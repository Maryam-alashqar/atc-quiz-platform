import { useQueryClient } from '@tanstack/react-query'
import { AlarmClock, ArrowLeft, ArrowRight, Check, CloudOff, LoaderCircle, X } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, Navigate, useNavigate, useParams } from 'react-router'
import { meKey } from '../../api/auth'
import { ApiError } from '../../api/client'
import { saveAnswer, studentKeys, useAttempt, useSubmitAttempt } from '../../api/student'
import type { Attempt } from '../../api/types'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { Dialog } from '../../components/ui/Dialog'
import { ErrorState, Spinner } from '../../components/ui/States'
import { useI18n } from '../../i18n/context'
import { AnswerQueue, type SaveOutcome, type SaveStatus } from '../../lib/answerQueue'
import { formatCountdown, remainingMs } from '../../lib/time'
import { useCountdown } from './useCountdown'

const LETTERS = { EN: ['A', 'B', 'C', 'D'], AR: ['أ', 'ب', 'ج', 'د'] }

function SaveIndicator({ status }: { status: SaveStatus }) {
  const { t } = useI18n()
  const [Icon, label, tone] =
    status === 'saving'
      ? [LoaderCircle, t('player.saving'), 'text-muted']
      : status === 'retrying'
        ? [CloudOff, t('player.retrying'), 'text-gold-ink']
        : status === 'failed'
          ? [CloudOff, t('player.saveFailed'), 'text-danger']
          : [Check, t('player.saved'), 'text-success']
  return (
    <span role="status" className={`inline-flex items-center gap-1.5 text-xs font-medium ${tone}`}>
      <Icon className={`size-3.5 ${status === 'saving' ? 'animate-spin' : ''}`} aria-hidden="true" />
      {label}
    </span>
  )
}

function Timer({ ms }: { ms: number }) {
  const { t } = useI18n()
  const tone =
    ms <= 60_000 ? 'bg-danger text-white animate-pulse' : ms <= 5 * 60_000 ? 'bg-gold text-ink' : 'bg-primary text-white'
  const minutes = Math.ceil(ms / 60_000)
  return (
    <div className={`flex min-h-11 shrink-0 items-center gap-2 rounded-full px-4 font-semibold tabular-nums ${tone}`}>
      <AlarmClock className="size-5" aria-hidden="true" />
      <span aria-hidden="true" dir="ltr">
        {formatCountdown(ms)}
      </span>
      {/* Screen readers get a coarse, non-chatty version. */}
      <span className="sr-only">{t('player.timeLeft', { n: minutes })}</span>
    </div>
  )
}

