import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import { CurrentUser, Roles } from '../auth/auth.decorators.js';
import type { AuthUser } from '../auth/auth.types.js';
import { PaginationDto } from '../common/dto/pagination.dto.js';
import { AttemptsService } from './attempts.service.js';
import { SaveAnswerDto } from './dto/save-answer.dto.js';

function requireEmptyBody(body: unknown): void {
  if (
    body !== undefined &&
    (body === null ||
      typeof body !== 'object' ||
      Array.isArray(body) ||
      Object.keys(body).length)
  )
    throw new BadRequestException('This endpoint accepts no body fields');
}

@Controller('student')
@Roles('STUDENT')
export class AttemptsController {
  constructor(private readonly attempts: AttemptsService) {}

  @Get('quizzes')
  quizzes(@CurrentUser() user: AuthUser, @Query() query: PaginationDto) {
    return this.attempts.availableQuizzes(user, query);
  }

  @Get('quizzes/:id')
  quiz(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthUser) {
    return this.attempts.quizDetails(id, user);
  }

  @Post('quizzes/:id/attempt')
  @HttpCode(200)
  start(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthUser,
    @Body() body: unknown,
  ) {
    requireEmptyBody(body);
    return this.attempts.start(id, user);
  }

  @Get('attempts')
  history(@CurrentUser() user: AuthUser, @Query() query: PaginationDto) {
    return this.attempts.history(user, query);
  }

  @Get('attempts/:id')
  get(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthUser) {
    return this.attempts.get(id, user);
  }

  @Put('attempts/:id/answers')
  save(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: SaveAnswerDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.attempts.saveAnswer(id, body, user);
  }

  @Post('attempts/:id/submit')
  @HttpCode(200)
  submit(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthUser,
    @Body() body: unknown,
  ) {
    requireEmptyBody(body);
    return this.attempts.submit(id, user);
  }
}
