import { Info, Search } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useClasses, useMyStudents } from '../../api/manage'
import type { StudentProgressRow } from '../../api/types'
import { useCurrentUser } from '../../app/useCurrentUser'
import { Avatar } from '../../components/ui/Avatar'
import { Badge } from '../../components/ui/Badge'
import { Card } from '../../components/ui/Card'
import { EmptyState, ErrorState, Spinner } from '../../components/ui/States'
import { useI18n } from '../../i18n/context'

const inputClass =
  'min-h-11 w-full rounded-xl border border-line bg-surface px-3.5 text-base outline-none placeholder:text-muted/60 focus:border-secondary focus:ring-4 focus:ring-sky'

type Filter = 'all' | 'behind' | 'missed'

function Figures({ row }: { row: StudentProgressRow }) {
  const { t } = useI18n()
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Badge tone="info">{t('myStudents.done', { done: row.completed, total: row.assigned })}</Badge>
      {row.openNotStarted > 0 && <Badge tone="warning">{t('myStudents.toStart', { n: row.openNotStarted })}</Badge>}
      {row.missed > 0 && <Badge tone="danger">{t('myStudents.missed', { n: row.missed })}</Badge>}
    </div>
  )
}

/**
 * A teacher's students: everyone in the classes their quizzes are for, plus anyone they named.
 * Read-only: moving a student between classes affects every teacher, so it stays with the admin.
 */
export function MyStudentsPage() {
  const { t } = useI18n()
  const user = useCurrentUser()
  const students = useMyStudents()
  const classes = useClasses()
  const [search, setSearch] = useState('')
  const [classId, setClassId] = useState('')
  const [filter, setFilter] = useState<Filter>('all')

  const rows = useMemo(() => {
    const needle = search.trim().toLowerCase()
    return (students.data?.items ?? []).filter(
      (row) =>
        (!classId || row.student.class?.id === classId) &&
        (!needle || row.student.name.toLowerCase().includes(needle) || row.student.username.includes(needle)) &&
        (filter === 'all' || (filter === 'behind' ? row.openNotStarted > 0 : row.missed > 0)),
    )
  }, [students.data, search, classId, filter])

  const behind = students.data?.items.filter((row) => row.openNotStarted > 0).length ?? 0
  const missed = students.data?.items.filter((row) => row.missed > 0).length ?? 0
  const myClasses = new Map((students.data?.items ?? []).flatMap((row) => (row.student.class ? [[row.student.class.id, row.student.class.name]] : [])))

  return (
    <div className="flex flex-col gap-5">
      <header>
        <h1 className="font-serif text-3xl font-bold text-ink sm:text-4xl">{t('nav.myStudents')}</h1>
        <p className="mt-1 text-muted">{t(user.role === 'ADMIN' ? 'myStudents.subtitleAdmin' : 'myStudents.subtitle')}</p>
      </header>

      <div className="flex flex-wrap items-center gap-3">
        <div role="tablist" className="flex gap-1 rounded-full bg-surface p-1 shadow-card">
          {(
            [
              ['all', t('manage.filter.all'), students.data?.items.length],
              ['behind', t('myStudents.filter.behind'), behind],
              ['missed', t('myStudents.filter.missed'), missed],
            ] as const
          ).map(([value, label, count]) => (
            <button
              key={value}
              type="button"
              role="tab"
              aria-selected={filter === value}
              onClick={() => setFilter(value)}
              className={`flex min-h-10 items-center gap-2 rounded-full px-4 text-sm font-semibold ${
                filter === value ? 'bg-primary text-white' : 'text-muted hover:text-primary'
              }`}
            >
              {label}
              {count !== undefined && (
                <span className={`rounded-full px-1.5 text-xs ${filter === value ? 'bg-white/20' : 'bg-ivory'}`}>{count}</span>
              )}
            </button>
          ))}
        </div>
        <label className="relative min-w-48 flex-1">
          <span className="sr-only">{t('users.search')}</span>
          <Search className="pointer-events-none absolute start-3.5 top-1/2 size-4 -translate-y-1/2 text-muted" aria-hidden="true" />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t('users.search')}
            className={`${inputClass} ps-10`}
          />
        </label>
        <select
          value={classId}
          onChange={(e) => setClassId(e.target.value)}
          aria-label={t('results.col.class')}
          className={`${inputClass} w-auto!`}
        >
          <option value="">{t('users.allClasses')}</option>
          {(classes.data ?? [])
            .filter((c) => user.role === 'ADMIN' || myClasses.has(c.id))
            .map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
        </select>
      </div>

      <Card className="px-5 py-2 sm:px-6">
        {students.isPending ? (
          <Spinner />
        ) : students.isError ? (
          <ErrorState error={students.error} onRetry={() => students.refetch()} />
        ) : rows.length === 0 ? (
          <EmptyState title={t(students.data.items.length ? 'users.empty' : 'myStudents.none')}>
            {!students.data.items.length && t('myStudents.noneBody')}
          </EmptyState>
        ) : (
          <ul className="divide-y divide-line">
            {rows.map((row) => (
              <li key={row.student.id} className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:gap-4">
                <div className="flex min-w-0 flex-1 items-center gap-3">
                  <Avatar name={row.student.name} />
                  <div className="min-w-0">
                    <p className="truncate font-semibold text-ink">
                      <bdi>{row.student.name}</bdi>
                    </p>
                    <p className="truncate text-sm text-muted">
                      <span dir="ltr">{row.student.username}</span>
                      {row.student.class && ` · ${row.student.class.name}`}
                    </p>
                  </div>
                </div>
                <div className="flex items-center justify-between gap-4 ps-14 sm:ps-0">
                  <Figures row={row} />
                  <span className="w-14 shrink-0 text-end font-serif text-xl font-bold text-ink">
                    {row.averagePercent === null ? '—' : `${row.averagePercent}%`}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <p className="flex items-start gap-2 text-sm text-muted">
        <Info className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
        {t('myStudents.classNote')}
      </p>
    </div>
  )
}