function Player({ attempt }: { attempt: Attempt }) {
  const { t } = useI18n()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const submit = useSubmitAttempt(attempt.id)
  const questions = attempt.quiz.questions
  const lang = attempt.quiz.language
  const dir = lang === 'AR' ? 'rtl' : 'ltr'

  const [answers, setAnswers] = useState<Record<string, string | null>>(() =>
    Object.fromEntries(attempt.answers.map((answer) => [answer.questionId, answer.optionId])),
  )
  // Resume at the first unanswered question.
  const [index, setIndex] = useState(() => {
    const first = questions.findIndex((question) => !attempt.answers.some((a) => a.questionId === question.id))
    return first === -1 ? 0 : first
  })
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle')
  const [confirming, setConfirming] = useState(false)
  const [finishing, setFinishing] = useState<null | 'submit' | 'timeUp'>(null)
  const finishingRef = useRef(false)

  const goToResult = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: studentKeys.all })
    navigate(`/student/attempts/${attempt.id}/result`, { replace: true })
  }, [attempt.id, navigate, queryClient])

  const [queue] = useState(
    () =>
      new AnswerQueue({
        save: async (questionId, optionId): Promise<SaveOutcome> => {
          try {
            await saveAnswer(attempt.id, questionId, optionId)
            return { ok: true }
          } catch (error) {
            if (!(error instanceof ApiError) || error.status >= 500) return { ok: false, retry: true }
            if (error.status === 401) queryClient.setQueryData(meKey, null)
            // 409: the attempt was submitted or expired elsewhere.
            return { ok: false, retry: false, closed: error.status === 409 || error.status === 404 }
          }
        },
        onStatus: setSaveStatus,
        onClosed: goToResult,
      }),
  )

  const finish = useCallback(
    async (reason: 'submit' | 'timeUp') => {
      if (finishingRef.current) return
      finishingRef.current = true
      setFinishing(reason)
      setConfirming(false)
      await queue.flush()
      // Keep trying through short network drops while the server still accepts the submission.
      for (;;) {
        try {
          await submit.mutateAsync()
          break
        } catch (error) {
          const retryable = !(error instanceof ApiError) || error.status >= 500
          if (!retryable || remainingMs(attempt.graceEndsAt) === 0) break
          await new Promise((resolve) => setTimeout(resolve, 1500))
        }
      }
      // Whatever happened, the server has graded (or will lazily grade) the saved answers.
      goToResult()
    },
    [attempt.graceEndsAt, goToResult, queue, submit],
  )

  const remaining = useCountdown(attempt.deadlineAt, () => void finish('timeUp'))

  // Warn before closing the tab only while an answer is still unsaved.
  useEffect(() => {
    const handler = (event: BeforeUnloadEvent) => {
      if (queue.size > 0) event.preventDefault()
    }
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [queue])

  const question = questions[index]
  const selected = answers[question.id] ?? null
  const answeredCount = useMemo(() => questions.filter((q) => answers[q.id]).length, [answers, questions])
  const isLast = index === questions.length - 1

  function choose(optionId: string | null) {
    if (finishingRef.current) return
    setAnswers((current) => ({ ...current, [question.id]: optionId }))
    queue.enqueue(question.id, optionId)
  }

  return (
    <div className="min-h-dvh bg-ivory">
      <header className="sticky top-0 z-20 bg-surface/95 shadow-card backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center gap-3 px-4 py-2.5">
          <Link
            to="/student"
            aria-label={t('player.exit')}
            title={t('player.exit')}
            className="grid size-11 shrink-0 place-items-center rounded-full text-muted hover:bg-ivory hover:text-primary"
          >
            <X className="size-5" aria-hidden="true" />
          </Link>
          <div className="min-w-0 flex-1">
            <p className="truncate font-semibold text-ink">
              <bdi>{attempt.quiz.title}</bdi>
            </p>
            <div className="flex flex-wrap items-center gap-x-3 text-xs text-muted">
              <span>{t('player.progress', { i: index + 1, n: questions.length })}</span>
              <SaveIndicator status={saveStatus} />
            </div>
          </div>
          <Timer ms={remaining} />
        </div>
        <div className="h-1 bg-sky" aria-hidden="true">
          <div
            className="h-full bg-primary transition-[width] duration-300"
            style={{ width: `${(answeredCount / questions.length) * 100}%` }}
          />
        </div>
      </header>

      <main className="mx-auto grid max-w-5xl gap-5 px-4 pt-5 pb-32 lg:grid-cols-[1fr_17rem] lg:pb-10">
        <Card className="p-5 sm:p-8" dir={dir} lang={lang.toLowerCase()}>
          <div className="mb-4 flex items-center justify-between gap-3 text-sm">
            <span className="font-semibold text-secondary">
              {t('player.question', { i: index + 1 })}
            </span>
            <span className="rounded-full bg-sky-soft px-3 py-1 font-semibold text-primary">
              {t('common.points', { n: Number(question.points) })}
            </span>
          </div>
          <h1 className="text-lg leading-relaxed font-semibold break-words whitespace-pre-line text-ink sm:text-xl">
            {question.prompt}
          </h1>

          <div role="radiogroup" aria-label={t('player.options')} className="mt-6 flex flex-col gap-3">
            {question.options.map((option, optionIndex) => {
              const checked = selected === option.id
              return (
                <button
                  key={option.id}
                  type="button"
                  role="radio"
                  aria-checked={checked}
                  disabled={finishing !== null}
                  onClick={() => choose(option.id)}
                  className={`flex min-h-14 items-center gap-3 rounded-2xl border-2 p-3 text-start transition-colors sm:p-4 ${
                    checked
                      ? 'border-primary bg-sky-soft text-ink'
                      : 'border-line bg-surface hover:border-secondary hover:bg-ivory'
                  }`}
                >
                  <span
                    className={`grid size-9 shrink-0 place-items-center rounded-full font-bold ${
                      checked ? 'bg-primary text-white' : 'bg-ivory text-muted'
                    }`}
                  >
                    {LETTERS[lang][optionIndex] ?? optionIndex + 1}
                  </span>
                  <span className="min-w-0 flex-1 break-words">{option.text}</span>
                  {checked && <Check className="size-5 shrink-0 text-primary" aria-hidden="true" />}
                </button>
              )
            })}
          </div>

          {selected && (
            <button
              type="button"
              onClick={() => choose(null)}
              disabled={finishing !== null}
              className="mt-4 min-h-11 text-sm font-semibold text-muted underline-offset-4 hover:text-primary hover:underline"
            >
              {t('player.clear')}
            </button>
          )}

          <div className="mt-8 hidden items-center justify-between gap-3 lg:flex">
            <NavButtons
              index={index}
              isLast={isLast}
              onPrev={() => setIndex(index - 1)}
              onNext={() => setIndex(index + 1)}
              onReview={() => setConfirming(true)}
            />
          </div>
        </Card>

        <aside className="flex flex-col gap-4">
          <Card className="p-5">
            <p className="mb-3 text-sm font-semibold text-ink">
              {t('player.answered', { a: answeredCount, n: questions.length })}
            </p>
            <nav aria-label={t('player.navigator')} className="grid grid-cols-5 gap-2">
              {questions.map((q, i) => {
                const done = Boolean(answers[q.id])
                const current = i === index
                return (
                  <button
                    key={q.id}
                    type="button"
                    onClick={() => setIndex(i)}
                    aria-current={current ? 'step' : undefined}
                    aria-label={t(done ? 'player.navAnswered' : 'player.navUnanswered', { i: i + 1 })}
                    className={`grid aspect-square min-h-11 place-items-center rounded-xl text-sm font-semibold transition-colors ${
                      current
                        ? 'bg-primary text-white ring-2 ring-primary ring-offset-2'
                        : done
                          ? 'bg-sky text-primary'
                          : 'bg-ivory text-muted hover:bg-sky-soft'
                    }`}
                  >
                    {i + 1}
                  </button>
                )
              })}
            </nav>
            <Button className="mt-5 w-full" onClick={() => setConfirming(true)} disabled={finishing !== null}>
              {t('player.submit')}
            </Button>
          </Card>
        </aside>
      </main>

      {/* Phone navigation stays within thumb reach. */}
      <div className="fixed inset-x-0 bottom-0 z-20 border-t border-line bg-surface/95 px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur lg:hidden">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-3">
          <NavButtons
            index={index}
            isLast={isLast}
            onPrev={() => setIndex(index - 1)}
            onNext={() => setIndex(index + 1)}
            onReview={() => setConfirming(true)}
          />
        </div>
      </div>

      <Dialog
        open={confirming}
        onClose={() => setConfirming(false)}
        title={t('player.confirmTitle')}
        actions={
          <>
            <Button variant="secondary" onClick={() => setConfirming(false)}>
              {t('player.keepWorking')}
            </Button>
            <Button onClick={() => void finish('submit')}>{t('player.submit')}</Button>
          </>
        }
      >
        <p>{t('player.confirmAnswered', { a: answeredCount, n: questions.length })}</p>
        {answeredCount < questions.length && <p className="mt-2">{t('player.confirmUnanswered')}</p>}
        <p className="mt-2">{t('player.confirmFinal')}</p>
      </Dialog>

      {finishing && (
        <div role="alert" className="fixed inset-0 z-30 grid place-items-center bg-ink/60 p-6 backdrop-blur-sm">
          <Card className="flex max-w-sm flex-col items-center gap-3 p-8 text-center">
            {finishing === 'timeUp' ? (
              <AlarmClock className="size-10 text-gold" aria-hidden="true" />
            ) : (
              <LoaderCircle className="size-10 animate-spin text-primary" aria-hidden="true" />
            )}
            <p className="font-serif text-2xl font-semibold">
              {finishing === 'timeUp' ? t('player.timeUp') : t('player.submitting')}
            </p>
            <p className="text-muted">{t('player.finishingBody')}</p>
          </Card>
        </div>
      )}
    </div>
  )
}

