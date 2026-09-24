import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';

@Injectable()
export class ClassesService {
  constructor(private readonly prisma: PrismaService) {}

  list() {
    return this.prisma.class.findMany({
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    });
  }
}
