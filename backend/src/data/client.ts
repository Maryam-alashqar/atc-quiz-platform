import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../generated/prisma/client.js';

export function createDatabaseClient(connectionString: string): PrismaClient {
  const schema =
    new URL(connectionString).searchParams.get('schema') ?? 'public';
  return new PrismaClient({
    adapter: new PrismaPg({ connectionString }, { schema }),
  });
}
