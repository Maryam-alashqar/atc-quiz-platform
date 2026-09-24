import type { Locale } from '../i18n/context'

/** The centre's timezone. Every date shown in the UI is in Amman time, whatever the device is set to. */
export const CENTRE_TZ = 'Asia/Amman'

// Latin digits in both languages keep scores, times and usernames consistent.
const intlLocale = (locale: Locale) => (locale === 'ar' ? 'ar-JO-u-nu-latn' : 'en-GB')

// --- Server clock -----------------------------------------------------------
// Device clocks can be wrong. API responses carry `serverTime`; we keep the offset
// so countdowns and "opens tomorrow" labels follow the server, not the phone.
let offsetMs = 0

export function syncServerTime(serverTime: string, receivedAt = Date.now()): void {
  const server = Date.parse(serverTime)
  if (!Number.isNaN(server)) offsetMs = server - receivedAt
}

export function serverNow(): number {
  return Date.now() + offsetMs
}

// --- Formatting ---------------------------------------------------------------

export function formatDate(iso: string, locale: Locale): string {
  return new Intl.DateTimeFormat(intlLocale(locale), {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: CENTRE_TZ,
  }).format(new Date(iso))
}

export function formatDateTime(iso: string, locale: Locale): string {
  return new Intl.DateTimeFormat(intlLocale(locale), {
    day: 'numeric',
    month: 'short',
    hour: 'numeric',
    minute: '2-digit',
    timeZone: CENTRE_TZ,
  }).format(new Date(iso))
}

export function formatTime(iso: string, locale: Locale): string {
  return new Intl.DateTimeFormat(intlLocale(locale), {
    hour: 'numeric',
    minute: '2-digit',
    timeZone: CENTRE_TZ,
  }).format(new Date(iso))
}

export function formatDateRange(startIso: string, endIso: string, locale: Locale): string {
  return new Intl.DateTimeFormat(intlLocale(locale), {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: CENTRE_TZ,
  }).formatRange(new Date(startIso), new Date(endIso))
}

/** Calendar date (YYYY-MM-DD) in Amman; used to count whole days regardless of the time of day. */
function ammanDay(ms: number): number {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: CENTRE_TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date(ms))
  return Date.parse(`${parts}T00:00:00Z`) / 86_400_000
}

/** 0 = today, 1 = tomorrow, … counted in Amman calendar days. */
export function daysUntil(iso: string, now = serverNow()): number {
  return Math.round(ammanDay(Date.parse(iso)) - ammanDay(now))
}

export function ammanHour(now = serverNow()): number {
  return Number(
    new Intl.DateTimeFormat('en-GB', { timeZone: CENTRE_TZ, hour: '2-digit', hourCycle: 'h23' }).format(
      new Date(now),
    ),
  )
}

// --- Countdown ----------------------------------------------------------------

/** Milliseconds left until `deadlineIso`, never negative. */
export function remainingMs(deadlineIso: string, now = serverNow()): number {
  return Math.max(0, Date.parse(deadlineIso) - now)
}

/** "19:05" or "1:02:03" for long quizzes. Rounds up so the display never shows 0:00 early. */
export function formatCountdown(ms: number): string {
  const total = Math.ceil(ms / 1000)
  const hours = Math.floor(total / 3600)
  const minutes = Math.floor((total % 3600) / 60)
  const seconds = total % 60
  const mm = hours ? String(minutes).padStart(2, '0') : String(minutes)
  const ss = String(seconds).padStart(2, '0')
  return hours ? `${hours}:${mm}:${ss}` : `${mm}:${ss}`
}
