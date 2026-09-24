import { describe, expect, it } from 'vitest';
import { Prisma } from '../generated/prisma/client.js';
import { gradeAttempt, percentage } from './attempt-rules.js';

const questions = [
  {
    id: 'q1',
    points: '1.5',
    options: [
      { id: 'q1-correct', isCorrect: true },
      { id: 'q1-wrong', isCorrect: false },
    ],
  },
  {
    id: 'q2',
    points: '2.5',
    options: [
      { id: 'q2-correct', isCorrect: true },
      { id: 'q2-wrong', isCorrect: false },
    ],
  },
  {
    id: 'q3',
    points: '3',
    options: [
      { id: 'q3-correct', isCorrect: true },
      { id: 'q3-wrong', isCorrect: false },
    ],
  },
];
const answers = [
  { questionId: 'q1', optionId: 'q1-correct' },
  { questionId: 'q2', optionId: 'q2-wrong' },
];

describe('Attempt scoring — weighted questions and negative marking', () => {
  it('adds each correct question’s own points rather than counting correct answers', () => {
    const grade = gradeAttempt(
      questions,
      questions.map((q) => ({ questionId: q.id, optionId: `${q.id}-correct` })),
      'NONE',
      '0',
    );
    expect(grade.score.toFixed()).toBe('7');
    expect(grade.maxScore.toFixed()).toBe('7');
    expect(percentage(grade.score, grade.maxScore)).toBe('100.00');
  });

  it.each([
    ['NONE', '0', '1.5'],
    ['FRACTION', '0.25', '0.875'],
    ['FIXED', '0.5', '1'],
  ] as const)(
    'scores a correct, wrong and unanswered question in %s mode',
    (mode, penalty, expected) => {
      expect(
        gradeAttempt(questions, answers, mode, penalty).score.toFixed(),
      ).toBe(expected);
    },
  );

  it('gives unanswered questions zero even when fixed negative marking is enabled', () => {
    expect(gradeAttempt(questions, [], 'FIXED', '100').score.toFixed()).toBe(
      '0',
    );
  });

  it('floors the total at zero after applying all penalties', () => {
    expect(
      gradeAttempt(
        questions,
        [{ questionId: 'q1', optionId: 'q1-wrong' }],
        'FIXED',
        '10',
      ).score.toFixed(),
    ).toBe('0');
  });

  it('preserves eight-decimal products without floating-point rounding loss', () => {
    const precise = [
      { ...questions[0], points: '2' },
      { ...questions[1], points: '1.2345' },
    ];
    const grade = gradeAttempt(precise, answers, 'FRACTION', '0.1234');
    expect(grade.score.toFixed()).toBe('1.8476627');
    expect(grade.maxScore.toFixed()).toBe('3.2345');
  });

  it('rounds only the displayed percentage to two decimal places', () => {
    expect(percentage(new Prisma.Decimal(1), new Prisma.Decimal(3))).toBe(
      '33.33',
    );
    expect(percentage(new Prisma.Decimal(2), new Prisma.Decimal(3))).toBe(
      '66.67',
    );
  });

  it('rejects inconsistent stored option references instead of guessing a score', () => {
    expect(() =>
      gradeAttempt(
        questions,
        [{ questionId: 'q1', optionId: 'q2-correct' }],
        'NONE',
        '0',
      ),
    ).toThrow('does not belong');
  });
});
