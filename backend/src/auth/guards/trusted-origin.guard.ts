import {
  ForbiddenException,
  Injectable,
  type CanActivate,
  type ExecutionContext,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Request } from 'express';
import type { Environment } from '../../config/environment.js';

@Injectable()
export class TrustedOriginGuard implements CanActivate {
  constructor(private readonly config: ConfigService<Environment, true>) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    if (['GET', 'HEAD', 'OPTIONS'].includes(request.method)) return true;
    // Cookie authentication requires CSRF protection, including login/logout.
    if (
      request.headers.origin !==
      this.config.get('FRONTEND_ORIGIN', { infer: true })
    )
      throw new ForbiddenException('Untrusted request origin');
    return true;
  }
}
