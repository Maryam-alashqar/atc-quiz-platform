import {
  createStudentTestApp,
  type StudentTestApp,
} from './helpers/student-test-app.js';

// Fixture: 'student' and 'classmate' are in 10A, 'outsider' is in 10B.
describe('Quiz audience — whole classes or named students', () => {
  let context: StudentTestApp;
  let ids: Record<'student' | 'classmate' | 'outsider', string>;
  beforeAll(async () => {
    context = await createStudentTestApp();
    const users = await context.db.user.findMany({
      where: { username: { in: ['student', 'classmate', 'outsider'] } },
    });
    ids = Object.fromEntries(
      users.map((u) => [u.username, u.id]),
    ) as typeof ids;
  });
  beforeEach(async () => {
    await context.reset();
  });
  afterAll(async () => {
    await context?.close();
  });

  /** A quiz for 'student' (10A) and 'outsider' (10B) by name, not for 'classmate'. */
  const namedQuiz = () =>
    context.publishQuiz({
      audience: 'STUDENTS',
      classIds: [],
      studentIds: [ids.student, ids.outsider],
    });

  it('is visible and startable only for the named students, across classes', async () => {
    const quiz = await namedQuiz();
    for (const username of ['student', 'outsider']) {
      const list = await context
        .studentApi('get', '/quizzes', undefined, username)
        .expect(200);
      expect(list.body.items.map((q: { id: string }) => q.id)).toContain(
        quiz.id,
      );
      await context
        .studentApi('post', `/quizzes/${quiz.id}/attempt`, undefined, username)
        .expect(200);
    }
  });

  it('is invisible to a classmate who was not named, even by direct request', async () => {
    const quiz = await namedQuiz();
    const list = await context
      .studentApi('get', '/quizzes', undefined, 'classmate')
      .expect(200);
    expect(list.body.items).toEqual([]);
    await context
      .studentApi('get', `/quizzes/${quiz.id}`, undefined, 'classmate')
      .expect(404);
    await context
      .studentApi('post', `/quizzes/${quiz.id}/attempt`, undefined, 'classmate')
      .expect(404);
    expect(await context.db.attempt.count()).toBe(0);
  });

  it('shows an upcoming named quiz only to the named students', async () => {
    await context.publishQuiz({
      audience: 'STUDENTS',
      classIds: [],
      studentIds: [ids.outsider],
      opensAt: new Date(context.now().getTime() + 60_000).toISOString(),
    });
    const outsider = await context
      .studentApi('get', '/quizzes/upcoming', undefined, 'outsider')
      .expect(200);
    const student = await context
      .studentApi('get', '/quizzes/upcoming', undefined, 'student')
      .expect(200);
    expect(outsider.body.total).toBe(1);
    expect(student.body.total).toBe(0);
  });

  it('ignores the class list when the audience is named students', async () => {
    // Classes left over from an earlier choice must not grant access.
    const quiz = await context.publishQuiz({
      audience: 'STUDENTS',
      classIds: [context.classroom.id],
      studentIds: [ids.outsider],
    });
    await context
      .studentApi('post', `/quizzes/${quiz.id}/attempt`, undefined, 'classmate')
      .expect(404);
  });

  it('requires at least one named student to publish, and only real students', async () => {
    const draft = await context
      .api('teacher', 'post', '/quizzes', {
        ...context.quiz(),
        audience: 'STUDENTS',
        classIds: [],
        studentIds: [],
      })
      .expect(201);
    const publish = await context
      .api('teacher', 'post', `/quizzes/${draft.body.id}/publish`)
      .expect(400);
    expect(publish.body.message).toMatch(/at least one student/);
    await context
      .api('teacher', 'post', '/quizzes', {
        ...context.quiz(),
        audience: 'STUDENTS',
        studentIds: [context.teacher.id],
      })
      .expect(400);
    await context
      .api('teacher', 'post', '/quizzes', {
        ...context.quiz(),
        audience: 'STUDENTS',
        studentIds: ['00000000-0000-4000-8000-000000000000'],
      })
      .expect(400);
  });

  it('freezes the audience and the named list once a student has started', async () => {
    const quiz = await namedQuiz();
    await context
      .studentApi('post', `/quizzes/${quiz.id}/attempt`, undefined, 'student')
      .expect(200);
    await context
      .api('teacher', 'patch', `/quizzes/${quiz.id}`, {
        studentIds: [ids.student, ids.classmate],
      })
      .expect(409);
    await context
      .api('teacher', 'patch', `/quizzes/${quiz.id}`, { audience: 'CLASSES' })
      .expect(409);
  });

  it('returns the named students in the quiz detail for the editor', async () => {
    const quiz = await namedQuiz();
    const detail = await context
      .api('teacher', 'get', `/quizzes/${quiz.id}`)
      .expect(200);
    expect(detail.body).toMatchObject({
      audience: 'STUDENTS',
      studentCount: 2,
    });
    expect(
      detail.body.students.map((s: { username: string }) => s.username).sort(),
    ).toEqual(['outsider', 'student']);
  });

  it('lists only the named students on the results roster and in the follow-up figures', async () => {
    const quiz = await namedQuiz();
    const roster = await context
      .api('teacher', 'get', `/quizzes/${quiz.id}/results/students`)
      .expect(200);
    expect(
      roster.body.items
        .map((r: { student: { username: string } }) => r.student.username)
        .sort(),
    ).toEqual(['outsider', 'student']);
    expect(roster.body.summary).toMatchObject({ assigned: 2, notStarted: 2 });

    const overview = await context
      .api('teacher', 'get', '/overview')
      .expect(200);
    expect(
      overview.body.quizzes.find((q: { id: string }) => q.id === quiz.id),
    ).toMatchObject({ audience: 'STUDENTS', expected: 2, notStarted: 2 });
  });
});

describe('Teacher — my students and the student lookup', () => {
  let context: StudentTestApp;
  beforeAll(async () => {
    context = await createStudentTestApp();
  });
  afterAll(async () => {
    await context?.close();
  });

  it('lists the students of the teacher’s classes with their progress', async () => {
    const quiz = await context.publishQuiz();
    const attempt = await context
      .studentApi('post', `/quizzes/${quiz.id}/attempt`)
      .expect(200);
    await context
      .studentApi('post', `/attempts/${attempt.body.id}/submit`)
      .expect(200);
    const response = await context
      .api('teacher', 'get', '/overview/students')
      .expect(200);
    const rows = Object.fromEntries(
      response.body.items.map((r: { student: { username: string } }) => [
        r.student.username,
        r,
      ]),
    );
    // The quiz is for 10A: 'outsider' (10B) is not this teacher's student.
    expect(Object.keys(rows).sort()).toEqual(['classmate', 'student']);
    expect(rows.student).toMatchObject({
      assigned: 1,
      completed: 1,
      openNotStarted: 0,
    });
    expect(rows.classmate).toMatchObject({
      assigned: 1,
      completed: 0,
      openNotStarted: 1,
    });
  });

  it('lets a teacher look students up by name, without account details', async () => {
    const response = await context
      .api('teacher', 'get', `/students?search=${encodeURIComponent('الخطيب')}`)
      .expect(200);
    expect(response.body.items).toEqual([
      expect.objectContaining({
        username: 'student',
        class: expect.objectContaining({ name: '10A' }),
      }),
    ]);
    expect(JSON.stringify(response.body)).not.toMatch(/password|role|attempt/i);
  });

  it('keeps both endpoints away from students', async () => {
    await context.api('student', 'get', '/students').expect(403);
    await context.api('student', 'get', '/overview/students').expect(403);
  });
});
