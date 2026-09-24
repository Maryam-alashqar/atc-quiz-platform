import type { AttemptSummary, HistoryItem, StudentQuiz } from '../../api/types'

export type QuizState =
  | { kind: 'open' }
  | { kind: 'inProgress'; attemptId: string }
  | { kind: 'completed'; attempt: AttemptSummary }
  | { kind: 'upcoming' }

/** What a student can do with a quiz right now. Upcoming quizzes come from their own endpoint. */
export function quizState(quiz: StudentQuiz, upcoming = false): QuizState {
  if (upcoming) return { kind: 'upcoming' }
  const attempt = quiz.attempt
  if (!attempt) return { kind: 'open' }
  if (attempt.status === 'IN_PROGRESS') return { kind: 'inProgress', attemptId: attempt.id }
  return { kind: 'completed', attempt }
}

export interface ProgressSummary {
  completed: number
  inProgress: number
  notStarted: number
  /** Share of known quizzes the student has finished, 0–100. */
  percent: number
  /** Mean percentage across finished attempts, or null before the first one. */
  averagePercent: number | null
}

export function progressSummary(available: StudentQuiz[], history: HistoryItem[]): ProgressSummary {
  const finished = history.filter((item) => item.status !== 'IN_PROGRESS')
  const completed = finished.length
  const inProgress = history.length - completed
  const notStarted = available.filter((quiz) => !quiz.attempt).length
  const total = completed + inProgress + notStarted
  const percents = finished.map((item) => Number(item.percentage)).filter(Number.isFinite)
  return {
    completed,
    inProgress,
    notStarted,
    percent: total ? Math.round((completed / total) * 100) : 0,
    averagePercent: percents.length
      ? Math.round(percents.reduce((sum, value) => sum + value, 0) / percents.length)
      : null,
  }
}
