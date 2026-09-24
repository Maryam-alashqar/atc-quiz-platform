import {
  answer,
  createStudentTestApp,
  type StudentTestApp,
} from './helpers/student-test-app.js';

describe('Student attempts - server deadlines and expiry', () => {
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

  it('caps the timer at quiz closing time and accepts the last answer only before grace ends', async () => {
    const closesAt = new Date(context.now().getTime() + 30_000).toISOString();
    const quiz = await context.publishQuiz({ closesAt });
    const started = await context
      .studentApi('post', `/quizzes/${quiz.id}/attempt`)
      .expect(200);
    expect(started.body.deadlineAt).toBe(closesAt);
    context.setTime(new Date(new Date(started.body.graceEndsAt).getTime() - 1));
    await context
      .studentApi(
        'put',
        `/attempts/${started.body.id}/answers`,
        answer(quiz, 0, true),
      )
      .expect(200);
    context.setTime(started.body.graceEndsAt);
    await context
      .studentApi(
        'put',
        `/attempts/${started.body.id}/answers`,
        answer(quiz, 1, true),
      )
      .expect(409);
    const stored = await context.db.attempt.findUniqueOrThrow({
      where: { id: started.body.id },
      include: { answers: true },
    });
    expect(stored.status).toBe('EXPIRED');
    expect(stored.score!.toString()).toBe('1.5');
    expect(stored.answers).toHaveLength(1);
  });

  it.each(['read', 'history', 'dashboard', 'preview', 'restart', 'submit'])(
    'persists expiry and grades saved answers when the next request is %s',
    async (action) => {
      const quiz = await context.publishQuiz({ durationMinutes: 1 });
      const started = await context
        .studentApi('post', `/quizzes/${quiz.id}/attempt`)
        .expect(200);
      await context
        .studentApi(
          'put',
          `/attempts/${started.body.id}/answers`,
          answer(quiz, 1, true),
        )
        .expect(200);
      context.setTime(started.body.graceEndsAt);
      const paths = {
        read: `/attempts/${started.body.id}`,
        history: '/attempts',
        dashboard: '/quizzes',
        preview: `/quizzes/${quiz.id}`,
        restart: `/quizzes/${quiz.id}/attempt`,
        submit: `/attempts/${started.body.id}/submit`,
      };
      await context
        .studentApi(
          action === 'restart' || action === 'submit' ? 'post' : 'get',
          paths[action as keyof typeof paths],
        )
        .expect(action === 'restart' ? 409 : 200);
      const stored = await context.db.attempt.findUniqueOrThrow({
        where: { id: started.body.id },
      });
      expect(stored.status).toBe('EXPIRED');
      expect(stored.score!.toString()).toBe('2.5');
      const repeated = await context
        .studentApi('post', `/attempts/${started.body.id}/submit`)
        .expect(200);
      expect(repeated.body.submittedAt).toBe(stored.submittedAt!.toISOString());
    },
  );
});
