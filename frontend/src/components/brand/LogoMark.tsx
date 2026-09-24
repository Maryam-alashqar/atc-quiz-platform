interface LogoMarkProps {
  /** `onDark` for the blue sidebar, `onLight` for ivory/white surfaces. */
  tone?: 'onDark' | 'onLight'
  className?: string
}

// Vector redraw of the supplied logo (open book, two leaves, rising sun), so it stays
// crisp at any size and works on both light and dark backgrounds.
export function LogoMark({ tone = 'onLight', className }: LogoMarkProps) {
  const page = tone === 'onDark' ? '#FFFFFF' : '#1F4E79'
  const leaf = tone === 'onDark' ? '#DCE8F2' : '#4F7CAC'
  const edge = tone === 'onDark' ? '#DCE8F2' : '#173D60'
  return (
    <svg viewBox="0 0 64 64" className={className} aria-hidden="true" focusable="false">
      <circle cx="32" cy="10" r="6" fill="#E9B44C" />
      <path d="M32 36C25 32 19 25 19 17c7 1 12 8 13 19Z" fill={leaf} />
      <path d="M32 36c7-4 13-11 13-19-7 1-12 8-13 19Z" fill={leaf} opacity=".8" />
      <path d="M5 31c9-4 19-3 27 5v20c-8-6-18-7-27-3Z" fill={page} />
      <path d="M59 31c-9-4-19-3-27 5v20c8-6 18-7 27-3Z" fill={page} />
      <path d="M5 53c9-4 19-3 27 3 8-6 18-7 27-3" fill="none" stroke={edge} strokeWidth="2" strokeLinecap="round" />
      <path d="M46 33v11l3-2.4 3 2.4V33.6c-2-.5-4-.7-6-.6Z" fill="#E9B44C" />
    </svg>
  )
}
