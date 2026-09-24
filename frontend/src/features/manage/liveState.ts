import type { TeacherQuizSummary } from '../../api/types'
import type { Tone } from '../../components/ui/Badge'
import type { MessageKey } from '../../i18n/en'
import { serverNow } from '../../lib/time'

/** Where a quiz stands for students right now: draft, scheduled, live or closed. */
export function liveState(quiz: Pick<TeacherQuizSummary, 'status' | 'opensAt' | 'closesAt'>): { key: MessageKey; tone: Tone } {
  if (quiz.status === 'DRAFT') return { key: 'manage.state.draft', tone: 'neutral' }
  const now = serverNow()
  if (now < Date.parse(quiz.opensAt)) return { key: 'manage.state.scheduled', tone: 'warning' }
  if (now >= Date.parse(quiz.closesAt)) return { key: 'manage.state.closed', tone: 'info' }
  return { key: 'manage.state.live', tone: 'success' }
}
