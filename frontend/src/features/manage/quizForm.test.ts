import type { TeacherQuizDetail } from '../../api/types'
import { copyDraft, draftFromQuiz, emptyDraft, penaltyValue, publishIssues, saveIssues, toQuizInput, totalPoints, type QuizDraft } from './quizForm'

function completeDraft(overrides: Partial<QuizDraft> = {}): QuizDraft {
  return {
    ...emptyDraft(),
    title: 'Algebra',
    classIds: ['c1'],
    opensAt: '2030-01-01T09:00',
    closesAt: '2030-01-02T09:00',
    questions: [{ key: 'k', prompt: '2 + 2?', points: '1.5', options: ['3', '4', '5', '6'], correct: 1 }],
    ...overrides,
  }
}

const keysOf = (issues: { key: string }[]) => issues.map((issue) => issue.key)

describe('toQuizInput', () => {
  it('converts Amman form times to instants and marks the chosen option correct', () => {
    const input = toQuizInput(completeDraft())
    expect(input.opensAt).toBe('2030-01-01T06:00:00.000Z')
    expect(input.questions?.[0]).toEqual({
      prompt: '2 + 2?',
      points: '1.5',
      options: [
        { text: '3', isCorrect: false },
        { text: '4', isCorrect: true },
        { text: '5', isCorrect: false },
        { text: '6', isCorrect: false },
      ],
    })
  })

  it('never sends status or ownership', () => {
    const input = toQuizInput(completeDraft()) as Record<string, unknown>
    expect(input).not.toHaveProperty('status')
    expect(input).not.toHaveProperty('teacherId')
  })

  it('sends an empty description as null so it is cleared', () => {
    expect(toQuizInput(completeDraft({ description: '   ' })).description).toBeNull()
  })
})

describe('penaltyValue', () => {
  it('converts a percentage to the fraction the API expects, without float noise', () => {
    expect(penaltyValue(completeDraft({ negativeMarking: 'FRACTION', penalty: '25' }))).toBe('0.25')
    expect(penaltyValue(completeDraft({ negativeMarking: 'FRACTION', penalty: '33.33' }))).toBe('0.3333')
    expect(penaltyValue(completeDraft({ negativeMarking: 'FRACTION', penalty: '100' }))).toBe('1')
  })

  it('rejects a percentage with more precision than the API stores', () => {
    expect(keysOf(saveIssues(completeDraft({ negativeMarking: 'FRACTION', penalty: '33.333' })))).toContain('editor.issue.fraction')
  })

  it('passes fixed penalties through and sends zero when marking is off', () => {
    expect(penaltyValue(completeDraft({ negativeMarking: 'FIXED', penalty: '0.5' }))).toBe('0.5')
    expect(penaltyValue(completeDraft({ negativeMarking: 'NONE', penalty: '25' }))).toBe('0')
  })
})

describe('validation', () => {
  it('accepts a complete quiz', () => {
    expect(publishIssues(completeDraft())).toEqual([])
  })

  it('lets a draft be saved before it is complete', () => {
    const draft = completeDraft({ classIds: [], questions: [{ key: 'k', prompt: '', points: '1', options: ['', '', '', ''], correct: null }] })
    expect(saveIssues(draft)).toEqual([])
    expect(keysOf(publishIssues(draft))).toEqual(
      expect.arrayContaining(['editor.issue.classes', 'editor.issue.prompt', 'editor.issue.options', 'editor.issue.correct']),
    )
  })

  it('rejects a closing time before the opening time', () => {
    expect(keysOf(saveIssues(completeDraft({ closesAt: '2029-12-31T09:00' })))).toContain('editor.issue.windowOrder')
  })

  it('rejects invalid points and penalties', () => {
    const draft = completeDraft({
      negativeMarking: 'FRACTION',
      penalty: '150',
      questions: [{ key: 'k', prompt: 'x', points: '0', options: ['a', 'b', 'c', 'd'], correct: 0 }],
    })
    expect(keysOf(saveIssues(draft))).toEqual(['editor.issue.fraction', 'editor.issue.points'])
  })

  it('rejects duplicate options, which the API also refuses', () => {
    const draft = completeDraft({ questions: [{ key: 'k', prompt: 'x', points: '1', options: ['a', 'a ', 'c', 'd'], correct: 0 }] })
    expect(saveIssues(draft)[0]).toMatchObject({ key: 'editor.issue.duplicate', question: 1 })
  })

  it('refuses to publish a quiz whose closing time has passed', () => {
    expect(keysOf(publishIssues(completeDraft({ opensAt: '2020-01-01T09:00', closesAt: '2020-01-02T09:00' })))).toContain(
      'editor.issue.closed',
    )
  })
})

describe('audience', () => {
  const ali = { id: 's1', username: 's10a-01', name: 'Ali', class: { id: 'c1', name: '10A' } }

  it('needs named students, not classes, to publish a quiz for named students', () => {
    const named = completeDraft({ audience: 'STUDENTS', classIds: [], students: [] })
    expect(keysOf(publishIssues(named))).toEqual(['editor.issue.students'])
    expect(publishIssues({ ...named, students: [ali] })).toEqual([])
  })

  it('sends the named student ids with the audience', () => {
    const input = toQuizInput(completeDraft({ audience: 'STUDENTS', students: [ali] }))
    expect(input).toMatchObject({ audience: 'STUDENTS', studentIds: ['s1'] })
  })
})

