import { Link } from 'react-router-dom'
import { ArrowUpRight, ChefHat, LayoutDashboard, RotateCcw, Smartphone } from 'lucide-react'
import { IS_DEMO } from '@/lib/supabase'
import { demoReset } from '@/services/demoApi'
import { Wordmark, DemoBadge } from '@/components/Brand'
import { FoodGlyph } from '@/components/FoodGlyph'

const DOORS = [
  { to: '/menu?mesa=4', icon: Smartphone, tag: 'cliente', title: 'Menú · Mesa 04', desc: 'Lo que abre el QR. Abrilo en el celu o con la vista móvil.', cls: 'bg-mustard' },
  { to: '/kitchen', icon: ChefHat, tag: 'cocina', title: 'Pantalla KDS', desc: 'Comandas en vivo con timbre. Pensada para un monitor.', cls: 'bg-ink text-paper' },
  { to: '/admin', icon: LayoutDashboard, tag: 'caja', title: 'Administración', desc: 'Salón, cobros y el ABM completo del menú.', cls: 'bg-ketchup text-paper' },
]

export default function HomePage() {
  return (
    <div className="paper-grain min-h-dvh">
      <div className="checker" />
      <div className="mx-auto max-w-5xl px-6 py-14">
        <div className="flex items-start gap-6">
          <div>
            <DemoBadge className="text-ketchup" />
            <Wordmark className="mt-4 block text-7xl sm:text-8xl" />
            <p className="mt-5 max-w-md text-lg text-ink-soft">
              Pedidos por QR desde la mesa, cocina en tiempo real y caja. Elegí una puerta.
            </p>
          </div>
          <FoodGlyph kind="hamburguesas" className="ml-auto hidden size-44 animate-wobble sm:block" />
        </div>

        <div className="mt-12 grid gap-5 md:grid-cols-3">
          {DOORS.map(({ to, icon: Icon, tag, title, desc, cls }, i) => (
            <Link
              key={to}
              to={to}
              target={to === '/menu?mesa=4' ? undefined : '_blank'}
              className={`card-hard group flex animate-rise flex-col p-6 transition-transform hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-[6px_6px_0_0_var(--color-ink)] ${cls}`}
              style={{ animationDelay: `${i * 90}ms` }}
            >
              <div className="flex items-center justify-between">
                <Icon className="size-7" />
                <ArrowUpRight className="size-5 opacity-50 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
              </div>
              <p className="label-mono mt-10 opacity-60">{tag}</p>
              <h2 className="mt-1 font-display text-3xl leading-none">{title}</h2>
              <p className="mt-3 text-sm opacity-75">{desc}</p>
            </Link>
          ))}
        </div>

        {IS_DEMO && (
          <div className="mt-10 flex flex-wrap items-center gap-4 rounded-2xl border-2 border-dashed border-ink/25 p-5 text-sm text-ink-soft">
            <p className="max-w-xl">
              <b className="text-ink">Tip:</b> abrí el menú y la cocina en dos ventanas lado a lado. Al confirmar un pedido lo vas a ver caer
              en cocina con timbre, y los cambios de estado vuelven al celular del cliente al instante.
            </p>
            <button
              onClick={() => {
                if (confirm('¿Restaurar los datos de ejemplo?')) demoReset()
              }}
              className="btn-hard ml-auto bg-paper px-4 py-2"
            >
              <RotateCcw className="size-4" /> Reiniciar demo
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
