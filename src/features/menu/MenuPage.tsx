import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { QrCode, ReceiptText } from 'lucide-react'
import { useMenu } from '@/hooks/queries'
import { useCart, cartTotals } from '@/stores/cartStore'
import { money, tableNo } from '@/lib/format'
import { Wordmark, DemoBadge } from '@/components/Brand'
import { ProductImage } from '@/components/FoodGlyph'
import type { Product } from '@/types/domain'
import { ProductSheet } from './components/ProductSheet'
import { CartBar } from './components/CartBar'

export default function MenuPage() {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const { tableNumber, setTable, lines, lastOrderToken } = useCart()
  const { data: menu, isLoading, error } = useMenu()
  const [selected, setSelected] = useState<{ product: Product; slug: string } | null>(null)
  const [activeCat, setActiveCat] = useState<string | null>(null)
  const sectionRefs = useRef<Record<string, HTMLElement | null>>({})
  const tabsRef = useRef<HTMLDivElement>(null)

  const mesaParam = Number(params.get('mesa'))
  useEffect(() => {
    if (Number.isInteger(mesaParam) && mesaParam > 0) setTable(mesaParam)
  }, [mesaParam, setTable])

  // Scroll-spy de categorías
  useEffect(() => {
    if (!menu) return
    const io = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)
        if (visible[0]) setActiveCat(visible[0].target.id)
      },
      { rootMargin: '-120px 0px -60% 0px' },
    )
    Object.values(sectionRefs.current).forEach((el) => el && io.observe(el))
    return () => io.disconnect()
  }, [menu])

  useEffect(() => {
    tabsRef.current?.querySelector(`[data-cat="${activeCat}"]`)?.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' })
  }, [activeCat])

  const { count, total } = cartTotals(lines)
  const categories = useMemo(() => menu?.filter((c) => c.products.length > 0) ?? [], [menu])

  if (!tableNumber) return <NoTable />

  return (
    <div className="paper-grain min-h-dvh pb-32">
      <div className="checker" />

      {/* HERO */}
      <header className="relative overflow-hidden px-5 pt-7 pb-8">
        <div className="halftone absolute -top-10 -right-16 size-64 rounded-full text-mustard" />
        <div className="relative flex items-start justify-between">
          <div className="animate-rise">
            <p className="label-mono text-ink-soft">smash burgers · a la plancha</p>
            <Wordmark className="mt-3 block text-[3.4rem]" />
          </div>
          <div
            className="animate-wobble grid size-[88px] shrink-0 place-items-center rounded-full border-[3px] border-ink bg-mustard text-center"
            style={{ boxShadow: 'var(--shadow-hard)' }}
          >
            <div>
              <div className="label-mono !text-[9px] !tracking-[0.2em]">mesa</div>
              <div className="font-display text-4xl leading-none">{tableNo(tableNumber)}</div>
            </div>
          </div>
        </div>
        <div className="relative mt-5 flex items-center gap-3">
          <p className="max-w-[26ch] text-[15px] leading-snug text-ink-soft">
            Pedí desde acá. Lo mandamos directo a la plancha y te avisamos cuando esté.
          </p>
          <DemoBadge className="ml-auto shrink-0 text-ketchup" />
        </div>
        {lastOrderToken && (
          <button
            onClick={() => navigate(`/pedido/${lastOrderToken}`)}
            className="btn-hard relative mt-5 w-full bg-paper px-4 py-3 text-sm"
          >
            <ReceiptText className="size-4" /> Ver el estado de mi último pedido
          </button>
        )}
      </header>

      {/* TABS */}
      <nav className="sticky top-0 z-30 border-y-2 border-ink bg-paper/95 backdrop-blur">
        <div ref={tabsRef} className="no-scrollbar flex gap-2 overflow-x-auto px-4 py-3">
          {categories.map((c, i) => {
            const on = activeCat === c.slug
            return (
              <button
                key={c.id}
                data-cat={c.slug}
                onClick={() => sectionRefs.current[c.slug]?.scrollIntoView({ behavior: 'smooth' })}
                className={`flex shrink-0 items-baseline gap-1.5 rounded-full border-2 border-ink px-4 py-1.5 text-sm font-bold transition-colors ${
                  on ? 'bg-ink text-paper' : 'bg-paper text-ink'
                }`}
              >
                <span className={`font-mono text-[10px] ${on ? 'text-mustard' : 'text-ink-mute'}`}>{String(i + 1).padStart(2, '0')}</span>
                {c.name}
              </button>
            )
          })}
        </div>
      </nav>

      {isLoading && <MenuSkeleton />}
      {error && <p className="p-6 text-ketchup">No pudimos cargar el menú. Probá de nuevo en un momento.</p>}

      {/* SECCIONES */}
      <main className="px-4">
        {categories.map((c, ci) => (
          <section
            key={c.id}
            id={c.slug}
            ref={(el) => {
              sectionRefs.current[c.slug] = el
            }}
            className="scroll-mt-20 pt-9"
          >
            <div className="mb-4 flex items-end gap-3 px-1">
              <h2 className="font-display text-[2rem] leading-none">{c.name}</h2>
              <span className="mb-1 h-[2px] flex-1 bg-ink/15" />
              <span className="label-mono mb-1 text-ink-mute">{String(ci + 1).padStart(2, '0')}</span>
            </div>

            <ul className="space-y-4">
              {c.products.map((p, i) => (
                <li key={p.id} className="animate-rise" style={{ animationDelay: `${Math.min(i, 6) * 60}ms` }}>
                  <ProductRow product={p} slug={c.slug} onOpen={() => setSelected({ product: p, slug: c.slug })} />
                </li>
              ))}
            </ul>
          </section>
        ))}

        <footer className="mt-14 mb-6 text-center">
          <div className="checker-ink mx-auto h-2.5 w-24 rounded-full" />
          <p className="label-mono mt-4 text-ink-mute">precios finales en pesos · iva incluido</p>
        </footer>
      </main>

      {count > 0 && <CartBar count={count} total={total} onClick={() => navigate('/menu/pedido')} />}

      {selected && <ProductSheet product={selected.product} slug={selected.slug} onClose={() => setSelected(null)} />}
    </div>
  )
}

