import { describe, expect, it } from 'vitest';
import { hashPassword, verifyPassword } from './password.js';

describe('password hashing', () => {
  it('uses independent salts and verifies only the matching password', async () => {
    const a = await hashPassword('كلمة مرور تجريبية');
    const b = await hashPassword('كلمة مرور تجريبية');
    expect(a).not.toBe(b);
    expect(a).not.toContain('كلمة');
    expect(await verifyPassword('كلمة مرور تجريبية', a)).toBe(true);
    expect(await verifyPassword('wrong-password', a)).toBe(false);
  });
  it('rejects malformed stored hashes', async () => {
    expect(await verifyPassword('password', 'invalid')).toBe(false);
    expect(await verifyPassword('password', 'scrypt$bad$bad')).toBe(false);
  });
});
