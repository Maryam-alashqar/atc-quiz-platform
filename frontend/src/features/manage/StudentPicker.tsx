import { Plus, Search, UserPlus, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useClasses, useStudentSearch } from '../../api/manage'
import type { StudentRef } from '../../api/types'
import { Button } from '../../components/ui/Button'
import { Spinner } from '../../components/ui/States'
import { useI18n } from '../../i18n/context'

const inputClass =
  'min-h-11 w-full rounded-xl border border-line bg-surface px-3.5 text-base outline-none placeholder:text-muted/60 focus:border-secondary focus:ring-4 focus:ring-sky disabled:cursor-not-allowed disabled:bg-ivory'

interface StudentPickerProps {
  selected: StudentRef[]
  onChange: (students: StudentRef[]) => void
  disabled?: boolean
}

/** Choose the named students a quiz is for: search by name, or filter a class and add all of it. */
export function StudentPicker({ selected, onChange, disabled = false }: StudentPickerProps) {
  const { t } = useI18n()
  const classes = useClasses()
  const [input, setInput] = useState('')
  const [search, setSearch] = useState('')
  const [classId, setClassId] = useState('')
  const lookingUp = Boolean(search.trim() || classId)
  const results = useStudentSearch(search, classId, lookingUp && !disabled)

  useEffect(() => {
    const timer = setTimeout(() => setSearch(input), 250)
    return () => clearTimeout(timer)
  }, [input])

  const chosen = new Set(selected.map((s) => s.id))
  const available = (results.data?.items ?? []).filter((s) => !chosen.has(s.id))
  const add = (students: StudentRef[]) => onChange([...selected, ...students.filter((s) => !chosen.has(s.id))])

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-2">
        {selected.length === 0 ? (
          <p className="text-sm text-muted">{t('picker.none')}</p>
        ) : (
          selected.map((student) => (
            <span key={student.id} className="inline-flex min-h-9 items-center gap-1.5 rounded-full bg-sky-soft ps-3 pe-1 text-sm text-ink">
              <bdi className="font-semibold">{student.name}</bdi>
              {student.class && <span className="text-muted">· {student.class.name}</span>}
              {!disabled && (
                <button
                  type="button"
                  onClick={() => onChange(selected.filter((s) => s.id !== student.id))}
                  aria-label={t('picker.remove', { name: student.name })}
                  className="grid size-7 place-items-center rounded-full text-muted hover:bg-surface hover:text-danger"
                >
                  <X className="size-4" aria-hidden="true" />
                </button>
              )}
            </span>
          ))
        )}
      </div>

      {!disabled && (
        <div className="rounded-2xl border border-line p-3">
          <div className="flex flex-wrap gap-2">
            <label className="relative min-w-44 flex-1">
              <span className="sr-only">{t('picker.search')}</span>
              <Search className="pointer-events-none absolute start-3.5 top-1/2 size-4 -translate-y-1/2 text-muted" aria-hidden="true" />
              <input
                type="search"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder={t('picker.search')}
                className={`${inputClass} ps-10`}
              />
            </label>
            <select value={classId} onChange={(e) => setClassId(e.target.value)} aria-label={t('results.col.class')} className={`${inputClass} w-auto!`}>
              <option value="">{t('users.allClasses')}</option>
              {classes.data?.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          {!lookingUp ? (
            <p className="mt-3 text-sm text-muted">{t('picker.hint')}</p>
          ) : results.isPending ? (
            <Spinner />
          ) : available.length === 0 ? (
            <p className="mt-3 text-sm text-muted">{t('picker.noMatches')}</p>
          ) : (
            <>
              {available.length > 1 && (
                <Button variant="ghost" className="mt-2" onClick={() => add(available)}>
                  <UserPlus className="size-4" aria-hidden="true" />
                  {t('picker.addAll', { n: available.length })}
                </Button>
              )}
              <ul className="mt-1 max-h-64 divide-y divide-line overflow-y-auto">
                {available.map((student) => (
                  <li key={student.id}>
                    <button
                      type="button"
                      onClick={() => add([student])}
                      className="flex min-h-11 w-full items-center gap-3 rounded-xl px-2 text-start hover:bg-ivory"
                    >
                      <Plus className="size-4 shrink-0 text-secondary" aria-hidden="true" />
                      <span className="min-w-0 flex-1 truncate">
                        <bdi className="font-semibold text-ink">{student.name}</bdi>
                        <span className="text-sm text-muted">
                          {' · '}
                          <span dir="ltr">{student.username}</span>
                          {student.class && ` · ${student.class.name}`}
                        </span>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      )}
    </div>
  )
}
