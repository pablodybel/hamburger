import { useEffect, useRef, useState } from 'react'
import { ImagePlus, Loader2, Plus, Trash2, X } from 'lucide-react'
import { api } from '@/services/api'
import { useCatalogMutation } from '@/hooks/queries'
import { uid } from '@/lib/format'
import { ProductImage } from '@/components/FoodGlyph'
import type { Category, Product, Variant, VariantGroup } from '@/types/domain'
import { Switch } from './Switch'

export const emptyProduct = (category_id: string): Product => ({
  id: uid(), category_id, name: '', description: '', price: 0, image_url: null,
  is_available: true, is_active: true, sort_order: 999, groups: [],
})

const newVariant = (sort_order: number): Variant => ({ id: uid(), name: '', price_delta: 0, is_default: false, is_available: true, sort_order })
const newGroup = (sort_order: number): VariantGroup => ({ id: uid(), name: '', min_select: 0, max_select: 1, sort_order, variants: [newVariant(1)] })

const input = 'w-full rounded-xl border-2 border-ink bg-thermal px-3.5 py-2.5 focus:outline-none focus-visible:ring-4 focus-visible:ring-mustard/50'

export function ProductEditor({ initial, categories, onClose }: { initial: Product; categories: Category[]; onClose: () => void }) {
  const [p, setP] = useState<Product>(() => structuredClone(initial))
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const save = useCatalogMutation((prod: Product) => api.saveProduct(prod))
  const isNew = !initial.name

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  const set = <K extends keyof Product>(k: K, v: Product[K]) => setP((x) => ({ ...x, [k]: v }))
  const setGroup = (gid: string, patch: Partial<VariantGroup>) =>
    setP((x) => ({ ...x, groups: x.groups.map((g) => (g.id === gid ? { ...g, ...patch } : g)) }))
  const setVariant = (gid: string, vid: string, patch: Partial<Variant>) =>
    setP((x) => ({
      ...x,
      groups: x.groups.map((g) => (g.id === gid ? { ...g, variants: g.variants.map((v) => (v.id === vid ? { ...v, ...patch } : v)) } : g)),
    }))

  async function onFile(f: File | undefined) {
    if (!f) return
    if (f.size > 3 * 1024 * 1024) return setError('La imagen no puede superar 3 MB')
    setUploading(true)
    try {
      set('image_url', await api.uploadProductImage(f))
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setUploading(false)
    }
  }

  function validate(): string | null {
    if (!p.name.trim()) return 'El producto necesita un nombre'
    if (!(p.price >= 0)) return 'Precio inválido'
    for (const g of p.groups) {
      if (!g.name.trim()) return 'Todos los grupos necesitan nombre'
      if (!g.variants.length) return `El grupo "${g.name}" no tiene opciones`
      if (g.variants.some((v) => !v.name.trim())) return `Hay opciones sin nombre en "${g.name}"`
      if (g.min_select > g.max_select) return `En "${g.name}" el mínimo supera al máximo`
      if (g.max_select > g.variants.length) return `En "${g.name}" el máximo supera la cantidad de opciones`
    }
    return null
  }

  function submit(e: React.FormEvent) {
    e.preventDefault()
    const err = validate()
    if (err) return setError(err)
    setError(null)
    const clean: Product = {
      ...p,
      name: p.name.trim(),
      groups: p.groups.map((g, gi) => ({ ...g, sort_order: gi + 1, variants: g.variants.map((v, vi) => ({ ...v, sort_order: vi + 1 })) })),
    }
    save.mutate(clean, { onSuccess: onClose, onError: (e) => setError((e as Error).message) })
  }

  const slug = categories.find((c) => c.id === p.category_id)?.slug ?? 'hamburguesas'

  return (
    <div className="fixed inset-0 z-50 flex justify-end" role="dialog" aria-modal aria-label="Editar producto">
      <button aria-label="Cerrar" onClick={onClose} className="absolute inset-0 bg-ink/50 backdrop-blur-[2px]" />
      <form onSubmit={submit} className="relative flex h-full w-full max-w-2xl animate-[rise_.3s_ease-out] flex-col border-l-2 border-ink bg-paper">
        <header className="flex items-center gap-3 border-b-2 border-ink px-6 py-4">
          <h2 className="font-display text-3xl leading-none">{isNew ? 'Nuevo producto' : 'Editar producto'}</h2>
          <button type="button" onClick={onClose} aria-label="Cerrar" className="ml-auto rounded-lg p-2 hover:bg-paper-2">
            <X className="size-5" />
          </button>
        </header>

        <div className="flex-1 space-y-8 overflow-y-auto px-6 py-6">
          {/* Básicos */}
          <section className="grid gap-5 sm:grid-cols-[160px_1fr]">
            <div>
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                className="group relative aspect-square w-full overflow-hidden rounded-2xl border-2 border-ink bg-mustard-soft"
              >
                <ProductImage src={p.image_url} kind={slug} />
                <span className="absolute inset-0 grid place-items-center bg-ink/60 text-paper opacity-0 transition-opacity group-hover:opacity-100">
                  {uploading ? <Loader2 className="size-6 animate-spin" /> : <ImagePlus className="size-7" />}
                </span>
              </button>
              <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp" hidden onChange={(e) => onFile(e.target.files?.[0])} />
              {p.image_url && (
                <button type="button" onClick={() => set('image_url', null)} className="mt-2 w-full text-center text-xs text-ink-mute hover:text-ketchup">
                  Quitar foto
                </button>
              )}
            </div>
            <div className="space-y-4">
              <Field label="Nombre">
                <input className={input} value={p.name} onChange={(e) => set('name', e.target.value)} placeholder="La Clásica" autoFocus />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Categoría">
                  <select className={input} value={p.category_id} onChange={(e) => set('category_id', e.target.value)}>
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Precio base ($)">
                  <input className={`${input} font-mono`} type="number" min={0} step={50} value={p.price} onChange={(e) => set('price', Number(e.target.value))} />
                </Field>
              </div>
            </div>
          </section>

          <Field label="Descripción">
            <textarea className={`${input} resize-none`} rows={2} value={p.description ?? ''} onChange={(e) => set('description', e.target.value)} />
          </Field>

          <div className="flex items-center gap-3 rounded-2xl border-2 border-dashed border-ink/25 px-4 py-3">
            <Switch checked={p.is_available} onChange={(v) => set('is_available', v)} label="Disponible" />
            <div>
              <p className="font-semibold">{p.is_available ? 'Disponible' : 'Agotado'}</p>
              <p className="text-[13px] text-ink-mute">Si está agotado se muestra en el menú pero no se puede pedir.</p>
            </div>
          </div>

          {/* Variantes */}
          <section>
            <div className="mb-3 flex items-end">
              <div>
                <h3 className="text-xl font-bold">Variantes y modificadores</h3>
                <p className="text-[13px] text-ink-mute">Ej: Medallón (elegí 1), Aderezos (hasta 3), Combo (opcional).</p>
              </div>
            </div>

            <div className="space-y-4">
              {p.groups.map((g) => (
                <div key={g.id} className="overflow-hidden rounded-2xl border-2 border-ink bg-thermal">
                  <div className="flex flex-wrap items-center gap-2 border-b-2 border-ink bg-paper-2 px-3 py-2.5">
                    <input
                      className="min-w-0 flex-1 rounded-lg border-2 border-transparent bg-transparent px-2 py-1 font-bold focus:border-ink focus:bg-thermal focus:outline-none"
                      value={g.name}
                      placeholder="Nombre del grupo"
                      onChange={(e) => setGroup(g.id, { name: e.target.value })}
                    />
                    <MiniNum label="mín" value={g.min_select} onChange={(v) => setGroup(g.id, { min_select: v })} />
                    <MiniNum label="máx" value={g.max_select} min={1} onChange={(v) => setGroup(g.id, { max_select: v })} />
                    <button
                      type="button"
                      aria-label="Eliminar grupo"
                      onClick={() => setP((x) => ({ ...x, groups: x.groups.filter((y) => y.id !== g.id) }))}
                      className="rounded-lg p-1.5 text-ink-mute hover:text-ketchup"
                    >
                      <Trash2 className="size-4" />
                    </button>
                  </div>
                  <ul>
                    {g.variants.map((v) => (
                      <li key={v.id} className="flex items-center gap-2 border-b border-dashed border-ink/15 px-3 py-2">
                        <input
                          className="min-w-0 flex-1 rounded-lg border-2 border-ink/15 bg-paper px-2.5 py-1.5 text-sm focus:border-ink focus:outline-none"
                          value={v.name}
                          placeholder="Opción"
                          onChange={(e) => setVariant(g.id, v.id, { name: e.target.value })}
                        />
                        <label className="flex items-center gap-1 rounded-lg border-2 border-ink/15 bg-paper px-2 font-mono text-sm">
                          +$
                          <input
                            type="number"
                            step={50}
                            className="w-20 bg-transparent py-1.5 focus:outline-none"
                            value={v.price_delta}
                            onChange={(e) => setVariant(g.id, v.id, { price_delta: Number(e.target.value) })}
                          />
                        </label>
                        <label className="label-mono flex cursor-pointer items-center gap-1 text-ink-soft" title="Viene seleccionada por defecto">
                          <input type="checkbox" checked={v.is_default} onChange={(e) => setVariant(g.id, v.id, { is_default: e.target.checked })} className="accent-ink" />
                          def
                        </label>
                        <Switch checked={v.is_available} onChange={(val) => setVariant(g.id, v.id, { is_available: val })} label="Opción disponible" />
                        <button
                          type="button"
                          aria-label="Eliminar opción"
                          onClick={() => setGroup(g.id, { variants: g.variants.filter((x) => x.id !== v.id) })}
                          className="rounded-lg p-1 text-ink-mute hover:text-ketchup"
                        >
                          <X className="size-4" />
                        </button>
                      </li>
                    ))}
                  </ul>
                  <button
                    type="button"
                    onClick={() => setGroup(g.id, { variants: [...g.variants, newVariant(g.variants.length + 1)] })}
                    className="flex w-full items-center gap-1.5 px-4 py-2.5 text-sm font-semibold text-ink-soft hover:bg-paper-2"
                  >
                    <Plus className="size-4" /> Agregar opción
                  </button>
                </div>
              ))}
            </div>

            <button
              type="button"
              onClick={() => setP((x) => ({ ...x, groups: [...x.groups, newGroup(x.groups.length + 1)] }))}
              className="mt-4 flex w-full items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-ink/40 py-3.5 font-semibold text-ink-soft hover:border-ink hover:text-ink"
            >
              <Plus className="size-5" /> Agregar grupo de variantes
            </button>
          </section>
        </div>

        <footer className="flex items-center gap-3 border-t-2 border-ink bg-paper-2 px-6 py-4">
          {error && <p className="text-sm font-semibold text-ketchup">{error}</p>}
          <button type="button" onClick={onClose} className="ml-auto rounded-xl px-4 py-2.5 font-semibold text-ink-soft hover:bg-paper-3">
            Cancelar
          </button>
          <button disabled={save.isPending || uploading} className="btn-hard bg-ketchup px-6 py-2.5 text-paper">
            {save.isPending ? <Loader2 className="size-5 animate-spin" /> : 'Guardar'}
          </button>
        </footer>
      </form>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="label-mono mb-1.5 block text-ink-soft">{label}</span>
      {children}
    </label>
  )
}

function MiniNum({ label, value, onChange, min = 0 }: { label: string; value: number; onChange: (v: number) => void; min?: number }) {
  return (
    <label className="label-mono flex items-center gap-1 rounded-lg border-2 border-ink/20 bg-thermal pl-2 text-ink-soft">
      {label}
      <input
        type="number"
        min={min}
        max={20}
        value={value}
        onChange={(e) => onChange(Math.max(min, Number(e.target.value)))}
        className="w-11 bg-transparent py-1 font-mono text-sm text-ink focus:outline-none"
      />
    </label>
  )
}
