import type { ReactNode } from 'react'

interface Segment {
  value: number
  className: string
}

interface ProgressRingProps {
  segments: Segment[]
  children?: ReactNode
  size?: number
  label: string
}

/** Donut chart: each segment is drawn as an arc proportional to its share of the total. */
export function ProgressRing({ segments, children, size = 150, label }: ProgressRingProps) {
  const stroke = 14
  const radius = (size - stroke) / 2
  const circumference = 2 * Math.PI * radius
  const total = segments.reduce((sum, segment) => sum + segment.value, 0)
  const gap = total > 0 && segments.filter((s) => s.value > 0).length > 1 ? 6 : 0
  let offset = 0
  return (
    <div className="relative grid shrink-0 place-items-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label={label} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" strokeWidth={stroke} className="stroke-ivory" />
        {total > 0 &&
          segments.map((segment, index) => {
            const length = (segment.value / total) * circumference
            const dash = Math.max(0, length - gap)
            const circle = (
              <circle
                key={index}
                cx={size / 2}
                cy={size / 2}
                r={radius}
                fill="none"
                strokeWidth={stroke}
                strokeLinecap="round"
                strokeDasharray={`${dash} ${circumference - dash}`}
                strokeDashoffset={-offset}
                className={segment.className}
              />
            )
            offset += length
            return segment.value > 0 ? circle : null
          })}
      </svg>
      <div className="absolute inset-0 grid place-items-center text-center">{children}</div>
    </div>
  )
}
