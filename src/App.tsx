import { lazy, Suspense } from 'react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { Loader2 } from 'lucide-react'
import { RequireStaff } from '@/routes/RequireStaff'
import { IS_DEMO } from '@/lib/supabase'
import HomePage from '@/routes/HomePage'

// Code-splitting por área: el cliente móvil no descarga cocina ni admin
const MenuPage = lazy(() => import('@/features/menu/MenuPage'))
const CheckoutPage = lazy(() => import('@/features/menu/CheckoutPage'))
const OrderStatusPage = lazy(() => import('@/features/menu/OrderStatusPage'))
const DemoMercadoPagoPage = lazy(() => import('@/features/menu/DemoMercadoPagoPage'))
const KitchenPage = lazy(() => import('@/features/kitchen/KitchenPage'))
const LoginPage = lazy(() => import('@/features/admin/LoginPage'))
const AdminLayout = lazy(() => import('@/features/admin/AdminLayout'))
const OrdersPage = lazy(() => import('@/features/admin/OrdersPage'))
const MenuManagerPage = lazy(() => import('@/features/admin/MenuManagerPage'))

export default function App() {
  return (
    <BrowserRouter>
      <Suspense fallback={<Fallback />}>
        <Routes>
          <Route path="/" element={<HomePage />} />

          {/* Cliente (anónimo, mobile-first) */}
          <Route path="/menu" element={<MenuPage />} />
          <Route path="/menu/pedido" element={<CheckoutPage />} />
          <Route path="/pedido/:token" element={<OrderStatusPage />} />
          {IS_DEMO && <Route path="/demo/mercadopago/:token" element={<DemoMercadoPagoPage />} />}

          {/* Staff */}
          <Route path="/login" element={<LoginPage />} />
          <Route element={<RequireStaff roles={['kitchen', 'admin']} />}>
            <Route path="/kitchen" element={<KitchenPage />} />
          </Route>
          <Route element={<RequireStaff roles={['admin']} />}>
            <Route path="/admin" element={<AdminLayout />}>
              <Route index element={<OrdersPage />} />
              <Route path="menu" element={<MenuManagerPage />} />
            </Route>
          </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  )
}

function Fallback() {
  return (
    <div className="grid min-h-dvh place-items-center">
      <Loader2 className="size-8 animate-spin text-ink-mute" />
    </div>
  )
}
