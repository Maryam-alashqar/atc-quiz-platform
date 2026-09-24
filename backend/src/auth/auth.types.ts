import type { Request } from 'express';
import type { Role } from '../generated/prisma/enums.js';

export interface AuthUser {
  id: string;
  username: string;
  name: string;
  role: Role;
  classId: string | null;
}

export interface AuthRequest extends Request {
  user?: AuthUser;
}

export const AUTH_COOKIE = 'atc_session';
export const JWT_ISSUER = 'atc-quiz-platform';
export const JWT_AUDIENCE = 'atc-web';
