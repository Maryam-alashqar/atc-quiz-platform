import { Controller, Get, type INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../../src/app.module.js';
import { configureApp } from '../../src/configure-app.js';
import {
  validateEnvironment,
  type Environment,
} from '../../src/config/environment.js';
import { hashPassword } from '../../src/common/security/password.js';
import { CurrentUser, Roles } from '../../src/auth/auth.decorators.js';
import type { AuthUser } from '../../src/auth/auth.types.js';
import { createTestDatabase } from './test-database.js';

// Test-only routes exercise the real global guards. They never ship in AppModule.
@Controller('test-access')
class TestAccessController {
  @Get('teacher')
  @Roles('TEACHER', 'ADMIN')
  teacher(@CurrentUser() user: AuthUser) {
    return { role: user.role };
  }

  @Get('admin')
  @Roles('ADMIN')
  admin() {
    return { allowed: true };
  }

  @Get('student')
  @Roles('STUDENT')
  student() {
    return { allowed: true };
  }

  @Get('authenticated')
  authenticated() {
    return { allowed: true };
  }
}

export const TEST_PASSWORD = 'TestPassword2026!';

export async function createAuthTestApp(overrides: Partial<Environment> = {}) {
  const database = await createTestDatabase();
  let application: INestApplication | undefined;
  try {
    const config = validateEnvironment({
      ...process.env,
      ...overrides,
      DATABASE_URL: database.connectionString,
    });
    const module = await Test.createTestingModule({
      imports: [AppModule],
      controllers: [TestAccessController],
    })
      .overrideProvider(ConfigService)
      .useValue(new ConfigService(config))
      .compile();
    const app = module.createNestApplication({ logger: false });
    application = app;
    configureApp(app);
    await app.init();
    const classroom = await database.db.class.create({ data: { name: '10A' } });
    const passwordHash = await hashPassword(TEST_PASSWORD);
    for (const role of ['STUDENT', 'TEACHER', 'ADMIN'] as const) {
      await database.db.user.create({
        data: {
          username: role.toLowerCase(),
          name: role === 'STUDENT' ? 'أحمد الخطيب' : role,
          passwordHash,
          role,
          classId: role === 'STUDENT' ? classroom.id : null,
        },
      });
    }
    return {
      app,
      db: database.db,
      config,
      classroom,
      login: (username = 'student', password = TEST_PASSWORD) =>
        request(app.getHttpServer())
          .post('/api/auth/login')
          .set('Origin', config.FRONTEND_ORIGIN)
          .send({ username, password }),
      close: async () => {
        try {
          await app.close();
        } finally {
          await database.destroy();
        }
      },
    };
  } catch (error) {
    try {
      await application?.close();
    } finally {
      await database.destroy();
    }
    throw error;
  }
}

export type AuthTestApp = Awaited<ReturnType<typeof createAuthTestApp>>;

export function sessionCookie(response: {
  headers: Record<string, unknown>;
}): string {
  const cookies = response.headers['set-cookie'];
  if (!Array.isArray(cookies))
    throw new Error('Expected an authentication cookie.');
  return String(cookies[0]).split(';')[0];
}
