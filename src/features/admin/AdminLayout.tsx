import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { ChefHat, ExternalLink, LayoutGrid, LogOut, UtensilsCrossed } from 'lucide-react'
import { api } from '@/services/api'
import { qk, useSession } from '@/hooks/queries'
import { Wordmark, DemoBadge } from '@/components/Brand'

const NAV = [
  { to: '/admin', end: true, label: 'Salón y cobros', icon: LayoutGrid },
  { to: '/admin/menu', end: false, label: 'Menú', icon: UtensilsCrossed },
]

export default function AdminLayout() {
  const { data: session } = useSession()
  const qc = useQueryClient()
  const navigate = useNavigate()

  return (
    <div className="paper-grain flex min-h-dvh flex-col md:flex-row">
      <aside className="relative flex shrink-0 flex-col bg-ink text-paper md:sticky md:top-0 md:h-dvh md:w-64">
        <div className="checker-ink absolute inset-y-0 right-0 hidden w-2 opacity-20 md:block" />
        <div className="flex items-center gap-3 px-5 py-4 md:block md:px-6 md:pt-7">
          <Wordmark light className="text-3xl md:text-[2.6rem]" />
          <p className="label-mono mt-1 hidden text-paper/40 md:block">administración</p>
          <DemoBadge className="ml-auto text-mustard md:mt-4 md:ml-0" />
        </div>

        <nav className="flex gap-1 overflow-x-auto px-3 pb-3 md:mt-6 md:flex-col md:px-4">
          {NAV.map(({ to, end, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                `flex shrink-0 items-center gap-3 rounded-xl px-4 py-2.5 font-semibold transition-colors ${
                  isActive ? 'bg-mustard text-ink' : 'text-paper/70 hover:bg-white/5 hover:text-paper'
                }`
              }
            >
              <Icon className="size-[18px]" /> {label}
            </NavLink>
          ))}
          <a href="/kitchen" target="_blank" className="flex shrink-0 items-center gap-3 rounded-xl px-4 py-2.5 font-semibold text-paper/70 hover:bg-white/5 hover:text-paper">
            <ChefHat className="size-[18px]" /> Pantalla cocina <ExternalLink className="ml-auto size-3.5 opacity-50" />
          </a>
        </nav>

        <div className="mt-auto hidden border-t border-white/10 px-6 py-5 md:block">
          <p className="text-sm font-semibold">{session?.full_name}</p>
          <p className="label-mono text-paper/40">{session?.role}</p>
          <button
            onClick={async () => {
              await api.signOut()
              qc.setQueryData(qk.session, null)
              navigate('/login')
            }}
            className="mt-3 flex items-center gap-2 text-sm text-paper/60 hover:text-mustard"
          >
            <LogOut className="size-4" /> Cerrar sesión
          </button>
        </div>
      </aside>

      <main className="min-w-0 flex-1">
        <Outlet />
      </main>
    </div>
  )
}
