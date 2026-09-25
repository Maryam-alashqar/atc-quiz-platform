/**
 * Centre-wide participation figures for the admin dashboard.
 *
 * "Expected" attempts = for every published quiz that has already opened, the number of
 * students currently in each class it is assigned to. Participation = completed / expected.
 * Completed means SUBMITTED or EXPIRED (an expired attempt was still marked).
 */

export interface StatsInput {
  classes: { id: string; name: string; studentCount: number }[];
  teachers: { id: string; name: string; username: string }[];
  /** Published quizzes whose opening time has passed. */
  openedQuizzes: { id: string; teacherId: string; classIds: string[] }[];
  completedAttempts: {
    quizId: string;
    studentClassId: string | null;
    percent: number;
  }[];
}

export interface Rate {
  completed: number;
  expected: number;
  /** Rounded 0–100, or null when nothing was expected yet. */
  participation: number | null;
  /** Rounded mean score percentage of completed attempts, or null. */
  averagePercent: number | null;
}

function rate(completed: number, expected: number, percents: number[]): Rate {
  return {
    completed,
    expected,
    participation: expected
      ? Math.min(100, Math.round((completed / expected) * 100))
      : null,
    averagePercent: percents.length
      ? Math.round(percents.reduce((sum, p) => sum + p, 0) / percents.length)
      : null,
  };
}

export function overviewStats(input: StatsInput) {
  const studentsIn = new Map(input.classes.map((c) => [c.id, c.studentCount]));
  const quizById = new Map(input.openedQuizzes.map((q) => [q.id, q]));
  // Only attempts on opened quizzes, by students of a class the quiz is assigned to,
  // count towards participation (a student who moved class keeps their old attempts
  // out of the new class's figures).
  const counted = input.completedAttempts.filter((attempt) => {
    const quiz = quizById.get(attempt.quizId);
    return (
      quiz &&
      attempt.studentClassId !== null &&
      quiz.classIds.includes(attempt.studentClassId)
    );
  });

  const classes = input.classes.map((c) => {
    const quizzes = input.openedQuizzes.filter((q) =>
      q.classIds.includes(c.id),
    );
    const mine = counted.filter((a) => a.studentClassId === c.id);
    return {
      id: c.id,
      name: c.name,
      students: c.studentCount,
      quizzes: quizzes.length,
      ...rate(
        mine.length,
        quizzes.length * c.studentCount,
        mine.map((a) => a.percent),
      ),
    };
  });

  const teachers = input.teachers.map((t) => {
    const quizzes = input.openedQuizzes.filter((q) => q.teacherId === t.id);
    const ids = new Set(quizzes.map((q) => q.id));
    const mine = counted.filter((a) => ids.has(a.quizId));
    const expected = quizzes.reduce(
      (sum, q) =>
        sum + q.classIds.reduce((s, id) => s + (studentsIn.get(id) ?? 0), 0),
      0,
    );
    return {
      ...t,
      quizzes: quizzes.length,
      ...rate(
        mine.length,
        expected,
        mine.map((a) => a.percent),
      ),
    };
  });

  const expected = classes.reduce((sum, c) => sum + c.expected, 0);
  return {
    overall: rate(
      counted.length,
      expected,
      counted.map((a) => a.percent),
    ),
    classes,
    teachers,
  };
}

export interface ProgressInput {
  classes: { id: string; studentCount: number }[];
  quizzes: {
    id: string;
    title: string;
    closesAt: Date;
    classIds: string[];
  }[];
  attempts: {
    quizId: string;
    studentClassId: string | null;
    status: 'IN_PROGRESS' | 'SUBMITTED' | 'EXPIRED';
    percent: number | null;
  }[];
}

/**
 * Per-quiz follow-up for a teacher: of the students in the assigned classes, how many
 * finished, how many are part-way through and how many have not started.
 * Open quizzes come first (soonest deadline first), then the most recently closed.
 */
export function quizProgress(input: ProgressInput, now: Date, limit = 8) {
  const studentsIn = new Map(input.classes.map((c) => [c.id, c.studentCount]));
  return input.quizzes
    .map((quiz) => {
      const mine = input.attempts.filter(
        (a) =>
          a.quizId === quiz.id &&
          a.studentClassId !== null &&
          quiz.classIds.includes(a.studentClassId),
      );
      const finished = mine.filter((a) => a.status !== 'IN_PROGRESS');
      const inProgress = mine.length - finished.length;
      const expected = quiz.classIds.reduce(
        (sum, id) => sum + (studentsIn.get(id) ?? 0),
        0,
      );
      const percents = finished
        .map((a) => a.percent)
        .filter((p): p is number => p !== null);
      return {
        id: quiz.id,
        title: quiz.title,
        closesAt: quiz.closesAt,
        open: quiz.closesAt > now,
        expected,
        completed: finished.length,
        inProgress,
        notStarted: Math.max(0, expected - mine.length),
        averagePercent: percents.length
          ? Math.round(percents.reduce((s, p) => s + p, 0) / percents.length)
          : null,
      };
    })
    .sort((a, b) =>
      a.open !== b.open
        ? Number(b.open) - Number(a.open)
        : a.open
          ? a.closesAt.getTime() - b.closesAt.getTime()
          : b.closesAt.getTime() - a.closesAt.getTime(),
    )
    .slice(0, limit);
}
