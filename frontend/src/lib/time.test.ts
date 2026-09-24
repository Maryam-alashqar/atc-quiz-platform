import { ammanHour, daysUntil, formatCountdown, formatDate, remainingMs, serverNow, syncServerTime } from './time'

describe('server clock', () => {
  afterEach(() => syncServerTime(new Date().toISOString()))

  it('follows the server when the device clock is wrong', () => {
    const deviceNow = Date.now()
    // Server is 5 minutes ahead of this device.
    syncServerTime(new Date(deviceNow + 5 * 60_000).toISOString(), deviceNow)
    expect(serverNow() - Date.now()).toBeGreaterThan(5 * 60_000 - 1_000)
  })

  it('ignores an unparseable server time', () => {
    syncServerTime(new Date().toISOString())
    const before = serverNow() - Date.now()
    syncServerTime('not a date')
    expect(Math.abs(serverNow() - Date.now() - before)).toBeLessThan(50)
  })
})

describe('Amman calendar', () => {
  // 2026-09-24 22:30 UTC is already 25 Sep 01:30 in Amman (UTC+3).
  const lateUtc = Date.parse('2026-09-24T22:30:00Z')

  it('counts days in Amman, not in UTC or device time', () => {
    expect(daysUntil('2026-09-25T08:00:00Z', lateUtc)).toBe(0)
    expect(daysUntil('2026-09-25T22:00:00Z', lateUtc)).toBe(1)
    expect(daysUntil('2026-09-28T08:00:00Z', lateUtc)).toBe(3)
  })

  it('reads the hour in Amman', () => {
    expect(ammanHour(lateUtc)).toBe(1)
  })

  it('formats dates in Amman time with Latin digits in Arabic', () => {
    expect(formatDate('2026-09-24T22:30:00Z', 'en')).toBe('25 Sept 2026')
    expect(formatDate('2026-09-24T22:30:00Z', 'ar')).toMatch(/^25 /)
  })
})

describe('countdown', () => {
  it('never goes negative', () => {
    expect(remainingMs('2026-01-01T00:00:00Z', Date.parse('2026-01-01T00:00:05Z'))).toBe(0)
  })

  it('formats minutes and seconds, rounding up partial seconds', () => {
    expect(formatCountdown(20 * 60_000)).toBe('20:00')
    expect(formatCountdown(65_001)).toBe('1:06')
    expect(formatCountdown(500)).toBe('0:01')
    expect(formatCountdown(0)).toBe('0:00')
  })

  it('shows hours for long quizzes', () => {
    expect(formatCountdown(3_723_000)).toBe('1:02:03')
  })
})
