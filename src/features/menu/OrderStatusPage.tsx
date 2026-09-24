import { Link, useParams, useSearchParams } from 'react-router-dom'
import { useMutation } from '@tanstack/react-query'
import { Banknote, BellRing, Check, ChefHat, CircleAlert, Flame, Loader2, ReceiptText, Wallet } from 'lucide-react'
import { useOrderTracking } from '@/hooks/queries'
import { api } from '@/services/api'
import { clock, money, orderNo, tableNo } from '@/lib/format'
import { FoodGlyph } from '@/components/FoodGlyph'
import { Wordmark } from '@/components/Brand'
import type { Order, OrderStatus } from '@/types/domain'

const STEPS: { key: OrderStatus; title: string; sub: string; icon: typeof Check }[] = [
  { key: 'received', title: 'Recibido', sub: 'Tu comanda ya está colgada en cocina', icon: ReceiptText },
  { key: 'preparing', title: 'En la plancha', sub: 'Aplastando medallones con cariño', icon: Flame },
  { key: 'ready', title: '¡Listo!', sub: 'Sale para tu mesa en un toque', icon: BellRing },
]
const RANK: Record<OrderStatus, number> = { awaiting_payment: -1, received: 0, preparing: 1, ready: 2, delivered: 3, cancelled: -2 }

export default function OrderStatusPage() {
  const { token = '' } = useParams()
  const [params] = useSearchParams()
  const { data: order, isLoading } = useOrderTracking(token)

  if (isLoading) return <Center><Loader2 className="size-8 animate-spin" /></Center>
  if (!order)
    return (
      <Center>
        <h1 className="font-display text-4xl">Pedido no encontrado</h1>
        <p className="mt-2 text-ink-soft">Revisá el link o preguntale al mozo.</p>
      </Center>
    )

  const rank = RANK[order.status]
  const headline =
    order.status === 'awaiting_payment' ? 'Esperando tu pago'
    : order.status === 'cancelled' ? 'Pedido cancelado'
    : order.status === 'delivered' ? '¡Buen provecho!'
    : STEPS[Math.max(0, rank)].title

  return (
    <div className="paper-grain min-h-dvh pb-12">
      <div className="checker" />
      <header className="flex items-center justify-between px-5 pt-5">
        <Wordmark className="text-2xl" />
        <span className="label-mono flex items-center gap-1.5 rounded-full bg-ink px-2.5 py-1 text-paper">
          <span className="size-1.5 animate-[flash_1.2s_ease-in-out_infinite] rounded-full bg-ketchup" /> en vivo
        </span>
      </header>

      {/* Hero de estado */}
      <section className="relative mx-4 mt-6 overflow-hidden rounded-3xl border-2 border-ink bg-ink px-6 pt-6 pb-7 text-paper" style={{ boxShadow: 'var(--shadow-hard-lg)' }}>
        <div className="halftone absolute inset-0 text-mustard/40" />
        <div className="relative flex items-start justify-between">
          <div>
            <p className="label-mono text-paper/60">pedido {orderNo(order.order_number)} · mesa {tableNo(order.table_number)}</p>
            <h1 key={order.status} className="mt-3 animate-rise font-display text-[2.9rem] leading-[0.9] text-mustard">{headline}</h1>
          </div>
          <div className="relative -mt-1 -mr-2 size-24 shrink-0">
            {order.status === 'preparing' && (
              <div className="absolute -top-3 left-1/2 flex -translate-x-1/2 gap-2">
                {[0, 1, 2].map((i) => (
                  <span key={i} className="block h-5 w-1 animate-sizzle rounded-full bg-paper/70" style={{ animationDelay: `${i * 0.25}s` }} />
                ))}
              </div>
            )}
            <FoodGlyph kind="hamburguesas" className={`size-full ${order.status === 'ready' ? 'animate-wobble' : ''}`} />
          </div>
        </div>

        {rank >= 0 && rank <= 2 && (
          <div className="relative mt-6 grid grid-cols-3 gap-1.5">
            {STEPS.map((s, i) => (
              <div key={s.key} className={`h-2 rounded-full transition-colors duration-700 ${i <= rank ? 'bg-mustard' : 'bg-paper/15'}`} />
            ))}
          </div>
        )}
      </section>

      {order.status === 'awaiting_payment' && <AwaitingPayment order={order} token={token} failed={params.get('pago') === 'fallido' || order.payment_status === 'rejected'} />}

      {/* Timeline */}
      {rank >= 0 && (
        <ol className="mx-4 mt-7 space-y-0">
          {STEPS.map((s, i) => {
            const done = i < rank || order.status === 'delivered'
            const current = i === rank
            const Icon = s.icon
            return (
              <li key={s.key} className="relative flex gap-4 pb-6 last:pb-0">
                {i < STEPS.length - 1 && <span className={`absolute top-12 left-[23px] h-[calc(100%-3rem)] w-[3px] rounded ${done ? 'bg-ink' : 'bg-ink/15'}`} />}
                <span
                  className={`relative z-10 grid size-12 shrink-0 place-items-center rounded-full border-2 border-ink transition-colors ${
                    done ? 'bg-ink text-mustard' : current ? 'bg-mustard text-ink' : 'bg-paper text-ink/30'
                  }`}
                  style={current ? { boxShadow: 'var(--shadow-hard-sm)' } : undefined}
                >
                  {done ? <Check className="size-5" strokeWidth={3} /> : <Icon className="size-5" />}
                </span>
                <div className={`pt-1.5 ${!done && !current ? 'opacity-40' : ''}`}>
                  <p className="text-lg leading-tight font-bold">{s.title}</p>
                  <p className="text-sm text-ink-soft">{s.sub}</p>
                </div>
              </li>
            )
          })}
        </ol>
      )}

      <PaymentBanner order={order} />

      {/* Resumen */}
      <section className="mx-4 mt-7">
        <div className="zigzag-bottom rounded-t-2xl bg-thermal px-5 pt-4">
          <div className="flex justify-between font-mono text-[11px] text-ink-mute uppercase">
            <span>Detalle</span>
            <span>{clock(order.created_at)}</span>
          </div>
          <hr className="dash-rule my-3" />
          <ul className="space-y-3">
            {order.items.map((it, i) => (
              <li key={i} className="flex gap-3 text-sm">
                <span className="font-mono font-bold">{it.quantity}×</span>
                <div className="flex-1">
                  <p className="font-semibold">{it.product_name}</p>
                  {it.variants.length > 0 && <p className="text-ink-soft">{it.variants.map((v) => v.variant_name).join(' · ')}</p>}
                  {it.comment && <p className="font-mono text-[11px] font-semibold text-ketchup-deep uppercase">“{it.comment}”</p>}
                </div>
              </li>
            ))}
          </ul>
          <hr className="dash-rule my-3" />
          <div className="flex items-end justify-between pb-2">
            <span className="label-mono text-ink-soft">total</span>
            <span className="font-display text-3xl leading-none">{money(order.total)}</span>
          </div>
        </div>
      </section>

      <div className="mt-8 text-center">
        <Link to={`/menu?mesa=${order.table_number}`} className="btn-hard bg-mustard px-6 py-3">
          <ChefHat className="size-5" /> Pedir algo más
        </Link>
      </div>
    </div>
  )
}

