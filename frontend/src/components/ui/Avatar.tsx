import { initials } from '../../lib/initials'

export function Avatar({ name, className = '' }: { name: string; className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={`grid size-11 shrink-0 place-items-center rounded-full bg-sky font-semibold text-primary ring-2 ring-surface ${className}`}
    >
      {initials(name)}
    </span>
  )
}
