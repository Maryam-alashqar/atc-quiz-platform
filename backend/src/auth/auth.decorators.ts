import {
  createParamDecorator,
  SetMetadata,
  UnauthorizedException,
  type ExecutionContext,
} from '@nestjs/common';
import type { Role } from '../generated/prisma/enums.js';
import type { AuthRequest } from './auth.types.js';

export const PUBLIC_ROUTE = 'auth:public';
export const REQUIRED_ROLES = 'auth:roles';
export const Public = () => SetMetadata(PUBLIC_ROUTE, true);
export const Roles = (...roles: Role[]) => SetMetadata(REQUIRED_ROLES, roles);
export const CurrentUser = createParamDecorator(
  (_data: unknown, context: ExecutionContext) => {
    const user = context.switchToHttp().getRequest<AuthRequest>().user;
    if (!user) throw new UnauthorizedException();
    return user;
  },
);
