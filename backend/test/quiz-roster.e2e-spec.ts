import {
  createQuizTestApp,
  type QuizTestApp,
} from './helpers/quiz-test-app.js';

describe('Quiz results — every assigned student, including who has not started', () => {
  let context: QuizTestApp;
  let quizId: string;
  beforeAll(async () => {
    context = await createQuizTestApp();
    // A second 10A student and a 10B student who will not start the quiz.
    for (const [username, classId] of [
      ['classmate', context.classroom.id],
      ['b-student', context.secondClass.id],
    ] as const)
      await context.db.user.create({
        data: {
          username,
          name: username,
          role: 'STUDENT',
          classId,
          passwordHash: context.student.passwordHash,
        },
      });
    const created = await context
      .api('teacher', 'post', '/quizzes', {
        ...context.quiz(),
        classIds: [context.classroom.id, context.secondClass.id],
      })
      .expect(201);
    quizId = created.body.id;
    await context
      .api('teacher', 'post', `/quizzes/${quizId}/publish`)
      .expect(200);
    const attempt = await context
      .api('student', 'post', `/student/quizzes/${quizId}/attempt`)
      .expect(200);
    await context
      .api('student', 'post', `/student/attempts/${attempt.body.id}/submit`)
      .expect(200);
  });
  afterAll(async () => {
    await context?.close();
  });

  it('lists all students in the assigned classes with their status', async () => {
    const response = await context
      .api('teacher', 'get', `/quizzes/${quizId}/results/students`)
      .expect(200);
    expect(response.body.summary).toEqual({
      assigned: 3,
      notStarted: 2,
      inProgress: 0,
      submitted: 1,
      expired: 0,
    });
    const byUsername = Object.fromEntries(
      response.body.items.map(
        (row: { student: { username: string }; attempt: unknown }) => [
          row.student.username,
          row.attempt,
        ],
      ),
    );
    expect(byUsername.student).toMatchObject({ status: 'SUBMITTED' });
    expect(byUsername.classmate).toBeNull();
    expect(byUsername['b-student']).toBeNull();
    // Classes in name order, so the teacher can scan one class at a time.
    expect(
      response.body.items.map(
        (row: { student: { class: { name: string } } }) =>
          row.student.class.name,
      ),
    ).toEqual(['10A', '10A', '10B']);
    expect(JSON.stringify(response.body)).not.toMatch(/password|isCorrect/i);
  });

  it('keeps a student who took the quiz and then moved to an unassigned class', async () => {
    const other = await context.db.class.create({ data: { name: '12Z' } });
    await context.db.user.update({
      where: { id: context.student.id },
      data: { classId: other.id },
    });
    const response = await context
      .api('teacher', 'get', `/quizzes/${quizId}/results/students`)
      .expect(200);
    expect(
      response.body.items.find(
        (row: { student: { username: string } }) =>
          row.student.username === 'student',
      ),
    ).toMatchObject({ attempt: { status: 'SUBMITTED' } });
    await context.db.user.update({
      where: { id: context.student.id },
      data: { classId: context.classroom.id },
    });
  });

  it('is visible to the admin but hidden from other teachers and students', async () => {
    await context
      .api('admin', 'get', `/quizzes/${quizId}/results/students`)
      .expect(200);
    await context
      .api('other-teacher', 'get', `/quizzes/${quizId}/results/students`)
      .expect(404);
    await context
      .api('student', 'get', `/quizzes/${quizId}/results/students`)
      .expect(403);
  });
});
