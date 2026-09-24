import { JwtService } from '@nestjs/jwt';
import request from 'supertest';
import { JWT_AUDIENCE, JWT_ISSUER } from '../src/auth/auth.types.js';
import {
  createAuthTestApp,
  sessionCookie,
  type AuthTestApp,
} from './helpers/auth-test-app.js';

describe('Authorization — role-based access', () => {
  let context: AuthTestApp;
  beforeAll(async () => {
    context = await createAuthTestApp();
  });
  afterAll(async () => {
    await context?.close();
  });

  it('protects a route by default even when it has no Roles decorator', async () => {
    await request(context.app.getHttpServer())
      .get('/api/test-access/authenticated')
      .expect(401);
  });

  it.each([
    ['denies a student access to teacher routes', 'student', 'teacher', 403],
    ['denies a student access to admin routes', 'student', 'admin', 403],
    ['allows a student to access student routes', 'student', 'student', 200],
    ['allows a teacher to access teacher routes', 'teacher', 'teacher', 200],
    ['denies a teacher access to admin routes', 'teacher', 'admin', 403],
    [
      'denies a teacher access to student-only routes',
      'teacher',
      'student',
      403,
    ],
    [
      'allows an admin on routes explicitly shared with teachers',
      'admin',
      'teacher',
      200,
    ],
    ['allows an admin to access admin routes', 'admin', 'admin', 200],
    [
      'does not grant an admin implicit access to student-only routes',
      'admin',
      'student',
      403,
    ],
  ] as const)('%s', async (_description, username, route, status) => {
    const login = await context.login(username).expect(200);
    await request(context.app.getHttpServer())
      .get(`/api/test-access/${route}`)
      .set('Cookie', sessionCookie(login))
      .expect(status);
  });

  it('ignores a forged ADMIN role claim and checks the student role stored in the database', async () => {
    const student = await context.db.user.findUniqueOrThrow({
      where: { username: 'student' },
    });
    const token = new JwtService().sign(
      { sub: student.id, role: 'ADMIN' },
      {
        secret: context.config.JWT_SECRET,
        expiresIn: 3600,
        issuer: JWT_ISSUER,
        audience: JWT_AUDIENCE,
      },
    );
    await request(context.app.getHttpServer())
      .get('/api/test-access/admin')
      .set('Cookie', `atc_session=${token}`)
      .expect(403);
  });

  it('applies a role change to an already-issued session on the next request', async () => {
    const login = await context.login('teacher').expect(200);
    const cookie = sessionCookie(login);
    await context.db.user.update({
      where: { username: 'teacher' },
      data: { role: 'STUDENT', classId: context.classroom.id },
    });
    try {
      await request(context.app.getHttpServer())
        .get('/api/test-access/teacher')
        .set('Cookie', cookie)
        .expect(403);
      const response = await request(context.app.getHttpServer())
        .get('/api/auth/me')
        .set('Cookie', cookie)
        .expect(200);
      expect(response.body.user.role).toBe('STUDENT');
    } finally {
      await context.db.user.update({
        where: { username: 'teacher' },
        data: { role: 'TEACHER', classId: null },
      });
    }
  });
});
