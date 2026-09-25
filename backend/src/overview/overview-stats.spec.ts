import {
  overviewStats,
  quizProgress,
  studentProgress,
  type StatsInput,
} from './overview-stats.js';

const base: StatsInput = {
  classes: [
    { id: 'c10a', name: '10A', studentCount: 20 },
    { id: 'c11a', name: '11A', studentCount: 10 },
  ],
  teachers: [
    { id: 'math', name: 'Rana', username: 'teacher-math' },
    { id: 'eng', name: 'Sami', username: 'teacher-english' },
  ],
  openedQuizzes: [
    { id: 'algebra', teacherId: 'math', classIds: ['c10a'] },
    { id: 'grammar', teacherId: 'eng', classIds: ['c10a', 'c11a'] },
  ],
  completedAttempts: [],
};

describe('Admin overview — participation statistics', () => {
  it('expects one attempt per student for every opened quiz assigned to their class', () => {
    const stats = overviewStats(base);
    expect(stats.classes.map((c) => [c.name, c.quizzes, c.expected])).toEqual([
      ['10A', 2, 40],
      ['11A', 1, 10],
    ]);
    expect(stats.teachers.map((t) => [t.username, t.expected])).toEqual([
      ['teacher-math', 20],
      ['teacher-english', 30],
    ]);
    expect(stats.overall).toEqual({
      completed: 0,
      expected: 50,
      participation: 0,
      averagePercent: null,
    });
  });

  it('computes participation and average score per class and per teacher', () => {
    const stats = overviewStats({
      ...base,
      completedAttempts: [
        { quizId: 'algebra', studentClassId: 'c10a', percent: 80 },
        { quizId: 'algebra', studentClassId: 'c10a', percent: 60 },
        { quizId: 'grammar', studentClassId: 'c11a', percent: 90 },
      ],
    });
    const [c10a, c11a] = stats.classes;
    expect(c10a).toMatchObject({
      completed: 2,
      participation: 5,
      averagePercent: 70,
    });
    expect(c11a).toMatchObject({
      completed: 1,
      participation: 10,
      averagePercent: 90,
    });
    expect(stats.teachers[0]).toMatchObject({
      completed: 2,
      participation: 10,
      averagePercent: 70,
    });
    expect(stats.teachers[1]).toMatchObject({
      completed: 1,
      participation: 3,
      averagePercent: 90,
    });
    expect(stats.overall).toMatchObject({
      completed: 3,
      expected: 50,
      participation: 6,
      averagePercent: 77,
    });
  });

  it('ignores attempts on unopened quizzes and from students outside the assigned classes', () => {
    const stats = overviewStats({
      ...base,
      completedAttempts: [
        { quizId: 'draft-or-future', studentClassId: 'c10a', percent: 100 },
        { quizId: 'algebra', studentClassId: 'c11a', percent: 100 },
        { quizId: 'algebra', studentClassId: null, percent: 100 },
      ],
    });
    expect(stats.overall.completed).toBe(0);
  });

  it('reports no rate for a class or teacher with nothing expected yet', () => {
    const stats = overviewStats({ ...base, openedQuizzes: [] });
    expect(stats.classes[0]).toMatchObject({
      expected: 0,
      participation: null,
    });
    expect(stats.teachers[0]).toMatchObject({
      quizzes: 0,
      participation: null,
    });
  });
});

describe('Teacher overview — per-quiz follow-up', () => {
  const now = new Date('2026-09-25T09:00:00Z');
  const classes = [
    { id: 'c10a', studentCount: 20 },
    { id: 'c10b', studentCount: 18 },
  ];

  it('splits the assigned students into finished, in progress and not started', () => {
    const [quiz] = quizProgress(
      {
        classes,
        quizzes: [
          {
            id: 'q',
            title: 'Algebra',
            closesAt: new Date('2026-09-30T09:00:00Z'),
            classIds: ['c10a', 'c10b'],
          },
        ],
        attempts: [
          {
            quizId: 'q',
            studentClassId: 'c10a',
            status: 'SUBMITTED',
            percent: 80,
          },
          {
            quizId: 'q',
            studentClassId: 'c10b',
            status: 'EXPIRED',
            percent: 40,
          },
          {
            quizId: 'q',
            studentClassId: 'c10a',
            status: 'IN_PROGRESS',
            percent: null,
          },
          // Moved to a class the quiz is not assigned to: not counted here.
          {
            quizId: 'q',
            studentClassId: 'c11a',
            status: 'SUBMITTED',
            percent: 100,
          },
        ],
      },
      now,
    );
    expect(quiz).toMatchObject({
      open: true,
      expected: 38,
      completed: 2,
      inProgress: 1,
      notStarted: 35,
      averagePercent: 60,
    });
  });

  it('lists open quizzes first by deadline, then closed ones newest first', () => {
    const quiz = (id: string, closesAt: string) => ({
      id,
      title: id,
      closesAt: new Date(closesAt),
      classIds: ['c10a'],
    });
    const order = quizProgress(
      {
        classes,
        quizzes: [
          quiz('closed-old', '2026-09-01T00:00:00Z'),
          quiz('open-late', '2026-10-20T00:00:00Z'),
          quiz('closed-new', '2026-09-20T00:00:00Z'),
          quiz('open-soon', '2026-09-26T00:00:00Z'),
        ],
        attempts: [],
      },
      now,
    ).map((q) => q.id);
    expect(order).toEqual([
      'open-soon',
      'open-late',
      'closed-new',
      'closed-old',
    ]);
  });
});

