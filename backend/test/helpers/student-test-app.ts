import request from 'supertest';
import { vi } from 'vitest';
import { AttemptClock } from '../../src/attempts/attempt-clock.js';
import type { SaveQuizDto } from '../../src/quizzes/dto/save-quiz.dto.js';
import { createQuizTestApp } from './quiz-test-app.js';
import { sessionCookie } from './auth-test-app.js';

export interface StudentQuizFixture {
  id: string;
  questions: {
    id: string;
    points: string;
    options: { id: string; isCorrect: boolean }[];
  }[];
}

export async function createStudentTestApp() {
  const context = await createQuizTestApp();
  let now = new Date();
  const clock = vi
    .spyOn(context.app.get(AttemptClock), 'now')
    .mockImplementation(() => new Date(now));
  try {
    const cookies = new Map<string, string>();
    for (const [username, classId] of [
      ['classmate', context.classroom.id],
      ['outsider', context.secondClass.id],
    ]) {
      await context.db.user.create({
        data: {
          username,
          name: username,
          role: 'STUDENT',
          classId,
          passwordHash: context.student.passwordHash,
        },
      });
      cookies.set(
        username,
        sessionCookie(await context.login(username).expect(200)),
      );
    }
    cookies.set(
      'student',
      sessionCookie(await context.login('student').expect(200)),
    );
    return {
      ...context,
      now: () => new Date(now),
      setTime: (date: Date | string) => {
        now = new Date(date);
      },
      reset: async () => {
        now = new Date();
        await context.db.answer.deleteMany();
        await context.db.attempt.deleteMany();
        await context.db.quiz.deleteMany();
      },
      studentApi: (
        method: 'get' | 'post' | 'put',
        path: string,
        body?: object,
        username = 'student',
      ) => {
        const call = request(context.app.getHttpServer())
          [method](`/api/student${path}`)
          .set('Cookie', cookies.get(username)!)
          .set('Origin', context.config.FRONTEND_ORIGIN);
        return body === undefined ? call : call.send(body);
      },
      publishQuiz: async (
        overrides: Partial<SaveQuizDto> = {},
      ): Promise<StudentQuizFixture> => {
        const source = context.quiz();
        const questions = ['1.5', '2.5', '3'].map((points, index) => ({
          ...structuredClone(source.questions![0]),
          prompt: `Question ${index + 1}`,
          points,
        }));
        const created = await context
          .api('teacher', 'post', '/quizzes', {
            ...source,
            questions,
            opensAt: new Date(now.getTime() - 60_000).toISOString(),
            closesAt: new Date(now.getTime() + 3_600_000).toISOString(),
            ...overrides,
          })
          .expect(201);
        await context
          .api('teacher', 'post', `/quizzes/${created.body.id}/publish`)
          .expect(200);
        return created.body as StudentQuizFixture;
      },
      close: async () => {
        clock.mockRestore();
        await context.close();
      },
    };
  } catch (error) {
    clock.mockRestore();
    await context.close();
    throw error;
  }
}
export type StudentTestApp = Awaited<ReturnType<typeof createStudentTestApp>>;

export function answer(
  quiz: StudentQuizFixture,
  index: number,
  correct: boolean,
) {
  const question = quiz.questions[index];
  return {
    questionId: question.id,
    optionId: question.options.find((option) => option.isCorrect === correct)!
      .id,
  };
}
