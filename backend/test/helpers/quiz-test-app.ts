import request from 'supertest';
import type { SaveQuizDto } from '../../src/quizzes/dto/save-quiz.dto.js';
import { createAuthTestApp, sessionCookie } from './auth-test-app.js';

export async function createQuizTestApp() {
  const context = await createAuthTestApp();
  try {
    const teacher = await context.db.user.findUniqueOrThrow({
      where: { username: 'teacher' },
    });
    const student = await context.db.user.findUniqueOrThrow({
      where: { username: 'student' },
    });
    const otherTeacher = await context.db.user.create({
      data: {
        username: 'other-teacher',
        name: 'Other teacher',
        passwordHash: teacher.passwordHash,
        role: 'TEACHER',
      },
    });
    const secondClass = await context.db.class.create({
      data: { name: '10B' },
    });
    const cookies = new Map<string, string>();
    for (const role of ['student', 'teacher', 'admin', 'other-teacher'])
      cookies.set(role, sessionCookie(await context.login(role).expect(200)));
    return {
      ...context,
      teacher,
      student,
      otherTeacher,
      secondClass,
      api: (
        role: string,
        method: 'get' | 'post' | 'put' | 'patch' | 'delete',
        path: string,
        body?: object,
      ) => {
        const call = request(context.app.getHttpServer())
          [method](`/api${path}`)
          .set('Cookie', cookies.get(role)!)
          .set('Origin', context.config.FRONTEND_ORIGIN);
        return body === undefined ? call : call.send(body);
      },
      quiz: (): SaveQuizDto => ({
        title: 'اختبار الجبر',
        description: 'مراجعة أسبوعية',
        language: 'AR',
        durationMinutes: 20,
        opensAt: new Date(Date.now() - 60_000).toISOString(),
        closesAt: new Date(Date.now() + 3_600_000).toISOString(),
        classIds: [context.classroom.id],
        negativeMarking: 'FRACTION',
        penaltyValue: '0.25',
        questions: [
          {
            prompt: 'ما ناتج 2 + 2؟',
            points: '1.5',
            options: [
              { text: '3', isCorrect: false },
              { text: '4', isCorrect: true },
              { text: '5', isCorrect: false },
              { text: '6', isCorrect: false },
            ],
          },
        ],
      }),
    };
  } catch (error) {
    await context.close();
    throw error;
  }
}

export type QuizTestApp = Awaited<ReturnType<typeof createQuizTestApp>>;
