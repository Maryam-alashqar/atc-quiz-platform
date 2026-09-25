import { generatePassword } from './password'

describe('generatePassword', () => {
  it('meets the API minimum length and avoids look-alike characters', () => {
    for (let i = 0; i < 200; i++) {
      const password = generatePassword()
      expect(password).toMatch(/^[A-Z][a-z]{2}-[2-9]{4}-[A-Z][a-z]$/)
      expect(password.length).toBeGreaterThanOrEqual(8)
      expect(password).not.toMatch(/[01OIl]/)
    }
  })

  it('does not repeat itself', () => {
    const passwords = new Set(Array.from({ length: 50 }, generatePassword))
    expect(passwords.size).toBe(50)
  })
})
