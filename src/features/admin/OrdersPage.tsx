import { useMemo, useState } from 'react'
import { Banknote, Check, Loader2, Wallet, X } from 'lucide-react'
import { useMarkPaid, useOrdersToday, useTables, useUpdateOrderStatus } from '@/hooks/queries'
import { useNow } from '@/hooks/useNow'
import { clock, elapsed, money, orderNo, tableNo } from '@/lib/format'
import type { Order, OrderStatus } from '@/types/domain'

const STATUS: Record<OrderStatus, { label: string; cls: string }> = {
  awaiting_payment: { label: 'Esperando MP', cls: 'bg-[#cdeefb] text-[#0a5d7a] border-[#0a5d7a]/30' },
  received: { label: 'Recibido', cls: 'bg-mustard-soft border-ink/20' },
  preparing: { label: 'En plancha', cls: 'bg-ketchup text-paper border-ketchup' },
  ready: { label: 'Listo', cls: 'bg-pickle text-paper border-pickle' },
  delivered: { label: 'Entregado', cls: 'bg-paper-2 text-ink-soft border-ink/10' },
  cancelled: { label: 'Cancelado', cls: 'bg-transparent text-ink-mute border-ink/20 line-through' },
}
const ACTIVE: OrderStatus[] = ['awaiting_payment', 'received', 'preparing', 'ready']
type Filter = 'activos' | 'cobrar' | 'todos'

const isUnpaid = (o: Order) => o.payment_method === 'counter' && o.payment_status === 'pending' && o.status !== 'cancelled'

