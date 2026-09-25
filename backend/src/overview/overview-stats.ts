/**
 * Participation figures for the admin and teacher dashboards.
 *
 * A quiz is meant either for whole classes or for named students (`named`).
 * "Expected" attempts = for every published quiz that has already opened, the students it
 * is meant for (everyone currently in its classes, or the named students).
 * Participation = completed / expected. Completed means SUBMITTED or EXPIRED (an expired
 * attempt was still marked).
 */

export interface AudienceQuiz {
  id: string;
  classIds: string[];
  /** Named students with their current class, or null/undefined for a whole-class quiz. */
  named?: { id: string; classId: string | null }[] | null;
}

export interface StatsInput {
  classes: { id: string; name: string; studentCount: number }[];
  teachers: { id: string; name: string; username: string }[];
  /** Published quizzes whose opening time has passed. */
  openedQuizzes: (AudienceQuiz & { teacherId: string })[];
  completedAttempts: {
    quizId: string;
    studentId?: string;
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

/**
 * An attempt counts for a quiz only if the student is still meant to take it: in one of
 * its classes, or on its list of names. A student who moved to another class keeps their
 * old attempt out of the new class's figures.
 */
function meantFor(
  quiz: AudienceQuiz,
  attempt: { studentId?: string; studentClassId: string | null },
) {
  if (quiz.named) return quiz.named.some((s) => s.id === attempt.studentId);
  return (
    attempt.studentClassId !== null &&
    quiz.classIds.includes(attempt.studentClassId)
  );
}

function reachesClass(quiz: AudienceQuiz, classId: string) {
  return quiz.named
    ? quiz.named.some((s) => s.classId === classId)
    : quiz.classIds.includes(classId);
}

function expectedIn(
  quiz: AudienceQuiz,
  classId: string,
  studentsIn: Map<string, number>,
) {
  if (quiz.named) return quiz.named.filter((s) => s.classId === classId).length;
  return quiz.classIds.includes(classId) ? (studentsIn.get(classId) ?? 0) : 0;
}

function expectedTotal(quiz: AudienceQuiz, studentsIn: Map<string, number>) {
  if (quiz.named) return quiz.named.length;
  return quiz.classIds.reduce((sum, id) => sum + (studentsIn.get(id) ?? 0), 0);
}

export function overviewStats(input: StatsInput) {
  const studentsIn = new Map(input.classes.map((c) => [c.id, c.studentCount]));
  const quizById = new Map(input.openedQuizzes.map((q) => [q.id, q]));
  const counted = input.completedAttempts.filter((attempt) => {
    const quiz = quizById.get(attempt.quizId);
    return quiz !== undefined && meantFor(quiz, attempt);
  });

  const classes = input.classes.map((c) => {
    const quizzes = input.openedQuizzes.filter((q) => reachesClass(q, c.id));
    const mine = counted.filter((a) => a.studentClassId === c.id);
    return {
      id: c.id,
      name: c.name,
      students: c.studentCount,
      quizzes: quizzes.length,
      ...rate(
        mine.length,
        quizzes.reduce((sum, q) => sum + expectedIn(q, c.id, studentsIn), 0),
        mine.map((a) => a.percent),
      ),
    };
  });

  const teachers = input.teachers.map((t) => {
    const quizzes = input.openedQuizzes.filter((q) => q.teacherId === t.id);
    const ids = new Set(quizzes.map((q) => q.id));
    const mine = counted.filter((a) => ids.has(a.quizId));
    return {
      ...t,
      quizzes: quizzes.length,
      ...rate(
        mine.length,
        quizzes.reduce((sum, q) => sum + expectedTotal(q, studentsIn), 0),
        mine.map((a) => a.percent),
      ),
    };
  });

  return {
    overall: rate(
      counted.length,
      input.openedQuizzes.reduce(
        (sum, q) => sum + expectedTotal(q, studentsIn),
        0,
      ),
      counted.map((a) => a.percent),
    ),
    classes,
    teachers,
  };
}

export interface ProgressInput {
  classes: { id: string; studentCount: number }[];
  quizzes: (AudienceQuiz & { title: string; closesAt: Date })[];
  attempts: {
    quizId: string;
    studentId?: string;
    studentClassId: string | null;
    status: 'IN_PROGRESS' | 'SUBMITTED' | 'EXPIRED';
    percent: number | null;
  }[];
}

/**
 * Per-quiz follow-up for a teacher: of the students a quiz is meant for, how many
 * finished, how many are part-way through and how many have not started.
 * Open quizzes come first (soonest deadline first), then the most recently closed.
 */
export function quizProgress(input: ProgressInput, now: Date, limit = 8) {
  const studentsIn = new Map(input.classes.map((c) => [c.id, c.studentCount]));
  return input.quizzes
    .map((quiz) => {
      const mine = input.attempts.filter(
        (a) => a.quizId === quiz.id && meantFor(quiz, a),
      );
      const finished = mine.filter((a) => a.status !== 'IN_PROGRESS');
      const expected = expectedTotal(quiz, studentsIn);
      const percents = finished
        .map((a) => a.percent)
        .filter((p): p is number => p !== null);
      return {
        id: quiz.id,
        title: quiz.title,
        closesAt: quiz.closesAt,
        open: quiz.closesAt > now,
        audience: quiz.named ? ('STUDENTS' as const) : ('CLASSES' as const),
        expected,
        completed: finished.length,
        inProgress: mine.length - finished.length,
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

export interface StudentProgressInput {
  students: {
    id: string;
    username: string;
    name: string;
    class: { id: string; name: string } | null;
  }[];
  /** The teacher's published quizzes that have opened. */
  quizzes: (AudienceQuiz & { closesAt: Date })[];
  attempts: {
    quizId: string;
    studentId: string;
    status: 'IN_PROGRESS' | 'SUBMITTED' | 'EXPIRED';
    percent: number | null;
  }[];
}

/**
 * One row per student for a teacher's "My students" page: how many of the teacher's
 * quizzes were meant for them, how many they finished, how many open ones they have
 * not started yet, and their average score.
 */
export function studentProgress(input: StudentProgressInput, now: Date) {
  return input.students.map((student) => {
    const meant = input.quizzes.filter((quiz) =>
      meantFor(quiz, {
        studentId: student.id,
        studentClassId: student.class?.id ?? null,
      }),
    );
    const mine = input.attempts.filter(
      (a) => a.studentId === student.id && meant.some((q) => q.id === a.quizId),
    );
    const finished = mine.filter((a) => a.status !== 'IN_PROGRESS');
    const started = new Set(mine.map((a) => a.quizId));
    const percents = finished
      .map((a) => a.percent)
      .filter((p): p is number => p !== null);
    return {
      student,
      assigned: meant.length,
      completed: finished.length,
      openNotStarted: meant.filter(
        (q) => q.closesAt > now && !started.has(q.id),
      ).length,
      missed: meant.filter((q) => q.closesAt <= now && !started.has(q.id))
        .length,
      averagePercent: percents.length
        ? Math.round(percents.reduce((s, p) => s + p, 0) / percents.length)
        : null,
    };
  });
}
