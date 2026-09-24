// Solo en MODO DEMO: reemplaza el Checkout Pro real y simula el webhook.
import { useNavigate, useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { ShieldCheck } from 'lucide-react'
import { api } from '@/services/api'
import { demoApprovePayment } from '@/services/demoApi'
import { money, orderNo } from '@/lib/format'

export default function DemoMercadoPagoPage() {
  const { token = '' } = useParams()
  const navigate = useNavigate()
  const { data: order } = useQuery({ queryKey: ['demo-mp', token], queryFn: () => api.getOrderByToken(token) })

  function finish(ok: boolean) {
    // En producción esto lo hace la Edge Function mp-webhook al recibir la notificación
    demoApprovePayment(token, ok)
    navigate(`/pedido/${token}${ok ? '' : '?pago=fallido'}`, { replace: true })
  }

  return (
    <div className="grid min-h-dvh place-items-center bg-[#ededed] p-5 font-sans">
      <div className="w-full max-w-sm overflow-hidden rounded-2xl bg-white shadow-xl">
        <div className="bg-[#ffe600] px-5 py-4">
          <p className="text-[11px] font-semibold tracking-wider text-black/60 uppercase">Simulador · Checkout Pro</p>
          <p className="text-lg font-bold text-[#2d3277]">Pagá tu pedido</p>
        </div>
        <div className="space-y-1 px-5 py-6">
          <p className="text-sm text-black/60">La Plancha · Pedido {order ? orderNo(order.order_number) : '…'}</p>
          <p className="text-4xl font-semibold text-black/85">{order ? money(order.total) : '—'}</p>
        </div>
        <div className="space-y-2 px-5 pb-6">
          <button onClick={() => finish(true)} className="w-full rounded-lg bg-[#009ee3] py-3 font-semibold text-white">
            Aprobar pago
          </button>
          <button onClick={() => finish(false)} className="w-full rounded-lg py-3 font-semibold text-[#009ee3]">
            Rechazar pago
          </button>
        </div>
        <p className="flex items-center gap-2 border-t px-5 py-3 text-xs text-black/50">
          <ShieldCheck className="size-4" /> Modo demo: simula la notificación del webhook.
        </p>
      </div>
    </div>
  )
}
