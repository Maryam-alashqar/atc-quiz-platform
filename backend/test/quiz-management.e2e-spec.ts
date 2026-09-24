import {
  createQuizTestApp,
  type QuizTestApp,
} from './helpers/quiz-test-app.js';

describe('Quiz management — drafts, editing and listing', () => {
  let context: QuizTestApp;
  beforeAll(async () => {
    context = await createQuizTestApp();
  });
  beforeEach(async () => {
    await context.db.quiz.deleteMany();
  });
  afterAll(async () => {
    await context?.close();
  });

  it('creates an incomplete draft with defaults and assigns ownership to the logged-in teacher', async () => {
    const complete = context.quiz();
    const response = await context
      .api('teacher', 'post', '/quizzes', {
        title: '  Draft quiz  ',
        opensAt: complete.opensAt,
        closesAt: complete.closesAt,
      })
      .expect(201);
    expect(response.body).toMatchObject({
      title: 'Draft quiz',
      teacherId: context.teacher.id,
      status: 'DRAFT',
      language: 'EN',
      durationMinutes: 20,
      negativeMarking: 'NONE',
      penaltyValue: '0',
      questions: [],
      classes: [],
      maxScore: '0',
    });
    expect(await context.db.quiz.count()).toBe(1);
  });

  it('stores Arabic questions, exact decimal points and ordered options without exposing user passwords', async () => {
    const response = await context
      .api('teacher', 'post', '/quizzes', context.quiz())
      .expect(201);
    expect(response.body.title).toBe('اختبار الجبر');
    expect(response.body.questions[0]).toMatchObject({
      order: 1,
      points: '1.5',
      prompt: 'ما ناتج 2 + 2؟',
    });
    expect(
      response.body.questions[0].options.map((o: { order: number }) => o.order),
    ).toEqual([1, 2, 3, 4]);
    expect(response.body.maxScore).toBe('1.5');
    expect(response.body.classes).toEqual([
      { id: context.classroom.id, name: '10A' },
    ]);
    expect(JSON.stringify(response.body)).not.toContain('passwordHash');
    const fetched = await context
      .api('teacher', 'get', `/quizzes/${response.body.id}`)
      .expect(200);
    expect(fetched.body).toEqual(response.body);
  });

  it('patches a title and clears a description without recreating questions or options', async () => {
    const created = await context
      .api('teacher', 'post', '/quizzes', context.quiz())
      .expect(201);
    const edited = await context
      .api('teacher', 'patch', `/quizzes/${created.body.id}`, {
        title: 'Updated title',
        description: null,
      })
      .expect(200);
    expect(edited.body.description).toBeNull();
    expect(edited.body.questions).toEqual(created.body.questions);
    expect(edited.body.classes).toEqual(created.body.classes);
  });

  it('atomically replaces the supplied question array and removes obsolete options', async () => {
    const created = await context
      .api('teacher', 'post', '/quizzes', context.quiz())
      .expect(201);
    const edited = await context
      .api('teacher', 'patch', `/quizzes/${created.body.id}`, {
        questions: [
          { prompt: 'New draft question', points: '2.125', options: [] },
        ],
      })
      .expect(200);
    expect(edited.body.questions).toHaveLength(1);
    expect(edited.body.questions[0]).toMatchObject({
      prompt: 'New draft question',
      points: '2.125',
      options: [],
      order: 1,
    });
    expect(await context.db.option.count()).toBe(0);
    expect(
      await context.db.question.findUnique({
        where: { id: created.body.questions[0].id },
      }),
    ).toBeNull();
  });

  it('replaces class assignments with the supplied class IDs', async () => {
    const created = await context
      .api('teacher', 'post', '/quizzes', context.quiz())
      .expect(201);
    const edited = await context
      .api('teacher', 'patch', `/quizzes/${created.body.id}`, {
        classIds: [context.secondClass.id],
      })
      .expect(200);
    expect(edited.body.classes).toEqual([
      { id: context.secondClass.id, name: '10B' },
    ]);
    expect(await context.db.quizClass.count()).toBe(1);
  });

  it('lists only the teacher’s quizzes with pagination and a status filter', async () => {
    const first = await context
      .api('teacher', 'post', '/quizzes', context.quiz())
      .expect(201);
    await context
      .api('teacher', 'post', '/quizzes', {
        ...context.quiz(),
        title: 'Second draft',
      })
      .expect(201);
    await context
      .api('other-teacher', 'post', '/quizzes', context.quiz())
      .expect(201);
    await context
      .api('teacher', 'post', `/quizzes/${first.body.id}/publish`)
      .expect(200);
    const page = await context
      .api('teacher', 'get', '/quizzes?page=1&pageSize=1')
      .expect(200);
    expect(page.body).toMatchObject({ total: 2, page: 1, pageSize: 1 });
    expect(page.body.items).toHaveLength(1);
    expect(page.body.items[0].teacherId).toBe(context.teacher.id);
    expect(page.body.items[0].questions).toBeUndefined();
    const published = await context
      .api('teacher', 'get', '/quizzes?status=PUBLISHED')
      .expect(200);
    expect(published.body.total).toBe(1);
    expect(published.body.items[0].id).toBe(first.body.id);
  });

  it('lists all teachers’ quizzes for an admin without returning answer keys in list responses', async () => {
    await context
      .api('teacher', 'post', '/quizzes', context.quiz())
      .expect(201);
    await context
      .api('other-teacher', 'post', '/quizzes', context.quiz())
      .expect(201);
    const response = await context.api('admin', 'get', '/quizzes').expect(200);
    expect(response.body.total).toBe(2);
    expect(JSON.stringify(response.body)).not.toContain('isCorrect');
  });

  it('allows an admin to create a quiz for an explicitly selected teacher', async () => {
    const response = await context
      .api('admin', 'post', '/quizzes', {
        ...context.quiz(),
        teacherId: context.otherTeacher.id,
      })
      .expect(201);
    expect(response.body.teacherId).toBe(context.otherTeacher.id);
    expect(response.body.status).toBe('DRAFT');
  });

  it('deletes an unused quiz together with its questions, options and class assignments', async () => {
    const created = await context
      .api('teacher', 'post', '/quizzes', context.quiz())
      .expect(201);
    await context
      .api('teacher', 'delete', `/quizzes/${created.body.id}`)
      .expect(204);
    expect(await context.db.quiz.count()).toBe(0);
    expect(await context.db.question.count()).toBe(0);
    expect(await context.db.option.count()).toBe(0);
    expect(await context.db.quizClass.count()).toBe(0);
  });

  it('lists class identifiers and names for teachers and admins', async () => {
    for (const role of ['teacher', 'admin']) {
      const response = await context.api(role, 'get', '/classes').expect(200);
      expect(response.body).toEqual([
        { id: context.classroom.id, name: '10A' },
        { id: context.secondClass.id, name: '10B' },
      ]);
    }
  });
});
