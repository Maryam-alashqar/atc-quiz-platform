import type { NegativeMarking, QuizInput, QuizLanguage, TeacherQuizDetail } from '../../api/types'
import type { MessageKey } from '../../i18n/en'
import { ammanLocalToIso, isoToAmmanLocal } from '../../lib/time'

/** Editor state. Numbers stay strings while typing; conversion happens once, in toQuizInput. */
export interface QuestionDraft {
  key: string
  prompt: string
  points: string
  options: [string, string, string, string]
  correct: number | null
}

export interface QuizDraft {
  title: string
  description: string
  language: QuizLanguage
  classIds: string[]
  opensAt: string // datetime-local, Amman time
  closesAt: string
  durationMinutes: string
  negativeMarking: NegativeMarking
  /** FRACTION: percent of the question's points ("25"). FIXED: points per wrong answer ("0.5"). */
  penalty: string
  questions: QuestionDraft[]
}

let nextKey = 0
const newKey = () => `q${++nextKey}`

export function emptyQuestion(): QuestionDraft {
  return { key: newKey(), prompt: '', points: '1', options: ['', '', '', ''], correct: null }
}

export function emptyDraft(): QuizDraft {
  return {
    title: '',
    description: '',
    language: 'EN',
    classIds: [],
    opensAt: '',
    closesAt: '',
    durationMinutes: '20',
    negativeMarking: 'NONE',
    penalty: '25',
    questions: [emptyQuestion()],
  }
}

/** Trim trailing zeros from a decimal string ("0.2500" → "0.25"). */
const tidy = (value: string) => String(Number(value))

export function draftFromQuiz(quiz: TeacherQuizDetail): QuizDraft {
  const penalty =
    quiz.negativeMarking === 'FRACTION'
      ? tidy(String(Number(quiz.penaltyValue) * 100))
      : quiz.negativeMarking === 'FIXED'
        ? tidy(quiz.penaltyValue)
        : '25'
  return {
    title: quiz.title,
    description: quiz.description ?? '',
    language: quiz.language,
    classIds: quiz.classes.map((c) => c.id),
    opensAt: isoToAmmanLocal(quiz.opensAt),
    closesAt: isoToAmmanLocal(quiz.closesAt),
    durationMinutes: String(quiz.durationMinutes),
    negativeMarking: quiz.negativeMarking,
    penalty,
    questions: quiz.questions.map((question) => {
      const texts = [0, 1, 2, 3].map((i) => question.options[i]?.text ?? '') as QuestionDraft['options']
      const correct = question.options.findIndex((option) => option.isCorrect)
      return { key: newKey(), prompt: question.prompt, points: tidy(question.points), options: texts, correct: correct === -1 ? null : correct }
    }),
  }
}

const DECIMAL = /^\d{1,8}(\.\d{1,4})?$/

/** "25" (percent) → "0.25", kept to the API's four decimal places without float noise. */
function percentToFraction(percent: string): string {
  // Shift the decimal point two places left on the string itself: "33.33" → "0.3333".
  const [whole, fraction = ''] = percent.trim().split('.')
  const padded = whole.padStart(3, '0')
  return tidy(`${padded.slice(0, -2)}.${padded.slice(-2)}${fraction}`)
}

export function penaltyValue(draft: QuizDraft): string {
  if (draft.negativeMarking === 'NONE') return '0'
  return draft.negativeMarking === 'FRACTION' ? percentToFraction(draft.penalty) : draft.penalty.trim()
}

/** Everything the API accepts. Status and ownership are never sent: the server decides those. */
export function toQuizInput(draft: QuizDraft): QuizInput {
  return {
    title: draft.title.trim(),
    description: draft.description.trim() || null,
    language: draft.language,
    classIds: draft.classIds,
    opensAt: ammanLocalToIso(draft.opensAt) ?? undefined,
    closesAt: ammanLocalToIso(draft.closesAt) ?? undefined,
    durationMinutes: Number(draft.durationMinutes),
    negativeMarking: draft.negativeMarking,
    penaltyValue: penaltyValue(draft),
    questions: draft.questions.map((question) => ({
      prompt: question.prompt.trim(),
      points: question.points.trim(),
      options: question.options.map((text, index) => ({ text: text.trim(), isCorrect: index === question.correct })),
    })),
  }
}

export interface Issue {
  key: MessageKey
  vars?: Record<string, string | number>
  /** 1-based question number, when the issue belongs to one question. */
  question?: number
}

/** Problems that block saving at all (the API would reject the request). */
export function saveIssues(draft: QuizDraft): Issue[] {
  const issues: Issue[] = []
  if (!draft.title.trim()) issues.push({ key: 'editor.issue.title' })
  const opens = ammanLocalToIso(draft.opensAt)
  const closes = ammanLocalToIso(draft.closesAt)
  if (!opens || !closes) issues.push({ key: 'editor.issue.window' })
  else if (Date.parse(closes) <= Date.parse(opens)) issues.push({ key: 'editor.issue.windowOrder' })
  const duration = Number(draft.durationMinutes)
  if (!Number.isInteger(duration) || duration < 1 || duration > 1440) issues.push({ key: 'editor.issue.duration' })
  if (draft.negativeMarking !== 'NONE') {
    const value = Number(penaltyValue(draft))
    const valid =
      DECIMAL.test(penaltyValue(draft)) &&
      value > 0 &&
      (draft.negativeMarking === 'FIXED' || value <= 1)
    if (!valid) issues.push({ key: draft.negativeMarking === 'FRACTION' ? 'editor.issue.fraction' : 'editor.issue.fixed' })
  }
  draft.questions.forEach((question, index) => {
    const points = question.points.trim()
    if (!DECIMAL.test(points) || Number(points) <= 0) issues.push({ key: 'editor.issue.points', question: index + 1 })
    const filled = question.options.map((text) => text.trim()).filter(Boolean)
    if (new Set(filled).size !== filled.length) issues.push({ key: 'editor.issue.duplicate', question: index + 1 })
  })
  return issues
}

/** Extra requirements before students can see the quiz (mirrors the API's publish rules). */
export function publishIssues(draft: QuizDraft): Issue[] {
  const issues = saveIssues(draft)
  if (draft.classIds.length === 0) issues.push({ key: 'editor.issue.classes' })
  if (draft.questions.length === 0) issues.push({ key: 'editor.issue.noQuestions' })
  const closes = ammanLocalToIso(draft.closesAt)
  if (closes && Date.parse(closes) <= Date.now()) issues.push({ key: 'editor.issue.closed' })
  draft.questions.forEach((question, index) => {
    if (!question.prompt.trim()) issues.push({ key: 'editor.issue.prompt', question: index + 1 })
    if (question.options.some((text) => !text.trim())) issues.push({ key: 'editor.issue.options', question: index + 1 })
    if (question.correct === null) issues.push({ key: 'editor.issue.correct', question: index + 1 })
  })
  return issues
}

/** Sum of question points, shown live in the editor. */
export function totalPoints(draft: QuizDraft): number {
  return draft.questions.reduce((sum, question) => sum + (Number(question.points) || 0), 0)
}
