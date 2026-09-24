import { describe, expect, it } from 'vitest';
import { validateEnvironment } from './environment.js';

const valid = {
  NODE_ENV: 'development',
  DATABASE_URL: 'postgresql://test:test@localhost:5432/test',
  JWT_SECRET: 'unit-test-only-secret-with-at-least-32-characters',
  FRONTEND_ORIGIN: 'http://localhost:5173',
};

describe('Configuration — environment validation', () => {
  it('uses documented defaults for the port, session lifetime and login limit', () => {
    expect(validateEnvironment(valid)).toMatchObject({
      PORT: 3000,
      JWT_TTL_SECONDS: 3600,
      LOGIN_RATE_LIMIT: 10,
    });
  });

  it.each([
    ['missing signing secret', 'JWT_SECRET', undefined],
    ['short signing secret', 'JWT_SECRET', 'too-short'],
    [
      'placeholder signing secret',
      'JWT_SECRET',
      'change-me-this-is-only-a-placeholder-secret',
    ],
    ['missing database URL', 'DATABASE_URL', undefined],
    ['unsupported database protocol', 'DATABASE_URL', 'https://example.com/db'],
    ['missing database name', 'DATABASE_URL', 'postgresql://localhost/'],
    ['missing frontend origin', 'FRONTEND_ORIGIN', undefined],
    ['wildcard frontend origin', 'FRONTEND_ORIGIN', '*'],
    [
      'frontend origin with a path',
      'FRONTEND_ORIGIN',
      'http://localhost:5173/path',
    ],
    [
      'frontend origin with credentials',
      'FRONTEND_ORIGIN',
      'http://user:password@localhost:5173',
    ],
    ['unsupported environment', 'NODE_ENV', 'staging'],
    ['invalid port', 'PORT', '70000'],
    ['fractional session lifetime', 'JWT_TTL_SECONDS', '1.5'],
    ['session lifetime longer than one day', 'JWT_TTL_SECONDS', '86401'],
    ['disabled login limit', 'LOGIN_RATE_LIMIT', '0'],
  ] as const)('refuses startup with %s', (_description, key, value) => {
    expect(() => validateEnvironment({ ...valid, [key]: value })).toThrow(
      `Invalid environment: ${key}`,
    );
  });

  it('requires an HTTPS frontend origin in production', () => {
    expect(() =>
      validateEnvironment({ ...valid, NODE_ENV: 'production' }),
    ).toThrow('HTTPS in production');
    expect(
      validateEnvironment({
        ...valid,
        NODE_ENV: 'production',
        FRONTEND_ORIGIN: 'https://quiz.example',
      }).NODE_ENV,
    ).toBe('production');
  });

  it('does not expose the database password in validation errors', () => {
    expect(() =>
      validateEnvironment({ ...valid, DATABASE_URL: 'invalid-password-value' }),
    ).not.toThrow('invalid-password-value');
  });
});
