import { randomUUID } from 'node:crypto';
import { readdir, readFile } from 'node:fs/promises';
import pg from 'pg';
import { createDatabaseClient } from '../../src/data/client.js';

export async function createTestDatabase() {
  const baseUrl = process.env.TEST_DATABASE_URL ?? process.env.DATABASE_URL;
  if (!baseUrl)
    throw new Error(
      'Set TEST_DATABASE_URL or DATABASE_URL to run database-backed tests.',
    );
  const schema = `atc_auth_test_${randomUUID().replaceAll('-', '')}`;
  const admin = new pg.Client({ connectionString: baseUrl });
  const url = new URL(baseUrl);
  url.searchParams.set('schema', schema);
  const connectionString = url.toString();
  const db = createDatabaseClient(connectionString);
  let created = false;
  const destroy = async () => {
    await db.$disconnect();
    if (created && /^atc_auth_test_[a-f0-9]{32}$/.test(schema)) {
      await admin.query('ROLLBACK');
      await admin.query(`DROP SCHEMA "${schema}" CASCADE`);
    }
    await admin.end();
  };
  try {
    await admin.connect();
    await admin.query(`CREATE SCHEMA "${schema}"`);
    created = true;
    await admin.query(`SET search_path TO "${schema}"`);
    const directory = new URL('../../prisma/migrations/', import.meta.url);
    const migrations = (await readdir(directory, { withFileTypes: true }))
      .filter((entry) => entry.isDirectory())
      .sort((a, b) => a.name.localeCompare(b.name));
    for (const migration of migrations)
      await admin.query(
        await readFile(
          new URL(`${migration.name}/migration.sql`, directory),
          'utf8',
        ),
      );
    return { db, connectionString, destroy };
  } catch (error) {
    await destroy();
    throw error;
  }
}
