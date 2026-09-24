import {
  Controller,
  Get,
  Header,
  Param,
  ParseUUIDPipe,
  Query,
  Res,
} from '@nestjs/common';
import type { Response } from 'express';
import { CurrentUser, Roles } from '../auth/auth.decorators.js';
import type { AuthUser } from '../auth/auth.types.js';
import { PaginationDto } from '../common/dto/pagination.dto.js';
import { ResultsService } from './results.service.js';

@Controller('quizzes/:id/results')
@Roles('TEACHER', 'ADMIN')
export class ResultsController {
  constructor(private readonly results: ResultsService) {}

  @Get()
  @Header('Cache-Control', 'no-store')
  list(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthUser,
    @Query() query: PaginationDto,
  ) {
    return this.results.list(id, user, query);
  }

  @Get('export')
  @Header('Cache-Control', 'no-store')
  async export(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthUser,
    @Res({ passthrough: true }) response: Response,
  ) {
    const csv = await this.results.export(id, user);
    response.type('text/csv; charset=utf-8');
    response.setHeader(
      'Content-Disposition',
      `attachment; filename="quiz-${id.toLowerCase()}-results.csv"`,
    );
    return csv;
  }
}