interface NavButtonsProps {
  index: number
  isLast: boolean
  onPrev: () => void
  onNext: () => void
  onReview: () => void
}

function NavButtons({ index, isLast, onPrev, onNext, onReview }: NavButtonsProps) {
  const { t } = useI18n()
  return (
    <>
      <Button variant="secondary" onClick={onPrev} disabled={index === 0}>
        <ArrowLeft className="size-4 rtl:-scale-x-100" aria-hidden="true" />
        {t('player.prev')}
      </Button>
      {isLast ? (
        <Button onClick={onReview}>{t('player.finish')}</Button>
      ) : (
        <Button onClick={onNext}>
          {t('player.next')}
          <ArrowRight className="size-4 rtl:-scale-x-100" aria-hidden="true" />
        </Button>
      )}
    </>
  )
}

export function QuizPlayerPage() {
  const { id = '' } = useParams()
  const attempt = useAttempt(id)
  if (attempt.isPending) return <Spinner />
  if (attempt.isError)
    return (
      <div className="mx-auto max-w-md p-6">
        <Card>
          <ErrorState error={attempt.error} onRetry={() => attempt.refetch()} />
        </Card>
      </div>
    )
  if (attempt.data.status !== 'IN_PROGRESS') return <Navigate to={`/student/attempts/${id}/result`} replace />
  return <Player attempt={attempt.data} />
}
