import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { Roles } from '../auth/auth.decorators.js';
import {
  CreateUserDto,
  ListUsersDto,
  ResetPasswordDto,
  UpdateUserDto,
} from './dto/user.dto.js';
import { UsersService } from './users.service.js';

/** Centre accounts. There is no self sign-up: the admin creates students and teachers. */
@Controller('users')
@Roles('ADMIN')
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Get()
  list(@Query() query: ListUsersDto) {
    return this.users.list(query);
  }

  @Post()
  create(@Body() body: CreateUserDto) {
    return this.users.create(body);
  }

  @Patch(':id')
  update(@Param('id', ParseUUIDPipe) id: string, @Body() body: UpdateUserDto) {
    return this.users.update(id, body);
  }

  @Post(':id/password')
  @HttpCode(204)
  async resetPassword(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: ResetPasswordDto,
  ) {
    await this.users.resetPassword(id, body);
  }
}
