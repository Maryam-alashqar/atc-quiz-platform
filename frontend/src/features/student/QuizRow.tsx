import { CalendarDays, ChevronRight, ClipboardList, Languages } from 'lucide-react'
import { Link } from 'react-router'
import type { StudentQuiz } from '../../api/types'
import { Badge } from '../../components/ui/Badge'
import { useI18n } from '../../i18n/context'
import { daysUntil, formatDate, formatDateRange, formatTime } from '../../lib/time'
import { quizState, type QuizState } from './quizState'

const tiles = ['bg-sky text-primary', 'bg-gold-soft text-gold-ink', 'bg-success-soft text-success']

export function QuizStatusBadge({ quiz, state }: { quiz: StudentQuiz; state: QuizState }) {
  const { t, locale } = useI18n()
  switch (state.kind) {
    case 'open':
      return <Badge tone="success">{t('quiz.status.open')}</Badge>
    case 'inProgress':
      return <Badge tone="info">{t('quiz.status.inProgress')}</Badge>
    case 'completed':
      return (
        <Badge tone="neutral">
          {state.attempt.percentage === null
            ? t('quiz.status.completed')
            : t('quiz.status.scored', { percent: Math.round(Number(state.attempt.percentage)) })}
        </Badge>
      )
    case 'upcoming': {
      const days = daysUntil(quiz.opensAt)
      const label =
        days <= 0
          ? t('quiz.status.opensToday', { time: formatTime(quiz.opensAt, locale) })
          : days === 1
            ? t('quiz.status.opensTomorrow')
            : t('quiz.status.opensOn', { date: formatDate(quiz.opensAt, locale) })
      return <Badge tone="warning">{label}</Badge>
    }
  }
}

interface QuizRowProps {
  quiz: StudentQuiz
  upcoming?: boolean
  index?: number
}

export function QuizRow({ quiz, upcoming = false, index = 0 }: QuizRowProps) {
  const { t, locale } = useI18n()
  const state = quizState(quiz, upcoming)
  const Icon = quiz.language === 'AR' ? Languages : ClipboardList
  const content = (
    <>
      <span className={`grid size-12 shrink-0 place-items-center rounded-2xl sm:size-14 ${tiles[index % tiles.length]}`}>
        <Icon className="size-6" aria-hidden="true" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate font-semibold text-ink">
          <bdi>{quiz.title}</bdi>
        </span>
        <span className="mt-0.5 block text-sm text-muted">
          {t('common.questions', { n: quiz.questionCount })} · {t('common.minutes', { n: quiz.durationMinutes })}
        </span>
        <span className="mt-1 flex items-center gap-1.5 text-xs text-muted sm:text-sm">
          <CalendarDays className="size-3.5 shrink-0" aria-hidden="true" />
          {formatDateRange(quiz.opensAt, quiz.closesAt, locale)}
        </span>
      </span>
      <span className="flex shrink-0 flex-col items-end gap-2 sm:flex-row sm:items-center">
        <QuizStatusBadge quiz={quiz} state={state} />
        {!upcoming && <ChevronRight className="hidden size-5 text-muted sm:block rtl:-scale-x-100" aria-hidden="true" />}
      </span>
    </>
  )
  const rowClass = 'flex items-center gap-3 py-4 sm:gap-4'
  // Upcoming quizzes cannot be opened yet, so they are not links.
  return upcoming ? (
    <div className={rowClass}>{content}</div>
  ) : (
    <Link to={`/student/quizzes/${quiz.id}`} className={`${rowClass} -mx-2 rounded-2xl px-2 hover:bg-ivory`}>
      {content}
    </Link>
  )
}
