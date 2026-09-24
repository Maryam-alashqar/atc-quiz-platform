import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';
import { ConfigService } from '@nestjs/config';
import { configureApp } from './configure-app.js';
import type { Environment } from './config/environment.js';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  configureApp(app);
  app.enableShutdownHooks();
  const config = app.get<ConfigService<Environment, true>>(ConfigService);
  await app.listen(config.get('PORT', { infer: true }));
}

await bootstrap();
