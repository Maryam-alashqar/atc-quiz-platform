export interface Environment {
  NODE_ENV: 'development' | 'test' | 'production';
  DATABASE_URL: string;
  JWT_SECRET: string;
  JWT_TTL_SECONDS: number;
  FRONTEND_ORIGIN: string;
  PORT: number;
  LOGIN_RATE_LIMIT: number;
  /** Behind a known reverse proxy (Docker nginx), read the client IP from X-Forwarded-For. */
  TRUST_PROXY: boolean;
}

export function validateEnvironment(
  input: Record<string, unknown>,
): Environment {
  const fail = (key: string, rule: string): never => {
    throw new Error(`Invalid environment: ${key} ${rule}`);
  };
  const text = (key: string): string => {
    const value = input[key];
    if (typeof value !== 'string' || !value.trim())
      return fail(key, 'is required.');
    return value;
  };
  const number = (key: string, fallback: number, max: number): number => {
    const value = input[key] ?? String(fallback);
    if (
      !/^\d+$/.test(String(value)) ||
      Number(value) < 1 ||
      Number(value) > max
    )
      return fail(key, `must be an integer from 1 to ${max}.`);
    return Number(value);
  };
  const nodeEnv = input.NODE_ENV ?? 'development';
  if (!['development', 'test', 'production'].includes(String(nodeEnv)))
    fail('NODE_ENV', 'must be development, test or production.');
  const databaseUrl = text('DATABASE_URL');
  try {
    const url = new URL(databaseUrl);
    if (
      !['postgres:', 'postgresql:'].includes(url.protocol) ||
      !url.hostname ||
      url.pathname.length < 2
    )
      throw new Error();
  } catch {
    fail(
      'DATABASE_URL',
      'must be a PostgreSQL connection URL with a database name.',
    );
  }
  const secret = text('JWT_SECRET');
  if (
    secret.length < 32 ||
    secret.trim() !== secret ||
    /^(change[-_ ]?me|replace[-_ ]?me)/i.test(secret)
  )
    fail(
      'JWT_SECRET',
      'must be a non-placeholder secret of at least 32 characters without surrounding whitespace.',
    );
  const origin = text('FRONTEND_ORIGIN');
  try {
    const url = new URL(origin);
    if (
      !['http:', 'https:'].includes(url.protocol) ||
      url.origin !== origin ||
      (nodeEnv === 'production' && url.protocol !== 'https:')
    )
      throw new Error();
  } catch {
    fail(
      'FRONTEND_ORIGIN',
      'must be an exact HTTP(S) origin without a path or trailing slash (HTTPS in production).',
    );
  }
  const trustProxy = String(input.TRUST_PROXY ?? 'false');
  if (!['true', 'false'].includes(trustProxy))
    fail('TRUST_PROXY', 'must be true or false.');
  return {
    NODE_ENV: nodeEnv as Environment['NODE_ENV'],
    DATABASE_URL: databaseUrl,
    JWT_SECRET: secret,
    FRONTEND_ORIGIN: origin,
    JWT_TTL_SECONDS: number('JWT_TTL_SECONDS', 3600, 86_400),
    PORT: number('PORT', 3000, 65_535),
    LOGIN_RATE_LIMIT: number('LOGIN_RATE_LIMIT', 10, 1000),
    TRUST_PROXY: trustProxy === 'true',
  };
}