export default function OrdersPage() {
  const { data: orders = [], isLoading } = useOrdersToday()
  const { data: tables = [] } = useTables()
  const markPaid = useMarkPaid()
  const updateStatus = useUpdateOrderStatus()
  const now = useNow(15_000)
  const [filter, setFilter] = useState<Filter>('activos')
  const [tableFilter, setTableFilter] = useState<number | null>(null)

  const stats = useMemo(() => {
    const valid = orders.filter((o) => o.status !== 'cancelled')
    const paid = valid.filter((o) => o.payment_status === 'approved')
    const unpaid = valid.filter(isUnpaid)
    const paidTotal = paid.reduce((s, o) => s + o.total, 0)
    return {
      paidTotal,
      mpTotal: paid.filter((o) => o.payment_method === 'mercadopago').reduce((s, o) => s + o.total, 0),
      unpaidTotal: unpaid.reduce((s, o) => s + o.total, 0),
      unpaid,
      active: valid.filter((o) => ACTIVE.includes(o.status)).length,
      avg: valid.length ? valid.reduce((s, o) => s + o.total, 0) / valid.length : 0,
      count: valid.length,
    }
  }, [orders])

  const byTable = useMemo(() => {
    const m = new Map<number, Order[]>()
    for (const o of orders) {
      if (!ACTIVE.includes(o.status) && !isUnpaid(o)) continue
      m.set(o.table_number, [...(m.get(o.table_number) ?? []), o])
    }
    return m
  }, [orders])

  const feed = orders.filter((o) => {
    if (tableFilter && o.table_number !== tableFilter) return false
    if (filter === 'activos') return ACTIVE.includes(o.status)
    if (filter === 'cobrar') return isUnpaid(o)
    return true
  })

  const today = new Date().toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' })

  return (
    <div className="px-5 py-7 md:px-10 md:py-10">
      <header className="flex flex-wrap items-end gap-4">
        <div>
          <p className="label-mono text-ink-mute">{today}</p>
          <h1 className="font-display text-5xl leading-none">Salón y cobros</h1>
        </div>
      </header>

      {/* KPIs */}
      <section className="mt-8 grid grid-cols-2 gap-4 xl:grid-cols-4">
        <Kpi label="Cobrado hoy" value={money(stats.paidTotal)} sub={`${money(stats.mpTotal)} por Mercado Pago`} tone="ink" />
        <Kpi label="Por cobrar en caja" value={money(stats.unpaidTotal)} sub={`${stats.unpaid.length} pedidos`} tone={stats.unpaid.length ? 'ketchup' : 'paper'} />
        <Kpi label="Pedidos activos" value={String(stats.active)} sub="en curso ahora" tone="mustard" />
        <Kpi label="Ticket promedio" value={money(stats.avg)} sub={`${stats.count} pedidos hoy`} tone="paper" />
      </section>

      <div className="mt-10 grid gap-10 xl:grid-cols-[1fr_380px]">
        <div className="min-w-0">
          {/* Salón */}
          <section>
            <SectionTitle title="Salón" hint="Tocá una mesa para filtrar" />
            <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 lg:grid-cols-6">
              {tables.map((t) => {
                const list = byTable.get(t.number) ?? []
                const main = list.find((o) => ACTIVE.includes(o.status))
                const owes = list.some(isUnpaid)
                const on = tableFilter === t.number
                return (
                  <button
                    key={t.id}
                    onClick={() => setTableFilter(on ? null : t.number)}
                    className={`relative aspect-[1/1.05] rounded-2xl border-2 p-3 text-left transition-all ${
                      main ? 'border-ink ' + tileTone(main.status) : 'border-dashed border-ink/25 bg-transparent'
                    } ${on ? 'shadow-[5px_5px_0_0_var(--color-ink)] -translate-x-0.5 -translate-y-0.5' : ''}`}
                  >
                    <span className="label-mono opacity-60">{t.label ?? 'mesa'}</span>
                    <span className="block font-display text-4xl leading-none">{tableNo(t.number)}</span>
                    <span className="absolute bottom-2.5 left-3 text-[12px] font-bold">
                      {main ? STATUS[main.status].label : owes ? 'Por cobrar' : 'Libre'}
                    </span>
                    {main && (
                      <span className="absolute top-2.5 right-3 font-mono text-[10px] opacity-70">{elapsed(main.created_at, now).minutes}′</span>
                    )}
                    {owes && (
                      <span className="absolute -top-2 -right-2 grid size-7 place-items-center rounded-full border-2 border-ink bg-ketchup font-display text-sm text-paper">$</span>
                    )}
                  </button>
                )
              })}
            </div>
          </section>

          {/* Feed */}
          <section className="mt-10">
            <div className="mb-4 flex flex-wrap items-center gap-2">
              <h2 className="mr-3 text-xl font-bold">Pedidos de hoy</h2>
              {(['activos', 'cobrar', 'todos'] as Filter[]).map((f) => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className={`rounded-full border-2 border-ink px-3.5 py-1 text-sm font-bold capitalize ${filter === f ? 'bg-ink text-paper' : ''}`}
                >
                  {f === 'cobrar' ? 'Por cobrar' : f}
                </button>
              ))}
              {tableFilter && (
                <button onClick={() => setTableFilter(null)} className="flex items-center gap-1 rounded-full bg-mustard px-3 py-1 text-sm font-bold">
                  Mesa {tableNo(tableFilter)} <X className="size-3.5" />
                </button>
              )}
            </div>

            {isLoading ? (
              <Loader2 className="size-6 animate-spin" />
            ) : feed.length === 0 ? (
              <p className="rounded-2xl border-2 border-dashed border-ink/20 p-8 text-center text-ink-mute">No hay pedidos en esta vista.</p>
            ) : (
              <ul className="space-y-3">
                {feed.map((o) => (
                  <OrderRow
                    key={o.id}
                    order={o}
                    onPaid={() => markPaid.mutate(o.id)}
                    paying={markPaid.isPending && markPaid.variables === o.id}
                    onStatus={(s) => updateStatus.mutate({ id: o.id, status: s })}
                  />
                ))}
              </ul>
            )}
          </section>
        </div>

        {/* Caja */}
        <aside className="xl:sticky xl:top-8 xl:self-start">
          <div className="card-hard overflow-hidden">
            <div className="flex items-center gap-2 border-b-2 border-ink bg-ketchup px-5 py-3 text-paper">
              <Banknote className="size-5" />
              <h2 className="font-bold">Caja · por cobrar</h2>
              <span className="ml-auto font-display text-2xl">{stats.unpaid.length}</span>
            </div>
            {stats.unpaid.length === 0 ? (
              <p className="px-5 py-8 text-center text-ink-mute">Todo cobrado. 🍔</p>
            ) : (
              <ul className="max-h-[60vh] divide-y-2 divide-dashed divide-ink/15 overflow-y-auto">
                {stats.unpaid.map((o) => (
                  <li key={o.id} className="flex items-center gap-3 px-5 py-3.5">
                    <div className="grid size-12 shrink-0 place-items-center rounded-xl bg-ink font-display text-xl text-mustard">{tableNo(o.table_number)}</div>
                    <div className="min-w-0 flex-1">
                      <p className="font-mono text-[15px] font-extrabold">{money(o.total)}</p>
                      <p className="text-xs text-ink-mute">
                        {orderNo(o.order_number)} · {clock(o.created_at)}
                      </p>
                    </div>
                    <button
                      onClick={() => markPaid.mutate(o.id)}
                      disabled={markPaid.isPending && markPaid.variables === o.id}
                      className="btn-hard bg-pickle px-3 py-2 text-sm text-paper !shadow-[2px_2px_0_0_var(--color-ink)]"
                    >
                      <Check className="size-4" strokeWidth={3} /> Cobrado
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </aside>
      </div>
    </div>
  )
}

function tileTone(s: OrderStatus) {
  return s === 'preparing' ? 'bg-ketchup text-paper' : s === 'ready' ? 'bg-pickle text-paper' : s === 'awaiting_payment' ? 'bg-[#cdeefb]' : 'bg-mustard'
}

function Kpi({ label, value, sub, tone }: { label: string; value: string; sub: string; tone: 'ink' | 'ketchup' | 'mustard' | 'paper' }) {
  const cls = { ink: 'bg-ink text-paper', ketchup: 'bg-ketchup text-paper', mustard: 'bg-mustard', paper: 'bg-paper' }[tone]
  return (
    <div className={`card-hard p-5 ${cls}`}>
      <p className="label-mono opacity-70">{label}</p>
      <p className="mt-3 font-display text-[2.1rem] leading-none tracking-tight">{value}</p>
      <p className="mt-2 text-[13px] opacity-70">{sub}</p>
    </div>
  )
}

function SectionTitle({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="mb-4 flex items-baseline gap-3">
      <h2 className="text-xl font-bold">{title}</h2>
      {hint && <span className="text-sm text-ink-mute">{hint}</span>}
    </div>
  )
}

function OrderRow({ order: o, onPaid, paying, onStatus }: { order: Order; onPaid: () => void; paying: boolean; onStatus: (s: OrderStatus) => void }) {
  const st = STATUS[o.status]
  return (
    <li className="flex flex-wrap items-center gap-x-5 gap-y-3 rounded-2xl border-2 border-ink bg-thermal px-4 py-3">
      <div className="grid size-12 shrink-0 place-items-center rounded-xl border-2 border-ink font-display text-xl">{tableNo(o.table_number)}</div>
      <div className="min-w-[180px] flex-1">
        <p className="flex items-center gap-2 text-sm">
          <span className="font-mono font-bold">{orderNo(o.order_number)}</span>
          <span className="text-ink-mute">{clock(o.created_at)}</span>
        </p>
        <p className="line-clamp-1 text-[13.5px] text-ink-soft">{o.items.map((i) => `${i.quantity}× ${i.product_name}`).join(', ')}</p>
      </div>
      <span className={`rounded-full border-2 px-3 py-0.5 text-xs font-bold ${st.cls}`}>{st.label}</span>
      <span className="flex items-center gap-1.5 text-xs font-semibold text-ink-soft">
        {o.payment_method === 'mercadopago' ? <Wallet className="size-4" /> : <Banknote className="size-4" />}
        {o.payment_status === 'approved' ? 'Pagado' : o.payment_status === 'rejected' ? 'Rechazado' : 'Pendiente'}
      </span>
      <span className="w-24 text-right font-mono font-extrabold">{money(o.total)}</span>
      <div className="ml-auto flex gap-2">
        {isUnpaid(o) && (
          <button onClick={onPaid} disabled={paying} className="btn-hard bg-pickle px-3 py-1.5 text-sm text-paper !shadow-[2px_2px_0_0_var(--color-ink)]">
            Cobrar
          </button>
        )}
        {o.status === 'ready' && (
          <button onClick={() => onStatus('delivered')} className="btn-hard bg-paper px-3 py-1.5 text-sm !shadow-[2px_2px_0_0_var(--color-ink)]">
            Entregado
          </button>
        )}
        {(o.status === 'awaiting_payment' || o.status === 'received') && (
          <button
            onClick={() => confirm(`¿Cancelar el pedido ${orderNo(o.order_number)}?`) && onStatus('cancelled')}
            className="rounded-lg px-2 py-1.5 text-sm font-semibold text-ink-mute hover:text-ketchup"
          >
            Cancelar
          </button>
        )}
      </div>
    </li>
  )
}
