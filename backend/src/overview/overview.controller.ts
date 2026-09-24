import { Controller, Get } from '@nestjs/common';
import { Roles } from '../auth/auth.decorators.js';
import { OverviewService } from './overview.service.js';

@Controller('overview')
@Roles('ADMIN')
export class OverviewController {
  constructor(private readonly overview: OverviewService) {}

  @Get()
  get() {
    return this.overview.overview();
  }
}
