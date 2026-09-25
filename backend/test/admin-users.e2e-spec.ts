import request from 'supertest';
import {
  createQuizTestApp,
  type QuizTestApp,
} from './helpers/quiz-test-app.js';
import { TEST_PASSWORD } from './helpers/auth-test-app.js';

const NEW_PASSWORD = 'Welcome2026!';

describe('Admin — managing student and teacher accounts', () => {
  let context: QuizTestApp;
  beforeAll(async () => {
    context = await createQuizTestApp();
  });
  afterAll(async () => {
    await context?.close();
  });
  afterEach(async () => {
    await context.db.user.deleteMany({
      where: { username: { startsWith: 'new-' } },
    });
  });

  const student = (overrides: object = {}) => ({
    username: 'new-student',
    name: 'ليان أحمد',
    role: 'STUDENT',
    classId: context.classroom.id,
    password: NEW_PASSWORD,
    ...overrides,
  });

  it('lists students and teachers without password hashes, and never lists admins', async () => {
    const response = await context.api('admin', 'get', '/users').expect(200);
    const usernames = response.body.items.map(
      (u: { username: string }) => u.username,
    );
    expect(usernames).toEqual(
      expect.arrayContaining(['student', 'teacher', 'other-teacher']),
    );
    expect(usernames).not.toContain('admin');
    expect(JSON.stringify(response.body)).not.toMatch(/password/i);
    expect(
      response.body.items.find(
        (u: { username: string }) => u.username === 'student',
      ),
    ).toMatchObject({
      role: 'STUDENT',
      class: { name: '10A' },
      attemptCount: 0,
    });
  });

  it('filters by role, class and an Arabic name search', async () => {
    const teachers = await context
      .api('admin', 'get', '/users?role=TEACHER')
      .expect(200);
    expect(
      teachers.body.items.every((u: { role: string }) => u.role === 'TEACHER'),
    ).toBe(true);
    const byClass = await context
      .api('admin', 'get', `/users?classId=${context.secondClass.id}`)
      .expect(200);
    expect(byClass.body.total).toBe(0);
    const search = await context
      .api('admin', 'get', `/users?search=${encodeURIComponent('الخطيب')}`)
      .expect(200);
    expect(
      search.body.items.map((u: { username: string }) => u.username),
    ).toEqual(['student']);
  });

  it('creates a student who can then sign in with the initial password', async () => {
    const created = await context
      .api('admin', 'post', '/users', student({ username: '  New-Student ' }))
      .expect(201);
    expect(created.body).toMatchObject({
      username: 'new-student',
      name: 'ليان أحمد',
      role: 'STUDENT',
      class: { id: context.classroom.id },
    });
    expect(JSON.stringify(created.body)).not.toMatch(/password/i);
    const login = await context.login('new-student', NEW_PASSWORD).expect(200);
    expect(login.body.user).toMatchObject({
      role: 'STUDENT',
      className: '10A',
    });
  });

  it('creates a teacher who can own a quiz the admin creates for them', async () => {
    const teacher = await context
      .api('admin', 'post', '/users', {
        username: 'new-teacher',
        name: 'Huda',
        role: 'TEACHER',
        password: NEW_PASSWORD,
      })
      .expect(201);
    expect(teacher.body.class).toBeNull();
    const quiz = await context
      .api('admin', 'post', '/quizzes', {
        ...context.quiz(),
        teacherId: teacher.body.id,
      })
      .expect(201);
    expect(quiz.body.teacher.id).toBe(teacher.body.id);
    await context.db.quiz.delete({ where: { id: quiz.body.id } });
  });

  it.each([
    ['a student without a class', { classId: undefined }],
    ['a teacher with a class', { role: 'TEACHER' }],
    ['an unknown class', { classId: '00000000-0000-4000-8000-000000000000' }],
    ['a username with spaces', { username: 'new student' }],
    ['a short password', { password: 'short' }],
    ['an admin role', { role: 'ADMIN' }],
    ['a smuggled password hash', { passwordHash: 'scrypt$x$y' }],
  ])('rejects %s with 400 and creates nothing', async (_name, overrides) => {
    await context
      .api('admin', 'post', '/users', student(overrides))
      .expect(400);
    expect(
      await context.db.user.count({
        where: { username: { startsWith: 'new' } },
      }),
    ).toBe(0);
  });

  it('rejects a username that is already taken, ignoring letter case', async () => {
    const response = await context
      .api('admin', 'post', '/users', student({ username: 'STUDENT' }))
      .expect(409);
    expect(response.body.message).toBe('This username is already taken');
  });

  it('renames a student and moves them to another class', async () => {
    const { body } = await context
      .api('admin', 'post', '/users', student())
      .expect(201);
    const updated = await context
      .api('admin', 'patch', `/users/${body.id}`, {
        name: 'ليان محمود',
        classId: context.secondClass.id,
      })
      .expect(200);
    expect(updated.body).toMatchObject({
      name: 'ليان محمود',
      class: { name: '10B' },
    });
  });

  it('refuses to give a teacher a class, an empty update, and editing an admin', async () => {
    await context
      .api('admin', 'patch', `/users/${context.teacher.id}`, {
        classId: context.classroom.id,
      })
      .expect(400);
    await context
      .api('admin', 'patch', `/users/${context.student.id}`, {})
      .expect(400);
    const admin = await context.db.user.findUniqueOrThrow({
      where: { username: 'admin' },
    });
    await context
      .api('admin', 'patch', `/users/${admin.id}`, { name: 'x' })
      .expect(404);
    await context
      .api('admin', 'post', `/users/${admin.id}/password`, {
        password: NEW_PASSWORD,
      })
      .expect(404);
  });

  it('resets a password so only the new one works', async () => {
    const { body } = await context
      .api('admin', 'post', '/users', student({ password: TEST_PASSWORD }))
      .expect(201);
    await context
      .api('admin', 'post', `/users/${body.id}/password`, {
        password: NEW_PASSWORD,
      })
      .expect(204);
    await context.login('new-student', TEST_PASSWORD).expect(401);
    await context.login('new-student', NEW_PASSWORD).expect(200);
  });

  it.each(['student', 'teacher'])(
    'forbids a %s from listing, creating or changing accounts',
    async (role) => {
      await context.api(role, 'get', '/users').expect(403);
      await context.api(role, 'post', '/users', student()).expect(403);
      await context
        .api(role, 'post', `/users/${context.student.id}/password`, {
          password: NEW_PASSWORD,
        })
        .expect(403);
      await context.login('student').expect(200);
    },
  );

  it('requires a session and a trusted origin', async () => {
    await request(context.app.getHttpServer()).get('/api/users').expect(401);
    const admin = await context.login('admin').expect(200);
    await request(context.app.getHttpServer())
      .post('/api/users')
      .set('Cookie', String(admin.headers['set-cookie']![0]).split(';')[0])
      .send(student())
      .expect(403);
  });
});
