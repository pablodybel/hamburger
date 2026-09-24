import { useMemo, useState } from 'react'
import { Loader2, Pencil, Plus, Search, Trash2 } from 'lucide-react'
import { api } from '@/services/api'
import { useCatalog, useCatalogMutation } from '@/hooks/queries'
import { money } from '@/lib/format'
import { ProductImage } from '@/components/FoodGlyph'
import type { Product } from '@/types/domain'
import { ProductEditor, emptyProduct } from './components/ProductEditor'
import { CategoryPanel } from './components/CategoryPanel'
import { Switch } from './components/Switch'

export default function MenuManagerPage() {
  const { data, isLoading } = useCatalog()
  const [cat, setCat] = useState<string | 'all'>('all')
  const [q, setQ] = useState('')
  const [editing, setEditing] = useState<Product | null>(null)

  const toggle = useCatalogMutation(({ id, v }: { id: string; v: boolean }) => api.setProductAvailability(id, v))
  const del = useCatalogMutation((id: string) => api.deleteProduct(id))

  const categories = data?.categories ?? []
  const slugOf = useMemo(() => Object.fromEntries(categories.map((c) => [c.id, c.slug])), [categories])
  const catOrder = useMemo(() => Object.fromEntries(categories.map((c) => [c.id, c.sort_order])), [categories])
  const products = (data?.products ?? [])
    .filter((p) => (cat === 'all' || p.category_id === cat) && p.name.toLowerCase().includes(q.trim().toLowerCase()))
    .sort((a, b) => (catOrder[a.category_id] ?? 0) - (catOrder[b.category_id] ?? 0) || a.sort_order - b.sort_order)
  const soldOut = (data?.products ?? []).filter((p) => !p.is_available).length

  return (
    <div className="px-5 py-7 md:px-10 md:py-10">
      <header className="flex flex-wrap items-end gap-4">
        <div>
          <p className="label-mono text-ink-mute">
            {data?.products.length ?? 0} productos · {soldOut} agotados
          </p>
          <h1 className="font-display text-5xl leading-none">Menú</h1>
        </div>
        <button
          onClick={() => setEditing(emptyProduct(cat !== 'all' ? cat : categories[0]?.id ?? ''))}
          disabled={!categories.length}
          className="btn-hard ml-auto bg-ketchup px-5 py-3 text-paper"
        >
          <Plus className="size-5" strokeWidth={3} /> Nuevo producto
        </button>
      </header>

      <div className="mt-8 grid gap-8 xl:grid-cols-[1fr_320px]">
        <section className="min-w-0">
          <div className="mb-5 flex flex-wrap items-center gap-2">
            <label className="relative mr-2 w-full sm:w-64">
              <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-ink-mute" />
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Buscar producto…"
                className="w-full rounded-full border-2 border-ink bg-thermal py-2 pr-4 pl-9 text-sm focus:outline-none"
              />
            </label>
            <Chip on={cat === 'all'} onClick={() => setCat('all')}>
              Todos
            </Chip>
            {categories.map((c) => (
              <Chip key={c.id} on={cat === c.id} onClick={() => setCat(c.id)}>
                {c.name}
              </Chip>
            ))}
          </div>

          {isLoading ? (
            <Loader2 className="size-6 animate-spin" />
          ) : (
            <ul className="overflow-hidden rounded-2xl border-2 border-ink bg-thermal">
              {products.map((p, i) => {
                const cName = categories.find((c) => c.id === p.category_id)?.name
                const nVariants = p.groups.reduce((s, g) => s + g.variants.length, 0)
                return (
                  <li key={p.id} className={`flex items-center gap-4 px-4 py-3 ${i > 0 ? 'border-t-2 border-dashed border-ink/10' : ''}`}>
                    <div className={`size-14 shrink-0 overflow-hidden rounded-xl border-2 border-ink bg-mustard-soft ${!p.is_available ? 'grayscale opacity-60' : ''}`}>
                      <ProductImage src={p.image_url} kind={slugOf[p.category_id]} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className={`truncate font-bold ${!p.is_available ? 'text-ink-mute line-through decoration-2' : ''}`}>{p.name}</p>
                      <p className="truncate text-[13px] text-ink-mute">
                        {cName}
                        {p.groups.length > 0 && ` · ${p.groups.length} grupos, ${nVariants} opciones`}
                      </p>
                    </div>
                    <span className="hidden w-24 text-right font-mono font-extrabold sm:block">{money(p.price)}</span>
                    <div className="flex w-32 items-center justify-end gap-2">
                      <span className={`label-mono ${p.is_available ? 'text-pickle' : 'text-ketchup'}`}>{p.is_available ? 'en stock' : 'agotado'}</span>
                      <Switch checked={p.is_available} onChange={(v) => toggle.mutate({ id: p.id, v })} label={`Disponibilidad de ${p.name}`} />
                    </div>
                    <button onClick={() => setEditing(p)} aria-label={`Editar ${p.name}`} className="rounded-lg p-2 hover:bg-paper-2">
                      <Pencil className="size-4" />
                    </button>
                    <button
                      onClick={() => confirm(`¿Eliminar "${p.name}" del menú?`) && del.mutate(p.id)}
                      aria-label={`Eliminar ${p.name}`}
                      className="rounded-lg p-2 text-ink-mute hover:bg-ketchup/10 hover:text-ketchup"
                    >
                      <Trash2 className="size-4" />
                    </button>
                  </li>
                )
              })}
              {products.length === 0 && <li className="p-8 text-center text-ink-mute">Sin productos.</li>}
            </ul>
          )}
        </section>

        <CategoryPanel categories={categories} products={data?.products ?? []} />
      </div>

      {editing && <ProductEditor initial={editing} categories={categories} onClose={() => setEditing(null)} />}
    </div>
  )
}

function Chip({ on, onClick, children }: { on: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick} className={`rounded-full border-2 border-ink px-3.5 py-1 text-sm font-bold ${on ? 'bg-ink text-paper' : ''}`}>
      {children}
    </button>
  )
}
