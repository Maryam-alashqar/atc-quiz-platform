import ExcelJS from 'exceljs';
import request from 'supertest';
import {
  createQuizTestApp,
  type QuizTestApp,
} from './helpers/quiz-test-app.js';
import { sessionCookie } from './helpers/auth-test-app.js';

const QUIZ_ID = 'a7c00000-0000-4000-8000-0000000000b1';

const tables = () => ({
  classes: [['name'], ['12Z']],
  users: [
    ['username', 'name', 'role', 'className', 'password'],
    // Existing teacher from the fixture: reused, never overwritten.
    ['teacher', 'TEACHER', 'TEACHER', '', 'Irrelevant2026!'],
    ['s12z-01', 'ليان أحمد', 'STUDENT', '12Z', 'Welcome2026!'],
  ],
  quizzes: [
    [
      'id',
      'teacherUsername',
      'title',
      'description',
      'language',
      'durationMinutes',
      'opensAt',
      'closesAt',
      'status',
      'negativeMarking',
      'penaltyValue',
      'classNames',
    ],
    [
      QUIZ_ID,
      'teacher',
      'اختبار مستورد',
      '',
      'AR',
      '20',
      '2030-01-05T09:00:00+03:00',
      '2030-01-12T09:00:00+03:00',
      'PUBLISHED',
      'NONE',
      '0',
      '12Z',
    ],
  ],
  questions: [
    [
      'quizId',
      'order',
      'prompt',
      'points',
      'option1',
      'option2',
      'option3',
      'option4',
      'correctOption',
    ],
    [QUIZ_ID, '1', 'ما جمع كتاب؟', '1', 'كتب', 'كتاب', 'كاتب', 'مكتبة', '1'],
  ],
});

async function xlsx(data: Record<string, string[][]>): Promise<Buffer> {
  const book = new ExcelJS.Workbook();
  for (const [name, rows] of Object.entries(data))
    book.addWorksheet(name).addRows(rows);
  return Buffer.from(await book.xlsx.writeBuffer());
}

const csv = (rows: string[][]) =>
  Buffer.from(
    rows
      .map((row) =>
        row.map((cell) => `"${cell.replaceAll('"', '""')}"`).join(','),
      )
      .join('\n'),
  );

describe('Admin — importing the centre’s spreadsheets from the browser', () => {
  let context: QuizTestApp;
  beforeAll(async () => {
    context = await createQuizTestApp();
  });
  afterAll(async () => {
    await context?.close();
  });
  afterEach(async () => {
    await context.db.quiz.deleteMany({ where: { id: QUIZ_ID } });
    await context.db.user.deleteMany({ where: { username: 's12z-01' } });
    await context.db.class.deleteMany({ where: { name: '12Z' } });
  });

  const upload = (path: string, files: [Buffer, string][], role = 'admin') => {
    let call = context.api(role, 'post', path);
    for (const [buffer, name] of files)
      call = call.attach('files', buffer, name);
    return call;
  };
  const counts = async () => ({
    classes: await context.db.class.count(),
    users: await context.db.user.count(),
    quizzes: await context.db.quiz.count(),
  });

  it('previews an Excel workbook without saving anything', async () => {
    const before = await counts();
    const response = await upload('/import?preview=true', [
      [await xlsx(tables()), 'centre.xlsx'],
    ]).expect(200);
    expect(response.body).toMatchObject({
      preview: true,
      source: 'xlsx',
      summary: {
        classesCreated: 1,
        usersCreated: 1,
        usersSkipped: 1,
        quizzesCreated: 1,
        questionsCreated: 1,
      },
    });
    expect(await counts()).toEqual(before);
  });

  it('imports the workbook: the new student can sign in and the quiz is assigned to their class', async () => {
    await upload('/import', [[await xlsx(tables()), 'centre.xlsx']]).expect(
      200,
    );
    const login = await context.login('s12z-01', 'Welcome2026!').expect(200);
    expect(login.body.user).toMatchObject({ className: '12Z' });
    const quiz = await context.db.quiz.findUniqueOrThrow({
      where: { id: QUIZ_ID },
      include: { classes: { include: { class: true } } },
    });
    expect(quiz.classes.map((c) => c.class.name)).toEqual(['12Z']);
    // The existing teacher's password was not replaced by the sheet's.
    await context.login('teacher').expect(200);
    await context.login('teacher', 'Irrelevant2026!').expect(401);
    // Re-importing the same file creates nothing new.
    const again = await upload('/import', [
      [await xlsx(tables()), 'centre.xlsx'],
    ]).expect(200);
    expect(again.body.summary).toMatchObject({
      classesCreated: 0,
      usersCreated: 0,
      quizzesCreated: 0,
    });
  });

  it('accepts the four CSV files instead of a workbook', async () => {
    const data = tables();
    const response = await upload(
      '/import?preview=true',
      Object.entries(data).map(([name, rows]) => [csv(rows), `${name}.csv`]),
    ).expect(200);
    expect(response.body).toMatchObject({
      source: 'csv',
      summary: { usersCreated: 1 },
    });
  });

  it('points to the sheet and row of a mistake and saves nothing', async () => {
    const data = tables();
    data.users[2][2] = 'PRINCIPAL';
    const before = await counts();
    const response = await upload('/import', [
      [await xlsx(data), 'centre.xlsx'],
    ]).expect(400);
    expect(response.body.message).toMatch(/^Sheet "users", row 3: role/);
    expect(await counts()).toEqual(before);
  });

  it('reports a conflict with existing data as a clear error, before and during import', async () => {
    const data = tables();
    // 'student' exists in 10A; the sheet says 12Z.
    data.users.push(['student', 'x', 'STUDENT', '12Z', 'Welcome2026!']);
    for (const path of ['/import?preview=true', '/import']) {
      const response = await upload(path, [
        [await xlsx(data), 'centre.xlsx'],
      ]).expect(400);
      expect(response.body.message).toMatch(
        /^Sheet "users": Existing username student has a different role or class/,
      );
    }
    expect(await context.db.class.count({ where: { name: '12Z' } })).toBe(0);
  });

  it('explains what to upload when the files are not recognised', async () => {
    const response = await upload('/import', [
      [Buffer.from('hello'), 'notes.txt'],
    ]).expect(400);
    expect(response.body.message).toMatch(/one Excel workbook/);
    await upload('/import', []).expect(400);
  });

  it('rejects a file over 5 MB', async () => {
    await upload('/import', [[Buffer.alloc(5_000_001, 1), 'big.xlsx']]).expect(
      413,
    );
  });

  it.each(['teacher', 'student'])(
    'is only for the admin, not a %s',
    async (role) => {
      await upload(
        '/import?preview=true',
        [[await xlsx(tables()), 'centre.xlsx']],
        role,
      ).expect(403);
    },
  );

  it('requires the trusted origin, like every other write', async () => {
    const cookie = sessionCookie(await context.login('admin').expect(200));
    await request(context.app.getHttpServer())
      .post('/api/import?preview=true')
      .set('Cookie', cookie)
      .attach('files', await xlsx(tables()), 'centre.xlsx')
      .expect(403);
  });
});
