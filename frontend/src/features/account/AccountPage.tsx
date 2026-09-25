import { CheckCircle2, Eye, EyeOff, KeyRound, LoaderCircle } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { useChangePassword } from '../../api/auth'
import { ApiError, NetworkError } from '../../api/client'
import { useCurrentUser } from '../../app/useCurrentUser'
import { Avatar } from '../../components/ui/Avatar'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { useI18n } from '../../i18n/context'

const inputClass =
  'min-h-12 w-full rounded-2xl border border-line bg-surface ps-4 pe-12 text-base outline-none focus:border-secondary focus:ring-4 focus:ring-sky'

function PasswordInput({
  label,
  value,
  onChange,
  autoComplete,
}: {
  label: string
  value: string
  onChange: (value: string) => void
  autoComplete: string
}) {
  const { t } = useI18n()
  const [visible, setVisible] = useState(false)
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-sm font-semibold">{label}</span>
      <span className="relative">
        <input
          type={visible ? 'text' : 'password'}
          dir="ltr"
          autoComplete={autoComplete}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          maxLength={128}
          className={inputClass}
        />
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          aria-label={visible ? t('auth.hidePassword') : t('auth.showPassword')}
          className="absolute inset-y-0 end-0 grid w-12 place-items-center text-muted hover:text-primary"
        >
          {visible ? <EyeOff className="size-5" /> : <Eye className="size-5" />}
        </button>
      </span>
    </label>
  )
}

/** Every signed-in user can replace the first password the admin gave them. */
export function AccountPage() {
  const { t } = useI18n()
  const user = useCurrentUser()
  const change = useChangePassword()
  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [confirm, setConfirm] = useState('')
  const [problem, setProblem] = useState<string | null>(null)
  const [done, setDone] = useState(false)

  function submit(event: FormEvent) {
    event.preventDefault()
    setDone(false)
    if (next.length < 8) return setProblem(t('users.shortPassword'))
    if (next !== confirm) return setProblem(t('account.mismatch'))
    if (next === current) return setProblem(t('account.same'))
    setProblem(null)
    change.mutate(
      { currentPassword: current, newPassword: next },
      {
        onSuccess: () => {
          setDone(true)
          setCurrent('')
          setNext('')
          setConfirm('')
        },
        onError: (error) =>
          setProblem(
            error instanceof NetworkError
              ? t('common.offline')
              : error instanceof ApiError && error.status === 429
                ? t('auth.tooMany')
                : error instanceof ApiError && error.message === 'Current password is incorrect'
                  ? t('account.wrongCurrent')
                  : error instanceof ApiError && error.status < 500
                    ? error.message
                    : t('common.error'),
          ),
      },
    )
  }

  return (
    <div className="mx-auto flex max-w-lg flex-col gap-5">
      <header>
        <h1 className="font-serif text-3xl font-bold text-ink sm:text-4xl">{t('account.title')}</h1>
      </header>

      <Card className="flex items-center gap-4 p-5">
        <Avatar name={user.name} />
        <div className="min-w-0">
          <p className="truncate font-semibold text-ink">
            <bdi>{user.name}</bdi>
          </p>
          <p className="text-sm text-muted">
            <span dir="ltr">{user.username}</span> · {t(`role.${user.role}`)}
            {user.className && ` · ${user.className}`}
          </p>
        </div>
      </Card>

      <Card className="p-5 sm:p-6">
        <h2 className="mb-1 flex items-center gap-2 font-serif text-xl font-semibold">
          <KeyRound className="size-5 text-secondary" aria-hidden="true" />
          {t('account.changePassword')}
        </h2>
        <p className="mb-5 text-sm text-muted">{t('account.hint')}</p>
        <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
          <PasswordInput label={t('account.current')} value={current} onChange={setCurrent} autoComplete="current-password" />
          <PasswordInput label={t('users.newPassword')} value={next} onChange={setNext} autoComplete="new-password" />
          <PasswordInput label={t('account.confirm')} value={confirm} onChange={setConfirm} autoComplete="new-password" />
          {problem && (
            <p role="alert" className="rounded-2xl bg-danger-soft px-4 py-3 text-sm text-danger">
              {problem}
            </p>
          )}
          {done && (
            <p role="status" className="flex items-center gap-2 rounded-2xl bg-success-soft px-4 py-3 text-sm text-success">
              <CheckCircle2 className="size-4" aria-hidden="true" />
              {t('account.changed')}
            </p>
          )}
          <Button type="submit" size="lg" disabled={change.isPending || !current || !next || !confirm}>
            {change.isPending && <LoaderCircle className="size-5 animate-spin" aria-hidden="true" />}
            {t('account.save')}
          </Button>
        </form>
      </Card>
    </div>
  )
}
