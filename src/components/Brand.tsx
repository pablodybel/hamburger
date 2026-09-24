import { IS_DEMO } from '@/lib/supabase'

export function Wordmark({ className = '', light = false }: { className?: string; light?: boolean }) {
  return (
    <span className={`font-display leading-[0.8] tracking-tight ${light ? 'text-paper' : 'text-ink'} ${className}`}>
      La Plancha<span className="text-ketchup">.</span>
    </span>
  )
}

export function DemoBadge({ className = '' }: { className?: string }) {
  if (!IS_DEMO) return null
  return (
    <span
      title="Sin Supabase configurado: datos simulados y sincronizados entre pestañas"
      className={`label-mono inline-flex items-center gap-1.5 rounded-full border-2 border-current px-2 py-0.5 ${className}`}
    >
      <span className="size-1.5 rounded-full bg-current" /> modo demo
    </span>
  )
}
