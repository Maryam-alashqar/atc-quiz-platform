import { vi } from 'vitest';
import { PrismaService } from '../src/prisma/prisma.service.js';
import {
  answer,
  createStudentTestApp,
  type StudentTestApp,
} from './helpers/student-test-app.js';

describe('Student attempts - concurrent starts and submissions', () => {
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

  it('returns one attempt and one deadline for simultaneous start requests', async () => {
    const quiz = await context.publishQuiz();
    const responses = await Promise.all(
      Array.from({ length: 4 }, () =>
        context.studentApi('post', `/quizzes/${quiz.id}/attempt`).expect(200),
      ),
    );
    expect(new Set(responses.map((response) => response.body.id)).size).toBe(1);
    expect(
      new Set(responses.map((response) => response.body.deadlineAt)).size,
    ).toBe(1);
    expect(await context.db.attempt.count()).toBe(1);
  });

  it('serializes answer saving with submission so the stored answers always match the final score', async () => {
    const quiz = await context.publishQuiz();
    const started = await context
      .studentApi('post', `/quizzes/${quiz.id}/attempt`)
      .expect(200);
    const [saved, submitted, repeated] = await Promise.all([
      context.studentApi(
        'put',
        `/attempts/${started.body.id}/answers`,
        answer(quiz, 0, true),
      ),
      context
        .studentApi('post', `/attempts/${started.body.id}/submit`)
        .expect(200),
      context
        .studentApi('post', `/attempts/${started.body.id}/submit`)
        .expect(200),
    ]);
    expect([200, 409]).toContain(saved.status);
    const stored = await context.db.attempt.findUniqueOrThrow({
      where: { id: started.body.id },
      include: { answers: true },
    });
    expect(stored.answers).toHaveLength(saved.status === 200 ? 1 : 0);
    expect(stored.score!.toString()).toBe(saved.status === 200 ? '1.5' : '0');
    expect(submitted.body.score).toBe(stored.score!.toString());
    expect(repeated.body.submittedAt).toBe(submitted.body.submittedAt);
  });

  it('waits for a locked quiz edit and snapshots the newly committed question points', async () => {
    const quiz = await context.publishQuiz();
    const prisma = context.app.get(PrismaService);
    let release!: () => void;
    let locked!: () => void;
    const hold = new Promise<void>((resolve) => {
      release = resolve;
    });
    const ready = new Promise<void>((resolve) => {
      locked = resolve;
    });
    const transaction = prisma.$transaction(
      async (tx) => {
        await prisma.lockQuiz(tx, quiz.id);
        await tx.question.update({
          where: { id: quiz.questions[0].id },
          data: { points: '3' },
        });
        locked();
        await hold;
      },
      { timeout: 12_000 },
    );
    await Promise.race([
      ready,
      transaction.then(() => {
        throw new Error('Quiz edit ended before locking');
      }),
    ]);
    const starting = context
      .studentApi('post', `/quizzes/${quiz.id}/attempt`)
      .then((response) => response);
    try {
      const schema = new URL(context.config.DATABASE_URL).searchParams.get(
        'schema',
      )!;
      await vi.waitFor(
        async () => {
          const waiting = await context.db.$queryRaw<
            { blocked: boolean }[]
          >`SELECT EXISTS(SELECT 1 FROM pg_stat_activity WHERE wait_event_type = 'Lock' AND query LIKE '%FOR UPDATE%' AND query LIKE ${'%' + schema + '%'}) AS blocked`;
          expect(waiting[0].blocked).toBe(true);
        },
        { timeout: 5_000, interval: 25 },
      );
    } finally {
      release();
      await transaction;
    }
    const response = await starting;
    expect(response.status).toBe(200);
    expect(response.body.maxScore).toBe('8.5');
    await context
      .api('teacher', 'patch', `/quizzes/${quiz.id}`, { durationMinutes: 30 })
      .expect(409);
  });
});
