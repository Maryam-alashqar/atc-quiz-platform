import type { NegativeMarking } from '../../api/types'
import type { MessageKey } from '../../i18n/en'

/** Plain-language description of how wrong answers are marked, shown before and after a quiz. */
export function markingRule(mode: NegativeMarking, penaltyValue: string): { key: MessageKey; vars?: Record<string, string | number> } {
  switch (mode) {
    case 'NONE':
      return { key: 'marking.none' }
    case 'FRACTION':
      return { key: 'marking.fraction', vars: { percent: Math.round(Number(penaltyValue) * 100) } }
    case 'FIXED':
      return { key: 'marking.fixed', vars: { points: Number(penaltyValue) } }
  }
}
