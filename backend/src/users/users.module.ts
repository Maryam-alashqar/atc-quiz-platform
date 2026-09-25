import { Module } from '@nestjs/common';
import { UsersController } from './users.controller.js';
import { UsersService } from './users.service.js';
import { StudentsDirectoryController } from './students-directory.controller.js';

@Module({
  controllers: [UsersController, StudentsDirectoryController],
  providers: [UsersService],
})
export class UsersModule {}
