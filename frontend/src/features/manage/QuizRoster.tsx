import { useState } from 'react'
import { useQuizRoster } from '../../api/manage'
import type { RosterRow } from '../../api/types'
import { Avatar } from '../../components/ui/Avatar'
import { Badge, type Tone } from '../../components/ui/Badge'
import { EmptyState, ErrorState, Spinner } from '../../components/ui/States'
import { useI18n } from '../../i18n/context'
import type { MessageKey } from '../../i18n/en'
import { formatDateTime } from '../../lib/time'

type Filter = 'all' | 'notStarted' | 'inProgress' | 'finished'

function status(row: RosterRow): { key: MessageKey; tone: Tone } {
  if (!row.attempt) return { key: 'roster.notStarted', tone: 'warning' }
  if (row.attempt.status === 'IN_PROGRESS') return { key: 'results.status.IN_PROGRESS', tone: 'info' }
  if (row.attempt.status === 'EXPIRED') return { key: 'results.status.EXPIRED', tone: 'neutral' }
  return { key: 'results.status.SUBMITTED', tone: 'success' }
}

const matches: Record<Filter, (row: RosterRow) => boolean> = {
  all: () => true,
  notStarted: (row) => !row.attempt,
  inProgress: (row) => row.attempt?.status === 'IN_PROGRESS',
  finished: (row) => row.attempt !== null && row.attempt.status !== 'IN_PROGRESS',
}

/** Every student the quiz is meant for, so the teacher can see exactly who has not started. */
export function QuizRoster({ quizId }: { quizId: string }) {
  const { t, locale } = useI18n()
  const roster = useQuizRoster(quizId)
  const [filter, setFilter] = useState<Filter>('all')

  if (roster.isPending) return <Spinner />
  if (roster.isError) return <ErrorState error={roster.error} onRetry={() => roster.refetch()} />
  const { summary, items, quiz } = roster.data
  const counts: Record<Filter, number> = {
    all: items.length,
    notStarted: summary.notStarted,
    inProgress: summary.inProgress,
    finished: summary.submitted + summary.expired,
  }
  const rows = items.filter(matches[filter])

  return (
    <div className="flex flex-col gap-4 p-4 sm:p-5">
      <p className="text-sm text-muted">
        {quiz.audience === 'STUDENTS'
          ? t('roster.forNamed', { n: summary.assigned })
          : t('roster.forClasses', { classes: quiz.classes.map((c) => c.name).join(', ') || '—', n: summary.assigned })}
      </p>
      <div role="tablist" className="flex flex-wrap gap-1 self-start rounded-full bg-ivory p-1">
        {(['all', 'notStarted', 'inProgress', 'finished'] as const).map((value) => (
          <button
            key={value}
            type="button"
            role="tab"
            aria-selected={filter === value}
            onClick={() => setFilter(value)}
            className={`flex min-h-10 items-center gap-2 rounded-full px-3.5 text-sm font-semibold ${
              filter === value ? 'bg-primary text-white' : 'text-muted hover:text-primary'
            }`}
          >
            {t(`roster.filter.${value}`)}
            <span className={`rounded-full px-1.5 text-xs ${filter === value ? 'bg-white/20' : 'bg-surface'}`}>{counts[value]}</span>
          </button>
        ))}
      </div>
      {rows.length === 0 ? (
        <EmptyState title={t(filter === 'notStarted' ? 'roster.everyoneStarted' : 'roster.nobody')} />
      ) : (
        <ul className="divide-y divide-line">
          {rows.map((row) => {
            const state = status(row)
            return (
              <li key={row.student.id} className="flex items-center gap-3 py-3">
                <Avatar name={row.student.name} className="size-10 text-sm" />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold text-ink">
                    <bdi>{row.student.name}</bdi>
                  </p>
                  <p className="truncate text-xs text-muted">
                    <span dir="ltr">{row.student.username}</span>
                    {row.student.class && ` · ${row.student.class.name}`}
                    {row.attempt?.submittedAt && ` · ${formatDateTime(row.attempt.submittedAt, locale)}`}
                  </p>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1 sm:flex-row sm:items-center sm:gap-3">
                  {row.attempt?.percentage != null && (
                    <span className="font-serif text-lg font-bold text-ink">{Math.round(Number(row.attempt.percentage))}%</span>
                  )}
                  <Badge tone={state.tone}>{t(state.key)}</Badge>
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
