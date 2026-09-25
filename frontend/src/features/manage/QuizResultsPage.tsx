import { ArrowLeft, Download, Pencil } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { Link, useParams } from 'react-router'
import { resultsExportUrl, useManagedQuiz, useQuizResults } from '../../api/manage'
import type { AttemptStatus, ResultRow } from '../../api/types'
import { Badge, type Tone } from '../../components/ui/Badge'
import { Button, ButtonLink } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { EmptyState, ErrorState, Spinner } from '../../components/ui/States'
import { useI18n } from '../../i18n/context'
import type { MessageKey } from '../../i18n/en'
import { formatDateTime } from '../../lib/time'
import { QuizRoster } from './QuizRoster'

const statusBadge: Record<AttemptStatus, { key: MessageKey; tone: Tone }> = {
  SUBMITTED: { key: 'results.status.SUBMITTED', tone: 'success' },
  EXPIRED: { key: 'results.status.EXPIRED', tone: 'warning' },
  IN_PROGRESS: { key: 'results.status.IN_PROGRESS', tone: 'info' },
}

function Stat({ label, value, sub }: { label: string; value: ReactNode; sub?: string }) {
  return (
    <Card className="p-4 sm:p-5">
      <p className="text-sm text-muted">{label}</p>
      <p className="font-serif text-2xl font-bold text-ink sm:text-3xl" dir="ltr">
        {value}
      </p>
      {sub && <p className="text-xs text-muted">{sub}</p>}
    </Card>
  )
}

const num = (value: string | null) => (value === null ? '—' : String(Number(value)))

function Score({ row }: { row: ResultRow }) {
  if (row.score === null) return <span className="text-muted">—</span>
  return (
    <span className="whitespace-nowrap" dir="ltr">
      <span className="font-semibold text-ink">{Number(row.score)}</span>
      <span className="text-muted"> / {Number(row.maxScore)}</span>
      <span className="ms-2 font-semibold text-primary">{Math.round(Number(row.percentage))}%</span>
    </span>
  )
}

