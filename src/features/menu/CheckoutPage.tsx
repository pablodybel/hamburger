import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ArrowLeft, Banknote, Loader2, Minus, Plus, Trash2, Wallet } from 'lucide-react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/services/api'
import { qk } from '@/hooks/queries'
import { useCart, cartTotals } from '@/stores/cartStore'
import { money, tableNo } from '@/lib/format'
import { FoodGlyph } from '@/components/FoodGlyph'
import type { PaymentMethod } from '@/types/domain'

export default function CheckoutPage() {
  const navigate = useNavigate()
  const qc = useQueryClient()
  const { lines, tableNumber, note, setNote, setQty, remove, clear } = useCart()
  const { count, total } = cartTotals(lines)
  const [method, setMethod] = useState<PaymentMethod | null>(null)

  const submit = useMutation({
    mutationFn: async (pm: PaymentMethod) => {
      const res = await api.createOrder({
        table_number: tableNumber!,
        payment_method: pm,
        customer_note: note,
        items: lines.map((l) => ({ product_id: l.product_id, quantity: l.quantity, comment: l.comment, variant_ids: l.variant_ids })),
      })
      if (pm === 'mercadopago') {
        const { init_point } = await api.startMercadoPago(res.public_token)
        return { ...res, redirect: init_point }
      }
      return { ...res, redirect: null as string | null }
    },
    onSuccess: (res) => {
      clear(res.public_token)
      if (res.redirect?.startsWith('http')) window.location.href = res.redirect
      else navigate(res.redirect ?? `/pedido/${res.public_token}`, { replace: true })
    },
    onError: () => qc.invalidateQueries({ queryKey: qk.menu }),
  })

  if (!tableNumber) return null

  if (count === 0)
    return (
      <div className="paper-grain grid min-h-dvh place-items-center p-8 text-center">
        <div>
          <FoodGlyph kind="hamburguesas" className="mx-auto size-28 -rotate-6 opacity-70" />
          <h1 className="mt-4 font-display text-4xl">Tu pedido está vacío</h1>
          <Link to={`/menu?mesa=${tableNumber}`} className="btn-hard mt-6 bg-mustard px-6 py-3">
            Volver al menú
          </Link>
        </div>
      </div>
    )

  return (
    <div className="paper-grain min-h-dvh pb-40">
      <header className="flex items-center gap-3 px-4 pt-5">
        <button onClick={() => navigate(-1)} aria-label="Volver" className="btn-hard size-11 bg-paper !shadow-[2px_2px_0_0_var(--color-ink)]">
          <ArrowLeft className="size-5" />
        </button>
        <div>
          <p className="label-mono text-ink-mute">mesa {tableNo(tableNumber)}</p>
          <h1 className="font-display text-3xl leading-none">Tu pedido</h1>
        </div>
      </header>

      {/* TICKET */}
      <section className="mx-4 mt-6 animate-rise">
        <div className="zigzag-bottom rounded-t-2xl bg-thermal px-5 pt-5 shadow-[0_10px_24px_-12px_rgb(27_21_18/0.45)]">
          <div className="flex items-center justify-between font-mono text-[11px] text-ink-mute uppercase">
            <span>La Plancha · comanda</span>
            <span>{new Date().toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })}</span>
          </div>
          <hr className="dash-rule my-4" />

          <ul className="space-y-5">
            {lines.map((l) => (
              <li key={l.key} className="flex gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline gap-2">
                    <span className="font-bold">{l.name}</span>
                    <span className="ml-auto font-mono text-sm font-extrabold">{money(l.unit_price * l.quantity)}</span>
                  </div>
                  {l.variant_labels.length > 0 && (
                    <p className="mt-0.5 text-[13px] leading-snug text-ink-soft">
                      {l.variant_labels.map((v) => v.name).join(' · ')}
                    </p>
                  )}
                  {l.comment && (
                    <p className="mt-1 inline-block -rotate-1 rounded bg-ketchup/10 px-1.5 font-mono text-[11px] font-semibold text-ketchup-deep uppercase">
                      “{l.comment}”
                    </p>
                  )}
                  <div className="mt-2 flex items-center gap-2">
                    <div className="flex items-center rounded-lg border-2 border-ink/80">
                      <button aria-label="Restar" onClick={() => setQty(l.key, l.quantity - 1)} className="grid size-8 place-items-center">
                        <Minus className="size-3.5" strokeWidth={3} />
                      </button>
                      <span className="w-6 text-center font-mono text-sm font-bold">{l.quantity}</span>
                      <button aria-label="Sumar" onClick={() => setQty(l.key, l.quantity + 1)} className="grid size-8 place-items-center">
                        <Plus className="size-3.5" strokeWidth={3} />
                      </button>
                    </div>
                    <span className="font-mono text-[11px] text-ink-mute">× {money(l.unit_price)}</span>
                    <button aria-label="Quitar" onClick={() => remove(l.key)} className="ml-auto p-1 text-ink-mute hover:text-ketchup">
                      <Trash2 className="size-4" />
                    </button>
                  </div>
                </div>
              </li>
            ))}
          </ul>

          <hr className="dash-rule my-5" />
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            maxLength={280}
            rows={2}
            placeholder="Nota general para el pedido (opcional)"
            className="w-full resize-none rounded-xl border-2 border-dashed border-ink/25 bg-transparent px-3 py-2 text-sm placeholder:text-ink-mute focus:border-ink focus:outline-none"
          />
          <hr className="dash-rule my-5" />
          <div className="flex items-end justify-between pb-2">
            <span className="label-mono text-ink-soft">total</span>
            <span className="font-display text-4xl leading-none">{money(total)}</span>
          </div>
        </div>
      </section>

      {/* PAGO */}
      <section className="mt-9 px-4">
        <h2 className="mb-3 px-1 text-lg font-bold">¿Cómo pagás?</h2>
        <div className="grid gap-3">
          <PayOption
            active={method === 'mercadopago'}
            onClick={() => setMethod('mercadopago')}
            icon={<Wallet className="size-6" />}
            accent="bg-[#00b1ea]"
            title="Mercado Pago"
            desc="Pagás ahora desde el celu. El pedido entra a cocina al confirmarse."
          />
          <PayOption
            active={method === 'counter'}
            onClick={() => setMethod('counter')}
            icon={<Banknote className="size-6" />}
            accent="bg-pickle"
            title="En caja"
            desc="Efectivo, débito o posnet. Pasa a cocina ya y lo pagás antes de irte."
          />
        </div>
        {submit.error && (
          <p className="mt-4 rounded-xl border-2 border-ketchup bg-ketchup/10 px-4 py-3 text-sm font-semibold text-ketchup-deep">
            {(submit.error as Error).message}
          </p>
        )}
      </section>

      <div className="fixed inset-x-0 bottom-0 z-40 border-t-2 border-ink bg-paper px-4 pt-3 pb-[max(1rem,env(safe-area-inset-bottom))]">
        <button
          disabled={!method || submit.isPending}
          onClick={() => method && submit.mutate(method)}
          className="btn-hard h-14 w-full bg-ketchup text-lg text-paper"
        >
          {submit.isPending ? (
            <Loader2 className="size-5 animate-spin" />
          ) : !method ? (
            'Elegí cómo pagar'
          ) : method === 'mercadopago' ? (
            <>Pagar {money(total)} con Mercado Pago</>
          ) : (
            <>Mandar a la plancha · {money(total)}</>
          )}
        </button>
      </div>
    </div>
  )
}

function PayOption(props: { active: boolean; onClick: () => void; icon: React.ReactNode; accent: string; title: string; desc: string }) {
  return (
    <button
      onClick={props.onClick}
      className={`flex items-start gap-4 rounded-2xl border-2 border-ink p-4 text-left transition-all ${
        props.active ? 'translate-x-[-2px] translate-y-[-2px] bg-mustard-soft shadow-[6px_6px_0_0_var(--color-ink)]' : 'bg-paper shadow-[2px_2px_0_0_var(--color-ink)]'
      }`}
    >
      <span className={`grid size-12 shrink-0 place-items-center rounded-xl border-2 border-ink text-paper ${props.accent}`}>{props.icon}</span>
      <span className="flex-1">
        <span className="block text-[17px] font-bold">{props.title}</span>
        <span className="mt-0.5 block text-[13.5px] leading-snug text-ink-soft">{props.desc}</span>
      </span>
      <span className={`mt-1 grid size-6 shrink-0 place-items-center rounded-full border-2 border-ink ${props.active ? 'bg-ink' : ''}`}>
        {props.active && <span className="size-2.5 rounded-full bg-mustard" />}
      </span>
    </button>
  )
}
