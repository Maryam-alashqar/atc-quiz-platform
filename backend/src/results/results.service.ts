import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { AttemptsService } from '../attempts/attempts.service.js';
import { percentage } from '../attempts/attempt-rules.js';
import type { AuthUser } from '../auth/auth.types.js';
import type { PaginationDto } from '../common/dto/pagination.dto.js';
import { resultsCsv } from './results-csv.js';

const resultSelect = {
  id: true,
  status: true,
  startedAt: true,
  deadlineAt: true,
  submittedAt: true,
  score: true,
  maxScore: true,
  student: {
    select: {
      id: true,
      username: true,
      name: true,
      class: { select: { id: true, name: true } },
    },
  },
} satisfies Prisma.AttemptSelect;
type Result = Prisma.AttemptGetPayload<{ select: typeof resultSelect }>;
function present(row: Result) {
  return {
    ...row,
    percentage: row.score === null ? null : percentage(row.score, row.maxScore),
  };
}

@Injectable()
export class ResultsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly attempts: AttemptsService,
  ) {}

  private async authorize(id: string, user: AuthUser) {
    const quiz = await this.prisma.quiz.findFirst({
      where: { id, ...(user.role === 'ADMIN' ? {} : { teacherId: user.id }) },
      select: { id: true },
    });
    if (!quiz) throw new NotFoundException('Quiz not found');
    // Authorization must precede lazy expiry: inaccessible requests cannot mutate results.
    await this.attempts.expireOverdueAttempts({ quizId: id });
  }

  async list(id: string, user: AuthUser, query: PaginationDto) {
    await this.authorize(id, user);
    return this.prisma.$transaction(
      async (tx) => {
        const quiz = await tx.quiz.findUnique({
          where: { id },
          select: { id: true, title: true },
        });
        if (!quiz) throw new NotFoundException('Quiz not found');
        const where = { quizId: id };
        const groups = await tx.attempt.groupBy({
          by: ['status'],
          where,
          _count: { _all: true },
        });
        const counts = { IN_PROGRESS: 0, SUBMITTED: 0, EXPIRED: 0 };
        for (const group of groups) counts[group.status] = group._count._all;
        const total = counts.IN_PROGRESS + counts.SUBMITTED + counts.EXPIRED;
        const aggregate = await tx.attempt.aggregate({
          where: { ...where, status: { in: ['SUBMITTED', 'EXPIRED'] } },
          _avg: { score: true },
          _min: { score: true },
          _max: { score: true },
        });
        const items = await tx.attempt.findMany({
          where,
          select: resultSelect,
          orderBy: [{ startedAt: 'desc' }, { id: 'asc' }],
          skip: (query.page - 1) * query.pageSize,
          take: query.pageSize,
        });
        return {
          quiz,
          total,
          page: query.page,
          pageSize: query.pageSize,
          summary: {
            inProgress: counts.IN_PROGRESS,
            submitted: counts.SUBMITTED,
            expired: counts.EXPIRED,
            completed: counts.SUBMITTED + counts.EXPIRED,
            averageScore: aggregate._avg.score?.toFixed(2) ?? null,
            lowestScore: aggregate._min.score,
            highestScore: aggregate._max.score,
          },
          items: items.map(present),
        };
      },
      { isolationLevel: 'RepeatableRead', timeout: 15_000 },
    );
  }

  /**
   * Every student the quiz is assigned to, with their attempt or none, so a teacher can
   * see who has not started. Students who attempted and later changed class are kept.
   */
  async students(id: string, user: AuthUser) {
    await this.authorize(id, user);
    return this.prisma.$transaction(
      async (tx) => {
        const quiz = await tx.quiz.findUnique({
          where: { id },
          select: {
            id: true,
            title: true,
            status: true,
            opensAt: true,
            closesAt: true,
            audience: true,
            students: { select: { studentId: true } },
            classes: {
              select: { class: { select: { id: true, name: true } } },
              orderBy: { class: { name: 'asc' } },
            },
          },
        });
        if (!quiz) throw new NotFoundException('Quiz not found');
        const classIds = quiz.classes.map((c) => c.class.id);
        const [students, attempts] = await Promise.all([
          tx.user.findMany({
            // Named-student quizzes list exactly those students; others list their classes.
            where:
              quiz.audience === 'STUDENTS'
                ? { id: { in: quiz.students.map((s) => s.studentId) } }
                : { role: 'STUDENT', classId: { in: classIds } },
            select: resultSelect.student.select,
            orderBy: [{ class: { name: 'asc' } }, { name: 'asc' }],
          }),
          tx.attempt.findMany({ where: { quizId: id }, select: resultSelect }),
        ]);
        const byStudent = new Map(attempts.map((a) => [a.student.id, a]));
        const listed = new Set(students.map((s) => s.id));
        const rows = [
          ...students.map((student) => ({
            student,
            attempt: byStudent.get(student.id),
          })),
          ...attempts
            .filter((a) => !listed.has(a.student.id))
            .map((a) => ({ student: a.student, attempt: a })),
        ].map(({ student, attempt }) => ({
          student,
          attempt: attempt ? present(attempt) : null,
        }));
        const count = (status: string) =>
          rows.filter((r) => r.attempt?.status === status).length;
        return {
          quiz: {
            id: quiz.id,
            title: quiz.title,
            status: quiz.status,
            opensAt: quiz.opensAt,
            closesAt: quiz.closesAt,
            audience: quiz.audience,
            classes: quiz.classes.map((c) => c.class),
          },
          summary: {
            assigned: students.length,
            notStarted: rows.filter((r) => !r.attempt).length,
            inProgress: count('IN_PROGRESS'),
            submitted: count('SUBMITTED'),
            expired: count('EXPIRED'),
          },
          items: rows.map(({ student, attempt }) => ({
            student,
            attempt: attempt && {
              id: attempt.id,
              status: attempt.status,
              startedAt: attempt.startedAt,
              submittedAt: attempt.submittedAt,
              score: attempt.score,
              maxScore: attempt.maxScore,
              percentage: attempt.percentage,
            },
          })),
        };
      },
      { isolationLevel: 'RepeatableRead', timeout: 15_000 },
    );
  }

  async export(id: string, user: AuthUser) {
    await this.authorize(id, user);
    const rows = await this.prisma.attempt.findMany({
      where: { quizId: id },
      select: resultSelect,
      orderBy: [{ startedAt: 'desc' }, { id: 'asc' }],
    });
    return resultsCsv(rows.map(present));
  }
}
