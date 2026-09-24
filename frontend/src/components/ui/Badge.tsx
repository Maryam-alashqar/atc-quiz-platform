import type { ReactNode } from 'react'

export type Tone = 'success' | 'warning' | 'neutral' | 'info' | 'danger'

const tones: Record<Tone, string> = {
  success: 'bg-success-soft text-success',
  warning: 'bg-gold-soft text-gold-ink',
  neutral: 'bg-ivory text-muted ring-1 ring-line',
  info: 'bg-sky text-primary',
  danger: 'bg-danger-soft text-danger',
}

export function Badge({ tone, children }: { tone: Tone; children: ReactNode }) {
  return (
    <span
      className={`inline-flex items-center whitespace-nowrap rounded-full px-3 py-1 text-xs font-semibold sm:text-sm ${tones[tone]}`}
    >
      {children}
    </span>
  )
}
