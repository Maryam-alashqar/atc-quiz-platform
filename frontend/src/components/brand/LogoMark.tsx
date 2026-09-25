import { useId } from 'react'

interface LogoMarkProps {
  /** `onDark` for the blue sidebar, `onLight` for ivory/white surfaces. */
  tone?: 'onDark' | 'onLight'
  className?: string
}

const palettes = {
  onLight: { cover: '#1F4E79', leafL: ['#3F8AD6', '#1F5E9E'], leafR: ['#2A6DB0', '#173D60'] },
  // On the blue sidebar the cover and leaves are lifted so they don't melt into the background.
  onDark: { cover: '#4F7CAC', leafL: ['#8CBCEB', '#4F8FD0'], leafR: ['#6FA6DE', '#3A78B8'] },
}

// Vector redraw of the supplied logo (open book, two leaves around a rising sun, bookmark),
// so it stays sharp at any size and needs no image request.
export function LogoMark({ tone = 'onLight', className }: LogoMarkProps) {
  // useId() can contain characters (such as ':') that break url(#…) references.
  const id = `logo${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`
  const p = palettes[tone]
  return (
    <svg viewBox="12 4 96 72" className={className} aria-hidden="true" focusable="false">
      <defs>
        <linearGradient id={`${id}g`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#F9C846" />
          <stop offset="1" stopColor="#EDA33A" />
        </linearGradient>
        <linearGradient id={`${id}l`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor={p.leafL[0]} />
          <stop offset="1" stopColor={p.leafL[1]} />
        </linearGradient>
        <linearGradient id={`${id}r`} x1="1" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={p.leafR[0]} />
          <stop offset="1" stopColor={p.leafR[1]} />
        </linearGradient>
      </defs>
      <path d="M26 35 Q24 35 23.6 37 L16 70 Q40 62 60 73 Q80 62 104 70 L96.4 37 Q96 35 94 35 Z" fill={p.cover} />
      <path d="M27.5 37 L92.5 37 L99 66.5 Q80 60 60 69 Q40 60 21 66.5 Z" fill="#BFD6EE" />
      <path d="M29 33 Q29 31 31 31 Q46 30.5 58 33 L58 66 Q43 58.5 25 63.5 Z" fill="#FDFBF6" />
      <path d="M91 33 Q91 31 89 31 Q74 30.5 62 33 L62 66 Q77 58.5 95 63.5 Z" fill="#FDFBF6" />
      <path d="M58.2 40 L61.8 40 L61.8 68 L60 70 L58.2 68 Z" fill={p.cover} />
      <path d="M29 52.5 Q44 49 56.5 55 L56.5 58.5 Q44 52.5 28.5 56.5 Z" fill="#BFD6EE" />
      <path d="M91 52.5 Q76 49 63.5 55 L63.5 58.5 Q76 52.5 91.5 56.5 Z" fill="#BFD6EE" />
      <path d="M79.5 32 L87 32.4 L87 47.5 L83.25 44.2 L79.5 47.5 Z" fill={`url(#${id}g)`} />
      <circle cx="60" cy="15.5" r="8" fill={`url(#${id}g)`} />
      <path d="M60 43 C55 22 46 17 37 18 C39 30 48 38 60 43 Z" fill={`url(#${id}l)`} />
      <path d="M60 43 C65 22 74 17 83 18 C81 30 72 38 60 43 Z" fill={`url(#${id}r)`} />
    </svg>
  )
}
