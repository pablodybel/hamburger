import { useEffect } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '@/services/api'
import type { OrderStatus } from '@/types/domain'

export const qk = {
  menu: ['menu'] as const,
  tables: ['tables'] as const,
  order: (token: string) => ['order', token] as const,
  kitchen: ['kitchen-orders'] as const,
  ordersToday: ['orders-today'] as const,
  catalog: ['admin-catalog'] as const,
  session: ['session'] as const,
}

const startOfDay = () => {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  return d.toISOString()
}

export const useMenu = () => useQuery({ queryKey: qk.menu, queryFn: api.getMenu, staleTime: 60_000 })
export const useTables = () => useQuery({ queryKey: qk.tables, queryFn: api.getTables, staleTime: 5 * 60_000 })
export const useSession = () => useQuery({ queryKey: qk.session, queryFn: api.getSession, staleTime: Infinity })

/** Cliente: estado del pedido por token. Broadcast realtime + polling de respaldo */
export function useOrderTracking(token: string) {
  const qc = useQueryClient()
  const query = useQuery({
    queryKey: qk.order(token),
    queryFn: () => api.getOrderByToken(token),
    refetchInterval: 15_000,
  })
  useEffect(() => api.subscribeToOrder(token, () => qc.invalidateQueries({ queryKey: qk.order(token) })), [token, qc])
  return query
}

/** Staff: cualquier cambio en orders invalida las vistas de cocina y admin */
function useOrdersRealtime() {
  const qc = useQueryClient()
  useEffect(
    () =>
      api.subscribeToOrders(() => {
        qc.invalidateQueries({ queryKey: qk.kitchen })
        qc.invalidateQueries({ queryKey: qk.ordersToday })
      }),
    [qc],
  )
}

export function useKitchenOrders() {
  useOrdersRealtime()
  return useQuery({ queryKey: qk.kitchen, queryFn: api.getKitchenOrders, refetchInterval: 30_000 })
}

export function useOrdersToday() {
  useOrdersRealtime()
  return useQuery({ queryKey: qk.ordersToday, queryFn: () => api.getOrdersSince(startOfDay()), refetchInterval: 60_000 })
}

export function useUpdateOrderStatus() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: OrderStatus }) => api.updateOrderStatus(id, status),
    onSettled: () => {
      qc.invalidateQueries({ queryKey: qk.kitchen })
      qc.invalidateQueries({ queryKey: qk.ordersToday })
    },
  })
}

export function useMarkPaid() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => api.markOrderPaid(id),
    onSettled: () => qc.invalidateQueries({ queryKey: qk.ordersToday }),
  })
}

export const useCatalog = () => useQuery({ queryKey: qk.catalog, queryFn: api.getAdminCatalog })

export function useCatalogMutation<T>(fn: (arg: T) => Promise<unknown>) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: fn,
    onSettled: () => {
      qc.invalidateQueries({ queryKey: qk.catalog })
      qc.invalidateQueries({ queryKey: qk.menu })
    },
  })
}
