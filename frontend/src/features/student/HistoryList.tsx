import { CheckCircle2, ChevronRight, ClipboardCheck, TimerOff } from 'lucide-react'
import { Link } from 'react-router'
import type { HistoryItem } from '../../api/types'
import { Badge } from '../../components/ui/Badge'
import { useI18n } from '../../i18n/context'
import { formatDateTime } from '../../lib/time'

/** Finished and in-progress attempts, newest first, each linking to its result or back into the quiz. */
export function HistoryList({ items }: { items: HistoryItem[] }) {
  const { t, locale } = useI18n()
  return (
    <ul className="divide-y divide-line">
      {items.map((item) => {
        const finished = item.status !== 'IN_PROGRESS'
        const Icon = item.status === 'EXPIRED' ? TimerOff : finished ? CheckCircle2 : ClipboardCheck
        return (
          <li key={item.id}>
            <Link
              to={finished ? `/student/attempts/${item.id}/result` : `/student/attempts/${item.id}`}
              className="-mx-2 flex items-center gap-3 rounded-2xl px-2 py-4 hover:bg-ivory sm:gap-4"
            >
              <span
                className={`grid size-12 shrink-0 place-items-center rounded-2xl ${
                  item.status === 'EXPIRED' ? 'bg-gold-soft text-gold-ink' : finished ? 'bg-success-soft text-success' : 'bg-sky text-primary'
                }`}
              >
                <Icon className="size-6" aria-hidden="true" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate font-semibold text-ink">
                  <bdi>{item.quiz.title}</bdi>
                </span>
                <span className="block text-sm text-muted">
                  {finished
                    ? t(item.status === 'EXPIRED' ? 'history.expiredAt' : 'history.submittedAt', {
                        date: formatDateTime(item.submittedAt ?? item.deadlineAt, locale),
                      })
                    : t('history.startedAt', { date: formatDateTime(item.startedAt, locale) })}
                </span>
              </span>
              <span className="flex shrink-0 items-center gap-2">
                {finished && item.score !== null ? (
                  <span className="text-end">
                    <span className="block font-serif text-xl font-bold text-ink">{Math.round(Number(item.percentage))}%</span>
                    <span className="block text-xs text-muted">
                      {Number(item.score)} / {Number(item.maxScore)}
                    </span>
                  </span>
                ) : (
                  <Badge tone="info">{t('quiz.status.inProgress')}</Badge>
                )}
                <ChevronRight className="hidden size-5 text-muted sm:block rtl:-scale-x-100" aria-hidden="true" />
              </span>
            </Link>
          </li>
        )
      })}
    </ul>
  )
}
