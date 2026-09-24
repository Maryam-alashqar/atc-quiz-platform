import { Module } from '@nestjs/common';
import { AttemptsModule } from '../attempts/attempts.module.js';
import { ResultsController } from './results.controller.js';
import { ResultsService } from './results.service.js';

@Module({
  imports: [AttemptsModule],
  controllers: [ResultsController],
  providers: [ResultsService],
})
export class ResultsModule {}
