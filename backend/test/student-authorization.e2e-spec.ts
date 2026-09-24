import {
  answer,
  createStudentTestApp,
  type StudentTestApp,
} from './helpers/student-test-app.js';

describe('Student attempts - ownership and input validation', () => {
  let context: StudentTestApp;
  beforeAll(async () => {
    context = await createStudentTestApp();
  });
  beforeEach(async () => {
    await context.reset();
  });
  afterAll(async () => {
    await context?.close();
  });

  it('prevents classmates from reading, changing or submitting another student attempt', async () => {
    const quiz = await context.publishQuiz();
    const started = await context
      .studentApi('post', `/quizzes/${quiz.id}/attempt`)
      .expect(200);
    const path = `/attempts/${started.body.id}`;
    await context.studentApi('get', path, undefined, 'classmate').expect(404);
    await context
      .studentApi('put', `${path}/answers`, answer(quiz, 0, true), 'classmate')
      .expect(404);
    await context
      .studentApi('post', `${path}/submit`, undefined, 'classmate')
      .expect(404);
    expect(
      (await context.studentApi('get', '/attempts', undefined, 'classmate'))
        .body.total,
    ).toBe(0);
    expect(
      (
        await context.db.attempt.findUniqueOrThrow({
          where: { id: started.body.id },
        })
      ).status,
    ).toBe('IN_PROGRESS');
  });

  it.each(['teacher', 'admin'])(
    'rejects the %s role from student routes',
    async (role) => {
      await context.api(role, 'get', '/student/quizzes').expect(403);
      await context.api(role, 'get', '/student/attempts').expect(403);
    },
  );

  it('rejects options from a different question and questions from another quiz', async () => {
    const quiz = await context.publishQuiz();
    const other = await context.publishQuiz();
    const started = await context
      .studentApi('post', `/quizzes/${quiz.id}/attempt`)
      .expect(200);
    await context
      .studentApi('put', `/attempts/${started.body.id}/answers`, {
        questionId: quiz.questions[0].id,
        optionId: quiz.questions[1].options[0].id,
      })
      .expect(400);
    await context
      .studentApi(
        'put',
        `/attempts/${started.body.id}/answers`,
        answer(other, 0, true),
      )
      .expect(400);
    expect(await context.db.answer.count()).toBe(0);
  });

  it('rejects forged scores, deadlines, missing options and malformed identifiers', async () => {
    const quiz = await context.publishQuiz();
    await context
      .studentApi('post', `/quizzes/${quiz.id}/attempt`, {
        deadlineAt: '2099-01-01',
      })
      .expect(400);
    const started = await context
      .studentApi('post', `/quizzes/${quiz.id}/attempt`)
      .expect(200);
    await context
      .studentApi('post', `/attempts/${started.body.id}/submit`, { score: '7' })
      .expect(400);
    await context
      .studentApi('put', `/attempts/${started.body.id}/answers`, {
        ...answer(quiz, 0, true),
        score: '7',
      })
      .expect(400);
    await context
      .studentApi('put', `/attempts/${started.body.id}/answers`, {
        questionId: quiz.questions[0].id,
      })
      .expect(400);
    await context.studentApi('get', '/attempts/not-a-uuid').expect(400);
    await context.studentApi('get', '/attempts?pageSize=101').expect(400);
  });

  it('never exposes correct-option flags in any student response before or after submission', async () => {
    const quiz = await context.publishQuiz();
    const started = await context
      .studentApi('post', `/quizzes/${quiz.id}/attempt`)
      .expect(200);
    const responses = [
      started,
      await context.studentApi('get', '/quizzes').expect(200),
      await context.studentApi('get', `/quizzes/${quiz.id}`).expect(200),
      await context
        .studentApi(
          'put',
          `/attempts/${started.body.id}/answers`,
          answer(quiz, 0, true),
        )
        .expect(200),
      await context
        .studentApi('post', `/attempts/${started.body.id}/submit`)
        .expect(200),
      await context
        .studentApi('get', `/attempts/${started.body.id}`)
        .expect(200),
      await context.studentApi('get', '/attempts').expect(200),
    ];
    for (const response of responses)
      expect(JSON.stringify(response.body)).not.toContain('isCorrect');
  });
});
