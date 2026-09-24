import { useState } from 'react'
import { ArrowDown, ArrowUp, Check, Plus, Trash2 } from 'lucide-react'
import { api } from '@/services/api'
import { useCatalogMutation } from '@/hooks/queries'
import { slugify, uid } from '@/lib/format'
import type { Category, Product } from '@/types/domain'
import { Switch } from './Switch'

export function CategoryPanel({ categories, products }: { categories: Category[]; products: Product[] }) {
  const [name, setName] = useState('')
  const [err, setErr] = useState<string | null>(null)
  const save = useCatalogMutation((c: Category) => api.saveCategory(c))
  const del = useCatalogMutation((id: string) => api.deleteCategory(id))

  const sorted = [...categories].sort((a, b) => a.sort_order - b.sort_order)

  function swap(i: number, j: number) {
    const a = sorted[i]
    const b = sorted[j]
    if (!a || !b) return
    save.mutate({ ...a, sort_order: b.sort_order })
    save.mutate({ ...b, sort_order: a.sort_order })
  }

  return (
    <aside className="xl:sticky xl:top-8 xl:self-start">
      <div className="card-hard overflow-hidden">
        <h2 className="border-b-2 border-ink bg-mustard px-5 py-3 font-bold">Categorías</h2>
        <ul className="divide-y-2 divide-dashed divide-ink/10">
          {sorted.map((c, i) => (
            <li key={c.id} className="flex items-center gap-2 px-4 py-2.5">
              <div className="flex flex-col">
                <button aria-label="Subir" disabled={i === 0} onClick={() => swap(i, i - 1)} className="text-ink-mute hover:text-ink disabled:opacity-20">
                  <ArrowUp className="size-3.5" />
                </button>
                <button aria-label="Bajar" disabled={i === sorted.length - 1} onClick={() => swap(i, i + 1)} className="text-ink-mute hover:text-ink disabled:opacity-20">
                  <ArrowDown className="size-3.5" />
                </button>
              </div>
              <div className="min-w-0 flex-1">
                <p className={`truncate font-semibold ${!c.is_active ? 'text-ink-mute' : ''}`}>{c.name}</p>
                <p className="label-mono text-ink-mute">{products.filter((p) => p.category_id === c.id).length} productos</p>
              </div>
              <Switch checked={c.is_active} onChange={(v) => save.mutate({ ...c, is_active: v })} label={`Visible: ${c.name}`} />
              <button
                aria-label={`Eliminar ${c.name}`}
                onClick={() => {
                  setErr(null)
                  if (confirm(`¿Eliminar la categoría "${c.name}"?`)) del.mutate(c.id, { onError: (e) => setErr((e as Error).message) })
                }}
                className="rounded-lg p-1.5 text-ink-mute hover:text-ketchup"
              >
                <Trash2 className="size-4" />
              </button>
            </li>
          ))}
        </ul>
        <form
          onSubmit={(e) => {
            e.preventDefault()
            if (!name.trim()) return
            save.mutate({ id: uid(), name: name.trim(), slug: slugify(name), sort_order: (sorted.at(-1)?.sort_order ?? 0) + 1, is_active: true })
            setName('')
          }}
          className="flex gap-2 border-t-2 border-ink bg-paper-2 p-3"
        >
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Nueva categoría"
            className="min-w-0 flex-1 rounded-lg border-2 border-ink bg-thermal px-3 py-1.5 text-sm focus:outline-none"
          />
          <button aria-label="Agregar categoría" className="btn-hard size-9 bg-ink text-paper !shadow-[2px_2px_0_0_var(--color-ketchup)]">
            {save.isPending ? <Check className="size-4" /> : <Plus className="size-4" strokeWidth={3} />}
          </button>
        </form>
        {err && <p className="px-4 pb-3 text-sm font-semibold text-ketchup">{err}</p>}
      </div>
      <p className="mt-3 px-1 text-[13px] text-ink-mute">
        El orden de las categorías es el de las pestañas del menú del cliente. Una categoría oculta no aparece en el menú.
      </p>
    </aside>
  )
}
