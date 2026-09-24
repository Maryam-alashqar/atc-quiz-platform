import { Injectable } from '@nestjs/common';

@Injectable()
export class AttemptClock {
  now(): Date {
    return new Date();
  }
}
