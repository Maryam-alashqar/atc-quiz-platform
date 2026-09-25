import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '../generated/prisma/client.js';
import { hashPassword } from '../common/security/password.js';
import { PrismaService } from '../prisma/prisma.service.js';
import {
  MANAGED_ROLES,
  type CreateUserDto,
  type ListUsersDto,
  type ResetPasswordDto,
  type UpdateUserDto,
} from './dto/user.dto.js';

// Never select passwordHash: responses are built from this projection only.
const userSelect = {
  id: true,
  username: true,
  name: true,
  role: true,
  class: { select: { id: true, name: true } },
  createdAt: true,
  _count: { select: { attempts: true, quizzes: true } },
} satisfies Prisma.UserSelect;

type SelectedUser = Prisma.UserGetPayload<{ select: typeof userSelect }>;

function present({ _count, ...user }: SelectedUser) {
  return { ...user, attemptCount: _count.attempts, quizCount: _count.quizzes };
}

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async list(query: ListUsersDto) {
    const where: Prisma.UserWhereInput = {
      role: query.role ?? { in: [...MANAGED_ROLES] },
      ...(query.classId && { classId: query.classId }),
      ...(query.search && {
        OR: [
          { username: { contains: query.search, mode: 'insensitive' } },
          { name: { contains: query.search, mode: 'insensitive' } },
        ],
      }),
    };
    const [total, users] = await this.prisma.$transaction([
      this.prisma.user.count({ where }),
      this.prisma.user.findMany({
        where,
        select: userSelect,
        orderBy: [{ role: 'asc' }, { username: 'asc' }],
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
    ]);
    return {
      total,
      page: query.page,
      pageSize: query.pageSize,
      items: users.map(present),
    };
  }

  private async assertClass(role: string, classId: string | undefined) {
    if (role === 'TEACHER' && classId)
      throw new BadRequestException('Teachers are not assigned to a class');
    if (role === 'STUDENT') {
      if (!classId)
        throw new BadRequestException('Students must be assigned to a class');
      const exists = await this.prisma.class.count({ where: { id: classId } });
      if (!exists) throw new BadRequestException('Class not found');
    }
  }

  async create(dto: CreateUserDto) {
    await this.assertClass(dto.role, dto.classId);
    try {
      const user = await this.prisma.user.create({
        data: {
          username: dto.username,
          name: dto.name,
          role: dto.role,
          classId: dto.role === 'STUDENT' ? dto.classId : null,
          passwordHash: await hashPassword(dto.password),
        },
        select: userSelect,
      });
      return present(user);
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      )
        throw new ConflictException('This username is already taken');
      throw error;
    }
  }

  /** Admin accounts are not managed here; they look like missing users. */
  private async managed(id: string) {
    const user = await this.prisma.user.findFirst({
      where: { id, role: { in: [...MANAGED_ROLES] } },
      select: { id: true, role: true },
    });
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  async update(id: string, dto: UpdateUserDto) {
    if (dto.name === undefined && dto.classId === undefined)
      throw new BadRequestException('Provide a name or a class to update');
    const user = await this.managed(id);
    if (dto.classId !== undefined)
      await this.assertClass(user.role, dto.classId);
    const updated = await this.prisma.user.update({
      where: { id },
      data: { name: dto.name, classId: dto.classId },
      select: userSelect,
    });
    return present(updated);
  }

  async resetPassword(id: string, dto: ResetPasswordDto) {
    await this.managed(id);
    await this.prisma.user.update({
      where: { id },
      data: { passwordHash: await hashPassword(dto.password) },
    });
  }
}
