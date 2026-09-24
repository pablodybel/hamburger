export type OrderStatus = 'awaiting_payment' | 'received' | 'preparing' | 'ready' | 'delivered' | 'cancelled'
export type PaymentMethod = 'counter' | 'mercadopago'
export type PaymentStatus = 'pending' | 'approved' | 'rejected' | 'refunded'
export type StaffRole = 'admin' | 'kitchen'

export interface Category {
  id: string
  name: string
  slug: string
  sort_order: number
  is_active: boolean
}

export interface Variant {
  id: string
  name: string
  price_delta: number
  is_default: boolean
  is_available: boolean
  sort_order: number
}

export interface VariantGroup {
  id: string
  name: string
  min_select: number
  max_select: number
  sort_order: number
  variants: Variant[]
}

export interface Product {
  id: string
  category_id: string
  name: string
  description: string | null
  price: number
  image_url: string | null
  is_available: boolean
  is_active: boolean
  sort_order: number
  groups: VariantGroup[]
}

export interface MenuCategory extends Category {
  products: Product[]
}

export interface OrderItemVariant {
  group_name: string
  variant_name: string
}

export interface OrderItem {
  id?: string
  product_name: string
  quantity: number
  comment: string | null
  unit_price?: number
  line_total?: number
  variants: OrderItemVariant[]
}

export interface Order {
  id: string
  order_number: number
  public_token?: string
  table_number: number
  status: OrderStatus
  payment_method: PaymentMethod
  payment_status: PaymentStatus
  total: number
  customer_note: string | null
  created_at: string
  sent_to_kitchen_at: string | null
  preparing_at?: string | null
  ready_at?: string | null
  delivered_at?: string | null
  paid_at?: string | null
  items: OrderItem[]
}

export interface DiningTable {
  id: number
  number: number
  label: string | null
  is_active: boolean
}

export interface CreateOrderInput {
  table_number: number
  payment_method: PaymentMethod
  customer_note?: string
  items: { product_id: string; quantity: number; comment?: string; variant_ids: string[] }[]
}

export interface CreateOrderResult {
  order_id: string
  public_token: string
  order_number: number
  total: number
}

export interface StaffSession {
  user_id: string
  email: string
  full_name: string
  role: StaffRole
}
