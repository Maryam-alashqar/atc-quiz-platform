import { Controller, Get } from '@nestjs/common';
import { Roles } from '../auth/auth.decorators.js';
import { ClassesService } from './classes.service.js';

@Controller('classes')
@Roles('TEACHER', 'ADMIN')
export class ClassesController {
  constructor(private readonly classes: ClassesService) {}

  @Get()
  list() {
    return this.classes.list();
  }
}