function ProductRow({ product: p, slug, onOpen }: { product: Product; slug: string; onOpen: () => void }) {
  const soldOut = !p.is_available
  const hasOptions = p.groups.length > 0
  return (
    <button
      disabled={soldOut}
      onClick={onOpen}
      className={`card-hard group relative flex w-full items-stretch gap-4 p-3 text-left transition-transform active:translate-x-[3px] active:translate-y-[3px] active:shadow-none ${
        soldOut ? 'cursor-not-allowed' : ''
      }`}
    >
      <div className={`flex min-w-0 flex-1 flex-col py-1 pl-1 ${soldOut ? 'opacity-45' : ''}`}>
        <h3 className="text-[19px] leading-tight font-bold">{p.name}</h3>
        {p.description && <p className="mt-1 line-clamp-2 text-[13.5px] leading-snug text-ink-soft">{p.description}</p>}
        <div className="mt-auto flex items-center gap-2 pt-3">
          <span className="font-mono text-[15px] font-extrabold">{money(p.price)}</span>
          {hasOptions && <span className="label-mono rounded-full bg-paper-2 px-2 py-0.5 text-ink-soft">personalizable</span>}
        </div>
      </div>

      <div
        className={`relative aspect-square w-[108px] shrink-0 overflow-hidden rounded-xl border-2 border-ink ${
          soldOut ? 'bg-paper-2 grayscale' : slug === 'bebidas' ? 'bg-pickle-soft' : slug === 'postres' ? 'bg-[#f7c9bf]' : 'bg-mustard-soft'
        }`}
      >
        <div className="halftone absolute inset-0 text-ink/40" />
        <ProductImage src={p.image_url} kind={slug} className="relative transition-transform duration-300 group-hover:scale-105 group-hover:-rotate-3" />
        {!soldOut && (
          <span className="absolute right-1.5 bottom-1.5 grid size-8 place-items-center rounded-full border-2 border-ink bg-ketchup font-display text-xl leading-none text-paper">
            +
          </span>
        )}
      </div>

      {soldOut && (
        <span className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 -rotate-6 rounded-md border-[3px] border-ketchup bg-paper/90 px-3 py-1 font-display text-2xl tracking-wide text-ketchup">
          AGOTADO
        </span>
      )}
    </button>
  )
}

function MenuSkeleton() {
  return (
    <div className="space-y-4 px-4 pt-9">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="h-[132px] animate-pulse rounded-2xl border-2 border-ink/10 bg-paper-2" />
      ))}
    </div>
  )
}

function NoTable() {
  return (
    <div className="paper-grain grid min-h-dvh place-items-center p-8 text-center">
      <div className="max-w-xs">
        <div className="card-hard mx-auto mb-6 grid size-28 -rotate-6 place-items-center bg-mustard">
          <QrCode className="size-14" strokeWidth={1.6} />
        </div>
        <Wordmark className="text-5xl" />
        <p className="mt-4 text-ink-soft">Escaneá el código QR de tu mesa para ver el menú y hacer tu pedido.</p>
      </div>
    </div>
  )
}
