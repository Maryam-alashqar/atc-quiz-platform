import { randomUUID } from 'node:crypto';
import { JwtService } from '@nestjs/jwt';
import request from 'supertest';
import { JWT_AUDIENCE, JWT_ISSUER } from '../src/auth/auth.types.js';
import {
  createAuthTestApp,
  sessionCookie,
  type AuthTestApp,
} from './helpers/auth-test-app.js';

describe('Authentication — current session and logout', () => {
  let context: AuthTestApp;
  beforeAll(async () => {
    context = await createAuthTestApp();
  });
  afterAll(async () => {
    await context?.close();
  });

  it('returns the current student profile, including its Arabic name, from the session cookie', async () => {
    const login = await context.login().expect(200);
    const response = await request(context.app.getHttpServer())
      .get('/api/auth/me')
      .set('Cookie', sessionCookie(login))
      .expect(200);
    expect(response.body).toEqual(login.body);
    expect(response.body.user.name).toBe('أحمد الخطيب');
    expect(response.headers['cache-control']).toBe('no-store');
  });

  it('returns 401 when there is no session cookie', async () => {
    await request(context.app.getHttpServer()).get('/api/auth/me').expect(401);
  });

  it('does not accept a bearer token as a substitute for the HttpOnly cookie', async () => {
    const login = await context.login().expect(200);
    const token = sessionCookie(login).slice('atc_session='.length);
    await request(context.app.getHttpServer())
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${token}`)
      .expect(401);
  });

  it.each([
    'tampered signature',
    'expired token',
    'wrong issuer',
    'wrong audience',
    'wrong algorithm',
    'invalid subject',
    'missing expiry',
    'unknown user',
  ])('returns 401 for a session with %s', async (scenario) => {
    const student = await context.db.user.findUniqueOrThrow({
      where: { username: 'student' },
    });
    const jwt = new JwtService();
    let token = jwt.sign(
      {
        sub:
          scenario === 'invalid subject'
            ? 'invalid-uuid'
            : scenario === 'unknown user'
              ? randomUUID()
              : student.id,
      },
      {
        secret: context.config.JWT_SECRET,
        algorithm: scenario === 'wrong algorithm' ? 'HS384' : 'HS256',
        issuer: scenario === 'wrong issuer' ? 'other-app' : JWT_ISSUER,
        audience:
          scenario === 'wrong audience' ? 'other-audience' : JWT_AUDIENCE,
        ...(scenario === 'missing expiry'
          ? {}
          : { expiresIn: scenario === 'expired token' ? -1 : 3600 }),
      },
    );
    if (scenario === 'tampered signature')
      token = token.split('.').slice(0, 2).join('.') + '.invalid-signature';
    await request(context.app.getHttpServer())
      .get('/api/auth/me')
      .set('Cookie', `atc_session=${token}`)
      .expect(401);
  });

  it('logs out a browser session by expiring its cookie and rejects the next authenticated request', async () => {
    const browser = request.agent(context.app.getHttpServer());
    await browser
      .post('/api/auth/login')
      .set('Origin', context.config.FRONTEND_ORIGIN)
      .send({ username: 'student', password: 'TestPassword2026!' })
      .expect(200);
    await browser.get('/api/auth/me').expect(200);
    const response = await browser
      .post('/api/auth/logout')
      .set('Origin', context.config.FRONTEND_ORIGIN)
      .expect(204);
    expect(response.headers['set-cookie'][0]).toContain('atc_session=;');
    expect(response.headers['set-cookie'][0]).toContain(
      'Expires=Thu, 01 Jan 1970',
    );
    expect(response.headers['set-cookie'][0]).toContain('Path=/api');
    await browser.get('/api/auth/me').expect(401);
  });

  it('allows logout with an expired or missing cookie', async () => {
    await request(context.app.getHttpServer())
      .post('/api/auth/logout')
      .set('Origin', context.config.FRONTEND_ORIGIN)
      .set('Cookie', 'atc_session=expired')
      .expect(204);
    await request(context.app.getHttpServer())
      .post('/api/auth/logout')
      .set('Origin', context.config.FRONTEND_ORIGIN)
      .expect(204);
  });
});
