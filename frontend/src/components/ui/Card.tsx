import type { HTMLAttributes, ReactNode } from 'react'

export function Card({ className = '', ...rest }: HTMLAttributes<HTMLDivElement>) {
  return <div className={`min-w-0 rounded-3xl bg-surface shadow-card ${className}`} {...rest} />
}

interface SectionCardProps {
  title: ReactNode
  action?: ReactNode
  children: ReactNode
  className?: string
}

export function SectionCard({ title, action, children, className = '' }: SectionCardProps) {
  return (
    <Card className={`p-5 sm:p-6 ${className}`}>
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="font-serif text-xl font-semibold text-ink sm:text-2xl">{title}</h2>
        {action}
      </div>
      {children}
    </Card>
  )
}
