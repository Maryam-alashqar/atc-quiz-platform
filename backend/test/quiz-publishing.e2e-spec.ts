import {
  createQuizTestApp,
  type QuizTestApp,
} from './helpers/quiz-test-app.js';

describe('Quiz management — publishing rules', () => {
  let context: QuizTestApp;
  beforeAll(async () => {
    context = await createQuizTestApp();
  });
  beforeEach(async () => {
    await context.db.quiz.deleteMany();
  });
  afterAll(async () => {
    await context?.close();
  });

  it('publishes a complete quiz and treats repeated publish requests as idempotent', async () => {
    const created = await context
      .api('teacher', 'post', '/quizzes', context.quiz())
      .expect(201);
    const published = await context
      .api('teacher', 'post', `/quizzes/${created.body.id}/publish`)
      .expect(200);
    expect(published.body.status).toBe('PUBLISHED');
    const again = await context
      .api('teacher', 'post', `/quizzes/${created.body.id}/publish`)
      .expect(200);
    expect(again.body).toEqual(published.body);
  });

  it.each([
    'no classes',
    'no questions',
    'three options',
    'no correct answer',
  ] as const)(
    'keeps a draft unpublished when it contains %s',
    async (scenario) => {
      const body = context.quiz();
      if (scenario === 'no classes') body.classIds = [];
      if (scenario === 'no questions') body.questions = [];
      if (scenario === 'three options') body.questions![0].options.pop();
      if (scenario === 'no correct answer')
        body.questions![0].options.forEach((o) => {
          o.isCorrect = false;
        });
      const created = await context
        .api('teacher', 'post', '/quizzes', body)
        .expect(201);
      await context
        .api('teacher', 'post', `/quizzes/${created.body.id}/publish`)
        .expect(400);
      expect(
        (
          await context.db.quiz.findUniqueOrThrow({
            where: { id: created.body.id },
          })
        ).status,
      ).toBe('DRAFT');
    },
  );

  it('rejects publication after the closing time has passed', async () => {
    const created = await context
      .api('teacher', 'post', '/quizzes', {
        ...context.quiz(),
        opensAt: new Date(Date.now() - 120_000).toISOString(),
        closesAt: new Date(Date.now() - 60_000).toISOString(),
      })
      .expect(201);
    await context
      .api('teacher', 'post', `/quizzes/${created.body.id}/publish`)
      .expect(400);
  });

  it('allows publishing an upcoming quiz without opening it early', async () => {
    const future = new Date(Date.now() + 300_000).toISOString();
    const created = await context
      .api('teacher', 'post', '/quizzes', {
        ...context.quiz(),
        opensAt: future,
      })
      .expect(201);
    const published = await context
      .api('teacher', 'post', `/quizzes/${created.body.id}/publish`)
      .expect(200);
    expect(published.body.opensAt).toBe(future);
  });

  it('rejects edits that would make a published quiz incomplete and preserves its data', async () => {
    const created = await context
      .api('teacher', 'post', '/quizzes', context.quiz())
      .expect(201);
    const published = await context
      .api('teacher', 'post', `/quizzes/${created.body.id}/publish`)
      .expect(200);
    for (const body of [
      { classIds: [] },
      { questions: [] },
      { questions: [{ prompt: 'Incomplete', points: '1', options: [] }] },
    ]) {
      await context
        .api('teacher', 'patch', `/quizzes/${created.body.id}`, body)
        .expect(400);
    }
    const actual = await context
      .api('teacher', 'get', `/quizzes/${created.body.id}`)
      .expect(200);
    expect(actual.body).toEqual(published.body);
  });

  it('allows valid question edits on a published quiz before any attempt starts', async () => {
    const created = await context
      .api('teacher', 'post', '/quizzes', context.quiz())
      .expect(201);
    await context
      .api('teacher', 'post', `/quizzes/${created.body.id}/publish`)
      .expect(200);
    const questions = context.quiz().questions!;
    questions[0].points = '2.5';
    const updated = await context
      .api('teacher', 'patch', `/quizzes/${created.body.id}`, { questions })
      .expect(200);
    expect(updated.body).toMatchObject({
      status: 'PUBLISHED',
      maxScore: '2.5',
    });
  });
});
