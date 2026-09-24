import 'reflect-metadata';
import 'dotenv/config';

// Test-only signing key. Each application uses its own isolated database schema.
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'atc-integration-test-secret-not-for-production';
process.env.FRONTEND_ORIGIN = 'http://localhost:5173';
process.env.JWT_TTL_SECONDS = '3600';
process.env.LOGIN_RATE_LIMIT = '100';
