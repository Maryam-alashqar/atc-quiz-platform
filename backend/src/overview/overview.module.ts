import { Module } from '@nestjs/common';
import { AttemptsModule } from '../attempts/attempts.module.js';
import { OverviewController } from './overview.controller.js';
import { OverviewService } from './overview.service.js';

@Module({
  imports: [AttemptsModule],
  controllers: [OverviewController],
  providers: [OverviewService],
})
export class OverviewModule {}
