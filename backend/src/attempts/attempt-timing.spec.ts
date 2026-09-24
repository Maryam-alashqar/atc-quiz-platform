import { describe, expect, it } from 'vitest';
import { attemptDeadline, graceEndsAt, hasExpired } from './attempt-rules.js';

describe('Attempt timing — fixed deadline and network grace boundaries', () => {
  const start = new Date('2026-09-24T09:00:00Z');
  it('uses the quiz duration when the closing time is later', () => {
    expect(
      attemptDeadline(
        start,
        20,
        new Date('2026-09-24T10:00:00Z'),
      ).toISOString(),
    ).toBe('2026-09-24T09:20:00.000Z');
  });
  it('caps the deadline at quiz closing time', () => {
    expect(
      attemptDeadline(
        start,
        20,
        new Date('2026-09-24T09:05:00Z'),
      ).toISOString(),
    ).toBe('2026-09-24T09:05:00.000Z');
  });
  it('ends the grace period exactly ten seconds after the fixed deadline', () => {
    expect(graceEndsAt(start).toISOString()).toBe('2026-09-24T09:00:10.000Z');
  });
  it.each([
    ['before the deadline', -1, false],
    ['at the deadline', 0, false],
    ['one millisecond before grace ends', 9999, false],
    ['exactly when grace ends', 10000, true],
    ['after grace ends', 10001, true],
  ] as const)(
    'classifies a request %s correctly',
    (_label, offset, expired) => {
      expect(hasExpired(start, new Date(start.getTime() + offset))).toBe(
        expired,
      );
    },
  );
});
