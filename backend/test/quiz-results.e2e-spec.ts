import request from 'supertest';
import { parse } from 'csv-parse/sync';
import {
  answer,
  createStudentTestApp,
  type StudentTestApp,
} from './helpers/student-test-app.js';

describe('Quiz results - teacher reporting and CSV export', () => {
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

  async function fixture() {
    const quiz = await context.publishQuiz({ durationMinutes: 1 });
    const first = await context
      .studentApi('post', `/quizzes/${quiz.id}/attempt`)
      .expect(200);
    await context
      .studentApi(
        'put',
        `/attempts/${first.body.id}/answers`,
        answer(quiz, 0, true),
      )
      .expect(200);
    await context
      .studentApi('post', `/attempts/${first.body.id}/submit`)
      .expect(200);
    const second = await context
      .studentApi('post', `/quizzes/${quiz.id}/attempt`, undefined, 'classmate')
      .expect(200);
    return { quiz, first, second };
  }

  it('returns safe student identities and exact scores while excluding unfinished attempts from averages', async () => {
    const { quiz } = await fixture();
    const result = await context
      .api('teacher', 'get', `/quizzes/${quiz.id}/results`)
      .expect(200);
    expect(result.body).toMatchObject({
      total: 2,
      summary: {
        inProgress: 1,
        submitted: 1,
        expired: 0,
        completed: 1,
        averageScore: '1.50',
        lowestScore: '1.5',
        highestScore: '1.5',
      },
    });
    const completed = result.body.items.find(
      (item: { status: string }) => item.status === 'SUBMITTED',
    );
    expect(completed).toMatchObject({
      score: '1.5',
      maxScore: '7',
      percentage: '21.43',
      student: { username: 'student', class: { id: context.classroom.id } },
    });
    expect(JSON.stringify(result.body)).not.toMatch(
      /passwordHash|isCorrect|optionId/,
    );
    expect(result.headers['cache-control']).toBe('no-store');
    const admin = await context
      .api('admin', 'get', `/quizzes/${quiz.id}/results`)
      .expect(200);
    expect(admin.body).toEqual(result.body);
  });

  it('paginates rows without changing the quiz-wide summary and rejects invalid pagination', async () => {
    const { quiz } = await fixture();
    const first = await context
      .api('teacher', 'get', `/quizzes/${quiz.id}/results?pageSize=1`)
      .expect(200);
    const second = await context
      .api('teacher', 'get', `/quizzes/${quiz.id}/results?pageSize=1&page=2`)
      .expect(200);
    expect(first.body.items).toHaveLength(1);
    expect(second.body.items[0].id).not.toBe(first.body.items[0].id);
    expect(second.body.summary).toEqual(first.body.summary);
    expect(second.body.total).toBe(2);
    await context
      .api('teacher', 'get', `/quizzes/${quiz.id}/results?pageSize=101`)
      .expect(400);
  });

  it.each(['results', 'results/export'])(
    'expires overdue attempts before serving %s and includes their saved-answer score',
    async (endpoint) => {
      const { quiz, second } = await fixture();
      await context
        .studentApi(
          'put',
          `/attempts/${second.body.id}/answers`,
          answer(quiz, 1, true),
          'classmate',
        )
        .expect(200);
      context.setTime(second.body.graceEndsAt);
      await context
        .api('teacher', 'get', `/quizzes/${quiz.id}/${endpoint}`)
        .expect(200);
      const expired = await context.db.attempt.findUniqueOrThrow({
        where: { id: second.body.id },
      });
      expect(expired.status).toBe('EXPIRED');
      expect(expired.score!.toString()).toBe('2.5');
      const results = await context
        .api('teacher', 'get', `/quizzes/${quiz.id}/results`)
        .expect(200);
      expect(results.body.summary).toMatchObject({
        expired: 1,
        completed: 2,
        averageScore: '2.00',
        lowestScore: '1.5',
        highestScore: '2.5',
      });
    },
  );

  it.each(['results', 'results/export'])(
    'denies anonymous users, students and other teachers access to %s without expiring data',
    async (endpoint) => {
      const { quiz, second } = await fixture();
      context.setTime(second.body.graceEndsAt);
      const path = `/quizzes/${quiz.id}/${endpoint}`;
      await request(context.app.getHttpServer()).get(`/api${path}`).expect(401);
      await context.api('student', 'get', path).expect(403);
      await context.api('other-teacher', 'get', path).expect(404);
      expect(
        (
          await context.db.attempt.findUniqueOrThrow({
            where: { id: second.body.id },
          })
        ).status,
      ).toBe('IN_PROGRESS');
    },
  );

  it('returns empty results with null statistics and a header-only CSV for a quiz with no attempts', async () => {
    const quiz = await context.publishQuiz();
    const results = await context
      .api('teacher', 'get', `/quizzes/${quiz.id}/results`)
      .expect(200);
    expect(results.body).toMatchObject({
      total: 0,
      items: [],
      summary: {
        completed: 0,
        averageScore: null,
        lowestScore: null,
        highestScore: null,
      },
    });
    const csv = await context
      .api('teacher', 'get', `/quizzes/${quiz.id}/results/export`)
      .expect(200);
    expect(parse(csv.text, { bom: true })).toHaveLength(1);
    await context
      .api(
        'admin',
        'get',
        '/quizzes/00000000-0000-4000-8000-000000000000/results',
      )
      .expect(404);
    await context
      .api('teacher', 'get', '/quizzes/invalid/results/export')
      .expect(400);
  });

  it('exports every attempt with Arabic, escaped commas and quotes, safe formulas and blank unfinished scores', async () => {
    const { quiz } = await fixture();
    await context.db.user.update({
      where: { id: context.student.id },
      data: { name: 'أحمد, "علي"\nطالب' },
    });
    await context.db.user.update({
      where: { username: 'classmate' },
      data: { name: '  =1+1' },
    });
    const response = await context
      .api('admin', 'get', `/quizzes/${quiz.id}/results/export`)
      .expect(200);
    expect(response.headers['content-type']).toContain('text/csv');
    expect(response.headers['content-disposition']).toBe(
      `attachment; filename="quiz-${quiz.id}-results.csv"`,
    );
    const rows = parse(response.text, { columns: true, bom: true }) as Record<
      string,
      string
    >[];
    expect(rows).toHaveLength(2);
    expect(rows.find((row) => row.username === 'student')).toMatchObject({
      student_name: 'أحمد, "علي"\nطالب',
      score: '1.5',
      percentage: '21.43',
    });
    expect(rows.find((row) => row.username === 'classmate')).toMatchObject({
      student_name: "'  =1+1",
      score: '',
      percentage: '',
      submitted_at: '',
    });
    expect(response.text).not.toMatch(/passwordHash|isCorrect/);
  });
});
