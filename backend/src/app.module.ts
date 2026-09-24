import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { validateEnvironment } from './config/environment.js';
import { PrismaModule } from './prisma/prisma.module.js';
import { AuthModule } from './auth/auth.module.js';
import { HealthController } from './health/health.controller.js';
import { QuizzesModule } from './quizzes/quizzes.module.js';
import { ClassesModule } from './classes/classes.module.js';
import { AttemptsModule } from './attempts/attempts.module.js';
import { ResultsModule } from './results/results.module.js';
@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, validate: validateEnvironment }),
    PrismaModule,
    AuthModule,
    QuizzesModule,
    ClassesModule,
    AttemptsModule,
    ResultsModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
