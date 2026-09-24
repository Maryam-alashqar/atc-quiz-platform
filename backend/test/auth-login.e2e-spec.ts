import request from 'supertest';
import {
  createAuthTestApp,
  sessionCookie,
  TEST_PASSWORD,
  type AuthTestApp,
} from './helpers/auth-test-app.js';

describe('Authentication — login', () => {
  let context: AuthTestApp;
  beforeAll(async () => {
    context = await createAuthTestApp();
  });
  afterAll(async () => {
    await context?.close();
  });

  it.each(['student', 'teacher', 'admin'])(
    'logs in the %s account and returns safe profile fields without exposing a token or password',
    async (username) => {
      const response = await context.login(username).expect(200);
      expect(response.body.user).toEqual({
        id: expect.any(String),
        username,
        name: expect.any(String),
        role: username.toUpperCase(),
        classId: username === 'student' ? context.classroom.id : null,
      });
      expect(Object.keys(response.body)).toEqual(['user']);
      expect(response.headers['cache-control']).toBe('no-store');
      const cookie = response.headers['set-cookie'][0];
      expect(cookie).toContain('HttpOnly');
      expect(cookie).toContain('SameSite=Lax');
      expect(cookie).toContain('Path=/api');
      expect(cookie).toContain('Max-Age=3600');
      expect(cookie).not.toContain('Secure');
      expect(sessionCookie(response)).toMatch(/^atc_session=.+/);
    },
  );

  it('normalizes the username before checking credentials', async () => {
    const response = await context.login('  STUDENT  ').expect(200);
    expect(response.body.user.username).toBe('student');
  });

  it('rejects an incorrect password and an unknown username with the same 401 response', async () => {
    const wrongPassword = await context
      .login('student', 'wrong-password')
      .expect(401);
    const unknownUser = await context
      .login('unknown-user', TEST_PASSWORD)
      .expect(401);
    expect(wrongPassword.body).toEqual(unknownUser.body);
    expect(wrongPassword.headers['set-cookie']).toBeUndefined();
    expect(unknownUser.headers['set-cookie']).toBeUndefined();
  });

  it.each([
    ['missing password', { username: 'student' }],
    ['numeric username', { username: 123, password: TEST_PASSWORD }],
    ['numeric password', { username: 'student', password: 12345678 }],
    ['oversized password', { username: 'student', password: 'x'.repeat(129) }],
    [
      'injected role',
      { username: 'student', password: TEST_PASSWORD, role: 'ADMIN' },
    ],
  ])('rejects a login request containing %s with 400', async (_label, body) => {
    const response = await request(context.app.getHttpServer())
      .post('/api/auth/login')
      .set('Origin', context.config.FRONTEND_ORIGIN)
      .send(body)
      .expect(400);
    expect(response.headers['set-cookie']).toBeUndefined();
    expect(JSON.stringify(response.body)).not.toContain(TEST_PASSWORD);
  });
});
