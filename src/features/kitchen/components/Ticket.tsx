import { useState } from 'react'
import { AlertTriangle, Undo2 } from 'lucide-react'
import type { Order, OrderStatus } from '@/types/domain'
import { clock, elapsed, orderNo, tableNo } from '@/lib/format'

const NEXT: Partial<Record<OrderStatus, { to: OrderStatus; label: string; cls: string }>> = {
  received: { to: 'preparing', label: 'A la plancha', cls: 'bg-ketchup text-white' },
  preparing: { to: 'ready', label: 'Listo', cls: 'bg-pickle text-white' },
  ready: { to: 'delivered', label: 'Entregado', cls: 'bg-grill text-thermal' },
}
const PREV: Partial<Record<OrderStatus, OrderStatus>> = { preparing: 'received', ready: 'preparing' }

const BAND: Record<string, { label: string; cls: string }> = {
  received: { label: 'Nuevo', cls: 'bg-mustard text-grill' },
  preparing: { label: 'En plancha', cls: 'bg-ketchup text-white' },
  ready: { label: 'Listo · al pase', cls: 'bg-pickle text-white' },
}

export function Ticket({
  order, now, onAdvance, onBack, busy, compact = false, index = 0,
}: {
  order: Order
  now: number
  onAdvance: (to: OrderStatus) => void
  onBack: (to: OrderStatus) => void
  busy: boolean
  compact?: boolean
  index?: number
}) {
  const [struck, setStruck] = useState<Set<number>>(new Set())
  const since = order.status === 'ready' ? order.ready_at : order.sent_to_kitchen_at
  const t = elapsed(order.sent_to_kitchen_at, now)
  const late = order.status !== 'ready' && t.minutes >= 15
  const warn = order.status !== 'ready' && t.minutes >= 8 && !late
  const isNew = order.status === 'received' && now - new Date(order.sent_to_kitchen_at ?? 0).getTime() < 45_000
  const next = NEXT[order.status]
  const prev = PREV[order.status]
  const band = BAND[order.status]
  const unpaid = order.payment_status !== 'approved'

  const toggle = (i: number) =>
    setStruck((s) => {
      const n = new Set(s)
      if (n.has(i)) n.delete(i)
      else n.add(i)
      return n
    })

  return (
    <article
      className={`relative flex flex-col ${isNew ? 'animate-drop' : ''}`}
      style={{
        animationDelay: isNew ? '0ms' : `${index * 40}ms`,
        // drop-shadow respeta la máscara dentada (box-shadow quedaría recortado)
        filter: isNew
          ? 'drop-shadow(0 0 0.5px #f2a900) drop-shadow(0 0 18px rgb(242 169 0 / 0.75))'
          : 'drop-shadow(0 16px 18px rgb(0 0 0 / 0.7))',
      }}
    >
      {/* clip del riel */}
      <div className="relative z-10 mx-auto -mb-2 h-5 w-16 rounded-b-md bg-gradient-to-b from-[#9a958c] to-[#4a4640] shadow-md" />

      <div
        className="zigzag-top relative flex flex-1 flex-col bg-thermal text-grill"
      >
        <div className={`mx-3 flex items-center justify-between rounded-sm px-3 py-1 font-kds text-sm font-bold tracking-[0.18em] uppercase ${band.cls}`}>
          <span className={isNew ? 'animate-flash' : ''}>{band.label}</span>
          <span className="font-mono text-[11px] tracking-normal opacity-80">{orderNo(order.order_number)}</span>
        </div>

        {/* Mesa + tiempo */}
        <div className="flex items-end gap-3 px-4 pt-2">
          <div className="leading-none">
            <div className="font-kds text-xs font-bold tracking-[0.3em] text-grill/50 uppercase">Mesa</div>
            <div className={`font-kds font-extrabold tracking-tight ${compact ? 'text-6xl' : 'text-[5.5rem]'} leading-[0.85]`}>
              {tableNo(order.table_number)}
            </div>
          </div>
          <div className="ml-auto pb-1 text-right">
            <div
              className={`inline-block rounded px-2 font-mono text-2xl font-extrabold tabular-nums ${
                late ? 'animate-flash bg-ketchup text-white' : warn ? 'bg-mustard' : ''
              }`}
            >
              {order.status === 'ready' ? elapsed(since, now).label : t.label}
            </div>
            <div className="mt-1 font-mono text-[11px] text-grill/55">entró {clock(order.sent_to_kitchen_at)}</div>
          </div>
        </div>

        <div className="mx-4 mt-2 flex gap-2">
          {unpaid ? (
            <span className="rounded-sm border-2 border-grill px-1.5 font-kds text-xs font-bold tracking-widest uppercase">Cobrar en caja</span>
          ) : (
            <span className="rounded-sm bg-grill/10 px-1.5 font-kds text-xs font-bold tracking-widest text-grill/60 uppercase">Pagado</span>
          )}
        </div>

        <hr className="dash-rule mx-4 my-3" />

        {/* Ítems */}
        {!compact && (
          <ul className="flex-1 space-y-3 px-4">
            {order.items.map((it, i) => {
              const done = struck.has(i)
              return (
                <li key={it.id ?? i}>
                  <button onClick={() => toggle(i)} className={`w-full text-left transition-opacity ${done ? 'opacity-35' : ''}`}>
                    <div className="flex items-start gap-3">
                      <span className="grid h-9 min-w-9 place-items-center rounded-md bg-grill px-1.5 font-kds text-2xl font-extrabold text-thermal">
                        {it.quantity}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className={`font-kds text-[1.7rem] leading-[1.05] font-bold uppercase ${done ? 'line-through decoration-4' : ''}`}>
                          {it.product_name}
                        </p>
                        {it.variants.length > 0 && (
                          <div className="mt-1 flex flex-wrap gap-1.5">
                            {it.variants.map((v, j) => (
                              <span
                                key={j}
                                className={`rounded-sm px-1.5 py-0.5 font-kds text-[15px] leading-none font-semibold uppercase ${
                                  /combo/i.test(v.group_name) ? 'bg-mustard text-grill' : /medall/i.test(v.group_name) ? 'bg-grill text-thermal' : 'border border-grill/40'
                                }`}
                              >
                                {v.variant_name}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </button>
                  {it.comment && (
                    <p className="mt-2 flex items-start gap-2 rounded-sm bg-ketchup px-2.5 py-1.5 font-kds text-xl leading-tight font-extrabold tracking-wide text-white uppercase">
                      <AlertTriangle className="mt-0.5 size-5 shrink-0" strokeWidth={2.8} />
                      {it.comment}
                    </p>
                  )}
                </li>
              )
            })}
          </ul>
        )}

        {compact && (
          <p className="px-4 font-kds text-lg leading-tight font-semibold text-grill/70 uppercase">
            {order.items.map((it) => `${it.quantity}× ${it.product_name}`).join(' · ')}
          </p>
        )}

        {order.customer_note && !compact && (
          <div className="mx-4 mt-4 rounded-sm border-2 border-dashed border-ketchup px-3 py-2">
            <p className="font-kds text-xs font-bold tracking-[0.25em] text-ketchup uppercase">Nota del pedido</p>
            <p className="font-kds text-lg leading-tight font-semibold">{order.customer_note}</p>
          </div>
        )}

        {/* Acciones */}
        <div className="mt-4 flex gap-2 px-3 pb-3">
          {prev && (
            <button
              aria-label="Volver al estado anterior"
              disabled={busy}
              onClick={() => onBack(prev)}
              className="grid w-14 shrink-0 place-items-center rounded-md border-2 border-grill/25 text-grill/60 hover:bg-grill/5 disabled:opacity-40"
            >
              <Undo2 className="size-5" />
            </button>
          )}
          {next && (
            <button
              disabled={busy}
              onClick={() => onAdvance(next.to)}
              className={`flex-1 rounded-md font-kds font-extrabold tracking-[0.12em] uppercase transition-transform active:scale-[0.98] disabled:opacity-50 ${
                compact ? 'h-12 text-xl' : 'h-16 text-3xl'
              } ${next.cls}`}
            >
              {next.label}
            </button>
          )}
        </div>
      </div>
    </article>
  )
}
