import { ValidationPipe, type INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import cookieParser from 'cookie-parser';
import type { Environment } from './config/environment.js';

/** Shared by production bootstrap and HTTP integration tests. */
export function configureApp(app: INestApplication): void {
  const config = app.get<ConfigService<Environment, true>>(ConfigService);
  // Only one hop: nginx in Docker. Off by default, so a client cannot forge its IP.
  if (config.get('TRUST_PROXY', { infer: true }))
    app.getHttpAdapter().getInstance().set('trust proxy', 1);
  app.setGlobalPrefix('api');
  app.use(cookieParser());
  app.enableCors({
    origin: config.get('FRONTEND_ORIGIN', { infer: true }),
    credentials: true,
  });
  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: true,
      validationError: { target: false, value: false },
    }),
  );
}
