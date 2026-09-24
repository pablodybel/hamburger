import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Bell, BellOff, Expand, LogOut, Wifi } from 'lucide-react'
import { useQueryClient } from '@tanstack/react-query'
import { useKitchenOrders, useUpdateOrderStatus, qk } from '@/hooks/queries'
import { useNow } from '@/hooks/useNow'
import { unlockAudio, playNewOrderChime } from '@/lib/sound'
import { tableNo } from '@/lib/format'
import { api } from '@/services/api'
import { DemoBadge } from '@/components/Brand'
import { Ticket } from './components/Ticket'
import { useNewOrderAlert } from './useNewOrderAlert'

export default function KitchenPage() {
  const qc = useQueryClient()
  const { data: orders, isLoading, isError } = useKitchenOrders()
  const update = useUpdateOrderStatus()
  const now = useNow(1000)
  const [armed, setArmed] = useState(false)
  const [soundOn, setSoundOn] = useState(true)
  const flash = useNewOrderAlert(orders, armed && soundOn)

  const queue = orders?.filter((o) => o.status === 'received' || o.status === 'preparing') ?? []
  const ready = orders?.filter((o) => o.status === 'ready') ?? []
  const nNew = queue.filter((o) => o.status === 'received').length
  const nPrep = queue.length - nNew

  function arm() {
    unlockAudio()
    playNewOrderChime()
    setArmed(true)
    document.documentElement.requestFullscreen?.().catch(() => {})
  }

  const move = (id: string) => (to: Parameters<typeof update.mutate>[0]['status']) => update.mutate({ id, status: to })

  return (
    <div className="brushed-steel flex h-dvh flex-col overflow-hidden font-kds text-thermal">
      {/* Barra superior */}
      <header className="flex shrink-0 items-center gap-6 border-b border-white/10 px-6 py-3">
        <div className="flex items-baseline gap-3">
          <span className="font-display text-2xl text-mustard">La Plancha.</span>
          <span className="text-xl font-bold tracking-[0.35em] text-thermal/50 uppercase">Cocina</span>
        </div>
        <DemoBadge className="text-mustard/70" />

        <div className="ml-6 flex items-center gap-5 text-2xl font-bold uppercase">
          <Counter n={nNew} label="Nuevos" dot="bg-mustard" />
          <Counter n={nPrep} label="En plancha" dot="bg-ketchup" />
          <Counter n={ready.length} label="Al pase" dot="bg-pickle" />
        </div>

        <div className="ml-auto flex items-center gap-2">
          <span className={`flex items-center gap-1.5 text-sm tracking-widest uppercase ${isError ? 'text-ketchup' : 'text-thermal/40'}`}>
            <Wifi className="size-4" /> {isError ? 'sin conexión' : 'en vivo'}
          </span>
          <span className="ml-3 font-mono text-3xl font-extrabold tabular-nums">
            {new Date(now).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })}
          </span>
          <IconBtn label={soundOn ? 'Silenciar' : 'Activar sonido'} onClick={() => setSoundOn((s) => !s)}>
            {soundOn ? <Bell className="size-5" /> : <BellOff className="size-5 text-ketchup" />}
          </IconBtn>
          <IconBtn label="Pantalla completa" onClick={() => document.documentElement.requestFullscreen?.().catch(() => {})}>
            <Expand className="size-5" />
          </IconBtn>
          <IconBtn
            label="Salir"
            onClick={async () => {
              await api.signOut()
              qc.setQueryData(qk.session, null)
            }}
          >
            <LogOut className="size-5" />
          </IconBtn>
        </div>
      </header>

      <div className="rail h-3 shrink-0" />

      <div className="flex min-h-0 flex-1">
        {/* Cola principal */}
        <main className="min-w-0 flex-1 overflow-y-auto px-6 pt-1 pb-10">
          {isLoading ? null : queue.length === 0 ? (
            <div className="grid h-full place-items-center text-center">
              <div>
                <p className="font-display text-6xl text-thermal/15">Plancha libre</p>
                <p className="mt-3 text-xl tracking-[0.3em] text-thermal/30 uppercase">Esperando comandas…</p>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-[repeat(auto-fill,minmax(310px,1fr))] items-start gap-x-6 gap-y-8">
              {queue.map((o, i) => (
                <Ticket
                  key={o.id}
                  order={o}
                  now={now}
                  index={i}
                  busy={update.isPending && update.variables?.id === o.id}
                  onAdvance={move(o.id)}
                  onBack={move(o.id)}
                />
              ))}
            </div>
          )}
        </main>

        {/* Pase: listos para servir */}
        <aside className="flex w-[330px] shrink-0 flex-col border-l border-white/10 bg-black/35">
          <h2 className="flex items-center gap-2 px-5 pt-4 pb-2 text-lg font-bold tracking-[0.3em] text-pickle-soft uppercase">
            <span className="size-2.5 rounded-full bg-pickle" /> Pase · listos
          </h2>
          <div className="flex-1 space-y-6 overflow-y-auto px-4 pb-8">
            {ready.length === 0 && <p className="px-1 pt-4 text-lg text-thermal/25">Nada esperando en el pase.</p>}
            {ready.map((o) => (
              <Ticket key={o.id} order={o} now={now} compact busy={update.isPending && update.variables?.id === o.id} onAdvance={move(o.id)} onBack={move(o.id)} />
            ))}
          </div>
        </aside>
      </div>

      {/* Flash de nuevo pedido */}
      {flash && (
        <div className="pointer-events-none fixed inset-0 z-50 grid place-items-center bg-mustard/90">
          <div className="animate-drop text-center text-grill">
            <p className="text-4xl font-extrabold tracking-[0.5em] uppercase">Nueva comanda</p>
            <p className="font-kds text-[14rem] leading-[0.85] font-extrabold">MESA {tableNo(flash.table_number)}</p>
            <p className="text-3xl font-bold uppercase">
              {flash.items.reduce((s, i) => s + i.quantity, 0)} ítems
            </p>
          </div>
        </div>
      )}

      {/* Activación (necesaria para sonido por políticas del navegador) */}
      {!armed && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-grill/92 backdrop-blur-sm">
          <div className="text-center">
            <p className="text-xl tracking-[0.4em] text-thermal/50 uppercase">Pantalla de cocina</p>
            <button
              onClick={arm}
              className="mt-6 rounded-2xl bg-mustard px-14 py-8 font-kds text-5xl font-extrabold tracking-wider text-grill uppercase shadow-[0_0_0_6px_rgb(242_169_0/0.25),0_20px_60px_-10px_rgb(242_169_0/0.5)] transition-transform active:scale-95"
            >
              Abrir cocina
            </button>
            <p className="mt-6 text-lg text-thermal/40">Activa el timbre de pedidos nuevos y la pantalla completa.</p>
            <Link to="/" className="mt-2 inline-block text-sm tracking-widest text-thermal/30 uppercase underline">volver</Link>
          </div>
        </div>
      )}
    </div>
  )
}

function Counter({ n, label, dot }: { n: number; label: string; dot: string }) {
  return (
    <span className="flex items-center gap-2">
      <span className={`size-3 rounded-full ${dot}`} />
      <span className="tabular-nums">{n}</span>
      <span className="text-base tracking-[0.2em] text-thermal/45">{label}</span>
    </span>
  )
}

function IconBtn({ children, label, onClick }: { children: React.ReactNode; label: string; onClick: () => void }) {
  return (
    <button aria-label={label} title={label} onClick={onClick} className="grid size-11 place-items-center rounded-lg border border-white/10 text-thermal/70 hover:bg-white/5">
      {children}
    </button>
  )
}
