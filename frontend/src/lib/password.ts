// No look-alike characters (0/O, 1/l/I), so a password read aloud or written on paper survives.
const LETTERS = 'abcdefghjkmnpqrstuvwxyz'
const UPPER = 'ABCDEFGHJKMNPQRSTUVWXYZ'
const DIGITS = '23456789'

function pick(alphabet: string, random: Uint32Array, index: number) {
  return alphabet[random[index] % alphabet.length]
}

/** A readable initial password such as "Kmt-4829-Qd", generated with the browser's CSPRNG. */
export function generatePassword(): string {
  const random = crypto.getRandomValues(new Uint32Array(9))
  const word = (start: number, length: number) =>
    Array.from({ length }, (_, i) => pick(i === 0 ? UPPER : LETTERS, random, start + i)).join('')
  const digits = Array.from({ length: 4 }, (_, i) => pick(DIGITS, random, 3 + i)).join('')
  return `${word(0, 3)}-${digits}-${word(7, 2)}`
}
