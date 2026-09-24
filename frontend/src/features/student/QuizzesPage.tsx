import { useSearchParams } from 'react-router'
import { useAvailableQuizzes, useHistory, useUpcomingQuizzes } from '../../api/student'
import { Card } from '../../components/ui/Card'
import { EmptyState, ErrorState, Spinner } from '../../components/ui/States'
import { useI18n } from '../../i18n/context'
import { HistoryList } from './HistoryList'
import { QuizRow } from './QuizRow'

const tabs = ['open', 'upcoming', 'completed'] as const
type Tab = (typeof tabs)[number]

export function QuizzesPage() {
  const { t } = useI18n()
  const [params, setParams] = useSearchParams()
  const tab: Tab = tabs.find((value) => value === params.get('tab')) ?? 'open'
  const available = useAvailableQuizzes()
  const upcoming = useUpcomingQuizzes()
  const history = useHistory()

  const query = tab === 'open' ? available : tab === 'upcoming' ? upcoming : history
  // Completed quizzes live in the history list, including ones that have since closed.
  const open = (available.data?.items ?? []).filter((quiz) => !quiz.attempt || quiz.attempt.status === 'IN_PROGRESS')
  const completed = (history.data?.items ?? []).filter((item) => item.status !== 'IN_PROGRESS')
  const counts: Record<Tab, number | undefined> = {
    open: available.data && open.length,
    upcoming: upcoming.data?.items.length,
    completed: history.data && completed.length,
  }

  return (
    <div className="flex flex-col gap-5">
      <header>
        <h1 className="font-serif text-3xl font-bold text-ink sm:text-4xl">{t('quizzes.title')}</h1>
        <p className="mt-1 text-muted">{t('quizzes.subtitle')}</p>
      </header>

      <div role="tablist" aria-label={t('quizzes.title')} className="flex gap-1 self-start rounded-full bg-surface p-1 shadow-card">
        {tabs.map((value) => (
          <button
            key={value}
            role="tab"
            type="button"
            aria-selected={tab === value}
            onClick={() => setParams(value === 'open' ? {} : { tab: value }, { replace: true })}
            className={`flex min-h-10 items-center gap-2 rounded-full px-4 text-sm font-semibold transition-colors ${
              tab === value ? 'bg-primary text-white' : 'text-muted hover:text-primary'
            }`}
          >
            {t(`quizzes.tab.${value}`)}
            {counts[value] !== undefined && (
              <span className={`rounded-full px-1.5 text-xs ${tab === value ? 'bg-white/20' : 'bg-ivory'}`}>{counts[value]}</span>
            )}
          </button>
        ))}
      </div>

      <Card className="px-5 py-2 sm:px-6" role="tabpanel">
        {query.isPending ? (
          <Spinner />
        ) : query.isError ? (
          <ErrorState error={query.error} onRetry={() => query.refetch()} />
        ) : tab === 'completed' ? (
          completed.length ? <HistoryList items={completed} /> : <EmptyState title={t('quizzes.empty.completed')} />
        ) : tab === 'upcoming' ? (
          upcoming.data?.items.length ? (
            <div className="divide-y divide-line">
              {upcoming.data.items.map((quiz, index) => (
                <QuizRow key={quiz.id} quiz={quiz} upcoming index={index} />
              ))}
            </div>
          ) : (
            <EmptyState title={t('quizzes.empty.upcoming')} />
          )
        ) : open.length ? (
          <div className="divide-y divide-line">
            {open.map((quiz, index) => (
              <QuizRow key={quiz.id} quiz={quiz} index={index} />
            ))}
          </div>
        ) : (
          <EmptyState title={t('quizzes.empty.open')}>{t('dash.noQuizzesBody')}</EmptyState>
        )}
      </Card>
    </div>
  )
}
