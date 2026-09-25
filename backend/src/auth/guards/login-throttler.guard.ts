import { Injectable } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';

/**
 * Login attempts are limited per client IP *and* username.
 * A whole class signing in from the centre's shared Wi-Fi (one public IP) must not
 * lock itself out, while guessing one account's password stays throttled.
 */
@Injectable()
export class LoginThrottlerGuard extends ThrottlerGuard {
  protected override async getTracker(
    req: Record<string, any>,
  ): Promise<string> {
    const body = req.body as { username?: unknown } | undefined;
    const username =
      typeof body?.username === 'string'
        ? body.username.trim().toLowerCase().slice(0, 100)
        : '';
    return `${String(req.ip)}|${username}`;
  }
}
