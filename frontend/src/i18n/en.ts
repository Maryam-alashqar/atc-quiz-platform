// English is the source dictionary: ar.ts must provide every key (enforced by its type).
export const en = {
  'brand.name': 'ATC',
  'brand.full': 'Amman Tutoring Center',
  'brand.tagline': 'Learning & Assessment',

  'lang.switch': 'العربية',
  'lang.switchLabel': 'Switch language to Arabic',

  'common.loading': 'Loading…',
  'common.retry': 'Try again',
  'common.back': 'Back',
  'common.cancel': 'Cancel',
  'common.viewAll': 'View all',
  'common.minutes': '{n} minutes',
  'common.questions': '{n} questions',
  'common.points': '{n} pts',
  'common.error': 'Something went wrong. Please try again.',
  'common.offline': 'Could not reach the server. Check your connection.',
} as const

export type MessageKey = keyof typeof en
