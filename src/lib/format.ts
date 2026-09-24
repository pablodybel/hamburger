const ars = new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 })

export const money = (n: number) => ars.format(n)

export const orderNo = (n: number) => `#${String(n).padStart(4, '0')}`

export const tableNo = (n: number) => String(n).padStart(2, '0')

export const clock = (iso: string | null | undefined) =>
  iso ? new Date(iso).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }) : '—'

export function elapsed(fromIso: string | null | undefined, now = Date.now()) {
  if (!fromIso) return { label: '00:00', minutes: 0 }
  const s = Math.max(0, Math.floor((now - new Date(fromIso).getTime()) / 1000))
  const m = Math.floor(s / 60)
  return { label: `${String(m).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`, minutes: m }
}

export const slugify = (s: string) =>
  s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')

/**
 * UUID v4. crypto.randomUUID() solo existe en contextos seguros (https / localhost);
 * al abrir la app por http desde la red local (celular) no está, así que se arma
 * con getRandomValues, que sí está disponible en cualquier contexto.
 */
export function uid(): string {
  if (typeof crypto.randomUUID === 'function') return crypto.randomUUID()
  const b = crypto.getRandomValues(new Uint8Array(16))
  b[6] = (b[6] & 0x0f) | 0x40
  b[8] = (b[8] & 0x3f) | 0x80
  const h = [...b].map((x) => x.toString(16).padStart(2, '0')).join('')
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`
}
