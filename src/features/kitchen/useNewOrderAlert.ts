import { useEffect, useRef, useState } from 'react'
import type { Order } from '@/types/domain'
import { playNewOrderChime } from '@/lib/sound'

/**
 * Detecta pedidos que ENTRAN a cocina comparando ids contra el render previo.
 * Robusto ante ambos caminos: INSERT directo (pago en caja) y UPDATE
 * awaiting_payment -> received (webhook de Mercado Pago).
 */
export function useNewOrderAlert(orders: Order[] | undefined, soundOn: boolean) {
  const seen = useRef<Set<string> | null>(null)
  const [flash, setFlash] = useState<Order | null>(null)

  useEffect(() => {
    if (!orders) return
    const ids = new Set(orders.map((o) => o.id))
    if (seen.current === null) {
      seen.current = ids // primera carga: no alertar lo que ya estaba
      return
    }
    const fresh = orders.filter((o) => o.status === 'received' && !seen.current!.has(o.id))
    seen.current = ids
    if (fresh.length) {
      if (soundOn) playNewOrderChime()
      setFlash(fresh[fresh.length - 1])
      if ('vibrate' in navigator) navigator.vibrate?.([120, 80, 120])
    }
  }, [orders, soundOn])

  useEffect(() => {
    if (!flash) return
    const t = setTimeout(() => setFlash(null), 2600)
    return () => clearTimeout(t)
  }, [flash])

  return flash
}