describe('draftFromQuiz', () => {
  it('turns a stored fraction back into a percentage and finds the correct option', () => {
    const quiz = {
      title: 'T',
      description: null,
      language: 'AR',
      audience: 'CLASSES',
      students: [],
      classes: [{ id: 'c1', name: '10A' }],
      opensAt: '2030-01-01T06:00:00.000Z',
      closesAt: '2030-01-02T06:00:00.000Z',
      durationMinutes: 20,
      negativeMarking: 'FRACTION',
      penaltyValue: '0.2500',
      questions: [
        {
          id: 'q',
          prompt: 'P',
          points: '2.0000',
          order: 1,
          options: ['a', 'b', 'c', 'd'].map((text, i) => ({ id: text, text, order: i + 1, isCorrect: i === 2 })),
        },
      ],
    } as unknown as TeacherQuizDetail
    const draft = draftFromQuiz(quiz)
    expect(draft).toMatchObject({ penalty: '25', opensAt: '2030-01-01T09:00', language: 'AR' })
    expect(draft.questions[0]).toMatchObject({ points: '2', correct: 2, options: ['a', 'b', 'c', 'd'] })
    expect(totalPoints(draft)).toBe(2)
  })
})

describe('saving a draft before every question is written', () => {
  // Regression: the empty starter question was sent as is and the API rejected the whole draft.
  it('saves a brand-new quiz as a draft, leaving the untouched starter question out', () => {
    const draft = { ...emptyDraft(), title: 'Week 6', opensAt: '2030-01-01T09:00', closesAt: '2030-01-02T09:00' }
    expect(saveIssues(draft)).toEqual([])
    expect(toQuizInput(draft).questions).toEqual([])
  })

  it('keeps a half-written question without its empty options, and the right option marked correct', () => {
    const draft = completeDraft({
      questions: [{ key: 'k', prompt: 'Capital of Jordan?', points: '1', options: ['Irbid', '', 'Amman', ''], correct: 2 }],
    })
    expect(toQuizInput(draft).questions).toEqual([
      {
        prompt: 'Capital of Jordan?',
        points: '1',
        options: [
          { text: 'Irbid', isCorrect: false },
          { text: 'Amman', isCorrect: true },
        ],
      },
    ])
  })

  it('asks for the question text when options were written but the question was not', () => {
    const draft = completeDraft({
      questions: [{ key: 'k', prompt: ' ', points: '1', options: ['a', 'b', '', ''], correct: null }],
    })
    expect(saveIssues(draft)).toEqual([{ key: 'editor.issue.prompt', question: 1 }])
  })

  it('still refuses to publish while a blank question is left in', () => {
    const draft = completeDraft()
    draft.questions.push({ key: 'blank', prompt: '', points: '1', options: ['', '', '', ''], correct: null })
    expect(keysOf(publishIssues(draft))).toEqual(
      expect.arrayContaining(['editor.issue.prompt', 'editor.issue.options', 'editor.issue.correct']),
    )
  })
})

it('lists a missing question text once when publishing', () => {
  const draft = completeDraft({
    questions: [{ key: 'k', prompt: '', points: '1', options: ['a', 'b', 'c', 'd'], correct: 0 }],
  })
  expect(publishIssues(draft).filter((issue) => issue.key === 'editor.issue.prompt')).toHaveLength(1)
})

describe('copyDraft', () => {
  const quiz = {
    title: 'Week 5 review',
    description: 'Algebra',
    language: 'AR',
    audience: 'STUDENTS',
    students: [{ id: 's1', username: 's10a-01', name: 'Ali', class: null }],
    classes: [],
    opensAt: '2026-09-20T06:00:00.000Z',
    closesAt: '2026-09-21T06:00:00.000Z',
    durationMinutes: 15,
    negativeMarking: 'FIXED',
    penaltyValue: '0.5',
    questions: [
      {
        id: 'q',
        prompt: 'P',
        points: '2',
        order: 1,
        options: ['a', 'b', 'c', 'd'].map((text, i) => ({ id: text, text, order: i + 1, isCorrect: i === 3 })),
      },
    ],
  } as unknown as TeacherQuizDetail

  it('keeps the content, marking and audience but asks for new dates', () => {
    const draft = copyDraft(quiz, '(copy)')
    expect(draft).toMatchObject({
      title: 'Week 5 review (copy)',
      language: 'AR',
      audience: 'STUDENTS',
      durationMinutes: '15',
      negativeMarking: 'FIXED',
      penalty: '0.5',
      opensAt: '',
      closesAt: '',
    })
    expect(draft.students.map((s) => s.id)).toEqual(['s1'])
    expect(draft.questions[0]).toMatchObject({ prompt: 'P', correct: 3 })
    expect(keysOf(saveIssues(draft))).toEqual(['editor.issue.window'])
  })
})
