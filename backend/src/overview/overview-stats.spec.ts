import { overviewStats, type StatsInput } from './overview-stats.js';

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