export function QuizResultsPage() {
  const { id = '' } = useParams()
  const { t, locale } = useI18n()
  const [page, setPage] = useState(1)
  // Default to the class list: the first question is usually "who hasn't done it?"
  const [view, setView] = useState<'students' | 'attempts'>('students')
  const results = useQuizResults(id, page)
  const quiz = useManagedQuiz(id)

  const back = (
    <Link to="/manage/quizzes" className="inline-flex min-h-11 items-center gap-2 font-semibold text-secondary hover:text-primary">
      <ArrowLeft className="size-5 rtl:-scale-x-100" aria-hidden="true" />
      {t('nav.quizzes')}
    </Link>
  )

  if (results.isPending) return <Spinner />
  if (results.isError)
    return (
      <div className="flex flex-col gap-4">
        {back}
        <Card>
          <ErrorState error={results.error} onRetry={() => results.refetch()} />
        </Card>
      </div>
    )

  const { summary, items, total, pageSize } = results.data
  const pages = Math.max(1, Math.ceil(total / pageSize))
  const maxScore = quiz.data?.maxScore

  return (
    <div className="flex flex-col gap-5">
      <div>
        {back}
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div className="min-w-0">
            <p className="text-sm font-semibold text-muted">{t('results.teacherTitle')}</p>
            <h1 className="font-serif text-3xl font-bold break-words text-ink">
              <bdi>{results.data.quiz.title}</bdi>
            </h1>
          </div>
          <div className="flex gap-2">
            <ButtonLink to={`/manage/quizzes/${id}/edit`} variant="ghost">
              <Pencil className="size-4" aria-hidden="true" />
              {t('manage.edit')}
            </ButtonLink>
            {/* Same-origin link: the session cookie goes with it and the browser saves the CSV. */}
            <a
              href={resultsExportUrl(id)}
              download
              className="inline-flex min-h-11 items-center gap-2 rounded-full bg-primary px-5 text-sm font-semibold text-white shadow-card hover:bg-primary-deep"
            >
              <Download className="size-4" aria-hidden="true" />
              {t('results.export')}
            </a>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label={t('results.completed')} value={summary.completed} sub={t('results.inProgressCount', { n: summary.inProgress })} />
        <Stat
          label={t('results.average')}
          value={num(summary.averageScore)}
          sub={maxScore ? t('results.outOf', { n: Number(maxScore) }) : undefined}
        />
        <Stat label={t('results.highest')} value={num(summary.highestScore)} />
        <Stat label={t('results.lowest')} value={num(summary.lowestScore)} />
      </div>

      <div role="tablist" aria-label={t('results.teacherTitle')} className="flex gap-1 self-start rounded-full bg-surface p-1 shadow-card">
        {(
          [
            ['students', t('roster.tab.students')],
            ['attempts', t('roster.tab.attempts', { n: total })],
          ] as const
        ).map(([value, label]) => (
          <button
            key={value}
            type="button"
            role="tab"
            aria-selected={view === value}
            onClick={() => setView(value)}
            className={`min-h-10 rounded-full px-4 text-sm font-semibold ${
              view === value ? 'bg-primary text-white' : 'text-muted hover:text-primary'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <Card className="overflow-hidden">
        {view === 'students' ? (
          <QuizRoster quizId={id} />
        ) : items.length === 0 ? (
          <EmptyState title={t('results.none')}>{t('results.noneBody')}</EmptyState>
        ) : (
          <>
            {/* Phones: one card per student. */}
            <ul className="divide-y divide-line sm:hidden">
              {items.map((row) => (
                <li key={row.id} className="flex items-center gap-3 p-4">
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold">
                      <bdi>{row.student.name}</bdi>
                    </p>
                    <p className="text-xs text-muted" dir="ltr">
                      {row.student.username} · {row.student.class?.name ?? '—'}
                    </p>
                    <div className="mt-1">
                      <Badge tone={statusBadge[row.status].tone}>{t(statusBadge[row.status].key)}</Badge>
                    </div>
                  </div>
                  <Score row={row} />
                </li>
              ))}
            </ul>
            {/* Larger screens: a table. */}
            <table className="hidden w-full text-start text-sm sm:table">
              <thead className="bg-ivory text-muted">
                <tr>
                  <th className="px-5 py-3 text-start font-semibold">{t('results.col.student')}</th>
                  <th className="px-5 py-3 text-start font-semibold">{t('results.col.class')}</th>
                  <th className="px-5 py-3 text-start font-semibold">{t('results.col.status')}</th>
                  <th className="px-5 py-3 text-start font-semibold">{t('results.col.score')}</th>
                  <th className="px-5 py-3 text-start font-semibold">{t('results.col.submitted')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {items.map((row) => (
                  <tr key={row.id}>
                    <td className="px-5 py-3">
                      <p className="font-semibold">
                        <bdi>{row.student.name}</bdi>
                      </p>
                      <p className="text-xs text-muted">{row.student.username}</p>
                    </td>
                    <td className="px-5 py-3">{row.student.class?.name ?? '—'}</td>
                    <td className="px-5 py-3">
                      <Badge tone={statusBadge[row.status].tone}>{t(statusBadge[row.status].key)}</Badge>
                    </td>
                    <td className="px-5 py-3">
                      <Score row={row} />
                    </td>
                    <td className="px-5 py-3 text-muted">{row.submittedAt ? formatDateTime(row.submittedAt, locale) : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}
      </Card>

      {view === 'attempts' && pages > 1 && (
        <div className="flex items-center justify-center gap-3">
          <Button variant="secondary" disabled={page === 1} onClick={() => setPage(page - 1)}>
            {t('player.prev')}
          </Button>
          <span className="text-sm text-muted">{t('results.page', { page, pages })}</span>
          <Button variant="secondary" disabled={page === pages} onClick={() => setPage(page + 1)}>
            {t('player.next')}
          </Button>
        </div>
      )}
      {view === 'attempts' && <p className="text-xs text-muted">{t('results.footnote')}</p>}
    </div>
  )
}
