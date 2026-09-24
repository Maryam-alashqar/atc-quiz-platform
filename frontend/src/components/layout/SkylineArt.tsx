// A light Amman hillside silhouette (stone blocks, arches, a minaret, cypress trees)
// standing in for the illustrated skyline in the design mock.
export function SkylineArt({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 240 200" className={className} aria-hidden="true" focusable="false" preserveAspectRatio="xMidYMax slice">
      <g fill="currentColor">
        <path d="M0 200V120c30-14 70-18 110-12s90 2 130-16v108Z" />
        <rect x="18" y="92" width="40" height="44" rx="2" />
        <rect x="64" y="78" width="30" height="58" rx="2" />
        <path d="M112 136V70l14-12 14 12v66Z" />
        <rect x="123" y="32" width="6" height="30" />
        <circle cx="126" cy="30" r="5" />
        <rect x="150" y="88" width="46" height="48" rx="2" />
        <rect x="200" y="100" width="34" height="36" rx="2" />
        <path d="M100 136c0-40 6-60 6-60s6 20 6 60Z" />
        <path d="M204 100c0-30 5-44 5-44s5 14 5 44Z" />
      </g>
      <g fill="#1F4E79">
        <path d="M26 136v-18a7 7 0 0 1 14 0v18Z" />
        <path d="M72 136v-22a7 7 0 0 1 14 0v22Z" />
        <path d="M160 136v-20a8 8 0 0 1 16 0v20Z" />
        <rect x="118" y="80" width="6" height="10" rx="3" />
        <rect x="128" y="80" width="6" height="10" rx="3" />
      </g>
    </svg>
  )
}
