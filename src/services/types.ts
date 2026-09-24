import type {
  Category, CreateOrderInput, CreateOrderResult, DiningTable, MenuCategory, Order, OrderStatus, Product, StaffSession,
} from '@/types/domain'

/**
 * Contrato único de acceso a datos. La UI solo conoce esta interfaz;
 * hay dos implementaciones: Supabase (producción) y Demo (navegador).
 */
export interface Api {
  mode: 'supabase' | 'demo'

  // --- Cliente (anónimo)
  getMenu(): Promise<MenuCategory[]>
  getTables(): Promise<DiningTable[]>
  createOrder(input: CreateOrderInput): Promise<CreateOrderResult>
  startMercadoPago(publicToken: string): Promise<{ init_point: string }>
  getOrderByToken(publicToken: string): Promise<Order | null>
  subscribeToOrder(publicToken: string, onChange: () => void): () => void

  // --- Staff (cocina + admin)
  getKitchenOrders(): Promise<Order[]>
  getOrdersSince(sinceIso: string): Promise<Order[]>
  subscribeToOrders(onChange: () => void): () => void
  updateOrderStatus(orderId: string, status: OrderStatus): Promise<void>
  markOrderPaid(orderId: string): Promise<void>

  // --- Admin: menú
  getAdminCatalog(): Promise<{ categories: Category[]; products: Product[] }>
  saveProduct(p: Product): Promise<void>
  deleteProduct(id: string): Promise<void>
  setProductAvailability(id: string, available: boolean): Promise<void>
  saveCategory(c: Category): Promise<void>
  deleteCategory(id: string): Promise<void>
  uploadProductImage(file: File): Promise<string>

  // --- Auth
  getSession(): Promise<StaffSession | null>
  signIn(email: string, password: string): Promise<StaffSession>
  signOut(): Promise<void>
}
