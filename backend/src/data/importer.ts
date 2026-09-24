import { hashPassword } from '../common/security/password.js';
import type { PrismaClient } from '../generated/prisma/client.js';
import type { Dataset } from './csv.js';

/** Append-only import. Existing users/passwords and quiz content are never overwritten. */
export async function importDataset(db: PrismaClient, data: Dataset) {
  const hashes = new Map<string, string>();
  // Bound scrypt concurrency and perform expensive hashing outside the transaction.
  for (let i = 0; i < data.users.length; i += 4) {
    await Promise.all(
      data.users.slice(i, i + 4).map(async (user) => {
        hashes.set(user.username, await hashPassword(user.password));
      }),
    );
  }

  return db.$transaction(
    async (tx) => {
      // Serialize importer processes. ReadCommitted sees the previous import after this lock.
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(4172026, 1)`;
      const summary = {
        classesCreated: 0,
        usersCreated: 0,
        quizzesCreated: 0,
        questionsCreated: 0,
        optionsCreated: 0,
        classesSkipped: 0,
        usersSkipped: 0,
        quizzesSkipped: 0,
      };
      const classIds = new Map<string, string>();
      for (const item of data.classes) {
        const existing = await tx.class.findUnique({
          where: { name: item.name },
        });
        const saved = existing ?? (await tx.class.create({ data: item }));
        classIds.set(item.name, saved.id);
        if (existing) summary.classesSkipped++;
        else summary.classesCreated++;
      }
      const userIds = new Map<string, string>();
      for (const item of data.users) {
        const classId = item.className ? classIds.get(item.className)! : null;
        const existing = await tx.user.findUnique({
          where: { username: item.username },
        });
        if (
          existing &&
          (existing.role !== item.role || existing.classId !== classId)
        ) {
          throw new Error(
            `users.csv: Existing username ${item.username} has a different role or class. No changes were saved.`,
          );
        }
        const saved =
          existing ??
          (await tx.user.create({
            data: {
              username: item.username,
              name: item.name,
              role: item.role,
              classId,
              passwordHash: hashes.get(item.username)!,
            },
          }));
        userIds.set(item.username, saved.id);
        if (existing) summary.usersSkipped++;
        else summary.usersCreated++;
      }
      for (const item of data.quizzes) {
        const teacherId = userIds.get(item.teacherUsername)!;
        const existing = await tx.quiz.findUnique({ where: { id: item.id } });
        if (existing) {
          if (existing.teacherId !== teacherId)
            throw new Error(
              `quizzes.csv: Existing quiz ${item.id} has a different owner. No changes were saved.`,
            );
          summary.quizzesSkipped++;
          continue;
        }
        const { teacherUsername: _teacherUsername, classNames, ...quiz } = item;
        const questions = data.questions.filter(
          (question) => question.quizId === item.id,
        );
        await tx.quiz.create({
          data: {
            ...quiz,
            teacherId,
            classes: {
              create: classNames.map((name) => ({
                classId: classIds.get(name)!,
              })),
            },
            questions: {
              create: questions.map((question) => ({
                prompt: question.prompt,
                points: question.points,
                order: question.order,
                options: {
                  create: question.options.map((text, index) => ({
                    text,
                    order: index + 1,
                    isCorrect: index + 1 === question.correctOption,
                  })),
                },
              })),
            },
          },
        });
        summary.quizzesCreated++;
        summary.questionsCreated += questions.length;
        summary.optionsCreated += questions.length * 4;
      }
      return summary;
    },
    { isolationLevel: 'ReadCommitted', maxWait: 30_000, timeout: 60_000 },
  );
}
