import { Check, Copy, KeyRound, Pencil, RefreshCw, Search, UserPlus } from 'lucide-react'
import { useEffect, useId, useState, type FormEvent } from 'react'
import { useSearchParams } from 'react-router'
import {
  useCreateUser,
  useResetPassword,
  useUpdateUser,
  useUsers,
  type ManagedRole,
  type ManagedUser,
} from '../../api/admin'
import { ApiError } from '../../api/client'
import { useClasses } from '../../api/manage'
import { Avatar } from '../../components/ui/Avatar'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { Dialog } from '../../components/ui/Dialog'
import { EmptyState, ErrorState, Spinner } from '../../components/ui/States'
import { useI18n } from '../../i18n/context'
import { generatePassword } from '../../lib/password'

const inputClass =
  'min-h-11 w-full rounded-xl border border-line bg-surface px-3.5 text-base outline-none placeholder:text-muted/60 focus:border-secondary focus:ring-4 focus:ring-sky'
const USERNAME = /^[a-z0-9][a-z0-9._-]{0,99}$/

function errorText(error: unknown, fallback: string) {
  return error instanceof ApiError && error.status < 500 ? error.message : fallback
}

/** Login details to hand over, shown once after creating an account or resetting a password. */
function Credentials({ username, password }: { username: string; password: string }) {
  const { t } = useI18n()
  const [copied, setCopied] = useState(false)
  async function copy() {
    try {
      await navigator.clipboard.writeText(`${t('auth.username')}: ${username}\n${t('auth.password')}: ${password}`)
      setCopied(true)
    } catch {
      // Clipboard can be blocked; the details are still visible to copy by hand.
    }
  }
  return (
    <div className="rounded-2xl bg-success-soft p-4 text-ink">
      <p className="mb-3 text-sm">{t('users.handOver')}</p>
      <dl className="grid grid-cols-[auto_1fr] items-baseline gap-x-4 gap-y-1 text-sm">
        <dt className="text-muted">{t('auth.username')}</dt>
        <dd className="font-mono font-semibold" dir="ltr">
          {username}
        </dd>
        <dt className="text-muted">{t('auth.password')}</dt>
        <dd className="font-mono font-semibold" dir="ltr">
          {password}
        </dd>
      </dl>
      <Button variant="secondary" className="mt-3" onClick={() => void copy()}>
        {copied ? <Check className="size-4" aria-hidden="true" /> : <Copy className="size-4" aria-hidden="true" />}
        {copied ? t('users.copied') : t('users.copy')}
      </Button>
    </div>
  )
}

function PasswordField({ value, onChange, id }: { value: string; onChange: (value: string) => void; id: string }) {
  const { t } = useI18n()
  return (
    <div className="flex gap-2">
      <input
        id={id}
        dir="ltr"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        autoComplete="new-password"
        minLength={8}
        maxLength={128}
        required
        className={`${inputClass} font-mono`}
      />
      <Button variant="secondary" className="shrink-0" onClick={() => onChange(generatePassword())}>
        <RefreshCw className="size-4" aria-hidden="true" />
        {t('users.generate')}
      </Button>
    </div>
  )
}

