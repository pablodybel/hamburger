import { useEffect, useMemo, useState } from 'react'
import { Check, Minus, Plus, X } from 'lucide-react'
import type { Product, VariantGroup } from '@/types/domain'
import { money } from '@/lib/format'
import { useCart } from '@/stores/cartStore'
import { ProductImage } from '@/components/FoodGlyph'

const QUICK_NOTES: Record<string, string[]> = {
  hamburguesas: ['Sin sal', 'Bien cocida', 'Sin cebolla', 'Sin pepinos', 'Pan sin gluten'],
  acompanamientos: ['Sin sal', 'Bien crocantes'],
  bebidas: ['Sin hielo', 'Bien fría'],
  postres: ['Sin azúcar extra'],
}

function initialSelection(groups: VariantGroup[]) {
  const sel: Record<string, string[]> = {}
  for (const g of groups) {
    const available = g.variants.filter((v) => v.is_available)
    const defaults = available.filter((v) => v.is_default).map((v) => v.id)
    sel[g.id] = defaults.length ? defaults.slice(0, g.max_select) : g.min_select > 0 && available[0] ? [available[0].id] : []
  }
  return sel
}

export function ProductSheet({ product, slug, onClose }: { product: Product; slug: string; onClose: () => void }) {
  const add = useCart((s) => s.add)
  const [sel, setSel] = useState(() => initialSelection(product.groups))
  const [qty, setQty] = useState(1)
  const [comment, setComment] = useState('')

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    document.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [onClose])

  const chosen = useMemo(
    () => product.groups.flatMap((g) => g.variants.filter((v) => sel[g.id]?.includes(v.id)).map((v) => ({ g, v }))),
    [product.groups, sel],
  )
  const unit = product.price + chosen.reduce((s, x) => s + x.v.price_delta, 0)
  const missing = product.groups.find((g) => (sel[g.id]?.length ?? 0) < g.min_select)

  function toggle(g: VariantGroup, vid: string) {
    setSel((s) => {
      const cur = s[g.id] ?? []
      if (g.max_select === 1) return { ...s, [g.id]: cur.includes(vid) && g.min_select === 0 ? [] : [vid] }
      if (cur.includes(vid)) return { ...s, [g.id]: cur.filter((x) => x !== vid) }
      if (cur.length >= g.max_select) return s
      return { ...s, [g.id]: [...cur, vid] }
    })
  }

  function addNote(n: string) {
    setComment((c) => {
      if (c.toLowerCase().includes(n.toLowerCase())) return c
      return c ? `${c}, ${n.toLowerCase()}` : n
    })
  }

  function submit() {
    if (missing) return
    add({
      product_id: product.id,
      name: product.name,
      category_slug: slug,
      unit_price: unit,
      quantity: qty,
      comment: comment.trim(),
      variant_ids: chosen.map((x) => x.v.id),
      variant_labels: chosen.map((x) => ({ group: x.g.name, name: x.v.name, delta: x.v.price_delta })),
    })
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center" role="dialog" aria-modal aria-label={product.name}>
      <button aria-label="Cerrar" onClick={onClose} className="absolute inset-0 bg-ink/55 backdrop-blur-[2px]" />

      <div className="animate-sheet relative flex max-h-[92dvh] w-full max-w-lg flex-col overflow-hidden rounded-t-[28px] border-2 border-b-0 border-ink bg-paper">
        {/* Header visual */}
        <div className="relative h-52 shrink-0 overflow-hidden border-b-2 border-ink bg-mustard">
          <div className="halftone absolute inset-0 text-ketchup" />
          <div className="absolute -bottom-8 left-1/2 size-60 -translate-x-1/2">
            <ProductImage src={product.image_url} kind={slug} className="rounded-full" />
          </div>
          <div className="absolute top-3 left-1/2 h-1.5 w-12 -translate-x-1/2 rounded-full bg-ink/30" />
          <button onClick={onClose} className="btn-hard absolute top-4 right-4 size-10 !rounded-full bg-paper !shadow-[2px_2px_0_0_var(--color-ink)]">
            <X className="size-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto overscroll-contain px-5 pt-5 pb-6">
          <h2 className="font-display text-[2.1rem] leading-none">{product.name}</h2>
          {product.description && <p className="mt-2 text-[15px] leading-snug text-ink-soft">{product.description}</p>}
          <p className="mt-2 font-mono text-sm font-extrabold">{money(product.price)}</p>

          {product.groups.map((g) => {
            const count = sel[g.id]?.length ?? 0
            const required = g.min_select > 0
            const hint = g.max_select === 1 ? 'Elegí 1' : `Hasta ${g.max_select}`
            return (
              <fieldset key={g.id} className="mt-7">
                <legend className="flex w-full items-center gap-2">
                  <span className="text-lg font-bold">{g.name}</span>
                  <span className="label-mono text-ink-mute">{hint}</span>
                  <span
                    className={`label-mono ml-auto rounded-full px-2 py-0.5 ${
                      required ? (count >= g.min_select ? 'bg-pickle text-paper' : 'bg-ketchup text-paper') : 'bg-paper-2 text-ink-soft'
                    }`}
                  >
                    {required ? (count >= g.min_select ? 'listo' : 'obligatorio') : 'opcional'}
                  </span>
                </legend>

                <div className="mt-3 overflow-hidden rounded-2xl border-2 border-ink">
                  {g.variants.map((v, i) => {
                    const on = sel[g.id]?.includes(v.id) ?? false
                    const blocked = !v.is_available || (!on && g.max_select > 1 && count >= g.max_select)
                    return (
                      <button
                        key={v.id}
                        type="button"
                        disabled={blocked}
                        onClick={() => toggle(g, v.id)}
                        className={`flex w-full items-center gap-3 px-4 py-3.5 text-left transition-colors ${i > 0 ? 'border-t-2 border-ink/10' : ''} ${
                          on ? 'bg-mustard-soft' : 'bg-paper'
                        } ${blocked ? 'opacity-40' : ''}`}
                      >
                        <span
                          className={`grid size-6 shrink-0 place-items-center border-2 border-ink transition-colors ${
                            g.max_select === 1 ? 'rounded-full' : 'rounded-md'
                          } ${on ? 'bg-ink text-mustard' : 'bg-paper'}`}
                        >
                          {on && (g.max_select === 1 ? <span className="size-2.5 rounded-full bg-mustard" /> : <Check className="size-4" strokeWidth={3.5} />)}
                        </span>
                        <span className="font-semibold">{v.name}</span>
                        {!v.is_available && <span className="label-mono text-ketchup">agotado</span>}
                        {v.price_delta > 0 && <span className="ml-auto font-mono text-[13px] font-semibold">+{money(v.price_delta)}</span>}
                      </button>
                    )
                  })}
                </div>
              </fieldset>
            )
          })}

          <div className="mt-7">
            <label htmlFor="item-comment" className="text-lg font-bold">
              ¿Algo para la cocina?
            </label>
            <div className="no-scrollbar -mx-5 mt-3 flex gap-2 overflow-x-auto px-5">
              {(QUICK_NOTES[slug] ?? []).map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => addNote(n)}
                  className="shrink-0 rounded-full border-2 border-dashed border-ink/40 px-3 py-1 text-sm font-semibold text-ink-soft active:border-solid active:border-ink"
                >
                  + {n}
                </button>
              ))}
            </div>
            <textarea
              id="item-comment"
              value={comment}
              maxLength={140}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Ej: sin sal, bien cocida…"
              rows={2}
              className="mt-3 w-full resize-none rounded-2xl border-2 border-ink bg-thermal px-4 py-3 text-[15px] placeholder:text-ink-mute focus:outline-none focus-visible:ring-4 focus-visible:ring-mustard/60"
            />
            <p className="label-mono mt-1 text-right text-ink-mute">{comment.length}/140</p>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center gap-3 border-t-2 border-ink bg-paper-2 px-4 pt-3 pb-[max(0.9rem,env(safe-area-inset-bottom))]">
          <div className="flex items-center rounded-xl border-2 border-ink bg-paper">
            <button aria-label="Restar" onClick={() => setQty((q) => Math.max(1, q - 1))} className="grid size-11 place-items-center">
              <Minus className="size-4" strokeWidth={3} />
            </button>
            <span className="w-7 text-center font-display text-xl">{qty}</span>
            <button aria-label="Sumar" onClick={() => setQty((q) => Math.min(50, q + 1))} className="grid size-11 place-items-center">
              <Plus className="size-4" strokeWidth={3} />
            </button>
          </div>
          <button onClick={submit} disabled={!!missing} className="btn-hard h-[52px] flex-1 bg-ketchup px-4 text-paper">
            {missing ? (
              <span className="text-sm">Elegí {missing.name.toLowerCase()}</span>
            ) : (
              <>
                <span>Agregar</span>
                <span className="font-mono text-sm font-extrabold">{money(unit * qty)}</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
