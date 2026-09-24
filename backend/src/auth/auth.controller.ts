import {
  Body,
  Controller,
  Get,
  HttpCode,
  Post,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ThrottlerGuard } from '@nestjs/throttler';
import type { CookieOptions, Response } from 'express';
import type { Environment } from '../config/environment.js';
import { AuthService } from './auth.service.js';
import { LoginDto } from './dto/login.dto.js';
import { CurrentUser, Public } from './auth.decorators.js';
import { AUTH_COOKIE, type AuthUser } from './auth.types.js';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly config: ConfigService<Environment, true>,
  ) {}

  private cookieOptions(): CookieOptions {
    return {
      httpOnly: true,
      secure: this.config.get('NODE_ENV', { infer: true }) === 'production',
      sameSite: 'lax',
      path: '/api',
    };
  }

  @Public()
  @Post('login')
  @HttpCode(200)
  @UseGuards(ThrottlerGuard)
  async login(
    @Body() body: LoginDto,
    @Res({ passthrough: true }) response: Response,
  ) {
    const { user, token } = await this.auth.login(body);
    response.setHeader('Cache-Control', 'no-store');
    response.cookie(AUTH_COOKIE, token, {
      ...this.cookieOptions(),
      maxAge: this.config.get('JWT_TTL_SECONDS', { infer: true }) * 1000,
    });
    return { user };
  }

  @Public()
  @Post('logout')
  @HttpCode(204)
  logout(@Res({ passthrough: true }) response: Response) {
    response.setHeader('Cache-Control', 'no-store');
    response.clearCookie(AUTH_COOKIE, this.cookieOptions());
  }

  @Get('me')
  me(
    @CurrentUser() user: AuthUser,
    @Res({ passthrough: true }) response: Response,
  ) {
    response.setHeader('Cache-Control', 'no-store');
    return { user };
  }
}
