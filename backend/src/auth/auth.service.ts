import {
  BadRequestException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service.js';
import { hashPassword, verifyPassword } from '../common/security/password.js';
import type { ChangePasswordDto } from './dto/change-password.dto.js';
import type { LoginDto } from './dto/login.dto.js';
import type { AuthUser } from './auth.types.js';

const publicUserSelect = {
  id: true,
  username: true,
  name: true,
  role: true,
  classId: true,
  class: { select: { name: true } },
} as const;

function toAuthUser({
  class: classroom,
  ...user
}: {
  id: string;
  username: string;
  name: string;
  role: AuthUser['role'];
  classId: string | null;
  class: { name: string } | null;
}): AuthUser {
  return { ...user, className: classroom?.name ?? null };
}
const dummyHash = `scrypt$${'0'.repeat(32)}$${'0'.repeat(128)}`;

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
  ) {}

  async login(
    credentials: LoginDto,
  ): Promise<{ user: AuthUser; token: string }> {
    const account = await this.prisma.user.findUnique({
      where: { username: credentials.username },
      select: { ...publicUserSelect, passwordHash: true },
    });
    // Perform the same expensive verification for unknown usernames.
    const matches = await verifyPassword(
      credentials.password,
      account?.passwordHash ?? dummyHash,
    );
    if (!account || !matches)
      throw new UnauthorizedException('Invalid username or password');
    const { passwordHash: _passwordHash, ...rest } = account;
    const user = toAuthUser(rest);
    const token = await this.jwt.signAsync({ sub: user.id });
    return { user, token };
  }

  async userFromToken(token: string): Promise<AuthUser> {
    let subject: string;
    try {
      const payload = await this.jwt.verifyAsync<{
        sub?: unknown;
        exp?: unknown;
      }>(token);
      if (
        typeof payload.sub !== 'string' ||
        !/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(
          payload.sub,
        ) ||
        typeof payload.exp !== 'number'
      )
        throw new Error();
      subject = payload.sub;
    } catch {
      throw new UnauthorizedException('Invalid or expired session');
    }
    // Keep database failures separate from invalid-token failures.
    const user = await this.prisma.user.findUnique({
      where: { id: subject },
      select: publicUserSelect,
    });
    if (!user) throw new UnauthorizedException('Invalid or expired session');
    return toAuthUser(user);
  }

  /**
   * Change one's own password. The current password is required, so a device left signed in
   * is not enough to take over the account. A wrong current password is a 400, not a 401:
   * the session itself is valid and must not be ended.
   */
  async changePassword(userId: string, dto: ChangePasswordDto): Promise<void> {
    const account = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { passwordHash: true },
    });
    if (!account) throw new UnauthorizedException('Invalid or expired session');
    if (!(await verifyPassword(dto.currentPassword, account.passwordHash)))
      throw new BadRequestException('Current password is incorrect');
    if (dto.newPassword === dto.currentPassword)
      throw new BadRequestException(
        'The new password must be different from the current one',
      );
    await this.prisma.user.update({
      where: { id: userId },
      data: { passwordHash: await hashPassword(dto.newPassword) },
    });
  }
}
