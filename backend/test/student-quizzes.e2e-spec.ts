import {
  createStudentTestApp,
  type StudentTestApp,
} from './helpers/student-test-app.js';

describe('Student quizzes — availability and safe previews', () => {
  let context: StudentTestApp;
  beforeAll(async () => {
    context = await createStudentTestApp();
  });
  beforeEach(async () => {
    await context.reset();
  });
  afterAll(async () => {
    await context?.close();
  });

  it('lists only published, currently open quizzes assigned to the student’s class', async () => {
    const open = await context.publishQuiz();
    await context.publishQuiz({
      opensAt: new Date(context.now().getTime() + 60_000).toISOString(),
    });
    const closed = await context.publishQuiz();
    await context.db.quiz.update({
      where: { id: closed.id },
      data: {
        opensAt: new Date(context.now().getTime() - 120_000),
        closesAt: new Date(context.now().getTime() - 60_000),
      },
    });
    await context.publishQuiz({ classIds: [context.secondClass.id] });
    await context
      .api('teacher', 'post', '/quizzes', context.quiz())
      .expect(201);
    const response = await context.studentApi('get', '/quizzes').expect(200);
    expect(response.body.items.map((q: { id: string }) => q.id)).toEqual([
      open.id,
    ]);
    expect(response.body.total).toBe(1);
    expect(response.body.items[0]).toMatchObject({
      questionCount: 3,
      maxScore: '7',
      attempt: null,
    });
    expect(JSON.stringify(response.body)).not.toContain('isCorrect');
    expect(JSON.stringify(response.body)).not.toContain('options');
  });

  it('returns quiz metadata before starting without exposing question text or answer keys', async () => {
    const quiz = await context.publishQuiz();
    const response = await context
      .studentApi('get', `/quizzes/${quiz.id}`)
      .expect(200);
    expect(response.body).toMatchObject({
      id: quiz.id,
      questionCount: 3,
      maxScore: '7',
      negativeMarking: 'FRACTION',
      penaltyValue: '0.25',
    });
    expect(response.body.questions).toBeUndefined();
    expect(await context.db.attempt.count()).toBe(0);
  });

  it.each(['draft', 'upcoming', 'closed', 'another class'] as const)(
    'rejects a direct attempt-start request for a quiz that is %s',
    async (scenario) => {
      const quiz = await context.publishQuiz();
      if (scenario === 'draft')
        await context.db.quiz.update({
          where: { id: quiz.id },
          data: { status: 'DRAFT' },
        });
      if (scenario === 'upcoming')
        context.setTime(new Date(context.now().getTime() - 120_000));
      if (scenario === 'closed')
        context.setTime(new Date(context.now().getTime() + 3_600_000));
      const username = scenario === 'another class' ? 'outsider' : 'student';
      await context
        .studentApi('post', `/quizzes/${quiz.id}/attempt`, undefined, username)
        .expect(404);
      await context
        .studentApi('get', `/quizzes/${quiz.id}`, undefined, username)
        .expect(404);
      expect(await context.db.attempt.count()).toBe(0);
    },
  );

  it('opens at the exact opening instant and rejects a new start at the closing instant', async () => {
    const opening = new Date(context.now().getTime() + 60_000);
    const closing = new Date(opening.getTime() + 60_000);
    const quiz = await context.publishQuiz({
      opensAt: opening.toISOString(),
      closesAt: closing.toISOString(),
    });
    context.setTime(opening);
    await context.studentApi('post', `/quizzes/${quiz.id}/attempt`).expect(200);
    context.setTime(closing);
    await context
      .studentApi('post', `/quizzes/${quiz.id}/attempt`, undefined, 'classmate')
      .expect(404);
  });
});
