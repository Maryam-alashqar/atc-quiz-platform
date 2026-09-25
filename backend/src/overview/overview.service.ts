import { Injectable } from '@nestjs/common';
import { Prisma } from '../generated/prisma/client.js';
import { AttemptsService } from '../attempts/attempts.service.js';
import { percentage } from '../attempts/attempt-rules.js';
import type { AuthUser } from '../auth/auth.types.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { overviewStats, quizProgress } from './overview-stats.js';

@Injectable()
export class OverviewService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly attempts: AttemptsService,
  ) {}

  /**
   * The admin sees the whole centre. A teacher sees the same figures limited to their
   * own quizzes and the classes those quizzes are assigned to.
   */
  async overview(user: AuthUser) {
    const teacherOnly = user.role === 'TEACHER';
    const quizScope: Prisma.QuizWhereInput = teacherOnly
      ? { teacherId: user.id }
      : {};
    const now = new Date();

    // Grade abandoned attempts whose time is up, so the figures are current. Expiry is
    // otherwise lazy (see docs/student-attempts.md); this uses the same locked path.
    const opened = await this.prisma.quiz.findMany({
      where: { ...quizScope, status: 'PUBLISHED', opensAt: { lte: now } },
      select: { id: true },
    });
    for (const { id } of opened)
      await this.attempts.expireOverdueAttempts({ quizId: id });

    // One consistent snapshot; the data set is a single centre (hundreds of rows).
    const [classes, teachers, openedQuizzes, quizCounts, attempts, recent] =
      await this.prisma.$transaction(
        [
          this.prisma.class.findMany({
            where: teacherOnly
              ? { quizzes: { some: { quiz: { teacherId: user.id } } } }
              : {},
            select: {
              id: true,
              name: true,
              _count: { select: { students: { where: { role: 'STUDENT' } } } },
            },
            orderBy: { name: 'asc' },
          }),
          this.prisma.user.findMany({
            where: teacherOnly ? { id: user.id } : { role: 'TEACHER' },
            select: { id: true, name: true, username: true },
            orderBy: { name: 'asc' },
          }),
          this.prisma.quiz.findMany({
            where: { ...quizScope, status: 'PUBLISHED', opensAt: { lte: now } },
            select: {
              id: true,
              title: true,
              teacherId: true,
              closesAt: true,
              classes: { select: { classId: true } },
            },
          }),
          this.prisma.quiz.groupBy({
            by: ['status'],
            where: quizScope,
            _count: true,
          }),
          this.prisma.attempt.findMany({
            where: { quiz: quizScope },
            select: {
              quizId: true,
              status: true,
              score: true,
              maxScore: true,
              student: { select: { classId: true } },
            },
          }),
          this.prisma.attempt.findMany({
            where: {
              quiz: quizScope,
              status: { in: ['SUBMITTED', 'EXPIRED'] },
            },
            orderBy: { submittedAt: 'desc' },
            take: 6,
            select: {
              id: true,
              status: true,
              submittedAt: true,
              score: true,
              maxScore: true,
              quiz: { select: { id: true, title: true } },
              student: {
                select: { name: true, class: { select: { name: true } } },
              },
            },
          }),
        ],
        { isolationLevel: 'RepeatableRead' },
      );

    const classInput = classes.map((c) => ({
      id: c.id,
      name: c.name,
      studentCount: c._count.students,
    }));
    const quizInput = openedQuizzes.map((q) => ({
      id: q.id,
      title: q.title,
      teacherId: q.teacherId,
      closesAt: q.closesAt,
      classIds: q.classes.map((c) => c.classId),
    }));
    const attemptInput = attempts.map((a) => ({
      quizId: a.quizId,
      studentClassId: a.student.classId,
      status: a.status,
      percent:
        a.score === null ? null : Number(percentage(a.score, a.maxScore)),
    }));
    const stats = overviewStats({
      classes: classInput,
      teachers,
      openedQuizzes: quizInput,
      completedAttempts: attemptInput.flatMap((a) =>
        a.percent === null ? [] : [{ ...a, percent: a.percent }],
      ),
    });
    const published =
      quizCounts.find((c) => c.status === 'PUBLISHED')?._count ?? 0;
    const live = openedQuizzes.filter((q) => q.closesAt > now).length;

    return {
      serverTime: now,
      scope: teacherOnly ? 'TEACHER' : 'CENTRE',
      counts: {
        students: classes.reduce((sum, c) => sum + c._count.students, 0),
        teachers: teacherOnly ? 1 : teachers.length,
        classes: classes.length,
        liveQuizzes: live,
        scheduledQuizzes: published - openedQuizzes.length,
        closedQuizzes: openedQuizzes.length - live,
        draftQuizzes: quizCounts.find((c) => c.status === 'DRAFT')?._count ?? 0,
      },
      ...stats,
      // A teacher does not need a list of other teachers; their own row is in `quizzes`.
      teachers: teacherOnly ? [] : stats.teachers,
      quizzes: quizProgress(
        { classes: classInput, quizzes: quizInput, attempts: attemptInput },
        now,
      ),
      recent: recent.map((a) => ({
        id: a.id,
        status: a.status,
        submittedAt: a.submittedAt,
        score: a.score,
        maxScore: a.maxScore,
        percentage: percentage(a.score!, a.maxScore),
        quiz: a.quiz,
        student: {
          name: a.student.name,
          className: a.student.class?.name ?? null,
        },
      })),
    };
  }
}
