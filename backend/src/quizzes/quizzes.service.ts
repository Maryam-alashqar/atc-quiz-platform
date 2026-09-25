import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type { AuthUser } from '../auth/auth.types.js';
import type { ListQuizzesDto } from './dto/list-quizzes.dto.js';
import type { QuizQuestionDto, SaveQuizDto } from './dto/save-quiz.dto.js';
import { validateQuizRules } from './quiz-rules.js';

const summaryInclude = {
  teacher: { select: { id: true, username: true, name: true } },
  classes: { include: { class: true }, orderBy: { class: { name: 'asc' } } },
  _count: { select: { questions: true, attempts: true, students: true } },
} satisfies Prisma.QuizInclude;
const detailInclude = {
  ...summaryInclude,
  students: {
    select: {
      student: {
        select: {
          id: true,
          username: true,
          name: true,
          class: { select: { id: true, name: true } },
        },
      },
    },
    orderBy: { student: { name: 'asc' } },
  },
  questions: {
    orderBy: { order: 'asc' },
    include: { options: { orderBy: { order: 'asc' } } },
  },
} satisfies Prisma.QuizInclude;
type QuizSummary = Prisma.QuizGetPayload<{ include: typeof summaryInclude }>;
type QuizDetail = Prisma.QuizGetPayload<{ include: typeof detailInclude }>;

function summary(quiz: QuizSummary) {
  const { classes, _count, ...rest } = quiz;
  return {
    ...rest,
    classes: classes.map((assignment) => assignment.class),
    questionCount: _count.questions,
    attemptCount: _count.attempts,
    studentCount: _count.students,
  };
}
function detail(quiz: QuizDetail) {
  const { students, ...rest } = quiz;
  return {
    ...summary(rest),
    students: students.map((assignment) => assignment.student),
    questions: quiz.questions,
    maxScore: quiz.questions
      .reduce(
        (sum, question) => sum.plus(question.points),
        new Prisma.Decimal(0),
      )
      .toFixed(),
  };
}
function nestedQuestions(questions: QuizQuestionDto[]) {
  return questions.map((question, index) => ({
    prompt: question.prompt,
    points: question.points,
    order: index + 1,
    options: {
      create: question.options.map((option, optionIndex) => ({
        ...option,
        order: optionIndex + 1,
      })),
    },
  }));
}

@Injectable()
export class QuizzesService {
  constructor(private readonly prisma: PrismaService) {}

  private ownership(user: AuthUser): Prisma.QuizWhereInput {
    return user.role === 'ADMIN' ? {} : { teacherId: user.id };
  }

  private async ownedQuiz(
    tx: Prisma.TransactionClient,
    id: string,
    user: AuthUser,
  ) {
    const quiz = await tx.quiz.findFirst({
      where: { id, ...this.ownership(user) },
      include: detailInclude,
    });
    if (!quiz) throw new NotFoundException('Quiz not found');
    return quiz;
  }

  /** Named students must be existing STUDENT accounts (any class). */
  private async checkStudents(
    tx: Prisma.TransactionClient,
    studentIds: string[],
  ) {
    if (
      (await tx.user.count({
        where: { id: { in: studentIds }, role: 'STUDENT' },
      })) !== studentIds.length
    )
      throw new BadRequestException('One or more students do not exist');
  }

  private async checkClasses(tx: Prisma.TransactionClient, classIds: string[]) {
    if (
      (await tx.class.count({ where: { id: { in: classIds } } })) !==
      classIds.length
    )
      throw new BadRequestException('One or more classes do not exist');
  }

  async list(user: AuthUser, query: ListQuizzesDto) {
    const where = {
      ...this.ownership(user),
      ...(query.status ? { status: query.status } : {}),
    };
    const [total, items] = await this.prisma.$transaction(
      [
        this.prisma.quiz.count({ where }),
        this.prisma.quiz.findMany({
          where,
          include: summaryInclude,
          orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
          skip: (query.page - 1) * query.pageSize,
          take: query.pageSize,
        }),
      ],
      { isolationLevel: 'RepeatableRead' },
    );
    return {
      items: items.map(summary),
      total,
      page: query.page,
      pageSize: query.pageSize,
    };
  }

  async get(id: string, user: AuthUser) {
    return detail(await this.ownedQuiz(this.prisma, id, user));
  }

  async create(dto: SaveQuizDto, user: AuthUser) {
    if (
      dto.title === undefined ||
      dto.opensAt === undefined ||
      dto.closesAt === undefined
    )
      throw new BadRequestException(
        'title, opensAt and closesAt are required when creating a quiz',
      );
    if (user.role !== 'ADMIN' && dto.teacherId !== undefined)
      throw new ForbiddenException('Only an admin may select a quiz owner');
    const teacherId = user.role === 'ADMIN' ? dto.teacherId : user.id;
    if (!teacherId)
      throw new BadRequestException(
        'An admin must provide teacherId when creating a quiz',
      );
    const data = {
      teacherId,
      title: dto.title,
      description: dto.description ?? null,
      language: dto.language ?? 'EN',
      durationMinutes: dto.durationMinutes ?? 20,
      opensAt: new Date(dto.opensAt),
      closesAt: new Date(dto.closesAt),
      negativeMarking: dto.negativeMarking ?? 'NONE',
      penaltyValue: dto.penaltyValue ?? '0',
      audience: dto.audience ?? 'CLASSES',
    };
    const questions = dto.questions ?? [];
    const classIds = dto.classIds ?? [];
    const studentIds = dto.studentIds ?? [];
    validateQuizRules({ ...data, questions, classIds, studentIds }, false);
    return this.prisma.$transaction(
      async (tx) => {
        if (
          !(await tx.user.findFirst({
            where: { id: teacherId, role: 'TEACHER' },
            select: { id: true },
          }))
        )
          throw new BadRequestException('teacherId must identify a teacher');
        await this.checkClasses(tx, classIds);
        await this.checkStudents(tx, studentIds);
        return detail(
          await tx.quiz.create({
            data: {
              ...data,
              classes: { create: classIds.map((classId) => ({ classId })) },
              students: {
                create: studentIds.map((studentId) => ({ studentId })),
              },
              questions: { create: nestedQuestions(questions) },
            },
            include: detailInclude,
          }),
        );
      },
      { timeout: 15_000 },
    );
  }

