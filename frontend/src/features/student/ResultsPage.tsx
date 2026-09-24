import { useHistory } from '../../api/student'
import { Card } from '../../components/ui/Card'
import { EmptyState, ErrorState, Spinner } from '../../components/ui/States'
import { useI18n } from '../../i18n/context'
import { HistoryList } from './HistoryList'

export function ResultsPage() {
  const { t } = useI18n()
  const history = useHistory()
  return (
    <div className="flex flex-col gap-5">
      <header>
        <h1 className="font-serif text-3xl font-bold text-ink sm:text-4xl">{t('results.title')}</h1>
        <p className="mt-1 text-muted">{t('results.subtitle')}</p>
      </header>
      <Card className="px-5 py-2 sm:px-6">
        {history.isPending ? (
          <Spinner />
        ) : history.isError ? (
          <ErrorState error={history.error} onRetry={() => history.refetch()} />
        ) : history.data.items.length ? (
          <HistoryList items={history.data.items} />
        ) : (
          <EmptyState title={t('results.empty')}>{t('results.emptyBody')}</EmptyState>
        )}
      </Card>
    </div>
  )
}
