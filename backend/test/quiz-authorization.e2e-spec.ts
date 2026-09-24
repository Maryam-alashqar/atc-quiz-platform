import request from 'supertest';
import {
  createQuizTestApp,
  type QuizTestApp,
} from './helpers/quiz-test-app.js';

describe('Quiz management — ownership and role authorization', () => {
  let context: QuizTestApp;
  let quizId: string;
  beforeAll(async () => {
    context = await createQuizTestApp();
  });
  beforeEach(async () => {
    await context.db.quiz.deleteMany();
    quizId = (
      await context
        .api('teacher', 'post', '/quizzes', context.quiz())
        .expect(201)
    ).body.id;
  });
  afterAll(async () => {
    await context?.close();
  });

  it('requires authentication to list quizzes and classes', async () => {
    await request(context.app.getHttpServer()).get('/api/quizzes').expect(401);
    await request(context.app.getHttpServer()).get('/api/classes').expect(401);
  });

  it('prevents a student from accessing quiz management or correct-answer data', async () => {
    await context.api('student', 'get', '/quizzes').expect(403);
    await context.api('student', 'get', `/quizzes/${quizId}`).expect(403);
    await context.api('student', 'get', '/classes').expect(403);
    await context
      .api('student', 'post', '/quizzes', context.quiz())
      .expect(403);
    await context
      .api('student', 'patch', `/quizzes/${quizId}`, { title: 'Forbidden' })
      .expect(403);
    await context
      .api('student', 'post', `/quizzes/${quizId}/publish`)
      .expect(403);
    await context.api('student', 'delete', `/quizzes/${quizId}`).expect(403);
  });

  it('returns 404 when another teacher tries to read, edit, publish or delete a quiz', async () => {
    await context.api('other-teacher', 'get', `/quizzes/${quizId}`).expect(404);
    await context
      .api('other-teacher', 'patch', `/quizzes/${quizId}`, {
        title: 'Forbidden',
      })
      .expect(404);
    await context
      .api('other-teacher', 'post', `/quizzes/${quizId}/publish`)
      .expect(404);
    await context
      .api('other-teacher', 'delete', `/quizzes/${quizId}`)
      .expect(404);
    expect(
      (await context.db.quiz.findUniqueOrThrow({ where: { id: quizId } }))
        .title,
    ).toBe('اختبار الجبر');
  });

  it('allows an admin to read, edit, publish and delete another teacher’s unused quiz', async () => {
    await context.api('admin', 'get', `/quizzes/${quizId}`).expect(200);
    await context
      .api('admin', 'patch', `/quizzes/${quizId}`, { title: 'Admin edit' })
      .expect(200);
    await context
      .api('admin', 'post', `/quizzes/${quizId}/publish`)
      .expect(200);
    await context.api('admin', 'delete', `/quizzes/${quizId}`).expect(204);
  });

  it('prevents a teacher from forging quiz ownership during creation', async () => {
    await context
      .api('teacher', 'post', '/quizzes', {
        ...context.quiz(),
        teacherId: context.otherTeacher.id,
      })
      .expect(403);
  });

  it('requires an admin to select a teacher rather than a student as quiz owner', async () => {
    await context.api('admin', 'post', '/quizzes', context.quiz()).expect(400);
    await context
      .api('admin', 'post', '/quizzes', {
        ...context.quiz(),
        teacherId: context.student.id,
      })
      .expect(400);
  });

  it('rejects ownership transfer even for an admin', async () => {
    await context
      .api('admin', 'patch', `/quizzes/${quizId}`, {
        teacherId: context.otherTeacher.id,
      })
      .expect(400);
  });
});
