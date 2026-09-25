import { BadRequestException } from '@nestjs/common';
import { Prisma } from '../generated/prisma/client.js';
import type {
  NegativeMarking,
  QuizAudience,
} from '../generated/prisma/enums.js';

interface QuizRulesInput {
  opensAt: Date;
  closesAt: Date;
  negativeMarking: NegativeMarking;
  penaltyValue: string | Prisma.Decimal;
  audience: QuizAudience;
  classIds: string[];
  studentIds: string[];
  questions: {
    points: string | Prisma.Decimal;
    options: { text: string; isCorrect: boolean }[];
  }[];
}

export function validateQuizRules(
  quiz: QuizRulesInput,
  published: boolean,
): void {
  if (quiz.closesAt <= quiz.opensAt)
    throw new BadRequestException('closesAt must be after opensAt');
  const penalty = new Prisma.Decimal(quiz.penaltyValue);
  if (
    (quiz.negativeMarking === 'NONE' && !penalty.isZero()) ||
    (quiz.negativeMarking !== 'NONE' && !penalty.gt(0)) ||
    (quiz.negativeMarking === 'FRACTION' && penalty.gt(1))
  ) {
    throw new BadRequestException(
      'Invalid penaltyValue for the selected negativeMarking mode',
    );
  }
  if (published && !quiz.questions.length)
    throw new BadRequestException('Publishing requires at least one question');
  if (published && quiz.audience === 'CLASSES' && !quiz.classIds.length)
    throw new BadRequestException('Publishing requires at least one class');
  if (published && quiz.audience === 'STUDENTS' && !quiz.studentIds.length)
    throw new BadRequestException(
      'Publishing a quiz for named students requires at least one student',
    );
  for (const [index, question] of quiz.questions.entries()) {
    if (!new Prisma.Decimal(question.points).gt(0))
      throw new BadRequestException(
        `Question ${index + 1}: points must be positive`,
      );
    if (
      new Set(question.options.map((option) => option.text.trim())).size !==
      question.options.length
    )
      throw new BadRequestException(
        `Question ${index + 1}: option texts must be distinct`,
      );
    const correctCount = question.options.filter(
      (option) => option.isCorrect,
    ).length;
    if (
      correctCount > 1 ||
      (published && (question.options.length !== 4 || correctCount !== 1))
    )
      throw new BadRequestException(
        `Question ${index + 1}: publishing requires four options and exactly one correct answer`,
      );
  }
}
