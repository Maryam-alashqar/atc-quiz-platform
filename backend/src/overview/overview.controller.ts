import { Controller, Get, Header } from '@nestjs/common';
import { CurrentUser, Roles } from '../auth/auth.decorators.js';
import type { AuthUser } from '../auth/auth.types.js';
import { OverviewService } from './overview.service.js';

/** Admin: the whole centre. Teacher: only their own quizzes and classes. */
@Controller('overview')
@Roles('ADMIN', 'TEACHER')
export class OverviewController {
  constructor(private readonly overview: OverviewService) {}

  @Get()
  @Header('Cache-Control', 'no-store')
  get(@CurrentUser() user: AuthUser) {
    return this.overview.overview(user);
  }

  @Get('students')
  @Header('Cache-Control', 'no-store')
  students(@CurrentUser() user: AuthUser) {
    return this.overview.students(user);
  }
}
