import { AlarmClock, CheckCircle2, Info } from 'lucide-react'
import { Navigate, useParams } from 'react-router'
import { useAttempt } from '../../api/student'
import { ButtonLink } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { ProgressRing } from '../../components/ui/ProgressRing'
import { ErrorState, Spinner } from '../../components/ui/States'
import { useI18n } from '../../i18n/context'
import { formatDateTime } from '../../lib/time'
import { markingRule } from './marking'

export function AttemptResultPage() {
  const { id = '' } = useParams()
  const { t, locale } = useI18n()
  const attempt = useAttempt(id)

  if (attempt.isPending) return <Spinner />
  if (attempt.isError)
    return (
      <Card>
        <ErrorState error={attempt.error} onRetry={() => attempt.refetch()} />
      </Card>
    )
  const data = attempt.data
  if (data.status === 'IN_PROGRESS') return <Navigate to={`/student/attempts/${id}`} replace />

  const percent = Number(data.percentage ?? 0)
  const answered = data.answers.length
  const total = data.quiz.questions.length
  const expired = data.status === 'EXPIRED'
  const rule = markingRule(data.quiz.negativeMarking, data.quiz.penaltyValue)

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-4">
      <Card className="overflow-hidden text-center">
        <div className="flex flex-col items-center gap-2 bg-gradient-to-b from-sky-soft to-surface px-6 pt-8 pb-4">
          {expired ? (
            <AlarmClock className="size-8 text-gold" aria-hidden="true" />
          ) : (
            <CheckCircle2 className="size-8 text-success" aria-hidden="true" />
          )}
          <h1 className="font-serif text-3xl font-bold text-ink">{expired ? t('result.expired') : t('result.submitted')}</h1>
          <p className="max-w-md text-muted">
            <bdi className="font-semibold text-ink">{data.quiz.title}</bdi>
          </p>
        </div>
        <div className="flex flex-col items-center gap-4 px-6 pb-8">
          <ProgressRing
            size={180}
            label={t('result.percentLabel', { percent: Math.round(percent) })}
            segments={[
              { value: percent, className: 'stroke-primary' },
              { value: 100 - percent, className: 'stroke-transparent' },
            ]}
          >
            <div>
              <p className="font-serif text-5xl font-bold text-ink">{Math.round(percent)}%</p>
            </div>
          </ProgressRing>
          <p className="text-lg">
            {t('result.score')}{' '}
            <span className="font-serif text-2xl font-bold text-ink">
              {t('result.scoreValue', { score: Number(data.score), max: Number(data.maxScore) })}
            </span>
          </p>
          <p className="text-muted">{t('result.answered', { a: answered, n: total })}</p>
          {data.submittedAt && (
            <p className="text-sm text-muted">
              {t(expired ? 'history.expiredAt' : 'history.submittedAt', { date: formatDateTime(data.submittedAt, locale) })}
            </p>
          )}
        </div>
      </Card>

      <Card className="flex gap-3 p-5">
        <Info className="mt-0.5 size-5 shrink-0 text-secondary" aria-hidden="true" />
        <div className="text-sm text-muted">
          {expired && <p className="mb-2">{t('result.expiredNote')}</p>}
          <p>{t(rule.key, rule.vars)}</p>
          <p className="mt-2">{t('result.noAnswers')}</p>
        </div>
      </Card>

      <div className="flex flex-col gap-3 sm:flex-row sm:justify-center">
        <ButtonLink to="/student" size="lg">
          {t('result.home')}
        </ButtonLink>
        <ButtonLink to="/student/results" variant="secondary" size="lg">
          {t('result.allResults')}
        </ButtonLink>
      </div>
    </div>
  )
}
