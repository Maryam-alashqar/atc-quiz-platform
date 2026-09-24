import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '../generated/prisma/client.js';
import type { AuthUser } from '../auth/auth.types.js';
import type { PaginationDto } from '../common/dto/pagination.dto.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { AttemptClock } from './attempt-clock.js';
import {
  ANSWER_GRACE_MS,
  attemptDeadline,
  graceEndsAt,
  gradeAttempt,
  hasExpired,
  percentage,
} from './attempt-rules.js';
import type { SaveAnswerDto } from './dto/save-answer.dto.js';

const quizSummarySelect = {
  id: true,
  title: true,
  description: true,
  language: true,
  durationMinutes: true,
  opensAt: true,
  closesAt: true,
  negativeMarking: true,
  penaltyValue: true,
} satisfies Prisma.QuizSelect;
const attemptInclude = {
  answers: { orderBy: { questionId: 'asc' } },
  quiz: {
    include: {
      questions: {
        orderBy: { order: 'asc' },
        include: { options: { orderBy: { order: 'asc' } } },
      },
    },
  },
} satisfies Prisma.AttemptInclude;
type LoadedAttempt = Prisma.AttemptGetPayload<{
  include: typeof attemptInclude;
}>;
type AttemptSummary = Pick<
  LoadedAttempt,
  | 'id'
  | 'quizId'
  | 'status'
  | 'startedAt'
  | 'deadlineAt'
  | 'submittedAt'
  | 'score'
  | 'maxScore'
>;

function summary(attempt: AttemptSummary) {
  return {
    id: attempt.id,
    quizId: attempt.quizId,
    status: attempt.status,
    startedAt: attempt.startedAt,
    deadlineAt: attempt.deadlineAt,
    graceEndsAt: graceEndsAt(attempt.deadlineAt),
    submittedAt: attempt.submittedAt,
    score: attempt.score,
    maxScore: attempt.maxScore,
    percentage:
      attempt.score === null
        ? null
        : percentage(attempt.score, attempt.maxScore),
  };
}

/** Explicit projections keep answer keys out of every student response, including completed attempts. */
function present(attempt: LoadedAttempt, now: Date) {
  return {
    ...summary(attempt),
    serverTime: now,
    quiz: {
      id: attempt.quiz.id,
      title: attempt.quiz.title,
      description: attempt.quiz.description,
      language: attempt.quiz.language,
      negativeMarking: attempt.quiz.negativeMarking,
      penaltyValue: attempt.quiz.penaltyValue,
      questions: attempt.quiz.questions.map((question) => ({
        id: question.id,
        prompt: question.prompt,
        points: question.points,
        order: question.order,
        options: question.options.map((option) => ({
          id: option.id,
          text: option.text,
          order: option.order,
        })),
      })),
    },
    answers: attempt.answers.map(({ questionId, optionId }) => ({
      questionId,
      optionId,
    })),
  };
}

