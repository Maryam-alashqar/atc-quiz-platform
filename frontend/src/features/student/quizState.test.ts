import type { AttemptStatus, HistoryItem, StudentQuiz } from '../../api/types'
import { progressSummary, quizState } from './quizState'

const attempt = (status: AttemptStatus, percentage: string | null = null) => ({
  id: `a-${status}`,
  quizId: 'q',
  status,
  startedAt: '2026-09-24T08:00:00Z',
  deadlineAt: '2026-09-24T08:20:00Z',
  graceEndsAt: '2026-09-24T08:20:10Z',
  submittedAt: status === 'IN_PROGRESS' ? null : '2026-09-24T08:10:00Z',
  score: percentage,
  maxScore: '100',
  percentage,
})

const quiz = (overrides: Partial<StudentQuiz> = {}): StudentQuiz => ({
  id: 'q',
  title: 'Quiz',
  description: null,
  language: 'EN',
  negativeMarking: 'NONE',
  penaltyValue: '0',
  durationMinutes: 20,
  opensAt: '2026-09-23T08:00:00Z',
  closesAt: '2026-09-30T08:00:00Z',
  questionCount: 15,
  maxScore: '22.5',
  attempt: null,
  ...overrides,
})

const history = (status: AttemptStatus, percentage: string | null = null) =>
  ({ ...attempt(status, percentage), quiz: quiz() }) as HistoryItem

describe('quizState', () => {
  it('is open when the student has no attempt', () => {
    expect(quizState(quiz())).toEqual({ kind: 'open' })
  })

  it('offers to resume an attempt in progress', () => {
    expect(quizState(quiz({ attempt: attempt('IN_PROGRESS') }))).toEqual({
      kind: 'inProgress',
      attemptId: 'a-IN_PROGRESS',
    })
  })

  it('treats submitted and expired attempts as completed, so a quiz is never offered twice', () => {
    expect(quizState(quiz({ attempt: attempt('SUBMITTED', '80.00') })).kind).toBe('completed')
    expect(quizState(quiz({ attempt: attempt('EXPIRED', '40.00') })).kind).toBe('completed')
  })

  it('marks quizzes from the upcoming list as upcoming', () => {
    expect(quizState(quiz(), true)).toEqual({ kind: 'upcoming' })
  })
})

describe('progressSummary', () => {
  it('counts completed, in-progress and not-started quizzes', () => {
    const summary = progressSummary(
      [quiz(), quiz({ attempt: attempt('IN_PROGRESS') })],
      [history('SUBMITTED', '80.00'), history('EXPIRED', '50.00'), history('IN_PROGRESS')],
    )
    expect(summary).toMatchObject({ completed: 2, inProgress: 1, notStarted: 1, percent: 50 })
  })

  it('averages only finished attempts', () => {
    const summary = progressSummary([], [history('SUBMITTED', '80.00'), history('EXPIRED', '45.00')])
    expect(summary.averagePercent).toBe(63)
  })

  it('has no average and zero progress before any quiz', () => {
    expect(progressSummary([], [])).toEqual({
      completed: 0,
      inProgress: 0,
      notStarted: 0,
      percent: 0,
      averagePercent: null,
    })
  })
})
