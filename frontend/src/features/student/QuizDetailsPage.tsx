import { ArrowLeft, CalendarClock, Clock, ListChecks, LoaderCircle, Save, ShieldCheck, Star, TimerReset } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { ApiError } from '../../api/client'
import { useQuizDetails, useStartAttempt } from '../../api/student'
import { Button, ButtonLink } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { Dialog } from '../../components/ui/Dialog'
import { ErrorState, Spinner } from '../../components/ui/States'
import { useI18n } from '../../i18n/context'
import { formatDateTime } from '../../lib/time'
import { markingRule } from './marking'
import { quizState } from './quizState'
import { QuizStatusBadge } from './QuizRow'

function Fact({ icon, label, value }: { icon: ReactNode; label: string; value: ReactNode }) {
  return (
    <div className="flex items-center gap-3 rounded-2xl bg-ivory p-3.5">
      <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-surface text-primary shadow-card">{icon}</span>
      <span className="min-w-0">
        <span className="block text-xs text-muted">{label}</span>
        <span className="block font-semibold text-ink">{value}</span>
      </span>
    </div>
  )
}

export function QuizDetailsPage() {
  const { id = '' } = useParams()
  const { t, locale } = useI18n()
  const navigate = useNavigate()
  const details = useQuizDetails(id)
  const start = useStartAttempt()
  const [confirming, setConfirming] = useState(false)

  const back = (
    <Link to="/student/quizzes" className="inline-flex min-h-11 items-center gap-2 font-semibold text-secondary hover:text-primary">
      <ArrowLeft className="size-5 rtl:-scale-x-100" aria-hidden="true" />
      {t('nav.myQuizzes')}
    </Link>
  )

  if (details.isPending) return <Spinner />
  if (details.isError) {
    const unavailable = details.error instanceof ApiError && details.error.status === 404
    return (
      <div className="flex flex-col gap-4">
        {back}
        <Card>
          {unavailable ? (
            <div className="p-10 text-center">
              <p className="font-serif text-2xl font-semibold">{t('details.unavailable')}</p>
              <p className="mt-2 text-muted">{t('details.unavailableBody')}</p>
            </div>
          ) : (
            <ErrorState error={details.error} onRetry={() => details.refetch()} />
          )}
        </Card>
      </div>
    )
  }

  const quiz = details.data
  const state = quizState(quiz)
  const rule = markingRule(quiz.negativeMarking, quiz.penaltyValue)
  const dir = quiz.language === 'AR' ? 'rtl' : 'ltr'

  function begin() {
    start.mutate(quiz.id, {
      onSuccess: (attempt) => navigate(`/student/attempts/${attempt.id}`),
      onError: (error) => {
        // Already finished (e.g. in another tab): show the result instead of an error.
        const body = error instanceof ApiError ? (error.body as { attemptId?: string }) : undefined
        if (error instanceof ApiError && error.status === 409 && body?.attemptId)
          navigate(`/student/attempts/${body.attemptId}/result`, { replace: true })
      },
    })
  }

  return (
    <div className="flex flex-col gap-4 pb-20 sm:pb-0">
      {back}
      <Card className="overflow-hidden">
        <div className="bg-gradient-to-br from-sky-soft to-ivory p-6 sm:p-8">
          <div className="mb-3">
            <QuizStatusBadge quiz={quiz} state={state} />
          </div>
          <h1 dir={dir} lang={quiz.language.toLowerCase()} className="font-serif text-3xl font-bold break-words text-ink sm:text-4xl">
            {quiz.title}
          </h1>
          {quiz.description && (
            <p dir={dir} lang={quiz.language.toLowerCase()} className="mt-2 max-w-2xl whitespace-pre-line text-muted">
              {quiz.description}
            </p>
          )}
        </div>
        <div className="grid gap-3 p-5 sm:grid-cols-2 sm:p-8 lg:grid-cols-4">
          <Fact icon={<ListChecks className="size-5" />} label={t('details.questions')} value={quiz.questionCount} />
          <Fact icon={<Clock className="size-5" />} label={t('details.timeLimit')} value={t('common.minutes', { n: quiz.durationMinutes })} />
          <Fact icon={<Star className="size-5" />} label={t('details.totalPoints')} value={Number(quiz.maxScore)} />
          <Fact icon={<CalendarClock className="size-5" />} label={t('details.closes')} value={formatDateTime(quiz.closesAt, locale)} />
        </div>
      </Card>

      <Card className="p-5 sm:p-8">
        <h2 className="font-serif text-xl font-semibold">{t('details.before')}</h2>
        <ul className="mt-4 flex flex-col gap-4">
          {(
            [
              [TimerReset, t('details.rule.timer', { n: quiz.durationMinutes })],
              [Save, t('details.rule.saved')],
              [ShieldCheck, t('details.rule.once')],
              [Star, t(rule.key, rule.vars)],
            ] as const
          ).map(([Icon, text]) => (
            <li key={text} className="flex gap-3">
              <Icon className="mt-0.5 size-5 shrink-0 text-secondary" aria-hidden="true" />
              <span>{text}</span>
            </li>
          ))}
        </ul>
      </Card>

      {start.isError && !(start.error instanceof ApiError && start.error.status === 409) && (
        <Card>
          <ErrorState error={start.error} />
        </Card>
      )}

      <div className="fixed inset-x-0 bottom-16 z-10 bg-ivory/95 p-4 pb-[max(1rem,env(safe-area-inset-bottom))] backdrop-blur sm:static sm:bg-transparent sm:p-0">
        {state.kind === 'open' && (
          <Button size="lg" className="w-full sm:w-auto" onClick={() => setConfirming(true)}>
            {t('details.start')}
          </Button>
        )}
        {state.kind === 'inProgress' && (
          <ButtonLink to={`/student/attempts/${state.attemptId}`} size="lg" className="w-full sm:w-auto">
            {t('details.resume')}
          </ButtonLink>
        )}
        {state.kind === 'completed' && (
          <ButtonLink to={`/student/attempts/${state.attempt.id}/result`} size="lg" className="w-full sm:w-auto">
            {t('details.viewResult')}
          </ButtonLink>
        )}
      </div>

      <Dialog
        open={confirming}
        onClose={() => setConfirming(false)}
        title={t('details.confirmTitle')}
        actions={
          <>
            <Button variant="secondary" onClick={() => setConfirming(false)}>
              {t('common.cancel')}
            </Button>
            <Button onClick={begin} disabled={start.isPending}>
              {start.isPending && <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />}
              {t('details.confirmStart')}
            </Button>
          </>
        }
      >
        {t('details.confirmBody', { n: quiz.durationMinutes })}
      </Dialog>
    </div>
  )
}
