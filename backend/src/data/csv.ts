import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { parse } from 'csv-parse/sync';
import { Prisma } from '../generated/prisma/client.js';

const headers = {
  classes: ['name'],
  users: ['username', 'name', 'role', 'className', 'password'],
  quizzes: [
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
  questions: [
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
} as const;

type Row = Record<string, string>;
export type CsvFiles = Record<keyof typeof headers, string>;

function fail(location: string, message: string): never {
  throw new Error(`${location}: ${message}`);
}

function rows(text: string, kind: keyof CsvFiles): Row[] {
  const location = `${kind}.csv`;
  let records: string[][];
  try {
    records = parse(text, {
      bom: true,
      skip_empty_lines: true,
      max_record_size: 100_000,
    }) as string[][];
  } catch {
    return fail(location, 'Malformed CSV; check quoting and column counts.');
  }
  const columns = records.shift();
  if (
    !columns ||
    columns.length !== headers[kind].length ||
    new Set(columns).size !== columns.length ||
    headers[kind].some((h) => !columns.includes(h))
  ) {
    return fail(
      location,
      `Expected exactly these headers: ${headers[kind].join(',')}`,
    );
  }
  if (!records.length)
    return fail(location, 'At least one data record is required.');
  return records.map((record) =>
    Object.fromEntries(
      columns.map((column, i) => [
        column,
        column === 'password' ? record[i] : record[i].trim(),
      ]),
    ),
  );
}

function required(
  value: string,
  location: string,
  field: string,
  max = 10_000,
): string {
  if (!value || value.length > max)
    fail(
      location,
      `${field} is required and must be at most ${max} characters.`,
    );
  return value;
}

function choice<T extends string>(
  value: string,
  allowed: readonly T[],
  location: string,
  field: string,
): T {
  if (!allowed.includes(value as T))
    fail(location, `${field} must be one of ${allowed.join(', ')}.`);
  return value as T;
}

function integer(
  value: string,
  location: string,
  field: string,
  max = 2_147_483_647,
): number {
  if (!/^[1-9]\d*$/.test(value) || Number(value) > max)
    fail(location, `${field} must be an integer from 1 to ${max}.`);
  return Number(value);
}

function decimal(value: string, location: string, field: string): string {
  if (!/^\d{1,8}(\.\d{1,4})?$/.test(value))
    fail(
      location,
      `${field} must be a nonnegative decimal with at most 8 integer and 4 fractional digits.`,
    );
  return new Prisma.Decimal(value).toFixed();
}

function username(value: string, location: string): string {
  const normalized = value.toLowerCase();
  if (!/^[a-z0-9][a-z0-9._-]{0,99}$/.test(normalized))
    fail(
      location,
      'username must use letters a-z, digits, dots, underscores or hyphens.',
    );
  return normalized;
}

function uuid(value: string, location: string): string {
  if (
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      value,
    )
  )
    fail(location, 'quiz ID must be a UUID.');
  return value.toLowerCase();
}

function timestamp(value: string, location: string, demoNow?: Date): Date {
  // Relative dates are deliberately enabled only by the demo seed command.
  const relative = /^NOW([+-])(\d{1,3})D$/.exec(value);
  if (relative && demoNow)
    return new Date(
      demoNow.getTime() +
        (relative[1] === '+' ? 1 : -1) * Number(relative[2]) * 86_400_000,
    );
  const match =
    /^(\d{4}-\d{2}-\d{2})T(?:[01]\d|2[0-3]):[0-5]\d:[0-5]\d(?:\.\d{1,3})?(?:Z|[+-](?:0\d|1[0-4]):[0-5]\d)$/.exec(
      value,
    );
  if (
    !match ||
    !Number.isFinite(Date.parse(value)) ||
    new Date(`${match[1]}T00:00:00Z`).toISOString().slice(0, 10) !== match[1]
  ) {
    fail(
      location,
      'Dates must be valid ISO 8601 timestamps with an explicit timezone, e.g. 2026-09-24T09:00:00+03:00.',
    );
  }
  return new Date(value);
}

function unique(values: string[], location: string): Set<string> {
  const set = new Set(values);
  if (set.size !== values.length)
    fail(location, 'Duplicate identifier or position.');
  return set;
}

export function parseDataset(files: CsvFiles, demoNow?: Date) {
  const classes = rows(files.classes, 'classes').map((r, i) => ({
    name: required(r.name, `classes.csv record ${i + 2}`, 'name', 100),
  }));
  const classNames = unique(
    classes.map((c) => c.name),
    'classes.csv',
  );
  const users = rows(files.users, 'users').map((r, i) => {
    const at = `users.csv record ${i + 2}`;
    const role = choice(
      r.role,
      ['STUDENT', 'TEACHER', 'ADMIN'] as const,
      at,
      'role',
    );
    if (
      (role === 'STUDENT' && !classNames.has(r.className)) ||
      (role !== 'STUDENT' && r.className)
    )
      fail(
        at,
        'Students require a class in classes.csv; other roles must leave className empty.',
      );
    if (r.password.length < 8 || r.password.length > 128)
      fail(at, 'password must contain 8–128 characters.');
    return {
      username: username(r.username, at),
      name: required(r.name, at, 'name', 200),
      role,
      className: r.className,
      password: r.password,
    };
  });
  unique(
    users.map((u) => u.username),
    'users.csv',
  );
  const teachers = new Set(
    users.filter((u) => u.role === 'TEACHER').map((u) => u.username),
  );
  const quizzes = rows(files.quizzes, 'quizzes').map((r, i) => {
    const at = `quizzes.csv record ${i + 2}`;
    const teacherUsername = username(r.teacherUsername, at);
    if (!teachers.has(teacherUsername))
      fail(at, 'teacherUsername must reference a TEACHER in users.csv.');
    const assignments = r.classNames.split('|').map((v) => v.trim());
    unique(assignments, at);
    if (assignments.some((name) => !classNames.has(name)))
      fail(
        at,
        'classNames must reference classes.csv (separate multiple classes with |).',
      );
    const opensAt = timestamp(r.opensAt, at, demoNow);
    const closesAt = timestamp(r.closesAt, at, demoNow);
    if (closesAt <= opensAt) fail(at, 'closesAt must be after opensAt.');
    const negativeMarking = choice(
      r.negativeMarking,
      ['NONE', 'FRACTION', 'FIXED'] as const,
      at,
      'negativeMarking',
    );
    const penaltyValue = decimal(r.penaltyValue, at, 'penaltyValue');
    const penalty = new Prisma.Decimal(penaltyValue);
    if (
      (negativeMarking === 'NONE' && !penalty.isZero()) ||
      (negativeMarking !== 'NONE' && !penalty.gt(0)) ||
      (negativeMarking === 'FRACTION' && penalty.gt(1))
    )
      fail(at, 'Invalid penalty for the selected negativeMarking mode.');
    return {
      id: uuid(r.id, at),
      teacherUsername,
      title: required(r.title, at, 'title', 200),
      description: r.description || null,
      language: choice(r.language, ['AR', 'EN'] as const, at, 'language'),
      durationMinutes: integer(r.durationMinutes, at, 'durationMinutes'),
      opensAt,
      closesAt,
      status: choice(r.status, ['DRAFT', 'PUBLISHED'] as const, at, 'status'),
      negativeMarking,
      penaltyValue,
      classNames: assignments,
    };
  });
  const quizIds = unique(
    quizzes.map((q) => q.id),
    'quizzes.csv',
  );
  const questions = rows(files.questions, 'questions').map((r, i) => {
    const at = `questions.csv record ${i + 2}`;
    const quizId = uuid(r.quizId, at);
    if (!quizIds.has(quizId)) fail(at, 'quizId must reference quizzes.csv.');
    const points = decimal(r.points, at, 'points');
    if (!new Prisma.Decimal(points).gt(0)) fail(at, 'points must be positive.');
    const options = [r.option1, r.option2, r.option3, r.option4].map((v) =>
      required(v, at, 'option'),
    );
    unique(options, at);
    return {
      quizId,
      order: integer(r.order, at, 'order'),
      prompt: required(r.prompt, at, 'prompt'),
      points,
      options,
      correctOption: integer(r.correctOption, at, 'correctOption', 4),
    };
  });
  unique(
    questions.map((q) => `${q.quizId}/${q.order}`),
    'questions.csv',
  );
  for (const quiz of quizzes) {
    if (!questions.some((q) => q.quizId === quiz.id))
      fail(
        'questions.csv',
        `Quiz ${quiz.id} must contain at least one question.`,
      );
  }
  return { classes, users, quizzes, questions };
}

export type Dataset = ReturnType<typeof parseDataset>;

export async function readDataset(
  directory: string,
  demoNow?: Date,
): Promise<Dataset> {
  const files = {} as CsvFiles;
  for (const key of Object.keys(headers) as (keyof CsvFiles)[]) {
    const bytes = await readFile(join(directory, `${key}.csv`));
    if (bytes.length > 5_000_000)
      fail(`${key}.csv`, 'File exceeds the 5 MB limit.');
    try {
      files[key] = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
    } catch {
      fail(`${key}.csv`, 'File must be UTF-8 encoded.');
    }
  }
  return parseDataset(files, demoNow);
}
