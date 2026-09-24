import {
  Injectable,
  UnauthorizedException,
  type CanActivate,
  type ExecutionContext,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthService } from '../auth.service.js';
import { AUTH_COOKIE, type AuthRequest } from '../auth.types.js';
import { PUBLIC_ROUTE } from '../auth.decorators.js';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly auth: AuthService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    if (
      this.reflector.getAllAndOverride<boolean>(PUBLIC_ROUTE, [
        context.getHandler(),
        context.getClass(),
      ])
    )
      return true;
    const request = context.switchToHttp().getRequest<AuthRequest>();
    const token: unknown = request.cookies?.[AUTH_COOKIE];
    if (typeof token !== 'string' || !token || token.length > 4096)
      throw new UnauthorizedException('Authentication required');
    request.user = await this.auth.userFromToken(token);
    return true;
  }
}
