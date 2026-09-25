import { AlertTriangle, ArrowDown, ArrowLeft, ArrowUp, CheckCircle2, LoaderCircle, Lock, Plus, Trash2 } from 'lucide-react'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Link, useBlocker, useLocation, useNavigate, useParams } from 'react-router'
import { useTeachers } from '../../api/admin'
import { ApiError } from '../../api/client'
import { useClasses, useDeleteQuiz, useManagedQuiz, usePublishQuiz, useSaveQuiz } from '../../api/manage'
import type { NegativeMarking, TeacherQuizDetail } from '../../api/types'
import { useCurrentUser } from '../../app/useCurrentUser'
import { Badge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { Dialog } from '../../components/ui/Dialog'
import { ErrorState, Spinner } from '../../components/ui/States'
import { useI18n } from '../../i18n/context'
import { liveState } from './liveState'
import { StudentPicker } from './StudentPicker'
import {
  draftFromQuiz,
  emptyDraft,
  emptyQuestion,
  publishIssues,
  saveIssues,
  toQuizInput,
  totalPoints,
  type Issue,
  type QuestionDraft,
  type QuizDraft,
} from './quizForm'

const inputClass =
  'min-h-11 w-full rounded-xl border border-line bg-surface px-3.5 text-base outline-none placeholder:text-muted/60 focus:border-secondary focus:ring-4 focus:ring-sky disabled:cursor-not-allowed disabled:bg-ivory disabled:text-muted'

function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-sm font-semibold text-ink">{label}</span>
      {children}
      {hint && <span className="text-xs text-muted">{hint}</span>}
    </label>
  )
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <Card className="p-5 sm:p-6">
      <h2 className="mb-4 font-serif text-xl font-semibold">{title}</h2>
      {children}
    </Card>
  )
}

function IssueList({ issues }: { issues: Issue[] }) {
  const { t } = useI18n()
  return (
    <div role="alert" className="rounded-2xl bg-danger-soft p-4 text-sm text-danger">
      <p className="mb-1 flex items-center gap-2 font-semibold">
        <AlertTriangle className="size-4" aria-hidden="true" />
        {t('editor.fixFirst')}
      </p>
      <ul className="list-disc ps-6">
        {issues.map((issue, index) => (
          <li key={index}>
            {issue.question ? `${t('player.question', { i: issue.question })}: ` : ''}
            {t(issue.key, issue.vars)}
          </li>
        ))}
      </ul>
    </div>
  )
}

interface QuestionEditorProps {
  question: QuestionDraft
  index: number
  count: number
  locked: boolean
  dir: 'rtl' | 'ltr'
  onChange: (question: QuestionDraft) => void
  onMove: (delta: -1 | 1) => void
  onRemove: () => void
}

function QuestionEditor({ question, index, count, locked, dir, onChange, onMove, onRemove }: QuestionEditorProps) {
  const { t } = useI18n()
  const letters = dir === 'rtl' ? ['أ', 'ب', 'ج', 'د'] : ['A', 'B', 'C', 'D']
  return (
    <fieldset disabled={locked} className="rounded-2xl border border-line p-4 sm:p-5">
      <legend className="sr-only">{t('player.question', { i: index + 1 })}</legend>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <span className="font-semibold text-secondary">{t('player.question', { i: index + 1 })}</span>
        <span className="flex-1" />
        <label className="flex items-center gap-2 text-sm">
          <span className="text-muted">{t('editor.points')}</span>
          <input
            inputMode="decimal"
            value={question.points}
            onChange={(event) => onChange({ ...question, points: event.target.value })}
            className={`${inputClass} w-20! text-center`}
            dir="ltr"
          />
        </label>
        {!locked && (
          <>
            <Button variant="ghost" className="px-3!" onClick={() => onMove(-1)} disabled={index === 0} aria-label={t('editor.moveUp')}>
              <ArrowUp className="size-4" />
            </Button>
            <Button variant="ghost" className="px-3!" onClick={() => onMove(1)} disabled={index === count - 1} aria-label={t('editor.moveDown')}>
              <ArrowDown className="size-4" />
            </Button>
            <Button variant="ghost" className="px-3! text-danger hover:bg-danger-soft" onClick={onRemove} aria-label={t('editor.removeQuestion')}>
              <Trash2 className="size-4" />
            </Button>
          </>
        )}
      </div>
      <textarea
        dir={dir}
        rows={2}
        value={question.prompt}
        onChange={(event) => onChange({ ...question, prompt: event.target.value })}
        placeholder={t('editor.promptPlaceholder')}
        aria-label={t('editor.prompt')}
        className={`${inputClass} py-2.5`}
      />
      <div className="mt-3 flex flex-col gap-2" role="radiogroup" aria-label={t('editor.correctLabel')}>
        {question.options.map((text, optionIndex) => (
          <div key={optionIndex} className="flex items-center gap-2">
            <label
              className={`flex min-h-11 shrink-0 cursor-pointer items-center gap-2 rounded-xl px-2 text-sm font-semibold ${
                question.correct === optionIndex ? 'bg-success-soft text-success' : 'text-muted'
              }`}
            >
              <input
                type="radio"
                name={`correct-${question.key}`}
                checked={question.correct === optionIndex}
                onChange={() => onChange({ ...question, correct: optionIndex })}
                className="size-4 accent-success"
                aria-label={t('editor.markCorrect', { letter: letters[optionIndex] })}
              />
              {letters[optionIndex]}
            </label>
            <input
              dir={dir}
              value={text}
              onChange={(event) => {
                const options = [...question.options] as QuestionDraft['options']
                options[optionIndex] = event.target.value
                onChange({ ...question, options })
              }}
              placeholder={t('editor.optionPlaceholder', { letter: letters[optionIndex] })}
              aria-label={t('editor.optionPlaceholder', { letter: letters[optionIndex] })}
              className={inputClass}
            />
          </div>
        ))}
      </div>
    </fieldset>
  )
}

