import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service.js';
import { verifyPassword } from '../common/security/password.js';
import type { LoginDto } from './dto/login.dto.js';
import type { AuthUser } from './auth.types.js';

const publicUserSelect = {
  id: true,
  username: true,
  name: true,
  role: true,
  classId: true,
} as const;
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
    const { passwordHash: _passwordHash, ...user } = account;
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
    return user;
  }
}
