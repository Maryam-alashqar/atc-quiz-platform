import { initials } from './Avatar'

describe('initials', () => {
  it('uses the first letters of the first and last names', () => {
    expect(initials('Leen Ahmad')).toBe('LA')
  })

  it('skips the Arabic definite article in the family name', () => {
    expect(initials('أحمد الخطيب')).toBe('أخ')
    expect(initials('نور الحسن')).toBe('نح')
  })

  it('handles single and empty names', () => {
    expect(initials('  Rana ')).toBe('R')
    expect(initials('')).toBe('?')
  })
})
