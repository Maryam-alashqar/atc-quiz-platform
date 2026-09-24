import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { CurrentUser, Roles } from '../auth/auth.decorators.js';
import type { AuthUser } from '../auth/auth.types.js';
import { ListQuizzesDto } from './dto/list-quizzes.dto.js';
import { SaveQuizDto } from './dto/save-quiz.dto.js';
import { QuizzesService } from './quizzes.service.js';

@Controller('quizzes')
@Roles('TEACHER', 'ADMIN')
export class QuizzesController {
  constructor(private readonly quizzes: QuizzesService) {}

  @Get()
  list(@CurrentUser() user: AuthUser, @Query() query: ListQuizzesDto) {
    return this.quizzes.list(user, query);
  }

  @Get(':id')
  get(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthUser) {
    return this.quizzes.get(id, user);
  }

  @Post()
  create(@Body() body: SaveQuizDto, @CurrentUser() user: AuthUser) {
    return this.quizzes.create(body, user);
  }

  @Patch(':id')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: SaveQuizDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.quizzes.update(id, body, user);
  }

  @Post(':id/publish')
  @HttpCode(200)
  publish(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.quizzes.publish(id, user);
  }

  @Delete(':id')
  @HttpCode(204)
  remove(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.quizzes.remove(id, user);
  }
}
