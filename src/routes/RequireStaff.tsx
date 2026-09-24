import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { Loader2 } from 'lucide-react'
import { useSession } from '@/hooks/queries'
import type { StaffRole } from '@/types/domain'

/** Guard de rutas. La seguridad real vive en RLS; esto es solo UX. */
export function RequireStaff({ roles }: { roles: StaffRole[] }) {
  const { data: session, isLoading } = useSession()
  const loc = useLocation()

  if (isLoading)
    return (
      <div className="grid min-h-dvh place-items-center">
        <Loader2 className="size-8 animate-spin" />
      </div>
    )
  if (!session) return <Navigate to={`/login?next=${encodeURIComponent(loc.pathname)}`} replace />
  if (!roles.includes(session.role)) return <Navigate to={session.role === 'kitchen' ? '/kitchen' : '/admin'} replace />
  return <Outlet />
}