describe('Overview — quizzes for named students', () => {
  const classes = [
    { id: 'c10a', name: '10A', studentCount: 20 },
    { id: 'c10b', name: '10B', studentCount: 20 },
  ];
  // Three named students across two classes; the quiz is not for the rest of either class.
  const named = {
    id: 'catch-up',
    teacherId: 'math',
    classIds: [],
    named: [
      { id: 's1', classId: 'c10a' },
      { id: 's2', classId: 'c10a' },
      { id: 's3', classId: 'c10b' },
    ],
  };

  it('expects only the named students, counted in their own classes', () => {
    const stats = overviewStats({
      classes,
      teachers: [{ id: 'math', name: 'Rana', username: 'teacher-math' }],
      openedQuizzes: [named],
      completedAttempts: [
        {
          quizId: 'catch-up',
          studentId: 's1',
          studentClassId: 'c10a',
          percent: 90,
        },
        // Not on the list (e.g. removed after starting): ignored.
        {
          quizId: 'catch-up',
          studentId: 'x',
          studentClassId: 'c10a',
          percent: 10,
        },
      ],
    });
    expect(stats.overall).toMatchObject({
      completed: 1,
      expected: 3,
      participation: 33,
    });
    expect(
      stats.classes.map((c) => [c.name, c.quizzes, c.expected, c.completed]),
    ).toEqual([
      ['10A', 1, 2, 1],
      ['10B', 1, 1, 0],
    ]);
    expect(stats.teachers[0]).toMatchObject({ expected: 3, completed: 1 });
  });

  it('follows up the named list: who finished and who has not started', () => {
    const [quiz] = quizProgress(
      {
        classes,
        quizzes: [
          {
            ...named,
            title: 'Catch-up',
            closesAt: new Date('2026-10-01T00:00:00Z'),
          },
        ],
        attempts: [
          {
            quizId: 'catch-up',
            studentId: 's1',
            studentClassId: 'c10a',
            status: 'SUBMITTED',
            percent: 90,
          },
          {
            quizId: 'catch-up',
            studentId: 's3',
            studentClassId: 'c10b',
            status: 'IN_PROGRESS',
            percent: null,
          },
        ],
      },
      new Date('2026-09-25T00:00:00Z'),
    );
    expect(quiz).toMatchObject({
      audience: 'STUDENTS',
      expected: 3,
      completed: 1,
      inProgress: 1,
      notStarted: 1,
    });
  });
});

describe('Teacher — my students', () => {
  const now = new Date('2026-09-25T00:00:00Z');
  const student = (id: string, classId: string) => ({
    id,
    username: id,
    name: id,
    class: { id: classId, name: classId },
  });

  it('shows, per student, finished, still-open-not-started and missed quizzes', () => {
    const [ali, sara] = studentProgress(
      {
        students: [student('ali', 'c10a'), student('sara', 'c10b')],
        quizzes: [
          {
            id: 'open',
            classIds: ['c10a', 'c10b'],
            closesAt: new Date('2026-10-01T00:00:00Z'),
          },
          {
            id: 'closed',
            classIds: ['c10a'],
            closesAt: new Date('2026-09-20T00:00:00Z'),
          },
          {
            id: 'named',
            classIds: [],
            named: [{ id: 'sara', classId: 'c10b' }],
            closesAt: new Date('2026-10-01T00:00:00Z'),
          },
        ],
        attempts: [
          {
            quizId: 'open',
            studentId: 'ali',
            status: 'SUBMITTED',
            percent: 70,
          },
          {
            quizId: 'named',
            studentId: 'sara',
            status: 'EXPIRED',
            percent: 50,
          },
        ],
      },
      now,
    );
    expect(ali).toMatchObject({
      assigned: 2,
      completed: 1,
      openNotStarted: 0,
      missed: 1,
      averagePercent: 70,
    });
    expect(sara).toMatchObject({
      assigned: 2,
      completed: 1,
      openNotStarted: 1,
      missed: 0,
      averagePercent: 50,
    });
  });
});
