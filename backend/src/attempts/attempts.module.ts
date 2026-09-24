import { Module } from '@nestjs/common';
import { AttemptsController } from './attempts.controller.js';
import { AttemptsService } from './attempts.service.js';
import { AttemptClock } from './attempt-clock.js';

@Module({
  controllers: [AttemptsController],
  providers: [AttemptsService, AttemptClock],
  exports: [AttemptsService],
})
export class AttemptsModule {}
