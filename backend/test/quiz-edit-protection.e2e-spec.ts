import { vi } from 'vitest';
import {
  createQuizTestApp,
  type QuizTestApp,
} from './helpers/quiz-test-app.js';

describe('Quiz management — grading consistency after attempts start', () => {
  let context: QuizTestApp;
  let quizId: string;
  beforeAll(async () => {
    context = await createQuizTestApp();
  });
  beforeEach(async () => {
    await context.db.attempt.deleteMany();
    await context.db.quiz.deleteMany();
    const created = await context
      .api('teacher', 'post', '/quizzes', context.quiz())
      .expect(201);
    quizId = created.body.id;
    await context
      .api('teacher', 'post', `/quizzes/${quizId}/publish`)
      .expect(200);
  });
  afterAll(async () => {
    await context?.close();
  });

  const startAttempt = () =>
    context.db.attempt.create({
      data: {
        quizId,
        studentId: context.student.id,
        maxScore: '1.5',
        deadlineAt: new Date(Date.now() + 60_000),
      },
    });

  it.each([
    ['questions', { questions: [] }],
    ['class assignments', { classIds: [] }],
    ['duration', { durationMinutes: 30 }],
    ['language', { language: 'EN' }],
    ['negative marking', { negativeMarking: 'NONE', penaltyValue: '0' }],
    ['penalty value', { penaltyValue: '0.5' }],
    ['opening time', { opensAt: '2027-01-01T00:00:00Z' }],
    ['closing time', { closesAt: '2027-01-02T00:00:00Z' }],
  ])(
    'prevents a teacher or admin from changing %s after the first attempt',
    async (_label, patch) => {
      await startAttempt();
      const before = await context
        .api('teacher', 'get', `/quizzes/${quizId}`)
        .expect(200);
      for (const role of ['teacher', 'admin'])
        await context
          .api(role, 'patch', `/quizzes/${quizId}`, patch)
          .expect(409);
      const after = await context
        .api('teacher', 'get', `/quizzes/${quizId}`)
        .expect(200);
      expect(after.body).toEqual(before.body);
    },
  );

  it('allows title and description corrections without changing the grading data or attempt', async () => {
    const attempt = await startAttempt();
    const before = await context
      .api('teacher', 'get', `/quizzes/${quizId}`)
      .expect(200);
    const edited = await context
      .api('teacher', 'patch', `/quizzes/${quizId}`, {
        title: 'Corrected title',
        description: null,
      })
      .expect(200);
    expect(edited.body.questions).toEqual(before.body.questions);
    expect(edited.body.attemptCount).toBe(1);
    expect(
      await context.db.attempt.findUnique({ where: { id: attempt.id } }),
    ).toEqual(attempt);
  });

  it('prevents quiz deletion after an attempt exists, including for admins', async () => {
    await startAttempt();
    for (const role of ['teacher', 'admin'])
      await context.api(role, 'delete', `/quizzes/${quizId}`).expect(409);
    expect(await context.db.quiz.count()).toBe(1);
  });

  it('keeps grading fields locked after an attempt has been submitted', async () => {
    const attempt = await startAttempt();
    await context.db.attempt.update({
      where: { id: attempt.id },
      data: { status: 'SUBMITTED', submittedAt: new Date(), score: '1.5' },
    });
    await context
      .api('teacher', 'patch', `/quizzes/${quizId}`, { durationMinutes: 30 })
      .expect(409);
  });

  it('waits for an in-flight attempt insert, then rejects a racing grading edit', async () => {
    let release!: () => void;
    let inserted!: () => void;
    const hold = new Promise<void>((resolve) => {
      release = resolve;
    });
    const started = new Promise<void>((resolve) => {
      inserted = resolve;
    });
    const transaction = context.db.$transaction(
      async (tx) => {
        await tx.attempt.create({
          data: {
            quizId,
            studentId: context.student.id,
            maxScore: '1.5',
            deadlineAt: new Date(Date.now() + 60_000),
          },
        });
        inserted();
        await hold;
      },
      { timeout: 12_000 },
    );
    await Promise.race([
      started,
      transaction.then(() => {
        throw new Error('Attempt transaction ended before inserting');
      }),
    ]);
    const editing = context
      .api('teacher', 'patch', `/quizzes/${quizId}`, { durationMinutes: 30 })
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
    expect((await editing).status).toBe(409);
    expect(
      (await context.db.quiz.findUniqueOrThrow({ where: { id: quizId } }))
        .durationMinutes,
    ).toBe(20);
  });
});
