import 'dotenv/config';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createDatabaseClient } from './client.js';
import { readDataset } from './csv.js';
import { importDataset } from './importer.js';

async function main() {
  const [command, directory, ...extra] = process.argv.slice(2);
  if (
    extra.length ||
    (command !== 'seed' && command !== 'import') ||
    (command === 'import' && !directory) ||
    (command === 'seed' && directory)
  ) {
    throw new Error(
      'Usage: npm run db:seed OR npm run db:import -- <CSV-directory>',
    );
  }
  const sampleDirectory = fileURLToPath(
    new URL('../../prisma/data/', import.meta.url),
  );
  // dist/data/cli.js resolves the same backend/prisma/data path as src/data/cli.ts.
  const data = await readDataset(
    directory ? resolve(directory) : sampleDirectory,
    command === 'seed' ? new Date() : undefined,
  );
  if (!process.env.DATABASE_URL)
    throw new Error(
      'DATABASE_URL is required; copy .env.example to .env and configure it.',
    );
  const db = createDatabaseClient(process.env.DATABASE_URL);
  try {
    console.log(JSON.stringify(await importDataset(db, data), null, 2));
  } finally {
    await db.$disconnect();
  }
}

main().catch((error: unknown) => {
  // Prisma errors may contain query values. Do not print raw database errors or credentials.
  const message = error instanceof Error ? error.message : '';
  console.error(
    /^(classes|users|quizzes|questions)\.csv:|^Usage:|^DATABASE_URL|^(classes|users|quizzes|questions)\.csv record /.test(
      message,
    )
      ? message
      : 'Import failed. Check the CSV directory, database connection and applied migrations. No partial import was saved.',
  );
  process.exitCode = 1;
});
