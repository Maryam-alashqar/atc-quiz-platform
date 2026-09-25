import { Languages, LogOut } from 'lucide-react'
import { NavLink, Outlet } from 'react-router'
import { useLogout } from '../../api/auth'
import type { User } from '../../api/types'
import { useI18n } from '../../i18n/context'
import { LogoMark } from '../brand/LogoMark'
import { Avatar } from '../ui/Avatar'
import { navigation } from './navigation'
import sidebarAmman from '../../assets/sidebar-amman.webp'

function LanguageToggle({ className = '' }: { className?: string }) {
  const { t, locale, setLocale } = useI18n()
  return (
    <button
      type="button"
      onClick={() => setLocale(locale === 'ar' ? 'en' : 'ar')}
      aria-label={t('lang.switchLabel')}
      className={`inline-flex min-h-11 items-center gap-2 rounded-full px-3 text-sm font-semibold ${className}`}
    >
      <Languages className="size-4" aria-hidden="true" />
      <span>{t('lang.switch')}</span>
    </button>
  )
}

function UserChip({ user }: { user: User }) {
  const { t } = useI18n()
  const role = t(`role.${user.role}`)
  return (
    <div className="flex min-w-0 items-center gap-3">
      <Avatar name={user.name} />
      <div className="hidden min-w-0 leading-tight sm:block">
        <p className="truncate font-semibold text-ink">{user.name}</p>
        <p className="truncate text-sm text-muted">
          {user.className ? `${user.className} · ${role}` : role}
        </p>
      </div>
    </div>
  )
}

function LogoutButton({ className = '' }: { className?: string }) {
  const { t } = useI18n()
  const logout = useLogout()
  return (
    <button
      type="button"
      onClick={() => logout.mutate()}
      disabled={logout.isPending}
      aria-label={t('auth.logout')}
      title={t('auth.logout')}
      className={`grid size-11 place-items-center rounded-full ${className}`}
    >
      <LogOut className="size-5 rtl:-scale-x-100" aria-hidden="true" />
    </button>
  )
}

function Sidebar({ user }: { user: User }) {
  const { t } = useI18n()
  return (
    <aside className="sticky top-4 hidden h-[calc(100dvh-2rem)] w-56 shrink-0 flex-col overflow-hidden rounded-[2rem] bg-primary text-white lg:flex">
      {/* Amman at dusk, fading into the sidebar blue so the menu stays readable above it. */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-[55%]" aria-hidden="true">
        <img src={sidebarAmman} alt="" className="size-full object-cover object-top" />
        <div className="absolute inset-0 bg-gradient-to-b from-primary via-primary/40 to-primary/85" />
      </div>
      <div className="relative z-10 flex flex-col items-center px-5 pt-8 pb-8 text-center">
        <LogoMark tone="onDark" className="mb-2 size-14" />
        <p className="font-serif text-4xl leading-none font-bold tracking-wide">{t('brand.name')}</p>
        <p className="mt-1.5 text-sm text-sky">{t('brand.full')}</p>
      </div>
      <nav aria-label={t('nav.main')} className="relative z-10 flex flex-col gap-1.5 pe-4">
        {navigation[user.role].map(({ to, label, icon: Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              `flex min-h-12 items-center gap-3 rounded-e-full ps-7 font-medium transition-colors ${
                isActive ? 'bg-white/18 text-white' : 'text-sky hover:bg-white/8 hover:text-white'
              }`
            }
          >
            <Icon className="size-5" aria-hidden="true" />
            {t(label)}
          </NavLink>
        ))}
      </nav>
      <div className="relative z-10 mt-auto flex items-center justify-between px-4 pb-4">
        <LanguageToggle className="text-sky hover:bg-white/10 hover:text-white" />
        <LogoutButton className="text-sky hover:bg-white/10 hover:text-white" />
      </div>
    </aside>
  )
}

function MobileTopBar({ user }: { user: User }) {
  const { t } = useI18n()
  return (
    <header className="sticky top-0 z-20 flex items-center justify-between gap-3 bg-ivory/90 px-4 py-2 backdrop-blur lg:hidden">
      <div className="flex items-center gap-2">
        <LogoMark className="size-9" />
        <span className="font-serif text-2xl font-bold text-primary">{t('brand.name')}</span>
      </div>
      <div className="flex items-center gap-1">
        <LanguageToggle className="text-primary hover:bg-sky-soft" />
        <LogoutButton className="text-primary hover:bg-sky-soft" />
        <Avatar name={user.name} className="size-10 text-sm" />
      </div>
    </header>
  )
}

function BottomNav({ user }: { user: User }) {
  const { t } = useI18n()
  return (
    <nav
      aria-label={t('nav.main')}
      className="fixed inset-x-0 bottom-0 z-20 border-t border-line bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden"
    >
      <ul className="mx-auto flex max-w-md">
        {navigation[user.role].map(({ to, label, icon: Icon, end }) => (
          <li key={to} className="flex-1">
            <NavLink
              to={to}
              end={end}
              className={({ isActive }) =>
                `flex min-h-16 flex-col items-center justify-center gap-1 text-xs font-medium ${
                  isActive ? 'text-primary' : 'text-muted'
                }`
              }
            >
              {({ isActive }) => (
                <>
                  <span className={`grid h-8 w-14 place-items-center rounded-full ${isActive ? 'bg-sky' : ''}`}>
                    <Icon className="size-5" aria-hidden="true" />
                  </span>
                  {t(label)}
                </>
              )}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  )
}

export function AppShell({ user }: { user: User }) {
  return (
    <div className="mx-auto flex max-w-[1440px] gap-6 lg:p-4">
      <Sidebar user={user} />
      <div className="min-w-0 flex-1">
        <MobileTopBar user={user} />
        <div className="hidden items-center justify-end gap-4 py-2 lg:flex">
          <UserChip user={user} />
        </div>
        <main className="px-4 pt-2 pb-28 lg:px-0 lg:pb-6">
          <Outlet />
        </main>
      </div>
      <BottomNav user={user} />
    </div>
  )
}
