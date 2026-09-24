// Ilustraciones tipo sticker para cuando el producto no tiene foto.
const INK = '#1b1512'
const S = { stroke: INK, strokeWidth: 3.2, strokeLinejoin: 'round' as const, strokeLinecap: 'round' as const }

function Burger() {
  return (
    <g {...S}>
      <path d="M14 52c0-17 15-29 36-29s36 12 36 29z" fill="#e4ae62" />
      <path d="M26 36l3 2M42 30l3 1M58 31l3-1M70 38l3-2M50 40l2 2M34 44l3 1" strokeWidth="2.6" stroke="#f8f5ec" />
      <rect x="10" y="52" width="80" height="7" rx="3.5" fill="#4e7a27" />
      <path d="M12 59h76l-6 9-8-6-9 9-8-8-10 9-9-9-8 8-9-8-9 6z" fill="#f2a900" />
      <rect x="12" y="63" width="76" height="13" rx="6.5" fill="#6b3a1f" />
      <path d="M13 79h74c0 7-6 11-13 11H26c-7 0-13-4-13-11z" fill="#e4ae62" />
    </g>
  )
}

function Fries() {
  return (
    <g {...S}>
      {[26, 36, 46, 56, 66, 74].map((x, i) => (
        <rect key={x} x={x} y={14 + (i % 3) * 6} width="8" height="46" rx="2" fill="#ffd66b" transform={`rotate(${(i - 2.5) * 5} ${x + 4} 60)`} />
      ))}
      <path d="M18 44h64l-8 46H26z" fill="#d7301f" />
      <path d="M50 58c-6 0-10 4-10 9 0 7 10 12 10 12s10-5 10-12c0-5-4-9-10-9z" fill="#f2a900" strokeWidth="2.6" />
    </g>
  )
}

function Drink() {
  return (
    <g {...S}>
      <path d="M58 6l-6 24" strokeWidth="6" stroke={INK} />
      <path d="M58 6l-6 24" strokeWidth="2.5" stroke="#d7301f" />
      <rect x="22" y="26" width="56" height="10" rx="5" fill="#f8f5ec" />
      <path d="M26 36h48l-6 54H32z" fill="#d7301f" />
      <path d="M29 58h42l-1.5 14h-39z" fill="#f8f5ec" />
      <path d="M40 65h20" strokeWidth="2.4" />
    </g>
  )
}

function Dessert() {
  return (
    <g {...S}>
      <circle cx="50" cy="16" r="5" fill="#d7301f" />
      <path d="M22 44c0-12 12-22 28-22s28 10 28 22z" fill="#f8f5ec" />
      <path d="M28 44c2-4 6-6 10-3s8 3 12-1 9-3 12 1 8 3 10 3" fill="none" strokeWidth="2.4" />
      <path d="M18 44h64l-10 30H28z" fill="#ffd66b" />
      <path d="M40 74h20l-4 16H44z" fill="#e4ae62" />
      <path d="M32 54l36 0M36 64h28" strokeWidth="2.2" opacity=".5" />
    </g>
  )
}

const MAP: Record<string, () => React.ReactElement> = {
  hamburguesas: Burger,
  acompanamientos: Fries,
  bebidas: Drink,
  postres: Dessert,
}

export function FoodGlyph({ kind, className }: { kind: string; className?: string }) {
  const G = MAP[kind] ?? Burger
  return (
    <svg viewBox="0 0 100 100" className={className} aria-hidden>
      <G />
    </svg>
  )
}

export function ProductImage({ src, kind, className = '' }: { src: string | null; kind: string; className?: string }) {
  if (src) return <img src={src} alt="" loading="lazy" className={`h-full w-full object-cover ${className}`} />
  return <FoodGlyph kind={kind} className={`h-full w-full p-[12%] ${className}`} />
}
