import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'

export interface CartLine {
  key: string
  product_id: string
  name: string
  category_slug: string
  unit_price: number
  quantity: number
  comment: string
  variant_ids: string[]
  variant_labels: { group: string; name: string; delta: number }[]
}

interface CartState {
  tableNumber: number | null
  lines: CartLine[]
  note: string
  lastOrderToken: string | null
  setTable: (n: number) => void
  add: (line: Omit<CartLine, 'key'>) => void
  setQty: (key: string, qty: number) => void
  remove: (key: string) => void
  setNote: (note: string) => void
  clear: (orderToken?: string) => void
}

// Misma combinación producto + variantes + comentario => se suma a la línea existente
const lineSignature = (l: Pick<CartLine, 'product_id' | 'variant_ids' | 'comment'>) =>
  `${l.product_id}|${[...l.variant_ids].sort().join(',')}|${l.comment.trim().toLowerCase()}`

export const useCart = create<CartState>()(
  persist(
    (set) => ({
      tableNumber: null,
      lines: [],
      note: '',
      lastOrderToken: null,
      setTable: (n) => set({ tableNumber: n }),
      add: (line) =>
        set((s) => {
          const sig = lineSignature(line)
          const existing = s.lines.find((l) => lineSignature(l) === sig)
          if (existing)
            return { lines: s.lines.map((l) => (l === existing ? { ...l, quantity: Math.min(50, l.quantity + line.quantity) } : l)) }
          return { lines: [...s.lines, { ...line, key: crypto.randomUUID() }] }
        }),
      setQty: (key, qty) =>
        set((s) => ({
          lines: qty <= 0 ? s.lines.filter((l) => l.key !== key) : s.lines.map((l) => (l.key === key ? { ...l, quantity: Math.min(50, qty) } : l)),
        })),
      remove: (key) => set((s) => ({ lines: s.lines.filter((l) => l.key !== key) })),
      setNote: (note) => set({ note }),
      clear: (orderToken) => set((s) => ({ lines: [], note: '', lastOrderToken: orderToken ?? s.lastOrderToken })),
    }),
    { name: 'laplancha-cart', storage: createJSONStorage(() => sessionStorage) },
  ),
)

export const cartTotals = (lines: CartLine[]) => ({
  count: lines.reduce((s, l) => s + l.quantity, 0),
  total: lines.reduce((s, l) => s + l.unit_price * l.quantity, 0),
})