function PaymentBanner({ order }: { order: Order }) {
  if (order.status === 'awaiting_payment' || order.status === 'cancelled') return null
  const paid = order.payment_status === 'approved'
  return (
    <div
      className={`mx-4 mt-7 flex items-center gap-3 rounded-2xl border-2 px-4 py-3 ${
        paid ? 'border-pickle bg-pickle-soft/60' : 'border-dashed border-ink/40 bg-paper-2'
      }`}
    >
      {order.payment_method === 'mercadopago' ? <Wallet className="size-5 shrink-0" /> : <Banknote className="size-5 shrink-0" />}
      <p className="text-sm leading-snug">
        {paid ? (
          <><b>Pagado</b> {order.payment_method === 'mercadopago' ? 'con Mercado Pago' : 'en caja'}. ¡Gracias!</>
        ) : (
          <><b>Pendiente de cobro:</b> pagá en caja o pedile el posnet al mozo.</>
        )}
      </p>
    </div>
  )
}

function AwaitingPayment({ token, failed }: { order: Order; token: string; failed: boolean }) {
  const retry = useMutation({
    mutationFn: () => api.startMercadoPago(token),
    onSuccess: ({ init_point }) => {
      if (init_point.startsWith('http')) window.location.href = init_point
      else window.location.assign(init_point)
    },
  })
  return (
    <div className={`mx-4 mt-6 rounded-2xl border-2 p-4 ${failed ? 'border-ketchup bg-ketchup/10' : 'border-ink bg-paper-2'}`}>
      <div className="flex gap-3">
        {failed ? <CircleAlert className="size-5 shrink-0 text-ketchup" /> : <Loader2 className="size-5 shrink-0 animate-spin" />}
        <p className="text-sm leading-snug">
          {failed
            ? 'El pago no se completó. Podés intentarlo de nuevo; tu pedido todavía no pasó a cocina.'
            : 'Apenas Mercado Pago confirme el pago, tu pedido entra a cocina automáticamente. Si ya pagaste, esperá unos segundos.'}
        </p>
      </div>
      <button onClick={() => retry.mutate()} disabled={retry.isPending} className="btn-hard mt-4 w-full bg-[#00b1ea] py-3 text-paper">
        {retry.isPending ? <Loader2 className="size-5 animate-spin" /> : <><Wallet className="size-5" /> Ir a pagar con Mercado Pago</>}
      </button>
    </div>
  )
}

function Center({ children }: { children: React.ReactNode }) {
  return <div className="paper-grain grid min-h-dvh place-items-center p-8 text-center"><div>{children}</div></div>
}
