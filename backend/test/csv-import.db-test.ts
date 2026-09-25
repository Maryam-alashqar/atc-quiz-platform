import 'dotenv/config';
import { randomUUID } from 'node:crypto';
import { readdir, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import pg from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createDatabaseClient } from '../src/data/client.js';
import { readDataset, type Dataset } from '../src/data/csv.js';
import { importDataset } from '../src/data/importer.js';
import { verifyPassword } from '../src/common/security/password.js';

// Each run owns a new schema; existing application tables are never truncated.
const schema = `atc_import_test_${randomUUID().replaceAll('-', '')}`;
const connectionString =
  process.env.TEST_DATABASE_URL ?? process.env.DATABASE_URL;
if (!connectionString)
  throw new Error(
    'Set TEST_DATABASE_URL or DATABASE_URL before running database tests.',
  );
const url = new URL(connectionString);
url.searchParams.set('schema', schema);
const db = createDatabaseClient(url.toString());
const admin = new pg.Client({ connectionString });
let data: Dataset;
let created = false;

beforeAll(async () => {
  await admin.connect();
  await admin.query(`CREATE SCHEMA "${schema}"`);
  created = true;
  await admin.query(`SET search_path TO "${schema}"`);
  // Apply every migration in order, so the schema matches production.
  const directory = new URL('../prisma/migrations/', import.meta.url);
  const migrations = (await readdir(directory, { withFileTypes: true }))
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();
  for (const name of migrations)
    await admin.query(
      await readFile(new URL(`${name}/migration.sql`, directory), 'utf8'),
    );
  data = await readDataset(
    fileURLToPath(new URL('../prisma/data/', import.meta.url)),
    new Date(),
  );
});

afterAll(async () => {
  await db.$disconnect();
  if (created && /^atc_import_test_[a-f0-9]{32}$/.test(schema)) {
    await admin.query('ROLLBACK');
    await admin.query(`DROP SCHEMA "${schema}" CASCADE`);
  }
  await admin.end();
});

describe.sequential('CSV import — PostgreSQL persistence', () => {
  it('imports the full dataset concurrently without duplicating records', async () => {
    const summaries = await Promise.all([
      importDataset(db, data),
      importDataset(db, data),
    ]);
    expect(summaries.map((s) => s.usersCreated).sort((a, b) => a - b)).toEqual([
      0, 65,
    ]);
    expect(await db.class.count()).toBe(3);
    expect(await db.user.count()).toBe(65);
    expect(await db.quiz.count()).toBe(5);
    expect(await db.question.count()).toBe(75);
    expect(await db.option.count()).toBe(300);
    const student = await db.user.findUniqueOrThrow({
      where: { username: 's10a-01' },
    });
    expect(student.name).toBe('أحمد الخطيب');
    expect(await verifyPassword('AtcDemo2026!', student.passwordHash)).toBe(
      true,
    );
    expect(await verifyPassword('wrong', student.passwordHash)).toBe(false);
    const questions = await db.question.findMany({
      include: { options: true },
    });
    for (const question of questions) {
      expect(question.options).toHaveLength(4);
      expect(question.options.filter((o) => o.isCorrect)).toHaveLength(1);
    }
  });

  it('preserves passwords, quiz edits, dates and attempts when imported again', async () => {
    const student = await db.user.findUniqueOrThrow({
      where: { username: 's10a-01' },
    });
    const quiz = await db.quiz.update({
      where: { id: data.quizzes[0].id },
      data: { title: 'Edited by teacher' },
    });
    const attempt = await db.attempt.create({
      data: {
        quizId: quiz.id,
        studentId: student.id,
        maxScore: '22.5',
        deadlineAt: new Date(Date.now() + 60_000),
      },
    });
    const changed = structuredClone(data);
    changed.users.find((u) => u.username === student.username)!.password =
      'DoNotResetThis!';
    changed.quizzes[0].closesAt = new Date(Date.now() + 90 * 86_400_000);
    const summary = await importDataset(db, changed);
    expect(summary.usersCreated).toBe(0);
    expect(summary.quizzesCreated).toBe(0);
    expect(
      (await db.user.findUniqueOrThrow({ where: { id: student.id } }))
        .passwordHash,
    ).toBe(student.passwordHash);
    expect(await db.quiz.findUnique({ where: { id: quiz.id } })).toEqual(quiz);
    expect(await db.attempt.findUnique({ where: { id: attempt.id } })).toEqual(
      attempt,
    );
    expect(await db.question.count()).toBe(75);
  });

  it('rolls back earlier inserts when a later existing user conflicts', async () => {
    const invalid = structuredClone(data);
    invalid.classes.push({ name: 'rollback-class' });
    invalid.users.unshift({
      username: 'rollback-user',
      name: 'Rollback test',
      role: 'TEACHER',
      className: '',
      password: 'TestPassword!',
    });
    const last = invalid.users.at(-1)!;
    last.role = 'TEACHER';
    last.className = '';
    await expect(importDataset(db, invalid)).rejects.toThrow(
      'different role or class',
    );
    expect(
      await db.class.findUnique({ where: { name: 'rollback-class' } }),
    ).toBeNull();
    expect(
      await db.user.findUnique({ where: { username: 'rollback-user' } }),
    ).toBeNull();
    expect(await db.user.count()).toBe(65);
  });

  it('rejects an existing quiz ID owned by another teacher atomically', async () => {
    const invalid = structuredClone(data);
    invalid.classes.push({ name: 'owner-conflict-class' });
    invalid.quizzes[0].teacherUsername = 'teacher-english';
    await expect(importDataset(db, invalid)).rejects.toThrow('different owner');
    expect(
      await db.class.findUnique({ where: { name: 'owner-conflict-class' } }),
    ).toBeNull();
  });
});
