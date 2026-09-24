import { AlertCircle, Inbox, LoaderCircle } from 'lucide-react'
import type { ReactNode } from 'react'
import { ApiError, NetworkError } from '../../api/client'
import { useI18n } from '../../i18n/context'
import { Button } from './Button'

export function Spinner({ label }: { label?: string }) {
  const { t } = useI18n()
  return (
    <div role="status" className="flex items-center justify-center gap-3 py-12 text-muted">
      <LoaderCircle className="size-5 animate-spin" aria-hidden="true" />
      <span>{label ?? t('common.loading')}</span>
    </div>
  )
}

export function ErrorState({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  const { t } = useI18n()
  const message =
    error instanceof NetworkError
      ? t('common.offline')
      : error instanceof ApiError && error.status < 500
        ? error.message
        : t('common.error')
  return (
    <div role="alert" className="flex flex-col items-center gap-3 py-10 text-center">
      <AlertCircle className="size-8 text-danger" aria-hidden="true" />
      <p className="max-w-sm text-muted">{message}</p>
      {onRetry && (
        <Button variant="secondary" onClick={onRetry}>
          {t('common.retry')}
        </Button>
      )}
    </div>
  )
}

export function EmptyState({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-2 py-8 text-center">
      <span className="grid size-12 place-items-center rounded-2xl bg-sky-soft text-secondary">
        <Inbox className="size-6" aria-hidden="true" />
      </span>
      <p className="font-semibold text-ink">{title}</p>
      {children && <div className="max-w-sm text-sm text-muted">{children}</div>}
    </div>
  )
}
