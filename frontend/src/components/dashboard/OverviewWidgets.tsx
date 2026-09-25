import { CheckCircle2, ChevronRight, TimerOff, UserRound } from 'lucide-react'
import { Link } from 'react-router'
import type { Overview, QuizFollowUp, Rate } from '../../api/admin'
import { useI18n } from '../../i18n/context'
import { daysUntil, formatDate, formatDateTime } from '../../lib/time'
import { Badge } from '../ui/Badge'
import { ProgressRing } from '../ui/ProgressRing'
import { EmptyState } from '../ui/States'

/** One labelled bar: how many of the expected attempts were completed, plus the average score. */
export function ParticipationBar({ label, sub, rate }: { label: string; sub: string; rate: Rate }) {
  const { t } = useI18n()
  const value = rate.participation ?? 0
  return (
    <div>
      <div className="mb-1.5 flex items-baseline justify-between gap-3">
        <span className="min-w-0 truncate font-semibold text-ink">
          <bdi>{label}</bdi>
        </span>
        <span className="shrink-0 font-serif text-lg font-bold text-ink">
          {rate.participation === null ? '—' : `${rate.participation}%`}
        </span>
      </div>
      <div
        className="h-2.5 overflow-hidden rounded-full bg-ivory"
        role="progressbar"
        aria-label={label}
        aria-valuenow={value}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <div className="h-full rounded-full bg-primary transition-[width]" style={{ width: `${value}%` }} />
      </div>
      <p className="mt-1 text-xs text-muted">
        {sub}
        {' · '}
        {rate.expected ? t('admin.rateDetail', { done: rate.completed, expected: rate.expected }) : t('admin.nothingYet')}
        {rate.averagePercent !== null && ` · ${t('admin.avgScore', { n: rate.averagePercent })}`}
      </p>
    </div>
  )
}

export function QuizStatusRing({ counts }: { counts: Overview['counts'] }) {
  const { t } = useI18n()
  const rows = [
    ['manage.state.live', counts.liveQuizzes, 'stroke-success', 'bg-success'],
    ['manage.state.scheduled', counts.scheduledQuizzes, 'stroke-gold', 'bg-gold'],
    ['manage.state.closed', counts.closedQuizzes, 'stroke-secondary', 'bg-secondary'],
    ['manage.state.draft', counts.draftQuizzes, 'stroke-line', 'bg-line'],
  ] as const
  const total = rows.reduce((sum, [, value]) => sum + value, 0)
  return (
    <div className="flex flex-col items-center gap-6 sm:flex-row lg:flex-col xl:flex-row">
      <ProgressRing label={t('admin.quizStatus')} segments={rows.map(([, value, stroke]) => ({ value, className: stroke }))}>
        <div>
          <p className="font-serif text-3xl font-bold text-ink">{total}</p>
          <p className="text-xs text-muted">{t('admin.quizzesTotal')}</p>
        </div>
      </ProgressRing>
      <dl className="flex w-full flex-col gap-3 text-sm">
        {rows.map(([key, value, , dot]) => (
          <div key={key} className="flex items-center gap-3">
            <span className={`size-3 rounded-full ${dot}`} aria-hidden="true" />
            <dt className="flex-1 text-muted">{t(key)}</dt>
            <dd className="font-semibold text-ink">{value}</dd>
          </div>
        ))}
      </dl>
    </div>
  )
}

export function RecentSubmissions({ items }: { items: Overview['recent'] }) {
  const { t, locale } = useI18n()
  if (items.length === 0) return <EmptyState title={t('dash.noActivity')} />
  return (
    <ul className="divide-y divide-line">
      {items.map((item) => {
        const Icon = item.status === 'EXPIRED' ? TimerOff : CheckCircle2
        return (
          <li key={item.id}>
            <Link to={`/manage/quizzes/${item.quiz.id}/results`} className="-mx-2 flex items-center gap-3 rounded-2xl px-2 py-3 hover:bg-ivory">
              <span className="grid size-10 shrink-0 place-items-center rounded-full bg-gold-soft text-gold-ink">
                <Icon className="size-5" aria-hidden="true" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-semibold text-ink">
                  <bdi>{item.student.name}</bdi>
                  {item.student.className && <span className="font-normal text-muted"> · {item.student.className}</span>}
                </span>
                <span className="block truncate text-xs text-muted">
                  <bdi>{item.quiz.title}</bdi> · {formatDateTime(item.submittedAt, locale)}
                </span>
              </span>
              <span className="shrink-0 font-serif text-lg font-bold text-ink">{Math.round(Number(item.percentage))}%</span>
            </Link>
          </li>
        )
      })}
    </ul>
  )
}

/**
 * Per-quiz follow-up: a stacked bar of finished / in progress / not started, and a link to
 * the list of exactly who has not started.
 */
export function QuizFollowUpList({ quizzes }: { quizzes: QuizFollowUp[] }) {
  const { t, locale } = useI18n()
  if (quizzes.length === 0) return <EmptyState title={t('teacher.noOpenQuizzes')}>{t('teacher.noOpenQuizzesBody')}</EmptyState>
  return (
    <ul className="divide-y divide-line">
      {quizzes.map((quiz) => {
        const share = (n: number) => (quiz.expected ? (n / quiz.expected) * 100 : 0)
        const days = daysUntil(quiz.closesAt)
        return (
          <li key={quiz.id}>
            <Link to={`/manage/quizzes/${quiz.id}/results`} className="-mx-2 block rounded-2xl px-2 py-4 hover:bg-ivory">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate font-semibold text-ink">
                    <bdi>{quiz.title}</bdi>
                  </p>
                  <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-muted">
                    {quiz.audience === 'STUDENTS' && (
                      <span className="inline-flex items-center gap-1">
                        <UserRound className="size-3.5" aria-hidden="true" />
                        {t('teacher.namedStudents')}
                      </span>
                    )}
                    <span>
                      {quiz.open
                        ? days <= 0
                          ? t('teacher.closesToday')
                          : t('teacher.closesOn', { date: formatDate(quiz.closesAt, locale) })
                        : t('teacher.closedOn', { date: formatDate(quiz.closesAt, locale) })}
                    </span>
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  {quiz.notStarted > 0 ? (
                    <Badge tone={quiz.open ? 'warning' : 'neutral'}>{t('teacher.notStartedCount', { n: quiz.notStarted })}</Badge>
                  ) : (
                    <Badge tone="success">{t('teacher.allDone')}</Badge>
                  )}
                  <ChevronRight className="size-5 text-muted rtl:-scale-x-100" aria-hidden="true" />
                </div>
              </div>
              <div
                className="mt-3 flex h-2.5 overflow-hidden rounded-full bg-ivory"
                role="img"
                aria-label={t('teacher.progressLabel', { done: quiz.completed, total: quiz.expected })}
              >
                <div className="bg-primary" style={{ width: `${share(quiz.completed)}%` }} />
                <div className="bg-gold" style={{ width: `${share(quiz.inProgress)}%` }} />
              </div>
              <p className="mt-1.5 text-xs text-muted">
                {t('teacher.progressLine', { done: quiz.completed, total: quiz.expected, active: quiz.inProgress })}
                {quiz.averagePercent !== null && ` · ${t('admin.avgScore', { n: quiz.averagePercent })}`}
              </p>
            </Link>
          </li>
        )
      })}
    </ul>
  )
}
