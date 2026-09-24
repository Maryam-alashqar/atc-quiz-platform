import { BarChart3, ClipboardList, FilePlus2, FileText, House, type LucideIcon } from 'lucide-react'
import type { Role } from '../../api/types'
import type { MessageKey } from '../../i18n/en'

export interface NavItem {
  to: string
  label: MessageKey
  icon: LucideIcon
  /** Match the path exactly, so "Home" is not highlighted on every nested page. */
  end?: boolean
}

export const navigation: Record<Role, NavItem[]> = {
  STUDENT: [
    { to: '/student', label: 'nav.home', icon: House, end: true },
    { to: '/student/quizzes', label: 'nav.myQuizzes', icon: FileText },
    { to: '/student/results', label: 'nav.results', icon: BarChart3 },
  ],
  TEACHER: [
    { to: '/manage/quizzes', label: 'nav.quizzes', icon: ClipboardList, end: true },
    { to: '/manage/quizzes/new', label: 'nav.newQuiz', icon: FilePlus2 },
  ],
  // The admin oversees every teacher's quizzes; creating one needs a teacher as its owner.
  ADMIN: [{ to: '/manage/quizzes', label: 'nav.allQuizzes', icon: ClipboardList, end: true }],
}

export function homePath(role: Role): string {
  return role === 'STUDENT' ? '/student' : '/manage/quizzes'
}
