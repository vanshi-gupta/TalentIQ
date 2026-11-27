// TalentIQ mark: a person (profile) whose head is a node in a neural network, with an upward "match" tick.
export function LogoMark({ size = 36 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" fill="none" aria-hidden="true">
      <defs>
        <linearGradient id="tq-g" x1="4" y1="4" x2="44" y2="44" gradientUnits="userSpaceOnUse">
          <stop stopColor="#2f6bff" /><stop offset="1" stopColor="#8b5cf6" />
        </linearGradient>
      </defs>
      <rect width="48" height="48" rx="13" fill="url(#tq-g)" />
      {/* network edges */}
      <path d="M24 17 L35 11 M24 17 L13 12 M24 17 L37 22" stroke="#fff" strokeOpacity=".55" strokeWidth="1.4" strokeLinecap="round" />
      <circle cx="35" cy="11" r="2.3" fill="#fff" fillOpacity=".85" />
      <circle cx="13" cy="12" r="2.3" fill="#fff" fillOpacity=".85" />
      <circle cx="37" cy="22" r="2.3" fill="#fff" fillOpacity=".85" />
      {/* person */}
      <circle cx="24" cy="17" r="5.2" fill="#fff" />
      <path d="M11 38c0-7.2 5.8-11 13-11s13 3.8 13 11" fill="#fff" />
      {/* match tick */}
      <path d="M19.5 33.5l3.2 3.2 6-6.6" stroke="#4f46e5" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

export function Logo({ size = 36, text = true }) {
  return (
    <div className="flex items-center gap-2.5">
      <LogoMark size={size} />
      {text && (
        <span className="text-xl font-extrabold tracking-tight text-white">
          Talent<span className="bg-gradient-to-r from-brand-blue to-brand-violet bg-clip-text text-transparent">IQ</span>
        </span>
      )}
    </div>
  )
}
