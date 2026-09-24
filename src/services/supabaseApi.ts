import type { SupabaseClient } from '@supabase/supabase-js'
import { uid } from '@/lib/format'
import type { Api } from './types'
import type { Category, MenuCategory, Order, Product, StaffSession, VariantGroup } from '@/types/domain'

const PRODUCT_SELECT =
  'id, category_id, name, description, price, image_url, is_available, is_active, sort_order,' +
  ' groups:product_variant_groups(id, name, min_select, max_select, sort_order,' +
  ' variants:product_variants(id, name, price_delta, is_default, is_available, sort_order))'

const ORDER_SELECT =
  'id, order_number, table_number, status, payment_method, payment_status, total, customer_note, created_at,' +
  ' sent_to_kitchen_at, preparing_at, ready_at, delivered_at, paid_at,' +
  ' items:order_items(id, product_name, quantity, comment, unit_price, line_total, sort_order,' +
  ' variants:order_item_variants(group_name, variant_name))'

function sortProduct(p: Product): Product {
  const groups = [...(p.groups ?? [])]
    .sort((a, b) => a.sort_order - b.sort_order)
    .map((g) => ({ ...g, variants: [...g.variants].sort((a, b) => a.sort_order - b.sort_order) }))
  return { ...p, price: Number(p.price), groups }
}

function must<T>(res: { data: T | null; error: { message: string } | null }): T {
  if (res.error) throw new Error(res.error.message)
  return res.data as T
}

export function createSupabaseApi(sb: SupabaseClient): Api {
  return {
    mode: 'supabase',

    async getMenu() {
      const [cats, prods] = await Promise.all([
        sb.from('categories').select('*').eq('is_active', true).order('sort_order'),
        sb.from('products').select(PRODUCT_SELECT).eq('is_active', true).order('sort_order'),
      ])
      const products = (must(prods) as unknown as Product[]).map(sortProduct)
      return (must(cats) as Category[]).map<MenuCategory>((c) => ({
        ...c,
        products: products.filter((p) => p.category_id === c.id),
      }))
    },

    async getTables() {
      return must(await sb.from('tables').select('id, number, label, is_active').order('number'))
    },

    async createOrder(input) {
      const data = must(
        await sb.rpc('create_order', {
          p_table_number: input.table_number,
          p_payment_method: input.payment_method,
          p_items: input.items,
          p_customer_note: input.customer_note ?? null,
        }),
      ) as { order_id: string; public_token: string; order_number: number; total: number }[]
      return { ...data[0], total: Number(data[0].total) }
    },

    async startMercadoPago(publicToken) {
      const { data, error } = await sb.functions.invoke('mp-create-preference', { body: { public_token: publicToken } })
      if (error) throw new Error('No se pudo iniciar Mercado Pago')
      return data as { init_point: string }
    },

    async getOrderByToken(publicToken) {
      const data = must(await sb.rpc('get_order_by_token', { p_token: publicToken })) as Order | null
      return data ? { ...data, total: Number(data.total) } : null
    },

    subscribeToOrder(publicToken, onChange) {
      // Broadcast emitido por el trigger orders_broadcast (realtime.send)
      const ch = sb
        .channel(`order:${publicToken}`)
        .on('broadcast', { event: 'status_changed' }, onChange)
        .subscribe()
      return () => void sb.removeChannel(ch)
    },

    async getKitchenOrders() {
      const rows = must(await sb.from('kitchen_orders').select('*').order('sent_to_kitchen_at')) as Order[]
      return rows.map((o) => ({ ...o, total: 0 }))
    },

    async getOrdersSince(sinceIso) {
      const rows = must(
        await sb.from('orders').select(ORDER_SELECT).gte('created_at', sinceIso).order('created_at', { ascending: false }),
      ) as unknown as Order[]
      return rows.map((o) => ({ ...o, total: Number(o.total) }))
    },

    subscribeToOrders(onChange) {
      const ch = sb
        .channel('staff-orders')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, onChange)
        .subscribe()
      return () => void sb.removeChannel(ch)
    },

    async updateOrderStatus(orderId, status) {
      must(await sb.from('orders').update({ status }).eq('id', orderId))
    },

    async markOrderPaid(orderId) {
      must(await sb.rpc('mark_order_paid', { p_order_id: orderId }))
    },

    async getAdminCatalog() {
      const [cats, prods] = await Promise.all([
        sb.from('categories').select('*').order('sort_order'),
        sb.from('products').select(PRODUCT_SELECT).order('sort_order'),
      ])
      return { categories: must(cats) as Category[], products: (must(prods) as unknown as Product[]).map(sortProduct) }
    },

    async saveProduct(p) {
      const { groups, ...row } = p
      must(await sb.from('products').upsert(row))

      // Sincroniza grupos/variantes: upsert de lo presente, delete de lo removido.
      const existing = must(await sb.from('product_variant_groups').select('id').eq('product_id', p.id)) as { id: string }[]
      const keep = new Set(groups.map((g) => g.id))
      const toDelete = existing.map((g) => g.id).filter((id) => !keep.has(id))
      if (toDelete.length) must(await sb.from('product_variant_groups').delete().in('id', toDelete))

      for (const g of groups as VariantGroup[]) {
        const { variants, ...gRow } = g
        must(await sb.from('product_variant_groups').upsert({ ...gRow, product_id: p.id }))
        const vKeep = variants.map((v) => v.id)
        const delQ = sb.from('product_variants').delete().eq('group_id', g.id)
        must(await (vKeep.length ? delQ.not('id', 'in', `(${vKeep.join(',')})`) : delQ))
        if (variants.length) must(await sb.from('product_variants').upsert(variants.map((v) => ({ ...v, group_id: g.id }))))
      }
    },

    async deleteProduct(id) {
      // Soft delete: los pedidos históricos siguen referenciando el producto
      must(await sb.from('products').update({ is_active: false }).eq('id', id))
    },

    async setProductAvailability(id, available) {
      must(await sb.from('products').update({ is_available: available }).eq('id', id))
    },

    async saveCategory(c) {
      must(await sb.from('categories').upsert(c))
    },

    async deleteCategory(id) {
      must(await sb.from('categories').delete().eq('id', id))
    },

    async uploadProductImage(file) {
      const ext = file.name.split('.').pop() ?? 'jpg'
      const path = `${uid()}.${ext}`
      must(await sb.storage.from('product-images').upload(path, file, { cacheControl: '31536000', upsert: false }))
      return sb.storage.from('product-images').getPublicUrl(path).data.publicUrl
    },

    async getSession() {
      const { data } = await sb.auth.getSession()
      const user = data.session?.user
      if (!user) return null
      const { data: staff } = await sb.from('staff').select('full_name, role').eq('user_id', user.id).maybeSingle()
      if (!staff) return null
      return { user_id: user.id, email: user.email ?? '', full_name: staff.full_name, role: staff.role } as StaffSession
    },

    async signIn(email, password) {
      const { error } = await sb.auth.signInWithPassword({ email, password })
      if (error) throw new Error('Email o contraseña incorrectos')
      const s = await this.getSession()
      if (!s) {
        await sb.auth.signOut()
        throw new Error('Tu usuario no tiene permisos de staff')
      }
      return s
    },

    async signOut() {
      await sb.auth.signOut()
    },
  }
}
