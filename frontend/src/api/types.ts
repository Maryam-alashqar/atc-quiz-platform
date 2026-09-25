// Mirrors the backend responses (backend/docs). Decimals arrive as strings to keep precision.

export type Role = 'STUDENT' | 'TEACHER' | 'ADMIN'
export type QuizLanguage = 'AR' | 'EN'
export type QuizStatus = 'DRAFT' | 'PUBLISHED'
export type NegativeMarking = 'NONE' | 'FRACTION' | 'FIXED'
export type AttemptStatus = 'IN_PROGRESS' | 'SUBMITTED' | 'EXPIRED'
/** CLASSES: everyone in the assigned classes. STUDENTS: only the named students. */
export type QuizAudience = 'CLASSES' | 'STUDENTS'

export interface StudentRef {
  id: string
  username: string
  name: string
  class: ClassRoom | null
}

export interface User {
  id: string
  username: string
  name: string
  role: Role
  classId: string | null
  className: string | null
}

export interface Page<T> {
  total: number
  page: number
  pageSize: number
  items: T[]
}

export interface TimedPage<T> extends Page<T> {
  serverTime: string
}

export interface AttemptSummary {
  id: string
  quizId: string
  status: AttemptStatus
  startedAt: string
  deadlineAt: string
  graceEndsAt: string
  submittedAt: string | null
  score: string | null
  maxScore: string
  percentage: string | null
}

interface QuizMeta {
  id: string
  title: string
  description: string | null
  language: QuizLanguage
  negativeMarking: NegativeMarking
  penaltyValue: string
}

export interface StudentQuiz extends QuizMeta {
  durationMinutes: number
  opensAt: string
  closesAt: string
  questionCount: number
  maxScore: string
  attempt: AttemptSummary | null
}

export interface StudentQuizDetails extends StudentQuiz {
  serverTime: string
}

export interface HistoryItem extends AttemptSummary {
  quiz: Omit<StudentQuiz, 'questionCount' | 'maxScore' | 'attempt'>
}

export interface AttemptOption {
  id: string
  text: string
  order: number
}

export interface AttemptQuestion {
  id: string
  prompt: string
  points: string
  order: number
  options: AttemptOption[]
}

export interface Attempt extends AttemptSummary {
  serverTime: string
  quiz: QuizMeta & { questions: AttemptQuestion[] }
  answers: { questionId: string; optionId: string }[]
}

export interface ClassRoom {
  id: string
  name: string
}

export interface TeacherQuizSummary extends QuizMeta {
  teacherId: string
  teacher: { id: string; username: string; name: string }
  durationMinutes: number
  opensAt: string
  closesAt: string
  status: QuizStatus
  audience: QuizAudience
  classes: ClassRoom[]
  questionCount: number
  attemptCount: number
  studentCount: number
  createdAt: string
  updatedAt: string
}

export interface TeacherOption {
  id: string
  text: string
  isCorrect: boolean
  order: number
}

export interface TeacherQuestion {
  id: string
  prompt: string
  points: string
  order: number
  options: TeacherOption[]
}

export interface TeacherQuizDetail extends TeacherQuizSummary {
  students: StudentRef[]
  questions: TeacherQuestion[]
  maxScore: string
}

export interface QuizInput {
  title?: string
  description?: string | null
  language?: QuizLanguage
  durationMinutes?: number
  opensAt?: string
  closesAt?: string
  negativeMarking?: NegativeMarking
  penaltyValue?: string
  audience?: QuizAudience
  classIds?: string[]
  studentIds?: string[]
  teacherId?: string
  questions?: {
    prompt: string
    points: string
    options: { text: string; isCorrect: boolean }[]
  }[]
}

export interface ResultRow {
  id: string
  status: AttemptStatus
  startedAt: string
  deadlineAt: string
  submittedAt: string | null
  score: string | null
  maxScore: string
  percentage: string | null
  student: { id: string; username: string; name: string; class: ClassRoom | null }
}

export interface QuizResults extends Page<ResultRow> {
  quiz: { id: string; title: string }
  summary: {
    inProgress: number
    submitted: number
    expired: number
    completed: number
    averageScore: string | null
    lowestScore: string | null
    highestScore: string | null
  }
}

export interface RosterRow {
  student: StudentRef
  attempt: {
    id: string
    status: AttemptStatus
    startedAt: string
    submittedAt: string | null
    score: string | null
    maxScore: string
    percentage: string | null
  } | null
}

export interface QuizRoster {
  quiz: {
    id: string
    title: string
    status: QuizStatus
    audience: QuizAudience
    opensAt: string
    closesAt: string
    classes: ClassRoom[]
  }
  summary: { assigned: number; notStarted: number; inProgress: number; submitted: number; expired: number }
  items: RosterRow[]
}

export interface StudentProgressRow {
  student: StudentRef
  assigned: number
  completed: number
  openNotStarted: number
  missed: number
  averagePercent: number | null
}