@Injectable()
export class AttemptsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly clock: AttemptClock,
  ) {}

  private available(user: AuthUser, now: Date): Prisma.QuizWhereInput {
    return {
      status: 'PUBLISHED',
      opensAt: { lte: now },
      closesAt: { gt: now },
      classes: {
        some: {
          classId: user.classId ?? '00000000-0000-0000-0000-000000000000',
        },
      },
    };
  }

  private async ownedLocked(
    tx: Prisma.TransactionClient,
    id: string,
    user: AuthUser,
  ) {
    await this.prisma.lockAttempt(tx, id);
    const attempt = await tx.attempt.findFirst({
      where: { id, studentId: user.id },
      include: attemptInclude,
    });
    if (!attempt) throw new NotFoundException('Attempt not found');
    return attempt;
  }

  private async complete(
    tx: Prisma.TransactionClient,
    attempt: LoadedAttempt,
    status: 'SUBMITTED' | 'EXPIRED',
    now: Date,
  ) {
    const grade = gradeAttempt(
      attempt.quiz.questions,
      attempt.answers,
      attempt.quiz.negativeMarking,
      attempt.quiz.penaltyValue,
    );
    if (!grade.maxScore.equals(attempt.maxScore))
      throw new Error('Quiz maximum changed after the attempt started');
    return tx.attempt.update({
      where: { id: attempt.id },
      data: { status, score: grade.score, submittedAt: now },
      include: attemptInclude,
    });
  }

  private async expireIfDue(
    tx: Prisma.TransactionClient,
    attempt: LoadedAttempt,
    now: Date,
  ) {
    return attempt.status === 'IN_PROGRESS' &&
      hasExpired(attempt.deadlineAt, now)
      ? this.complete(tx, attempt, 'EXPIRED', now)
      : attempt;
  }

  /** Also reused by the upcoming authorized teacher-results service. No scheduler is needed. */
  async expireOverdueAttempts(
    scope: { studentId: string } | { quizId: string },
  ) {
    const due = await this.prisma.attempt.findMany({
      where: {
        ...scope,
        status: 'IN_PROGRESS',
        deadlineAt: {
          lte: new Date(this.clock.now().getTime() - ANSWER_GRACE_MS),
        },
      },
      select: { id: true },
    });
    for (const { id } of due) {
      await this.prisma.$transaction(
        async (tx) => {
          await this.prisma.lockAttempt(tx, id);
          const attempt = await tx.attempt.findUnique({
            where: { id },
            include: attemptInclude,
          });
          if (attempt) await this.expireIfDue(tx, attempt, this.clock.now());
        },
        { isolationLevel: 'ReadCommitted', timeout: 15_000 },
      );
    }
  }

  async availableQuizzes(user: AuthUser, query: PaginationDto) {
    await this.expireOverdueAttempts({ studentId: user.id });
    const now = this.clock.now();
    const where = this.available(user, now);
    const [total, quizzes] = await this.prisma.$transaction(
      [
        this.prisma.quiz.count({ where }),
        this.prisma.quiz.findMany({
          where,
          select: {
            ...quizSummarySelect,
            questions: { select: { points: true } },
            attempts: { where: { studentId: user.id } },
          },
          orderBy: [{ closesAt: 'asc' }, { id: 'asc' }],
          skip: (query.page - 1) * query.pageSize,
          take: query.pageSize,
        }),
      ],
      { isolationLevel: 'RepeatableRead' },
    );
    return {
      total,
      page: query.page,
      pageSize: query.pageSize,
      serverTime: now,
      items: quizzes.map(({ questions, attempts, ...quiz }) => ({
        ...quiz,
        questionCount: questions.length,
        maxScore: questions
          .reduce(
            (sum, question) => sum.plus(question.points),
            new Prisma.Decimal(0),
          )
          .toFixed(),
        attempt: attempts[0] ? summary(attempts[0]) : null,
      })),
    };
  }

  async quizDetails(id: string, user: AuthUser) {
    const now = this.clock.now();
    const quiz = await this.prisma.quiz.findFirst({
      where: {
        id,
        OR: [
          this.available(user, now),
          { attempts: { some: { studentId: user.id } } },
        ],
      },
      select: {
        ...quizSummarySelect,
        questions: { select: { points: true } },
        attempts: { where: { studentId: user.id }, select: { id: true } },
      },
    });
    if (!quiz) throw new NotFoundException('Quiz not found');
    const { questions, attempts, ...metadata } = quiz;
    const attempt = attempts[0] ? await this.get(attempts[0].id, user) : null;
    return {
      ...metadata,
      serverTime: this.clock.now(),
      questionCount: questions.length,
      maxScore: questions
        .reduce(
          (sum, question) => sum.plus(question.points),
          new Prisma.Decimal(0),
        )
        .toFixed(),
      attempt: attempt ? summary(attempt) : null,
    };
  }

  async start(quizId: string, user: AuthUser) {
    const result = await this.prisma.$transaction(
      async (tx) => {
        if (!(await this.prisma.lockQuiz(tx, quizId)))
          throw new NotFoundException('Quiz not found');
        const existing = await tx.attempt.findUnique({
          where: { quizId_studentId: { quizId, studentId: user.id } },
          select: { id: true },
        });
        if (existing) {
          const attempt = await this.ownedLocked(tx, existing.id, user);
          const now = this.clock.now();
          return { attempt: await this.expireIfDue(tx, attempt, now), now };
        }
        const now = this.clock.now();
        const quiz = await tx.quiz.findFirst({
          where: { id: quizId, ...this.available(user, now) },
          include: { questions: true },
        });
        if (!quiz) throw new NotFoundException('Quiz is unavailable');
        const maxScore = quiz.questions.reduce(
          (sum, question) => sum.plus(question.points),
          new Prisma.Decimal(0),
        );
        if (!maxScore.gt(0))
          throw new ConflictException('Quiz has no scorable questions');
        const attempt = await tx.attempt.create({
          data: {
            quizId,
            studentId: user.id,
            startedAt: now,
            deadlineAt: attemptDeadline(
              now,
              quiz.durationMinutes,
              quiz.closesAt,
            ),
            maxScore,
          },
          include: attemptInclude,
        });
        return { attempt, now };
      },
      { isolationLevel: 'ReadCommitted', timeout: 15_000 },
    );
    // Throw only after committing a lazy expiry, so a rejected restart cannot undo grading.
    if (result.attempt.status !== 'IN_PROGRESS')
      throw new ConflictException({
        message: 'This quiz has already been completed',
        attemptId: result.attempt.id,
        status: result.attempt.status,
      });
    return present(result.attempt, result.now);
  }

  async get(id: string, user: AuthUser) {
    return this.prisma.$transaction(
      async (tx) => {
        const attempt = await this.ownedLocked(tx, id, user);
        const now = this.clock.now();
        return present(await this.expireIfDue(tx, attempt, now), now);
      },
      { isolationLevel: 'ReadCommitted', timeout: 15_000 },
    );
  }

  async history(user: AuthUser, query: PaginationDto) {
    await this.expireOverdueAttempts({ studentId: user.id });
    const where = { studentId: user.id };
    const [total, attempts] = await this.prisma.$transaction(
      [
        this.prisma.attempt.count({ where }),
        this.prisma.attempt.findMany({
          where,
          include: { quiz: { select: quizSummarySelect } },
          orderBy: [{ startedAt: 'desc' }, { id: 'desc' }],
          skip: (query.page - 1) * query.pageSize,
          take: query.pageSize,
        }),
      ],
      { isolationLevel: 'RepeatableRead' },
    );
    return {
      total,
      page: query.page,
      pageSize: query.pageSize,
      serverTime: this.clock.now(),
      items: attempts.map((attempt) => ({
        ...summary(attempt),
        quiz: attempt.quiz,
      })),
    };
  }

  async saveAnswer(id: string, dto: SaveAnswerDto, user: AuthUser) {
    const result = await this.prisma.$transaction(
      async (tx) => {
        const current = await this.ownedLocked(tx, id, user);
        const now = this.clock.now();
        const attempt = await this.expireIfDue(tx, current, now);
        if (attempt.status !== 'IN_PROGRESS')
          return { attempt, now, closed: true };
        const question = attempt.quiz.questions.find(
          (entry) => entry.id === dto.questionId,
        );
        if (
          !question ||
          (dto.optionId !== null &&
            !question.options.some((option) => option.id === dto.optionId))
        )
          throw new BadRequestException(
            'The selected question or option does not belong to this attempt',
          );
        if (dto.optionId === null)
          await tx.answer.deleteMany({
            where: { attemptId: id, questionId: dto.questionId },
          });
        else
          await tx.answer.upsert({
            where: {
              attemptId_questionId: {
                attemptId: id,
                questionId: dto.questionId,
              },
            },
            create: {
              attemptId: id,
              quizId: attempt.quizId,
              questionId: dto.questionId,
              optionId: dto.optionId,
            },
            update: { optionId: dto.optionId },
          });
        return {
          attempt: await tx.attempt.findUniqueOrThrow({
            where: { id },
            include: attemptInclude,
          }),
          now,
          closed: false,
        };
      },
      { isolationLevel: 'ReadCommitted', timeout: 15_000 },
    );
    if (result.closed)
      throw new ConflictException({
        message: 'This attempt no longer accepts answers',
        attemptId: id,
        status: result.attempt.status,
      });
    return present(result.attempt, result.now);
  }

  async submit(id: string, user: AuthUser) {
    return this.prisma.$transaction(
      async (tx) => {
        const current = await this.ownedLocked(tx, id, user);
        const now = this.clock.now();
        const attempt = await this.expireIfDue(tx, current, now);
        return present(
          attempt.status === 'IN_PROGRESS'
            ? await this.complete(tx, attempt, 'SUBMITTED', now)
            : attempt,
          now,
        );
      },
      { isolationLevel: 'ReadCommitted', timeout: 15_000 },
    );
  }
}
