import { ArrowRight } from 'lucide-react'
import type { ReactNode } from 'react'
import { Link } from 'react-router'

interface StatCardProps {
  icon: ReactNode
  label: string
  value: ReactNode
  hint: string
  to: string
  tone: 'sky' | 'gold'
}

export function StatCard({ icon, label, value, hint, to, tone }: StatCardProps) {
  return (
    <Link
      to={to}
      className={`group flex min-w-0 flex-col items-start gap-1 rounded-3xl p-3.5 shadow-card transition-shadow hover:shadow-lift sm:flex-row sm:items-center sm:gap-4 sm:p-5 ${
        tone === 'gold' ? 'bg-gold-soft' : 'bg-sky-soft'
      }`}
    >
      <span className="hidden size-14 shrink-0 place-items-center rounded-2xl bg-surface text-primary shadow-card sm:grid">{icon}</span>
      <span className="min-w-0 flex-1">
        <span className="block text-xs leading-tight text-muted sm:text-sm">{label}</span>
        <span className="block font-serif text-2xl font-bold text-ink sm:text-3xl">{value}</span>
        <span className="hidden truncate text-sm text-muted sm:block">{hint}</span>
      </span>
      <span className="hidden size-10 shrink-0 place-items-center rounded-full bg-surface text-primary transition-transform sm:grid lg:hidden 2xl:grid group-hover:translate-x-0.5 rtl:group-hover:-translate-x-0.5">
        <ArrowRight className="size-4 rtl:-scale-x-100" aria-hidden="true" />
      </span>
    </Link>
  )
}
