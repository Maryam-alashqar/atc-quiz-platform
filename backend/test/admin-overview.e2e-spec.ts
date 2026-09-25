import {
  createQuizTestApp,
  type QuizTestApp,
} from './helpers/quiz-test-app.js';

describe('Admin — centre overview', () => {
  let context: QuizTestApp;
  beforeAll(async () => {
    context = await createQuizTestApp();
  });
  afterAll(async () => {
    await context?.close();
  });

  async function publish(overrides: object = {}) {
    const created = await context
      .api('teacher', 'post', '/quizzes', { ...context.quiz(), ...overrides })
      .expect(201);
    await context
      .api('teacher', 'post', `/quizzes/${created.body.id}/publish`)
      .expect(200);
    return created.body.id as string;
  }

  it('counts people and quizzes and computes participation from real attempts', async () => {
    const open = await publish();
    await publish({
      opensAt: new Date(Date.now() + 86_400_000).toISOString(),
      closesAt: new Date(Date.now() + 2 * 86_400_000).toISOString(),
    });
    await context
      .api('teacher', 'post', '/quizzes', context.quiz())
      .expect(201);

    // The single 10A student takes and submits the open quiz.
    const attempt = await context
      .api('student', 'post', `/student/quizzes/${open}/attempt`)
      .expect(200);
    await context
      .api('student', 'post', `/student/attempts/${attempt.body.id}/submit`)
      .expect(200);

    const response = await context.api('admin', 'get', '/overview').expect(200);
    expect(response.body.counts).toMatchObject({
      students: 1,
      teachers: 2,
      classes: 2,
      liveQuizzes: 1,
      scheduledQuizzes: 1,
      draftQuizzes: 1,
    });
    // One opened quiz × one student in 10A = one expected attempt, and it was completed.
    expect(response.body.overall).toMatchObject({
      completed: 1,
      expected: 1,
      participation: 100,
      averagePercent: 0,
    });
    expect(
      response.body.classes.find((c: { name: string }) => c.name === '10A'),
    ).toMatchObject({ students: 1, quizzes: 1, participation: 100 });
    expect(
      response.body.teachers.find(
        (t: { username: string }) => t.username === 'teacher',
      ),
    ).toMatchObject({ quizzes: 1, completed: 1 });
    expect(response.body.recent[0]).toMatchObject({
      quiz: { id: open },
      student: { name: 'أحمد الخطيب', className: '10A' },
    });
    expect(JSON.stringify(response.body)).not.toMatch(/password|isCorrect/i);
  });

  it('gives a teacher the same view limited to their own quizzes and classes', async () => {
    // Another teacher's live quiz for 10B must not appear in this teacher's figures.
    const foreign = await context
      .api('other-teacher', 'post', '/quizzes', {
        ...context.quiz(),
        classIds: [context.secondClass.id],
      })
      .expect(201);
    await context
      .api('other-teacher', 'post', `/quizzes/${foreign.body.id}/publish`)
      .expect(200);

    const response = await context
      .api('teacher', 'get', '/overview')
      .expect(200);
    expect(response.body.scope).toBe('TEACHER');
    expect(response.body.teachers).toEqual([]);
    expect(response.body.classes.map((c: { name: string }) => c.name)).toEqual([
      '10A',
    ]);
    expect(
      response.body.quizzes.map((q: { id: string }) => q.id),
    ).not.toContain(foreign.body.id);
    expect(response.body.quizzes[0]).toMatchObject({
      open: true,
      expected: 1,
      completed: 1,
      notStarted: 0,
    });
    expect(
      response.body.recent.every(
        (r: { quiz: { id: string } }) => r.quiz.id !== foreign.body.id,
      ),
    ).toBe(true);
  });

  it('grades abandoned attempts whose time is up before reporting', async () => {
    const quiz = await publish();
    const attempt = await context
      .api('student', 'post', `/student/quizzes/${quiz}/attempt`)
      .expect(200);
    // The student walked away: move the deadline (and grace period) into the past.
    await context.db.attempt.update({
      where: { id: attempt.body.id },
      data: {
        startedAt: new Date(Date.now() - 3_600_000),
        deadlineAt: new Date(Date.now() - 60_000),
      },
    });
    const response = await context
      .api('teacher', 'get', '/overview')
      .expect(200);
    expect(
      response.body.quizzes.find((q: { id: string }) => q.id === quiz),
    ).toMatchObject({ completed: 1, inProgress: 0 });
    expect(
      (
        await context.db.attempt.findUniqueOrThrow({
          where: { id: attempt.body.id },
        })
      ).status,
    ).toBe('EXPIRED');
  });

  it('is not available to students', async () => {
    await context.api('student', 'get', '/overview').expect(403);
  });
});
