import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { Prisma, PrismaClient } from '../generated/prisma/client.js';
import type { Environment } from '../config/environment.js';

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  private readonly quizTable: Prisma.Sql;
  constructor(config: ConfigService<Environment, true>) {
    const connectionString = config.get('DATABASE_URL', { infer: true });
    const schema =
      new URL(connectionString).searchParams.get('schema') ?? 'public';
    super({ adapter: new PrismaPg({ connectionString }, { schema }) });
    // Identifiers cannot be query parameters; quote the configured schema safely.
    this.quizTable = Prisma.raw(`"${schema.replaceAll('"', '""')}"."Quiz"`);
  }

  /** Mutations and future attempt creation must lock before reading quiz state. */
  async lockQuiz(
    tx: Prisma.TransactionClient,
    quizId: string,
  ): Promise<boolean> {
    const rows = await tx.$queryRaw<
      { id: string }[]
    >`SELECT "id" FROM ${this.quizTable} WHERE "id" = ${quizId}::uuid FOR UPDATE`;
    return rows.length > 0;
  }

  async onModuleInit() {
    await this.$connect();
  }
  async onModuleDestroy() {
    await this.$disconnect();
  }
}
