import { useEffect } from 'react'
import { Outlet, useMatches } from 'react-router'
import { useI18n } from '../i18n/context'
import type { MessageKey } from '../i18n/en'

/** Every route can declare `handle: { title }`; the deepest one names the browser tab. */
export function RootLayout() {
  const { t } = useI18n()
  const matches = useMatches()
  const key = [...matches]
    .reverse()
    .map((match) => (match.handle as { title?: MessageKey } | undefined)?.title)
    .find(Boolean)

  useEffect(() => {
    document.title = key ? `${t(key)} · ATC` : `ATC · ${t('brand.full')}`
  }, [key, t])

  return <Outlet />
}
