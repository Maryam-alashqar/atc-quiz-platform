import { randomUUID } from 'node:crypto';
import {
  createQuizTestApp,
  type QuizTestApp,
} from './helpers/quiz-test-app.js';

describe('Quiz management — request and grading-rule validation', () => {
  let context: QuizTestApp;
  beforeAll(async () => {
    context = await createQuizTestApp();
  });
  afterAll(async () => {
    await context?.close();
  });

  it.each([
    ['blank title', { title: '   ' }],
    ['null title', { title: null }],
    ['null question array', { questions: null }],
    ['zero duration', { durationMinutes: 0 }],
    ['fractional duration', { durationMinutes: 1.5 }],
    [
      'a numeric string instead of an integer duration',
      { durationMinutes: '20' },
    ],
    ['a timestamp without a timezone', { opensAt: '2026-09-24T09:00:00' }],
    ['an impossible calendar date', { opensAt: '2026-02-30T09:00:00Z' }],
    ['an injected published status', { status: 'PUBLISHED' }],
    [
      'a penalty in NONE mode',
      { negativeMarking: 'NONE', penaltyValue: '0.25' },
    ],
    ['a fraction greater than one', { penaltyValue: '1.01' }],
    ['a zero fixed penalty', { negativeMarking: 'FIXED', penaltyValue: '0' }],
    ['a numeric penalty instead of a decimal string', { penaltyValue: 0.25 }],
    ['penalty precision beyond four decimals', { penaltyValue: '0.12345' }],
  ])('rejects %s without creating a quiz', async (_description, patch) => {
    await context
      .api('teacher', 'post', '/quizzes', { ...context.quiz(), ...patch })
      .expect(400);
    expect(await context.db.quiz.count()).toBe(0);
  });

  it('requires a title and both availability timestamps when creating a draft', async () => {
    await context.api('teacher', 'post', '/quizzes', {}).expect(400);
  });

  it('rejects a closing time equal to the opening time', async () => {
    const quiz = context.quiz();
    await context
      .api('teacher', 'post', '/quizzes', { ...quiz, closesAt: quiz.opensAt })
      .expect(400);
  });

  it.each([
    'zero points',
    'numeric points',
    'excessive points precision',
    'five options',
    'two correct options',
    'duplicate option text',
    'an injected question ID',
  ] as const)('rejects a question containing %s', async (scenario) => {
    const quiz = context.quiz();
    const question: Record<string, unknown> = { ...quiz.questions![0] };
    if (scenario === 'zero points') question.points = '0';
    if (scenario === 'numeric points') question.points = 1.5;
    if (scenario === 'excessive points precision') question.points = '1.12345';
    if (scenario === 'an injected question ID') question.id = randomUUID();
    const options = quiz.questions![0].options;
    if (scenario === 'five options')
      options.push({ text: '7', isCorrect: false });
    if (scenario === 'two correct options') options[0].isCorrect = true;
    if (scenario === 'duplicate option text') options[0].text = '  4  ';
    await context
      .api('teacher', 'post', '/quizzes', { ...quiz, questions: [question] })
      .expect(400);
    expect(await context.db.question.count()).toBe(0);
  });

  it('rejects nonexistent and duplicate class identifiers, including different UUID letter casing', async () => {
    await context
      .api('teacher', 'post', '/quizzes', {
        ...context.quiz(),
        classIds: [randomUUID()],
      })
      .expect(400);
    await context
      .api('teacher', 'post', '/quizzes', {
        ...context.quiz(),
        classIds: [context.classroom.id, context.classroom.id.toUpperCase()],
      })
      .expect(400);
  });

  it('rejects invalid pagination and malformed quiz identifiers', async () => {
    await context.api('teacher', 'get', '/quizzes?page=0').expect(400);
    await context.api('teacher', 'get', '/quizzes?pageSize=101').expect(400);
    await context.api('teacher', 'get', '/quizzes?status=UNKNOWN').expect(400);
    await context.api('teacher', 'get', '/quizzes/not-a-uuid').expect(400);
    await context.api('teacher', 'get', `/quizzes/${randomUUID()}`).expect(404);
  });

  it('rejects an empty patch and preserves all fields when class replacement fails', async () => {
    const created = await context
      .api('teacher', 'post', '/quizzes', context.quiz())
      .expect(201);
    try {
      await context
        .api('teacher', 'patch', `/quizzes/${created.body.id}`, {})
        .expect(400);
      await context
        .api('teacher', 'patch', `/quizzes/${created.body.id}`, {
          title: 'Must not persist',
          classIds: [randomUUID()],
          questions: [],
        })
        .expect(400);
      const actual = await context
        .api('teacher', 'get', `/quizzes/${created.body.id}`)
        .expect(200);
      expect(actual.body).toEqual(created.body);
    } finally {
      await context.db.quiz.delete({ where: { id: created.body.id } });
    }
  });
});
