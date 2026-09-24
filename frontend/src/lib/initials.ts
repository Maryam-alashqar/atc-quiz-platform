/** Initials of the first and last name; works for Arabic names too (e.g. "أحمد الخطيب" → "أخ"). */
export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  const first = [...parts[0]][0]
  if (parts.length === 1) return first
  // Skip the Arabic definite article so "الخطيب" gives "خ", not "ا".
  const last = parts[parts.length - 1].replace(/^ال(?=.)/, '')
  return `${first}${[...last][0]}`
}
