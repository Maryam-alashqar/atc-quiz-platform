import request from 'supertest';
import {
  createAuthTestApp,
  sessionCookie,
  TEST_PASSWORD,
  type AuthTestApp,
} from './helpers/auth-test-app.js';

describe('Authentication — browser request protection', () => {
  let context: AuthTestApp;
  beforeAll(async () => {
    context = await createAuthTestApp();
  });
  afterAll(async () => {
    await context?.close();
  });

  it('serves an anonymous health check backed by a real database query', async () => {
    const response = await request(context.app.getHttpServer())
      .get('/api/health')
      .expect(200);
    expect(response.body).toEqual({ status: 'ok', database: 'connected' });
  });

  it.each([
    ['an untrusted origin', 'https://untrusted.example'],
    ['a null origin', 'null'],
    ['a missing origin', undefined],
  ] as const)(
    'rejects login and logout with %s',
    async (_description, origin) => {
      const login = await context.login().expect(200);
      for (const route of ['login', 'logout']) {
        const call = request(context.app.getHttpServer())
          .post(`/api/auth/${route}`)
          .set('Cookie', sessionCookie(login));
        if (origin !== undefined) call.set('Origin', origin);
        await call
          .send({ username: 'student', password: TEST_PASSWORD })
          .expect(403);
      }
    },
  );

  it('permits a credentialed browser preflight from the configured frontend origin', async () => {
    const response = await request(context.app.getHttpServer())
      .options('/api/auth/login')
      .set('Origin', context.config.FRONTEND_ORIGIN)
      .set('Access-Control-Request-Method', 'POST')
      .set('Access-Control-Request-Headers', 'content-type')
      .expect(204);
    expect(response.headers['access-control-allow-origin']).toBe(
      context.config.FRONTEND_ORIGIN,
    );
    expect(response.headers['access-control-allow-credentials']).toBe('true');
  });

  it('never grants CORS access to an untrusted origin', async () => {
    const response = await request(context.app.getHttpServer())
      .options('/api/auth/login')
      .set('Origin', 'https://untrusted.example')
      .set('Access-Control-Request-Method', 'POST');
    expect(response.headers['access-control-allow-origin']).not.toBe(
      'https://untrusted.example',
    );
    expect(response.headers['access-control-allow-origin']).not.toBe('*');
  });
});

describe('Authentication — production cookie settings', () => {
  let context: AuthTestApp;
  beforeAll(async () => {
    context = await createAuthTestApp({
      NODE_ENV: 'production',
      FRONTEND_ORIGIN: 'https://quiz.example',
    });
  });
  afterAll(async () => {
    await context?.close();
  });

  it('sets Secure, HttpOnly and SameSite on production login and logout cookies', async () => {
    const login = await context.login().expect(200);
    const logout = await request(context.app.getHttpServer())
      .post('/api/auth/logout')
      .set('Origin', context.config.FRONTEND_ORIGIN)
      .expect(204);
    for (const response of [login, logout]) {
      const cookie = response.headers['set-cookie'][0];
      expect(cookie).toContain('Secure');
      expect(cookie).toContain('HttpOnly');
      expect(cookie).toContain('SameSite=Lax');
      expect(cookie).toContain('Path=/api');
    }
  });
});

describe('Authentication — login rate limiting', () => {
  let context: AuthTestApp;
  beforeAll(async () => {
    context = await createAuthTestApp({ LOGIN_RATE_LIMIT: 2 });
  });
  afterAll(async () => {
    await context?.close();
  });

  it('returns 429 after the configured login limit, even if a client forges X-Forwarded-For', async () => {
    await context.login('student', 'wrong-password').expect(401);
    await context.login('student', 'wrong-password').expect(401);
    const response = await context
      .login('student', 'wrong-password')
      .set('X-Forwarded-For', '203.0.113.99')
      .expect(429);
    expect(response.headers['retry-after']).toBeDefined();
    expect(response.headers['set-cookie']).toBeUndefined();
    await request(context.app.getHttpServer()).get('/api/health').expect(200);
  });
});
