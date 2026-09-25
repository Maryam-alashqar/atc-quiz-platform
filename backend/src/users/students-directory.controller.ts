import { Controller, Get, Query } from '@nestjs/common';
import { IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';
import { Transform } from 'class-transformer';
import { Roles } from '../auth/auth.decorators.js';
import { PrismaService } from '../prisma/prisma.service.js';

class StudentSearchDto {
  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @MaxLength(100)
  search?: string;

  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.toLowerCase() : value,
  )
  @IsUUID()
  classId?: string;
}

/**
 * Read-only student lookup so a teacher can name students on a quiz. It returns
 * identities only: no counts, results or anything account-related (that stays with the admin).
 */
@Controller('students')
@Roles('TEACHER', 'ADMIN')
export class StudentsDirectoryController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async search(@Query() query: StudentSearchDto) {
    const items = await this.prisma.user.findMany({
      where: {
        role: 'STUDENT',
        ...(query.classId && { classId: query.classId }),
        ...(query.search && {
          OR: [
            { name: { contains: query.search, mode: 'insensitive' } },
            { username: { contains: query.search, mode: 'insensitive' } },
          ],
        }),
      },
      select: {
        id: true,
        username: true,
        name: true,
        class: { select: { id: true, name: true } },
      },
      orderBy: [{ class: { name: 'asc' } }, { name: 'asc' }],
      take: 50,
    });
    return { items };
  }
}
