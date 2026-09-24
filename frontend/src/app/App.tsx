import { LogoMark } from '../components/brand/LogoMark'
import { I18nProvider } from '../i18n/I18nProvider'
import { useI18n } from '../i18n/context'

function Placeholder() {
  const { t, locale, setLocale } = useI18n()
  return (
    <main className="grid min-h-dvh place-items-center p-6">
      <div className="flex flex-col items-center gap-4 rounded-3xl bg-surface p-10 shadow-card">
        <LogoMark className="size-16" />
        <h1 className="font-serif text-3xl font-bold text-primary">{t('brand.full')}</h1>
        <p className="text-muted">{t('brand.tagline')}</p>
        <button
          className="rounded-full bg-primary px-5 py-2 text-white"
          onClick={() => setLocale(locale === 'ar' ? 'en' : 'ar')}
          aria-label={t('lang.switchLabel')}
        >
          {t('lang.switch')}
        </button>
      </div>
    </main>
  )
}

export function App() {
  return (
    <I18nProvider>
      <Placeholder />
    </I18nProvider>
  )
}
