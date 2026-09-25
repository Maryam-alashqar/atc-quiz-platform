import request from 'supertest';
import {
  createAuthTestApp,
  sessionCookie,
  TEST_PASSWORD,
  type AuthTestApp,
} from './helpers/auth-test-app.js';

const NEW_PASSWORD = 'MyOwnPassword2026';

describe('Authentication — changing one’s own password', () => {
  let context: AuthTestApp;
  beforeAll(async () => {
    context = await createAuthTestApp();
  });
  afterAll(async () => {
    await context?.close();
  });

  const change = (cookie: string | undefined, body: object) => {
    const call = request(context.app.getHttpServer())
      .post('/api/auth/password')
      .set('Origin', context.config.FRONTEND_ORIGIN);
    return (cookie ? call.set('Cookie', cookie) : call).send(body);
  };

  it('replaces the password: the old one stops working and the session stays valid', async () => {
    const cookie = sessionCookie(await context.login('teacher').expect(200));
    await change(cookie, {
      currentPassword: TEST_PASSWORD,
      newPassword: NEW_PASSWORD,
    }).expect(204);
    await context.login('teacher', TEST_PASSWORD).expect(401);
    await context.login('teacher', NEW_PASSWORD).expect(200);
    await request(context.app.getHttpServer())
      .get('/api/auth/me')
      .set('Cookie', cookie)
      .expect(200);
  });

  it('refuses a wrong current password with 400 (not 401, so the session is not ended)', async () => {
    const cookie = sessionCookie(await context.login('admin').expect(200));
    const response = await change(cookie, {
      currentPassword: 'not-my-password',
      newPassword: NEW_PASSWORD,
    }).expect(400);
    expect(response.body.message).toBe('Current password is incorrect');
    await context.login('admin', TEST_PASSWORD).expect(200);
  });

  it.each([
    [
      'the same password again',
      { currentPassword: TEST_PASSWORD, newPassword: TEST_PASSWORD },
    ],
    [
      'a password that is too short',
      { currentPassword: TEST_PASSWORD, newPassword: 'short' },
    ],
    [
      'an extra field',
      {
        currentPassword: TEST_PASSWORD,
        newPassword: NEW_PASSWORD,
        userId: 'x',
      },
    ],
  ])('rejects %s with 400 and keeps the old password', async (_name, body) => {
    const cookie = sessionCookie(await context.login('student').expect(200));
    await change(cookie, body).expect(400);
    await context.login('student', TEST_PASSWORD).expect(200);
  });

  it('requires a session and a trusted origin', async () => {
    await change(undefined, {
      currentPassword: TEST_PASSWORD,
      newPassword: NEW_PASSWORD,
    }).expect(401);
    const cookie = sessionCookie(await context.login('student').expect(200));
    await request(context.app.getHttpServer())
      .post('/api/auth/password')
      .set('Cookie', cookie)
      .send({ currentPassword: TEST_PASSWORD, newPassword: NEW_PASSWORD })
      .expect(403);
  });

  it('limits guesses of the current password per account', async () => {
    const other = await createAuthTestApp({ LOGIN_RATE_LIMIT: 2 });
    try {
      const cookie = sessionCookie(await other.login('student').expect(200));
      const guess = () =>
        request(other.app.getHttpServer())
          .post('/api/auth/password')
          .set('Origin', other.config.FRONTEND_ORIGIN)
          .set('Cookie', cookie)
          .send({ currentPassword: 'guess-1234', newPassword: NEW_PASSWORD });
      await guess().expect(400);
      await guess().expect(400);
      await guess().expect(429);
    } finally {
      await other.close();
    }
  });
});
