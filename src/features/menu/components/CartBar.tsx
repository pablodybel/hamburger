import { ArrowRight } from 'lucide-react'
import { money } from '@/lib/format'

export function CartBar({ count, total, onClick }: { count: number; total: number; onClick: () => void }) {
  return (
    <div className="fixed inset-x-0 bottom-0 z-40 px-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
      <button
        key={count /* re-dispara la animación al agregar */}
        onClick={onClick}
        className="animate-drop flex w-full items-center gap-3 rounded-2xl border-2 border-ink bg-ink py-3 pr-4 pl-3 text-paper"
        style={{ boxShadow: '4px 4px 0 0 var(--color-ketchup)' }}
      >
        <span className="grid size-10 place-items-center rounded-xl bg-mustard font-display text-xl text-ink">{count}</span>
        <span className="text-left">
          <span className="block text-[15px] font-bold">Revisar y enviar pedido</span>
          <span className="label-mono block text-paper/60">{count === 1 ? '1 producto · sin enviar' : `${count} productos · sin enviar`}</span>
        </span>
        <span className="ml-auto font-mono text-base font-extrabold">{money(total)}</span>
        <ArrowRight className="size-5 text-mustard" />
      </button>
    </div>
  )
}
