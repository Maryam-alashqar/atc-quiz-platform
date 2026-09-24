import { Eye, EyeOff, Languages, LoaderCircle } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { Navigate, useLocation, useNavigate } from 'react-router'
import { useLogin, useMe } from '../../api/auth'
import { ApiError, NetworkError } from '../../api/client'
import { LogoMark } from '../../components/brand/LogoMark'
import { homePath } from '../../components/layout/navigation'
import { Button } from '../../components/ui/Button'
import { useI18n } from '../../i18n/context'
import hero800 from '../../assets/hero-800.webp'
import hero1400 from '../../assets/hero-1400.webp'

function canReturnTo(path: unknown, home: string): path is string {
  // Only return to a page inside the signed-in user's own area.
  return typeof path === 'string' && path.startsWith(home.split('/').slice(0, 2).join('/'))
}

export function LoginPage() {
  const { t, locale, setLocale } = useI18n()
  const me = useMe()
  const login = useLogin()
  const navigate = useNavigate()
  const location = useLocation()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)

  const from = (location.state as { from?: unknown } | null)?.from
  if (me.data) {
    const home = homePath(me.data.role)
    return <Navigate to={canReturnTo(from, home) ? from : home} replace />
  }

  function submit(event: FormEvent) {
    event.preventDefault()
    login.mutate(
      { username: username.trim(), password },
      {
        onSuccess: ({ user }) => {
          const home = homePath(user.role)
          navigate(canReturnTo(from, home) ? from : home, { replace: true })
        },
      },
    )
  }

  const error = login.error
  const errorMessage = !error
    ? null
    : error instanceof NetworkError
      ? t('common.offline')
      : error instanceof ApiError && error.status === 429
        ? t('auth.tooMany')
        : error instanceof ApiError && error.status < 500
          ? t('auth.invalid')
          : t('common.error')

  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[1.1fr_1fr] lg:gap-4 lg:p-4">
      <section className="relative isolate overflow-hidden lg:rounded-[2rem]">
        <img
          src={hero1400}
          srcSet={`${hero800} 800w, ${hero1400} 1400w`}
          sizes="(min-width: 1024px) 55vw, 100vw"
          alt=""
          className="absolute inset-0 -z-10 size-full object-cover"
        />
        <div className="absolute inset-0 -z-10 bg-gradient-to-t from-ink/85 via-primary/45 to-primary/10" />
        <div className="flex h-56 flex-col justify-end p-6 text-white sm:h-72 lg:h-full lg:p-12">
          <p className="mb-2 text-xs font-semibold tracking-[0.3em] text-gold uppercase">{t('brand.tagline')}</p>
          <h1 className="font-serif text-3xl leading-tight font-bold sm:text-4xl lg:text-5xl">
            {t('auth.heroTitle')} <span className="text-gold">{t('auth.heroAccent')}</span>
          </h1>
          <p className="mt-3 hidden max-w-md text-sky sm:block">{t('auth.heroBody')}</p>
        </div>
      </section>

      <section className="relative -mt-6 flex justify-center rounded-t-[2rem] bg-ivory px-5 pt-8 pb-10 lg:mt-0 lg:items-center lg:rounded-none">
        <div className="w-full max-w-sm">
          <div className="mb-8 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <LogoMark className="size-12" />
              <div className="leading-tight">
                <p className="font-serif text-3xl font-bold text-primary">{t('brand.name')}</p>
                <p className="text-sm text-muted">{t('brand.full')}</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setLocale(locale === 'ar' ? 'en' : 'ar')}
              aria-label={t('lang.switchLabel')}
              className="inline-flex min-h-11 items-center gap-2 rounded-full px-3 text-sm font-semibold text-primary hover:bg-sky-soft"
            >
              <Languages className="size-4" aria-hidden="true" />
              {t('lang.switch')}
            </button>
          </div>

          <h2 className="font-serif text-3xl font-bold text-ink">{t('auth.title')}</h2>
          <p className="mt-1 mb-6 text-muted">{t('auth.subtitle')}</p>

          <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-semibold">{t('auth.username')}</span>
              <input
                name="username"
                autoComplete="username"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                dir="ltr"
                required
                value={username}
                onChange={(event) => setUsername(event.target.value)}
                placeholder="s10a-01"
                className="min-h-12 rounded-2xl border border-line bg-surface px-4 text-base outline-none placeholder:text-muted/60 focus:border-secondary focus:ring-4 focus:ring-sky"
              />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-semibold">{t('auth.password')}</span>
              <span className="relative">
                <input
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  dir="ltr"
                  required
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  className="min-h-12 w-full rounded-2xl border border-line bg-surface ps-4 pe-12 text-base outline-none focus:border-secondary focus:ring-4 focus:ring-sky"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((value) => !value)}
                  aria-label={showPassword ? t('auth.hidePassword') : t('auth.showPassword')}
                  className="absolute inset-y-0 end-0 grid w-12 place-items-center text-muted hover:text-primary"
                >
                  {showPassword ? <EyeOff className="size-5" /> : <Eye className="size-5" />}
                </button>
              </span>
            </label>

            {errorMessage && (
              <p role="alert" className="rounded-2xl bg-danger-soft px-4 py-3 text-sm text-danger">
                {errorMessage}
              </p>
            )}

            <Button
              type="submit"
              size="lg"
              disabled={login.isPending || !username.trim() || !password}
              className="mt-2 w-full"
            >
              {login.isPending && <LoaderCircle className="size-5 animate-spin" aria-hidden="true" />}
              {login.isPending ? t('auth.submitting') : t('auth.submit')}
            </Button>
          </form>
        </div>
      </section>
    </div>
  )
}