function Editor({ quiz }: { quiz?: TeacherQuizDetail }) {
  const { t } = useI18n()
  const navigate = useNavigate()
  const classes = useClasses()
  const save = useSaveQuiz(quiz?.id)
  const publish = usePublishQuiz()
  const remove = useDeleteQuiz()
  // The API needs a teacher as owner: the admin picks one when creating a quiz.
  const user = useCurrentUser()
  const isAdmin = user.role === 'ADMIN'
  const choosingOwner = !quiz && isAdmin
  const teachers = useTeachers(choosingOwner)
  const [teacherId, setTeacherId] = useState('')
  const [draft, setDraft] = useState<QuizDraft>(() => (quiz ? draftFromQuiz(quiz) : emptyDraft()))
  const [dirty, setDirty] = useState(false)
  // Read at navigation time, so a save that clears it and then redirects is never blocked.
  const dirtyRef = useRef(false)
  useEffect(() => {
    dirtyRef.current = dirty
  }, [dirty])
  // In-app navigation (sidebar, back link) would otherwise drop unsaved edits silently.
  const blocker = useBlocker(
    ({ currentLocation, nextLocation }) => dirtyRef.current && currentLocation.pathname !== nextLocation.pathname,
  )
  const [issues, setIssues] = useState<Issue[]>([])
  const [serverError, setServerError] = useState<string | null>(null)
  // A message carried over from the create → edit redirect.
  const location = useLocation()
  const [savedMessage, setSavedMessage] = useState<string | null>(
    () => (location.state as { saved?: string } | null)?.saved ?? null,
  )
  const [confirmDelete, setConfirmDelete] = useState(false)

  // Once a student has started, the API freezes everything except title and description.
  const locked = (quiz?.attemptCount ?? 0) > 0
  const published = quiz?.status === 'PUBLISHED'
  const dir = draft.language === 'AR' ? 'rtl' : 'ltr'
  const busy = save.isPending || publish.isPending || remove.isPending

  useEffect(() => {
    if (!dirty) return
    const handler = (event: BeforeUnloadEvent) => event.preventDefault()
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [dirty])

  function update(patch: Partial<QuizDraft>) {
    setDraft((current) => ({ ...current, ...patch }))
    setDirty(true)
    setSavedMessage(null)
  }

  function updateQuestion(index: number, question: QuestionDraft) {
    update({ questions: draft.questions.map((q, i) => (i === index ? question : q)) })
  }

  function moveQuestion(index: number, delta: -1 | 1) {
    const questions = [...draft.questions]
    const [moved] = questions.splice(index, 1)
    questions.splice(index + delta, 0, moved)
    update({ questions })
  }

  function apiMessage(error: unknown) {
    return error instanceof ApiError ? error.message : t('common.error')
  }

  async function persist(andPublish: boolean) {
    setServerError(null)
    // Published quizzes must stay complete, so they are checked like a publish.
    const found = locked ? [] : andPublish || published ? publishIssues(draft) : saveIssues(draft)
    if (locked && !draft.title.trim()) found.push({ key: 'editor.issue.title' })
    if (choosingOwner && !teacherId) found.unshift({ key: 'editor.issue.teacher' })
    setIssues(found)
    if (found.length) return
    const input = { ...toQuizInput(draft), ...(choosingOwner && { teacherId }) }
    try {
      const saved = await save.mutateAsync(locked ? { title: input.title, description: input.description } : input)
      dirtyRef.current = false
      setDirty(false)
      if (andPublish) await publish.mutateAsync(saved.id)
      setSavedMessage(t(andPublish ? 'editor.published' : 'editor.saved'))
      if (!quiz)
        navigate(`/manage/quizzes/${saved.id}/edit`, {
          replace: true,
          state: { saved: t(andPublish ? 'editor.published' : 'editor.saved') },
        })
    } catch (error) {
      setServerError(apiMessage(error))
    }
  }

  async function destroy() {
    if (!quiz) return
    try {
      await remove.mutateAsync(quiz.id)
      dirtyRef.current = false
      navigate('/manage/quizzes', { replace: true })
    } catch (error) {
      setConfirmDelete(false)
      setServerError(apiMessage(error))
    }
  }

  const state = quiz ? liveState(quiz) : null

  return (
    <div className="flex flex-col gap-5 pb-28">
      <div>
        <Link to="/manage/quizzes" className="inline-flex min-h-11 items-center gap-2 font-semibold text-secondary hover:text-primary">
          <ArrowLeft className="size-5 rtl:-scale-x-100" aria-hidden="true" />
          {t(isAdmin ? 'nav.allQuizzes' : 'nav.quizzes')}
        </Link>
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="font-serif text-3xl font-bold text-ink sm:text-4xl">{quiz ? t('editor.editTitle') : t('nav.newQuiz')}</h1>
          {state && <Badge tone={state.tone}>{t(state.key)}</Badge>}
        </div>
      </div>

      {locked && (
        <div className="flex gap-3 rounded-2xl bg-gold-soft p-4 text-sm text-ink">
          <Lock className="mt-0.5 size-5 shrink-0 text-gold-ink" aria-hidden="true" />
          <p>{t('editor.locked', { n: quiz?.attemptCount ?? 0 })}</p>
        </div>
      )}

      <Section title={t('editor.details')}>
        <div className="grid gap-4">
          {choosingOwner && (
            <Field label={t('editor.teacher')} hint={t('editor.teacherHint')}>
              <select
                value={teacherId}
                onChange={(e) => {
                  setTeacherId(e.target.value)
                  setDirty(true)
                }}
                className={inputClass}
              >
                <option value="">{teachers.isPending ? t('common.loading') : t('editor.chooseTeacher')}</option>
                {teachers.data?.items.map((teacher) => (
                  <option key={teacher.id} value={teacher.id}>
                    {teacher.name} ({teacher.username})
                  </option>
                ))}
              </select>
            </Field>
          )}
          {quiz && isAdmin && (
            <p className="text-sm text-muted">
              {t('manage.by')} <bdi className="font-semibold text-ink">{quiz.teacher.name}</bdi>
            </p>
          )}
          <Field label={t('editor.title')}>
            <input dir={dir} value={draft.title} onChange={(e) => update({ title: e.target.value })} maxLength={200} className={inputClass} />
          </Field>
          <Field label={t('editor.description')} hint={t('editor.descriptionHint')}>
            <textarea
              dir={dir}
              rows={2}
              value={draft.description}
              onChange={(e) => update({ description: e.target.value })}
              className={`${inputClass} py-2.5`}
            />
          </Field>
          <fieldset disabled={locked} className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <span className="text-sm font-semibold">{t('editor.language')}</span>
              <div className="flex gap-2">
                {(['EN', 'AR'] as const).map((language) => (
                  <label
                    key={language}
                    className={`flex min-h-11 flex-1 cursor-pointer items-center justify-center rounded-xl border text-sm font-semibold has-[:disabled]:cursor-not-allowed ${
                      draft.language === language ? 'border-primary bg-sky-soft text-primary' : 'border-line text-muted'
                    }`}
                  >
                    <input type="radio" name="language" className="sr-only" checked={draft.language === language} onChange={() => update({ language })} />
                    {language === 'AR' ? 'العربية' : 'English'}
                  </label>
                ))}
              </div>
            </div>
            <div className="flex flex-col gap-1.5 sm:col-span-2">
              <span className="text-sm font-semibold">{t('editor.audience')}</span>
              <div className="flex flex-col gap-2 sm:flex-row">
                {(['CLASSES', 'STUDENTS'] as const).map((audience) => (
                  <label
                    key={audience}
                    className={`flex min-h-11 flex-1 cursor-pointer items-center gap-3 rounded-xl border px-4 py-2 has-[:disabled]:cursor-not-allowed ${
                      draft.audience === audience ? 'border-primary bg-sky-soft' : 'border-line'
                    }`}
                  >
                    <input
                      type="radio"
                      name="audience"
                      className="size-4 accent-primary"
                      checked={draft.audience === audience}
                      onChange={() => update({ audience })}
                    />
                    <span>
                      <span className="block text-sm font-semibold text-ink">{t(`editor.audience.${audience}`)}</span>
                      <span className="block text-xs text-muted">{t(`editor.audience.${audience}.hint`)}</span>
                    </span>
                  </label>
                ))}
              </div>
            </div>
            {draft.audience === 'STUDENTS' ? (
              <div className="flex flex-col gap-1.5 sm:col-span-2">
                <span className="text-sm font-semibold">{t('editor.namedStudents', { n: draft.students.length })}</span>
                <StudentPicker selected={draft.students} onChange={(students) => update({ students })} disabled={locked} />
              </div>
            ) : (
            <div className="flex flex-col gap-1.5 sm:col-span-2">
              <span className="text-sm font-semibold">{t('editor.classes')}</span>
              {classes.isPending ? (
                <Spinner />
              ) : (
                <div className="flex flex-wrap gap-2">
                  {classes.data?.map((c) => {
                    const checked = draft.classIds.includes(c.id)
                    return (
                      <label
                        key={c.id}
                        className={`flex min-h-11 cursor-pointer items-center gap-2 rounded-xl border px-4 text-sm font-semibold has-[:disabled]:cursor-not-allowed ${
                          checked ? 'border-primary bg-sky-soft text-primary' : 'border-line text-muted'
                        }`}
                      >
                        <input
                          type="checkbox"
                          className="size-4 accent-primary"
                          checked={checked}
                          onChange={() =>
                            update({ classIds: checked ? draft.classIds.filter((id) => id !== c.id) : [...draft.classIds, c.id] })
                          }
                        />
                        {c.name}
                      </label>
                    )
                  })}
                </div>
              )}
            </div>
            )}
          </fieldset>
        </div>
      </Section>

      <Section title={t('editor.timing')}>
        <fieldset disabled={locked} className="grid gap-4 sm:grid-cols-3">
          <Field label={t('editor.opensAt')} hint={t('editor.ammanTime')}>
            <input type="datetime-local" value={draft.opensAt} onChange={(e) => update({ opensAt: e.target.value })} className={inputClass} />
          </Field>
          <Field label={t('editor.closesAt')} hint={t('editor.ammanTime')}>
            <input type="datetime-local" value={draft.closesAt} onChange={(e) => update({ closesAt: e.target.value })} className={inputClass} />
          </Field>
          <Field label={t('editor.duration')} hint={t('editor.durationHint')}>
            <input
              type="number"
              min={1}
              max={1440}
              inputMode="numeric"
              value={draft.durationMinutes}
              onChange={(e) => update({ durationMinutes: e.target.value })}
              className={inputClass}
            />
          </Field>
        </fieldset>
      </Section>

      <Section title={t('editor.marking')}>
        <fieldset disabled={locked} className="flex flex-col gap-3">
          <legend className="sr-only">{t('editor.marking')}</legend>
          {(['NONE', 'FRACTION', 'FIXED'] as NegativeMarking[]).map((mode) => (
            <label
              key={mode}
              className={`flex cursor-pointer gap-3 rounded-2xl border p-4 has-[:disabled]:cursor-not-allowed ${
                draft.negativeMarking === mode ? 'border-primary bg-sky-soft' : 'border-line'
              }`}
            >
              <input
                type="radio"
                name="marking"
                className="mt-1 size-4 accent-primary"
                checked={draft.negativeMarking === mode}
                onChange={() => update({ negativeMarking: mode, penalty: mode === 'FIXED' ? '0.5' : '25' })}
              />
              <span className="flex-1">
                <span className="block font-semibold">{t(`editor.marking.${mode}`)}</span>
                <span className="block text-sm text-muted">{t(`editor.marking.${mode}.hint`)}</span>
                {draft.negativeMarking === mode && mode !== 'NONE' && (
                  <span className="mt-3 flex items-center gap-2">
                    <input
                      inputMode="decimal"
                      dir="ltr"
                      value={draft.penalty}
                      onChange={(e) => update({ penalty: e.target.value })}
                      className={`${inputClass} w-24! text-center`}
                      aria-label={t(`editor.marking.${mode}`)}
                    />
                    <span className="text-sm text-muted">{t(mode === 'FRACTION' ? 'editor.penaltyPercent' : 'editor.penaltyPoints')}</span>
                  </span>
                )}
              </span>
            </label>
          ))}
        </fieldset>
      </Section>

      <Section title={t('editor.questionsTitle', { n: draft.questions.length, points: totalPoints(draft) })}>
        <div className="flex flex-col gap-4">
          {draft.questions.map((question, index) => (
            <QuestionEditor
              key={question.key}
              question={question}
              index={index}
              count={draft.questions.length}
              locked={locked}
              dir={dir}
              onChange={(q) => updateQuestion(index, q)}
              onMove={(delta) => moveQuestion(index, delta)}
              onRemove={() => update({ questions: draft.questions.filter((_, i) => i !== index) })}
            />
          ))}
          {!locked && (
            <Button variant="secondary" onClick={() => update({ questions: [...draft.questions, emptyQuestion()] })} className="self-start">
              <Plus className="size-4" aria-hidden="true" />
              {t('editor.addQuestion')}
            </Button>
          )}
        </div>
      </Section>

      {issues.length > 0 && <IssueList issues={issues} />}
      {serverError && (
        <p role="alert" className="rounded-2xl bg-danger-soft p-4 text-sm whitespace-pre-line text-danger">
          {serverError}
        </p>
      )}

      <div className="fixed inset-x-0 bottom-16 z-10 border-t border-line bg-surface/95 px-4 py-3 backdrop-blur lg:start-[calc(14rem+2.5rem)] lg:end-4 lg:bottom-4 lg:rounded-2xl lg:border lg:shadow-lift">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-3">
          {quiz && !locked && (
            <Button variant="ghost" className="text-danger hover:bg-danger-soft" onClick={() => setConfirmDelete(true)} disabled={busy}>
              <Trash2 className="size-4" aria-hidden="true" />
              <span className="hidden sm:inline">{t('editor.delete')}</span>
            </Button>
          )}
          <span className="flex-1 text-sm text-success" role="status">
            {savedMessage && (
              <span className="inline-flex items-center gap-1.5">
                <CheckCircle2 className="size-4" aria-hidden="true" />
                {savedMessage}
              </span>
            )}
          </span>
          <Button variant={published ? 'primary' : 'secondary'} onClick={() => void persist(false)} disabled={busy}>
            {save.isPending && !publish.isPending && <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />}
            {t(published ? 'editor.saveChanges' : 'editor.saveDraft')}
          </Button>
          {!published && (
            <Button onClick={() => void persist(true)} disabled={busy}>
              {publish.isPending && <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />}
              {t('editor.publish')}
            </Button>
          )}
        </div>
      </div>

      <Dialog
        open={blocker.state === 'blocked'}
        onClose={() => blocker.reset?.()}
        title={t('editor.leaveTitle')}
        actions={
          <>
            <Button variant="secondary" onClick={() => blocker.reset?.()}>
              {t('editor.stay')}
            </Button>
            <Button variant="danger" onClick={() => blocker.proceed?.()}>
              {t('editor.leave')}
            </Button>
          </>
        }
      >
        {t('editor.leaveBody')}
      </Dialog>

      <Dialog
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        title={t('editor.deleteTitle')}
        actions={
          <>
            <Button variant="secondary" onClick={() => setConfirmDelete(false)}>
              {t('common.cancel')}
            </Button>
            <Button variant="danger" onClick={() => void destroy()} disabled={remove.isPending}>
              {t('editor.delete')}
            </Button>
          </>
        }
      >
        {t('editor.deleteBody')}
      </Dialog>
    </div>
  )
}

export function QuizEditorPage() {
  const { id } = useParams()
  const quiz = useManagedQuiz(id)
  if (!id) return <Editor />
  if (quiz.isPending) return <Spinner />
  if (quiz.isError)
    return (
      <Card>
        <ErrorState error={quiz.error} onRetry={() => quiz.refetch()} />
      </Card>
    )
  // Keyed by id so switching quizzes resets the form.
  return <Editor key={quiz.data.id} quiz={quiz.data} />
}
