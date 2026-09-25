import { Injectable } from '@nestjs/common';
import { percentage } from '../attempts/attempt-rules.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { overviewStats } from './overview-stats.js';

@Injectable()
export class OverviewService {
  constructor(private readonly prisma: PrismaService) {}

  async overview() {
    const now = new Date();
    // One consistent snapshot; the data set is a single centre (hundreds of rows).
    const [classes, teachers, openedQuizzes, quizCounts, attempts, recent] =
      await this.prisma.$transaction(
        [
          this.prisma.class.findMany({
            select: {
              id: true,
              name: true,
              _count: { select: { students: { where: { role: 'STUDENT' } } } },
            },
            orderBy: { name: 'asc' },
          }),
          this.prisma.user.findMany({
            where: { role: 'TEACHER' },
            select: { id: true, name: true, username: true },
            orderBy: { name: 'asc' },
          }),
          this.prisma.quiz.findMany({
            where: { status: 'PUBLISHED', opensAt: { lte: now } },
            select: {
              id: true,
              teacherId: true,
              closesAt: true,
              classes: { select: { classId: true } },
            },
          }),
          this.prisma.quiz.groupBy({ by: ['status'], _count: true }),
          this.prisma.attempt.findMany({
            where: { status: { in: ['SUBMITTED', 'EXPIRED'] } },
            select: {
              quizId: true,
              score: true,
              maxScore: true,
              student: { select: { classId: true } },
            },
          }),
          this.prisma.attempt.findMany({
            where: { status: { in: ['SUBMITTED', 'EXPIRED'] } },
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

    const stats = overviewStats({
      classes: classes.map((c) => ({
        id: c.id,
        name: c.name,
        studentCount: c._count.students,
      })),
      teachers,
      openedQuizzes: openedQuizzes.map((q) => ({
        id: q.id,
        teacherId: q.teacherId,
        classIds: q.classes.map((c) => c.classId),
      })),
      completedAttempts: attempts.map((a) => ({
        quizId: a.quizId,
        studentClassId: a.student.classId,
        percent: Number(percentage(a.score!, a.maxScore)),
      })),
    });
    const published =
      quizCounts.find((c) => c.status === 'PUBLISHED')?._count ?? 0;
    const live = openedQuizzes.filter((q) => q.closesAt > now).length;

    return {
      serverTime: now,
      counts: {
        students: classes.reduce((sum, c) => sum + c._count.students, 0),
        teachers: teachers.length,
        classes: classes.length,
        liveQuizzes: live,
        scheduledQuizzes: published - openedQuizzes.length,
        closedQuizzes: openedQuizzes.length - live,
        draftQuizzes: quizCounts.find((c) => c.status === 'DRAFT')?._count ?? 0,
      },
      ...stats,
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