/** Mounted only while open, so every opening starts from a clean form on the current tab's role. */
function CreateUserDialog({ defaultRole, onClose }: { defaultRole: ManagedRole; onClose: () => void }) {
  const { t } = useI18n()
  const id = useId()
  const classes = useClasses()
  const create = useCreateUser()
  const [role, setRole] = useState<ManagedRole>(defaultRole)
  const [name, setName] = useState('')
  const [username, setUsername] = useState('')
  const [classId, setClassId] = useState('')
  const [password, setPassword] = useState(generatePassword)
  const [created, setCreated] = useState<{ username: string; password: string } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const close = onClose

  function submit(event: FormEvent) {
    event.preventDefault()
    const normalized = username.trim().toLowerCase()
    if (!USERNAME.test(normalized)) return setError(t('users.badUsername'))
    if (password.length < 8) return setError(t('users.shortPassword'))
    if (role === 'STUDENT' && !classId) return setError(t('users.needClass'))
    setError(null)
    create.mutate(
      { username: normalized, name: name.trim(), role, password, classId: role === 'STUDENT' ? classId : undefined },
      {
        onSuccess: (user) => setCreated({ username: user.username, password }),
        onError: (e) => setError(errorText(e, t('common.error'))),
      },
    )
  }

  return (
    <Dialog
      open
      onClose={close}
      title={t('users.addUser')}
      actions={
        created ? (
          <Button onClick={close}>{t('users.done')}</Button>
        ) : (
          <>
            <Button variant="secondary" onClick={close}>
              {t('common.cancel')}
            </Button>
            <Button type="submit" form={`${id}-form`} disabled={create.isPending || !name.trim() || !username.trim()}>
              {t('users.create')}
            </Button>
          </>
        )
      }
    >
      {created ? (
        <Credentials {...created} />
      ) : (
        <form id={`${id}-form`} onSubmit={submit} className="mt-2 flex flex-col gap-4 text-ink" noValidate>
          <fieldset>
            <legend className="mb-1.5 text-sm font-semibold">{t('users.accountType')}</legend>
            <div className="flex gap-2">
              {(['STUDENT', 'TEACHER'] as const).map((value) => (
                <label
                  key={value}
                  className={`flex min-h-11 flex-1 cursor-pointer items-center justify-center rounded-xl border text-sm font-semibold ${
                    role === value ? 'border-primary bg-sky-soft text-primary' : 'border-line text-muted'
                  }`}
                >
                  <input
                    type="radio"
                    name={`${id}-role`}
                    className="sr-only"
                    checked={role === value}
                    onChange={() => {
                      setRole(value)
                      setError(null)
                    }}
                  />
                  {t(`role.${value}`)}
                </label>
              ))}
            </div>
          </fieldset>
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-semibold">{t('users.name')}</span>
            <input dir="auto" value={name} onChange={(e) => setName(e.target.value)} maxLength={200} required className={inputClass} />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-semibold">{t('auth.username')}</span>
            <input
              dir="ltr"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoCapitalize="none"
              spellCheck={false}
              placeholder={role === 'STUDENT' ? 's10a-21' : 'teacher-arabic'}
              required
              className={inputClass}
            />
            <span className="text-xs text-muted">{t('users.usernameHint')}</span>
          </label>
          {role === 'STUDENT' && (
            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-semibold">{t('results.col.class')}</span>
              <select value={classId} onChange={(e) => setClassId(e.target.value)} required className={inputClass}>
                <option value="">{t('users.chooseClass')}</option>
                {classes.data?.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </label>
          )}
          <div className="flex flex-col gap-1.5">
            <label htmlFor={`${id}-password`} className="text-sm font-semibold">
              {t('users.initialPassword')}
            </label>
            <PasswordField id={`${id}-password`} value={password} onChange={setPassword} />
          </div>
          {error && (
            <p role="alert" className="rounded-xl bg-danger-soft px-3 py-2 text-sm text-danger">
              {error}
            </p>
          )}
        </form>
      )}
    </Dialog>
  )
}

function EditUserDialog({ user, onClose }: { user: ManagedUser; onClose: () => void }) {
  const { t } = useI18n()
  const id = useId()
  const classes = useClasses()
  const update = useUpdateUser()
  const [name, setName] = useState(user.name)
  const [classId, setClassId] = useState(user.class?.id ?? '')

  function submit(event: FormEvent) {
    event.preventDefault()
    const changes: { name?: string; classId?: string } = {}
    if (name.trim() !== user.name) changes.name = name.trim()
    if (user.role === 'STUDENT' && classId !== user.class?.id) changes.classId = classId
    if (!Object.keys(changes).length) return onClose()
    update.mutate({ id: user.id, ...changes }, { onSuccess: onClose })
  }

  return (
    <Dialog
      open
      onClose={onClose}
      title={t('users.edit')}
      actions={
        <>
          <Button variant="secondary" onClick={onClose}>
            {t('common.cancel')}
          </Button>
          <Button type="submit" form={`${id}-form`} disabled={update.isPending || !name.trim()}>
            {t('users.save')}
          </Button>
        </>
      }
    >
      <form id={`${id}-form`} onSubmit={submit} className="mt-2 flex flex-col gap-4 text-ink">
        <p className="text-sm text-muted" dir="ltr">
          {user.username}
        </p>
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-semibold">{t('users.name')}</span>
          <input dir="auto" value={name} onChange={(e) => setName(e.target.value)} maxLength={200} className={inputClass} />
        </label>
        {user.role === 'STUDENT' && (
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-semibold">{t('results.col.class')}</span>
            <select value={classId} onChange={(e) => setClassId(e.target.value)} className={inputClass}>
              {classes.data?.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
            <span className="text-xs text-muted">{t('users.moveHint')}</span>
          </label>
        )}
        {update.isError && (
          <p role="alert" className="rounded-xl bg-danger-soft px-3 py-2 text-sm text-danger">
            {errorText(update.error, t('common.error'))}
          </p>
        )}
      </form>
    </Dialog>
  )
}

function ResetPasswordDialog({ user, onClose }: { user: ManagedUser; onClose: () => void }) {
  const { t } = useI18n()
  const id = useId()
  const reset = useResetPassword()
  const [password, setPassword] = useState(generatePassword)
  const [done, setDone] = useState(false)

  return (
    <Dialog
      open
      onClose={onClose}
      title={t('users.resetTitle', { name: user.name })}
      actions={
        done ? (
          <Button onClick={onClose}>{t('users.done')}</Button>
        ) : (
          <>
            <Button variant="secondary" onClick={onClose}>
              {t('common.cancel')}
            </Button>
            <Button
              disabled={reset.isPending || password.length < 8}
              onClick={() => reset.mutate({ id: user.id, password }, { onSuccess: () => setDone(true) })}
            >
              {t('users.resetConfirm')}
            </Button>
          </>
        )
      }
    >
      {done ? (
        <Credentials username={user.username} password={password} />
      ) : (
        <div className="mt-2 flex flex-col gap-2 text-ink">
          <label htmlFor={`${id}-password`} className="text-sm font-semibold">
            {t('users.newPassword')}
          </label>
          <PasswordField id={`${id}-password`} value={password} onChange={setPassword} />
          <p className="text-xs text-muted">{t('users.resetHint')}</p>
          {reset.isError && (
            <p role="alert" className="rounded-xl bg-danger-soft px-3 py-2 text-sm text-danger">
              {errorText(reset.error, t('common.error'))}
            </p>
          )}
        </div>
      )}
    </Dialog>
  )
}

export function UsersPage() {
  const { t } = useI18n()
  const [params, setParams] = useSearchParams()
  const role: ManagedRole = params.get('role') === 'TEACHER' ? 'TEACHER' : 'STUDENT'
  const classId = role === 'STUDENT' ? (params.get('classId') ?? '') : ''
  const [searchInput, setSearchInput] = useState(params.get('search') ?? '')
  const [search, setSearch] = useState(searchInput)
  const [page, setPage] = useState(1)
  const [creating, setCreating] = useState(false)
  const [editing, setEditing] = useState<ManagedUser | null>(null)
  const [resetting, setResetting] = useState<ManagedUser | null>(null)
  const classes = useClasses()
  const users = useUsers({ role, classId: classId || undefined, search, page })

  // Search as the admin types, without a request per keystroke.
  useEffect(() => {
    const timer = setTimeout(() => {
      setSearch(searchInput)
      setPage(1)
    }, 300)
    return () => clearTimeout(timer)
  }, [searchInput])

  function setFilter(next: Record<string, string>) {
    const merged = { role, classId, search: searchInput, ...next }
    setParams(Object.fromEntries(Object.entries(merged).filter(([, value]) => value && value !== 'STUDENT')), { replace: true })
    setPage(1)
  }

  const pages = users.data ? Math.max(1, Math.ceil(users.data.total / users.data.pageSize)) : 1

  return (
    <div className="flex flex-col gap-5">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-serif text-3xl font-bold text-ink sm:text-4xl">{t('users.title')}</h1>
          <p className="mt-1 text-muted">{t('users.subtitle')}</p>
        </div>
        <Button onClick={() => setCreating(true)}>
          <UserPlus className="size-4" aria-hidden="true" />
          {t('users.addUser')}
        </Button>
      </header>

      <div className="flex flex-wrap items-center gap-3">
        <div role="tablist" className="flex gap-1 rounded-full bg-surface p-1 shadow-card">
          {(['STUDENT', 'TEACHER'] as const).map((value) => (
            <button
              key={value}
              type="button"
              role="tab"
              aria-selected={role === value}
              onClick={() => setFilter({ role: value, classId: '' })}
              className={`min-h-10 rounded-full px-4 text-sm font-semibold ${
                role === value ? 'bg-primary text-white' : 'text-muted hover:text-primary'
              }`}
            >
              {t(value === 'STUDENT' ? 'users.students' : 'users.teachers')}
            </button>
          ))}
        </div>
        <label className="relative min-w-48 flex-1">
          <span className="sr-only">{t('users.search')}</span>
          <Search className="pointer-events-none absolute start-3.5 top-1/2 size-4 -translate-y-1/2 text-muted" aria-hidden="true" />
          <input
            type="search"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder={t('users.search')}
            className={`${inputClass} ps-10`}
          />
        </label>
        {role === 'STUDENT' && (
          <select
            value={classId}
            onChange={(e) => setFilter({ classId: e.target.value })}
            aria-label={t('results.col.class')}
            className={`${inputClass} w-auto!`}
          >
            <option value="">{t('users.allClasses')}</option>
            {classes.data?.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        )}
      </div>

      <Card className="px-5 py-2 sm:px-6">
        {users.isPending ? (
          <Spinner />
        ) : users.isError ? (
          <ErrorState error={users.error} onRetry={() => users.refetch()} />
        ) : users.data.items.length === 0 ? (
          <EmptyState title={t('users.empty')} />
        ) : (
          <ul className="divide-y divide-line">
            {users.data.items.map((user) => (
              <li key={user.id} className="flex items-center gap-3 py-3">
                <Avatar name={user.name} />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold text-ink">
                    <bdi>{user.name}</bdi>
                  </p>
                  <p className="truncate text-sm text-muted">
                    <span dir="ltr">{user.username}</span>
                    {user.class && ` · ${user.class.name}`}
                    {' · '}
                    {user.role === 'STUDENT'
                      ? t('users.attempts', { n: user.attemptCount })
                      : t('users.quizzes', { n: user.quizCount })}
                  </p>
                </div>
                <Button variant="ghost" className="px-3!" onClick={() => setEditing(user)} aria-label={t('users.edit')} title={t('users.edit')}>
                  <Pencil className="size-4" aria-hidden="true" />
                </Button>
                <Button
                  variant="ghost"
                  className="px-3!"
                  onClick={() => setResetting(user)}
                  aria-label={t('users.resetTitle', { name: user.name })}
                  title={t('users.reset')}
                >
                  <KeyRound className="size-4" aria-hidden="true" />
                </Button>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {pages > 1 && (
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

      {creating && <CreateUserDialog defaultRole={role} onClose={() => setCreating(false)} />}
      {editing && <EditUserDialog user={editing} onClose={() => setEditing(null)} />}
      {resetting && <ResetPasswordDialog user={resetting} onClose={() => setResetting(null)} />}
    </div>
  )
}
