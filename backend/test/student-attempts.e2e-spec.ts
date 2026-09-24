import {
  answer,
  createStudentTestApp,
  type StudentTestApp,
} from './helpers/student-test-app.js';

describe('Student attempts — persistence, submission and history', () => {
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

  it('starts once and resumes the same attempt with its original timer after a refresh', async () => {
    const quiz = await context.publishQuiz();
    const first = await context
      .studentApi('post', `/quizzes/${quiz.id}/attempt`)
      .expect(200);
    expect(first.body).toMatchObject({
      quizId: quiz.id,
      status: 'IN_PROGRESS',
      score: null,
      maxScore: '7',
      percentage: null,
    });
    context.setTime(new Date(context.now().getTime() + 60_000));
    const resumed = await context
      .studentApi('post', `/quizzes/${quiz.id}/attempt`)
      .expect(200);
    expect(resumed.body.id).toBe(first.body.id);
    expect(resumed.body.startedAt).toBe(first.body.startedAt);
    expect(resumed.body.deadlineAt).toBe(first.body.deadlineAt);
    expect(await context.db.attempt.count()).toBe(1);
  });

  it('persists each answer, supports changing it, and restores it when the attempt is reopened', async () => {
    const quiz = await context.publishQuiz();
    const started = await context
      .studentApi('post', `/quizzes/${quiz.id}/attempt`)
      .expect(200);
    const path = `/attempts/${started.body.id}`;
    await context
      .studentApi('put', `${path}/answers`, answer(quiz, 0, false))
      .expect(200);
    await context
      .studentApi('put', `${path}/answers`, answer(quiz, 0, true))
      .expect(200);
    const reopened = await context.studentApi('get', path).expect(200);
    expect(reopened.body.answers).toEqual([answer(quiz, 0, true)]);
    expect(await context.db.answer.count()).toBe(1);
    await context
      .studentApi('put', `${path}/answers`, {
        questionId: quiz.questions[0].id,
        optionId: null,
      })
      .expect(200);
    expect((await context.studentApi('get', path)).body.answers).toEqual([]);
    expect(await context.db.answer.count()).toBe(0);
  });

  it.each([
    ['NONE', '0', '1.5', '21.43'],
    ['FRACTION', '0.25', '0.875', '12.50'],
    ['FIXED', '0.5', '1', '14.29'],
  ] as const)(
    'grades saved weighted answers using %s negative marking',
    async (mode, penaltyValue, score, percentage) => {
      const quiz = await context.publishQuiz({
        negativeMarking: mode,
        penaltyValue,
      });
      const started = await context
        .studentApi('post', `/quizzes/${quiz.id}/attempt`)
        .expect(200);
      const path = `/attempts/${started.body.id}`;
      await context
        .studentApi('put', `${path}/answers`, answer(quiz, 0, true))
        .expect(200);
      await context
        .studentApi('put', `${path}/answers`, answer(quiz, 1, false))
        .expect(200);
      const result = await context
        .studentApi('post', `${path}/submit`)
        .expect(200);
      expect(result.body).toMatchObject({
        status: 'SUBMITTED',
        score,
        maxScore: '7',
        percentage,
      });
      expect(result.body.submittedAt).toBe(context.now().toISOString());
      expect(JSON.stringify(result.body)).not.toContain('isCorrect');
    },
  );

  it('submits unanswered questions as zero and never produces a negative final score', async () => {
    const quiz = await context.publishQuiz({
      negativeMarking: 'FIXED',
      penaltyValue: '10',
    });
    const started = await context
      .studentApi('post', `/quizzes/${quiz.id}/attempt`)
      .expect(200);
    await context
      .studentApi(
        'put',
        `/attempts/${started.body.id}/answers`,
        answer(quiz, 0, false),
      )
      .expect(200);
    const result = await context
      .studentApi('post', `/attempts/${started.body.id}/submit`)
      .expect(200);
    expect(result.body.score).toBe('0');
    expect(result.body.percentage).toBe('0.00');
  });

  it('keeps repeated submissions idempotent and blocks both retakes and later answer changes', async () => {
    const quiz = await context.publishQuiz();
    const started = await context
      .studentApi('post', `/quizzes/${quiz.id}/attempt`)
      .expect(200);
    const first = await context
      .studentApi('post', `/attempts/${started.body.id}/submit`)
      .expect(200);
    context.setTime(new Date(context.now().getTime() + 30_000));
    const second = await context
      .studentApi('post', `/attempts/${started.body.id}/submit`)
      .expect(200);
    expect(second.body.score).toBe(first.body.score);
    expect(second.body.submittedAt).toBe(first.body.submittedAt);
    await context.studentApi('post', `/quizzes/${quiz.id}/attempt`).expect(409);
    await context
      .studentApi(
        'put',
        `/attempts/${started.body.id}/answers`,
        answer(quiz, 0, true),
      )
      .expect(409);
    expect(await context.db.attempt.count()).toBe(1);
  });

  it('keeps past results accessible through history after the quiz has closed', async () => {
    const quiz = await context.publishQuiz();
    const started = await context
      .studentApi('post', `/quizzes/${quiz.id}/attempt`)
      .expect(200);
    await context
      .studentApi('post', `/attempts/${started.body.id}/submit`)
      .expect(200);
    context.setTime(new Date(context.now().getTime() + 4_000_000));
    expect(
      (await context.studentApi('get', '/quizzes').expect(200)).body.total,
    ).toBe(0);
    const history = await context
      .studentApi('get', '/attempts?page=1&pageSize=1')
      .expect(200);
    expect(history.body.total).toBe(1);
    expect(history.body.items[0]).toMatchObject({
      id: started.body.id,
      status: 'SUBMITTED',
      score: '0',
    });
    await context.studentApi('get', `/attempts/${started.body.id}`).expect(200);
    await context.studentApi('get', `/quizzes/${quiz.id}`).expect(200);
  });
});
