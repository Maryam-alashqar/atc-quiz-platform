import { readFileSync } from 'node:fs';
import { parse } from 'csv-parse/sync';
import { describe, expect, it } from 'vitest';
import { parseDataset, type CsvFiles } from './csv.js';

const demoNow = new Date('2026-09-24T09:00:00Z');
function files(): CsvFiles {
  return Object.fromEntries(
    ['classes', 'users', 'quizzes', 'questions'].map((kind) => [
      kind,
      readFileSync(
        new URL(`../../prisma/data/${kind}.csv`, import.meta.url),
        'utf8',
      ),
    ]),
  ) as CsvFiles;
}
function change(
  input: CsvFiles,
  file: keyof CsvFiles,
  column: string,
  value: string,
  record = 1,
) {
  const rows = parse(input[file]) as string[][];
  rows[record][rows[0].indexOf(column)] = value;
  input[file] = rows
    .map((row) =>
      row.map((cell) => `"${cell.replaceAll('"', '""')}"`).join(','),
    )
    .join('\n');
}

describe('CSV import — input validation', () => {
  it('loads realistic bilingual sample data with all requested roles, classes and quiz modes', () => {
    const data = parseDataset(files(), demoNow);
    expect(data.classes.map((c) => c.name)).toEqual(['10A', '10B', '11A']);
    expect(data.users.filter((u) => u.role === 'STUDENT')).toHaveLength(60);
    expect(data.users.filter((u) => u.role === 'TEACHER')).toHaveLength(4);
    expect(data.users.filter((u) => u.role === 'ADMIN')).toHaveLength(1);
    for (const c of data.classes)
      expect(data.users.filter((u) => u.className === c.name)).toHaveLength(20);
    expect(data.quizzes).toHaveLength(5);
    expect(data.questions).toHaveLength(75);
    for (const q of data.quizzes)
      expect(
        data.questions.filter((question) => question.quizId === q.id),
      ).toHaveLength(15);
    expect(new Set(data.quizzes.map((q) => q.negativeMarking))).toEqual(
      new Set(['NONE', 'FRACTION', 'FIXED']),
    );
    expect(new Set(data.quizzes.map((q) => q.language))).toEqual(
      new Set(['AR', 'EN']),
    );
    expect(
      data.quizzes.some(
        (q) =>
          q.status === 'PUBLISHED' &&
          q.opensAt < demoNow &&
          q.closesAt > demoNow,
      ),
    ).toBe(true);
    expect(data.quizzes.some((q) => q.opensAt > demoNow)).toBe(true);
    expect(data.quizzes.some((q) => q.closesAt < demoNow)).toBe(true);
    expect(data.quizzes.some((q) => q.status === 'DRAFT')).toBe(true);
  });

  it('supports UTF-8 BOM, CRLF, quoted commas, quotes and multiline fields', () => {
    const input = files();
    input.classes = '\uFEFF' + input.classes.replaceAll('\n', '\r\n');
    change(
      input,
      'questions',
      'prompt',
      'سؤال عربي، "اختيار"\nSecond line, with comma',
    );
    expect(parseDataset(input, demoNow).questions[0].prompt).toBe(
      'سؤال عربي، "اختيار"\nSecond line, with comma',
    );
  });

  it('normalizes usernames while retaining password whitespace', () => {
    const input = files();
    change(input, 'users', 'username', 'ADMIN');
    change(input, 'users', 'password', ' space protected ');
    const data = parseDataset(input, demoNow);
    expect(data.users[0].username).toBe('admin');
    expect(data.users[0].password).toBe(' space protected ');
  });

  it.each([
    ['an unsupported user role', 'users', 'role', 'OWNER'],
    ['a class assigned to an admin', 'users', 'className', '10A'],
    ['a short password', 'users', 'password', 'short'],
    [
      'an unknown quiz teacher',
      'quizzes',
      'teacherUsername',
      'missing-teacher',
    ],
    ['an unknown assigned class', 'quizzes', 'classNames', '10A|missing-class'],
    ['a zero quiz duration', 'quizzes', 'durationMinutes', '0'],
    [
      'an opening timestamp without a timezone',
      'quizzes',
      'opensAt',
      '2026-09-24T09:00:00',
    ],
    [
      'an impossible calendar date',
      'quizzes',
      'opensAt',
      '2026-02-30T09:00:00Z',
    ],
    ['a closing date before the opening date', 'quizzes', 'closesAt', 'NOW-2D'],
    [
      'a penalty when negative marking is disabled',
      'quizzes',
      'penaltyValue',
      '0.25',
    ],
    ['zero question points', 'questions', 'points', '0'],
    ['nonnumeric question points', 'questions', 'points', 'NaN'],
    [
      'question points with excessive decimal precision',
      'questions',
      'points',
      '1.00001',
    ],
    [
      'a correct option outside the four choices',
      'questions',
      'correctOption',
      '5',
    ],
    ['an empty answer option', 'questions', 'option4', ''],
    [
      'a question referencing an unknown quiz',
      'questions',
      'quizId',
      'a7c00000-0000-4000-8000-000000000099',
    ],
  ] as const)(
    'rejects %s without displaying submitted values',
    (_description, file, column, value) => {
      const input = files();
      change(input, file, column, value);
      expect(() => parseDataset(input, demoNow)).toThrow(
        `${file}.csv record 2:`,
      );
    },
  );

  it('rejects duplicate normalized usernames and repeated question positions', () => {
    const input = files();
    change(input, 'users', 'username', 'ADMIN', 2);
    expect(() => parseDataset(input, demoNow)).toThrow('users.csv: Duplicate');
    const other = files();
    change(other, 'questions', 'order', '1', 2);
    expect(() => parseDataset(other, demoNow)).toThrow(
      'questions.csv: Duplicate',
    );
  });

  it('rejects missing headers and malformed CSV without leaking passwords', () => {
    const input = files();
    input.users = 'username,password\nadmin,secret-password';
    expect(() => parseDataset(input, demoNow)).toThrow(
      'Expected exactly these headers',
    );
    input.users = '"unterminated secret-password';
    expect(() => parseDataset(input, demoNow)).toThrow(
      'users.csv: Malformed CSV; check quoting and column counts.',
    );
  });

  it('reserves relative dates for the seed command; normal imports accept explicit timestamps', () => {
    expect(() => parseDataset(files())).toThrow('Dates must be valid ISO 8601');
    const input = files();
    for (let i = 1; i <= 5; i++) {
      change(input, 'quizzes', 'opensAt', '2026-09-24T09:00:00+03:00', i);
      change(input, 'quizzes', 'closesAt', '2026-09-25T09:00:00+03:00', i);
    }
    expect(parseDataset(input).quizzes[0].opensAt.toISOString()).toBe(
      '2026-09-24T06:00:00.000Z',
    );
  });
});