  async update(id: string, dto: SaveQuizDto, user: AuthUser) {
    if (!Object.values(dto).some((value) => value !== undefined))
      throw new BadRequestException('Provide at least one field to update');
    if (dto.teacherId !== undefined)
      throw new BadRequestException('Quiz ownership cannot be changed');
    return this.prisma.$transaction(
      async (tx) => {
        await this.prisma.lockQuiz(tx, id);
        const current = await this.ownedQuiz(tx, id, user);
        const protectedFields = [
          'language',
          'durationMinutes',
          'opensAt',
          'closesAt',
          'negativeMarking',
          'penaltyValue',
          'audience',
          'classIds',
          'studentIds',
          'questions',
        ] as const;
        if (
          current._count.attempts &&
          protectedFields.some((field) => dto[field] !== undefined)
        )
          throw new ConflictException(
            'After an attempt starts, only title and description may be changed',
          );
        const opensAt =
          dto.opensAt === undefined ? current.opensAt : new Date(dto.opensAt);
        const closesAt =
          dto.closesAt === undefined
            ? current.closesAt
            : new Date(dto.closesAt);
        validateQuizRules(
          {
            opensAt,
            closesAt,
            negativeMarking: dto.negativeMarking ?? current.negativeMarking,
            penaltyValue: dto.penaltyValue ?? current.penaltyValue,
            audience: dto.audience ?? current.audience,
            classIds:
              dto.classIds ??
              current.classes.map((assignment) => assignment.classId),
            studentIds:
              dto.studentIds ??
              current.students.map((assignment) => assignment.student.id),
            questions: dto.questions ?? current.questions,
          },
          current.status === 'PUBLISHED',
        );
        if (dto.classIds !== undefined) {
          await this.checkClasses(tx, dto.classIds);
          await tx.quizClass.deleteMany({ where: { quizId: id } });
        }
        if (dto.studentIds !== undefined) {
          await this.checkStudents(tx, dto.studentIds);
          await tx.quizStudent.deleteMany({ where: { quizId: id } });
        }
        if (dto.questions !== undefined)
          await tx.question.deleteMany({ where: { quizId: id } });
        return detail(
          await tx.quiz.update({
            where: { id },
            data: {
              title: dto.title,
              description: dto.description,
              language: dto.language,
              durationMinutes: dto.durationMinutes,
              opensAt,
              closesAt,
              negativeMarking: dto.negativeMarking,
              penaltyValue: dto.penaltyValue,
              audience: dto.audience,
              ...(dto.studentIds === undefined
                ? {}
                : {
                    students: {
                      create: dto.studentIds.map((studentId) => ({
                        studentId,
                      })),
                    },
                  }),
              ...(dto.classIds === undefined
                ? {}
                : {
                    classes: {
                      create: dto.classIds.map((classId) => ({ classId })),
                    },
                  }),
              ...(dto.questions === undefined
                ? {}
                : { questions: { create: nestedQuestions(dto.questions) } }),
            },
            include: detailInclude,
          }),
        );
      },
      { isolationLevel: 'ReadCommitted', timeout: 15_000 },
    );
  }

  async publish(id: string, user: AuthUser) {
    return this.prisma.$transaction(
      async (tx) => {
        await this.prisma.lockQuiz(tx, id);
        const quiz = await this.ownedQuiz(tx, id, user);
        if (quiz.status === 'PUBLISHED') return detail(quiz);
        if (quiz._count.attempts)
          throw new ConflictException(
            'A quiz with attempts cannot be republished',
          );
        validateQuizRules(
          {
            ...quiz,
            classIds: quiz.classes.map((assignment) => assignment.classId),
            studentIds: quiz.students.map(
              (assignment) => assignment.student.id,
            ),
          },
          true,
        );
        if (quiz.closesAt <= new Date())
          throw new BadRequestException(
            'Cannot publish a quiz whose closing time has passed',
          );
        return detail(
          await tx.quiz.update({
            where: { id },
            data: { status: 'PUBLISHED' },
            include: detailInclude,
          }),
        );
      },
      { isolationLevel: 'ReadCommitted', timeout: 15_000 },
    );
  }

  async remove(id: string, user: AuthUser): Promise<void> {
    await this.prisma.$transaction(
      async (tx) => {
        await this.prisma.lockQuiz(tx, id);
        const quiz = await this.ownedQuiz(tx, id, user);
        if (quiz._count.attempts)
          throw new ConflictException('A quiz with attempts cannot be deleted');
        await tx.quiz.delete({ where: { id } });
      },
      { isolationLevel: 'ReadCommitted', timeout: 15_000 },
    );
  }
}
