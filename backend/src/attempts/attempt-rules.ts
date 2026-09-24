import { Prisma } from '../generated/prisma/client.js';
import type { NegativeMarking } from '../generated/prisma/enums.js';

export const ANSWER_GRACE_MS = 10_000;

export function attemptDeadline(
  startedAt: Date,
  durationMinutes: number,
  closesAt: Date,
): Date {
  return new Date(
    Math.min(
      startedAt.getTime() + durationMinutes * 60_000,
      closesAt.getTime(),
    ),
  );
}

export function graceEndsAt(deadlineAt: Date): Date {
  return new Date(deadlineAt.getTime() + ANSWER_GRACE_MS);
}

export function hasExpired(deadlineAt: Date, now: Date): boolean {
  return now.getTime() >= graceEndsAt(deadlineAt).getTime();
}

export function percentage(
  score: Prisma.Decimal,
  maxScore: Prisma.Decimal,
): string {
  return score
    .dividedBy(maxScore)
    .times(100)
    .toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP)
    .toFixed(2);
}

interface ScoringQuestion {
  id: string;
  points: string | Prisma.Decimal;
  options: { id: string; isCorrect: boolean }[];
}

/** The caller validates question/option membership before persistence. No client scores are accepted. */
export function gradeAttempt(
  questions: ScoringQuestion[],
  answers: { questionId: string; optionId: string }[],
  mode: NegativeMarking,
  penaltyValue: string | Prisma.Decimal,
) {
  const selected = new Map(
    answers.map((answer) => [answer.questionId, answer.optionId]),
  );
  let score = new Prisma.Decimal(0);
  let maxScore = new Prisma.Decimal(0);
  const penalty = new Prisma.Decimal(penaltyValue);
  for (const question of questions) {
    const points = new Prisma.Decimal(question.points);
    maxScore = maxScore.plus(points);
    const optionId = selected.get(question.id);
    if (!optionId) continue;
    const option = question.options.find((entry) => entry.id === optionId);
    if (!option)
      throw new Error('Stored answer does not belong to its question');
    if (option.isCorrect) score = score.plus(points);
    else if (mode === 'FRACTION') score = score.minus(points.times(penalty));
    else if (mode === 'FIXED') score = score.minus(penalty);
  }
  return { score: Prisma.Decimal.max(score, 0), maxScore };
}
