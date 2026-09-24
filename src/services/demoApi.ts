// Backend simulado para correr la app sin Supabase.
// Persiste en localStorage y sincroniza pestañas con BroadcastChannel:
// abrí /menu en una pestaña y /kitchen en otra y vas a ver el "realtime".

import type { Api } from './types'
import type {
  Category, DiningTable, MenuCategory, Order, OrderStatus, Product, StaffSession, Variant, VariantGroup,
} from '@/types/domain'

const KEY = 'laplancha-demo-v2'
const SESSION_KEY = 'laplancha-demo-session'
const channel = typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel('laplancha-demo') : null

interface DemoDb {
  seq: number
  tables: DiningTable[]
  categories: Category[]
  products: Product[]
  orders: Order[]
}

const id = () => crypto.randomUUID()
const delay = (ms = 180) => new Promise((r) => setTimeout(r, ms))

function burgerGroups(): VariantGroup[] {
  const v = (name: string, price_delta: number, sort_order: number, is_default = false): Variant => ({
    id: id(), name, price_delta, sort_order, is_default, is_available: true,
  })
  return [
    { id: id(), name: 'Medallón', min_select: 1, max_select: 1, sort_order: 1,
      variants: [v('Simple', 0, 1, true), v('Doble', 2500, 2), v('Triple', 4800, 3)] },
    { id: id(), name: 'Extras', min_select: 0, max_select: 5, sort_order: 2,
      variants: [v('Doble cheddar', 1200, 1), v('Panceta extra', 1500, 2), v('Huevo frito', 1000, 3), v('Cebolla caramelizada', 900, 4), v('Pepinos extra', 500, 5)] },
    { id: id(), name: 'Hacelo combo', min_select: 0, max_select: 1, sort_order: 3,
      variants: [v('Con papas + bebida', 4900, 1)] },
    { id: id(), name: 'Aderezos', min_select: 0, max_select: 4, sort_order: 4,
      variants: [v('Mayo de ajo', 0, 1), v('Barbacoa', 0, 2), v('Ketchup', 0, 3), v('Mostaza', 0, 4), v('Salsa cheddar extra', 900, 5)] },
  ]
}

function seed(): DemoDb {
  const cats: Category[] = [
    ['Hamburguesas', 'hamburguesas'], ['Acompañamientos', 'acompanamientos'], ['Bebidas', 'bebidas'], ['Postres', 'postres'],
  ].map(([name, slug], i) => ({ id: id(), name, slug, sort_order: i + 1, is_active: true }))
  const c = Object.fromEntries(cats.map((x) => [x.slug, x.id]))
  const p = (cat: string, name: string, description: string, price: number, sort_order: number, groups: VariantGroup[] = [], is_available = true): Product => ({
    id: id(), category_id: c[cat], name, description, price, image_url: null, is_available, is_active: true, sort_order, groups,
  })
  const products = [
    p('hamburguesas', 'La Clásica', 'Smash de 110g, cheddar, cebolla, pepinos y salsa de la casa.', 8900, 1, burgerGroups()),
    p('hamburguesas', 'Bacon Brava', 'Doble cheddar, panceta crocante, barbacoa ahumada.', 10900, 2, burgerGroups()),
    p('hamburguesas', 'La Picante', 'Pepper jack, jalapeños encurtidos, mayo de chipotle.', 10400, 3, burgerGroups()),
    p('hamburguesas', 'Hongo Negro', 'Medallón de hongos y porotos, provoleta, rúcula.', 9800, 4, burgerGroups(), false),
    p('acompanamientos', 'Papas Bastón', 'Doble cocción, sal de mar.', 4200, 1),
    p('acompanamientos', 'Papas Cheddar & Verdeo', 'Con salsa cheddar y cebolla de verdeo.', 5600, 2),
    p('acompanamientos', 'Aros de Cebolla', 'Rebozado de cerveza, dip ranch.', 4900, 3),
    p('bebidas', 'Limonada de la Casa', 'Menta y jengibre. 500ml.', 3200, 1),
    p('bebidas', 'Gaseosa Línea Coca', 'Lata 354ml.', 2400, 2),
    p('bebidas', 'IPA Tirada', 'Pinta 473ml.', 4800, 3),
    p('postres', 'Brownie Tibio', 'Con helado de crema americana.', 4600, 1),
    p('postres', 'Milkshake Dulce de Leche', '400ml, crema batida.', 5200, 2),
  ]

  const ago = (min: number) => new Date(Date.now() - min * 60_000).toISOString()
  const mk = (n: number, table: number, status: OrderStatus, minAgo: number, pm: Order['payment_method'], ps: Order['payment_status'], total: number, items: Order['items'], note: string | null = null): Order => ({
    id: id(), order_number: n, public_token: id(), table_number: table, status, payment_method: pm, payment_status: ps,
    total, customer_note: note, created_at: ago(minAgo), sent_to_kitchen_at: ago(minAgo),
    preparing_at: status !== 'received' ? ago(minAgo - 2) : null, ready_at: status === 'ready' || status === 'delivered' ? ago(1) : null,
    paid_at: ps === 'approved' ? ago(minAgo) : null, items,
  })
  const orders: Order[] = [
    mk(138, 2, 'delivered', 55, 'mercadopago', 'approved', 27300, [
      { product_name: 'Bacon Brava', quantity: 2, comment: null, variants: [{ group_name: 'Medallón', variant_name: 'Doble' }] },
    ]),
    mk(139, 7, 'delivered', 40, 'counter', 'approved', 13100, [
      { product_name: 'La Clásica', quantity: 1, comment: null, variants: [{ group_name: 'Medallón', variant_name: 'Simple' }] },
      { product_name: 'Papas Bastón', quantity: 1, comment: null, variants: [] },
    ]),
    mk(140, 5, 'preparing', 11, 'mercadopago', 'approved', 31700, [
      { product_name: 'La Picante', quantity: 1, comment: 'Sin jalapeños, bien cocida', variants: [{ group_name: 'Medallón', variant_name: 'Doble' }, { group_name: 'Hacelo combo', variant_name: 'Con papas + bebida' }] },
      { product_name: 'La Clásica', quantity: 1, comment: null, variants: [{ group_name: 'Medallón', variant_name: 'Simple' }, { group_name: 'Aderezos', variant_name: 'Mayo de ajo' }] },
      { product_name: 'Aros de Cebolla', quantity: 1, comment: null, variants: [] },
    ]),
    mk(141, 9, 'received', 3, 'counter', 'pending', 18100, [
      { product_name: 'Bacon Brava', quantity: 1, comment: 'SIN SAL', variants: [{ group_name: 'Medallón', variant_name: 'Triple' }] },
      { product_name: 'IPA Tirada', quantity: 1, comment: null, variants: [] },
    ], 'Somos celíacos en la mesa: pan aparte por favor'),
  ]
  return {
    seq: 141,
    tables: Array.from({ length: 12 }, (_, i) => ({ id: i + 1, number: i + 1, label: i >= 9 ? `Terraza ${i - 8}` : null, is_active: true })),
    categories: cats,
    products,
    orders,
  }
}

function load(): DemoDb {
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) return JSON.parse(raw)
  } catch { /* storage no disponible */ }
  const db = seed()
  save(db, false)
  return db
}

const localListeners = new Set<() => void>()
function save(db: DemoDb, notify = true) {
  try { localStorage.setItem(KEY, JSON.stringify(db)) } catch { /* noop */ }
  if (notify) {
    channel?.postMessage('changed')
    localListeners.forEach((fn) => fn())
  }
}
function onAnyChange(fn: () => void) {
  const handler = () => fn()
  channel?.addEventListener('message', handler)
  localListeners.add(fn)
  return () => {
    channel?.removeEventListener('message', handler)
    localListeners.delete(fn)
  }
}

const clone = <T,>(x: T): T => structuredClone(x)

export function createDemoApi(): Api {
  return {
    mode: 'demo',

    async getMenu() {
      await delay()
      const db = load()
      return db.categories
        .filter((c) => c.is_active)
        .sort((a, b) => a.sort_order - b.sort_order)
        .map<MenuCategory>((c) => ({
          ...c,
          products: db.products.filter((p) => p.category_id === c.id && p.is_active).sort((a, b) => a.sort_order - b.sort_order),
        }))
    },

    async getTables() {
      return load().tables
    },

    async createOrder(input) {
      await delay(500)
      const db = load()
      if (!db.tables.some((t) => t.number === input.table_number)) throw new Error('Mesa inválida')
      let total = 0
      const items = input.items.map((it) => {
        const p = db.products.find((x) => x.id === it.product_id)
        if (!p || !p.is_available) throw new Error('Hay un producto que se agotó. Revisá tu pedido.')
        const chosen = p.groups.flatMap((g) => g.variants.filter((v) => it.variant_ids.includes(v.id)).map((v) => ({ g, v })))
        const unit = p.price + chosen.reduce((s, x) => s + x.v.price_delta, 0)
        total += unit * it.quantity
        return {
          id: id(), product_name: p.name, quantity: it.quantity, comment: it.comment?.trim() || null, unit_price: unit,
          line_total: unit * it.quantity, variants: chosen.map(({ g, v }) => ({ group_name: g.name, variant_name: v.name })),
        }
      })
      const now = new Date().toISOString()
      const isMp = input.payment_method === 'mercadopago'
      const order: Order = {
        id: id(), order_number: ++db.seq, public_token: id(), table_number: input.table_number,
        status: isMp ? 'awaiting_payment' : 'received', payment_method: input.payment_method, payment_status: 'pending',
        total, customer_note: input.customer_note?.trim() || null, created_at: now, sent_to_kitchen_at: isMp ? null : now, items,
      }
      db.orders.push(order)
      save(db)
      return { order_id: order.id, public_token: order.public_token!, order_number: order.order_number, total }
    },

    async startMercadoPago(publicToken) {
      await delay(400)
      return { init_point: `/demo/mercadopago/${publicToken}` }
    },

    async getOrderByToken(token) {
      const o = load().orders.find((x) => x.public_token === token)
      return o ? clone(o) : null
    },

    subscribeToOrder(_token, onChange) {
      return onAnyChange(onChange)
    },

    async getKitchenOrders() {
      return load()
        .orders.filter((o) => ['received', 'preparing', 'ready'].includes(o.status))
        .sort((a, b) => (a.sent_to_kitchen_at ?? '').localeCompare(b.sent_to_kitchen_at ?? ''))
    },

    async getOrdersSince(sinceIso) {
      return load()
        .orders.filter((o) => o.created_at >= sinceIso)
        .sort((a, b) => b.created_at.localeCompare(a.created_at))
    },

    subscribeToOrders(onChange) {
      return onAnyChange(onChange)
    },

    async updateOrderStatus(orderId, status) {
      const db = load()
      const o = db.orders.find((x) => x.id === orderId)
      if (!o) return
      const now = new Date().toISOString()
      o.status = status
      if (status === 'received') o.sent_to_kitchen_at ??= now
      if (status === 'preparing') o.preparing_at ??= now
      if (status === 'ready') o.ready_at ??= now
      if (status === 'delivered') o.delivered_at ??= now
      save(db)
    },

    async markOrderPaid(orderId) {
      const db = load()
      const o = db.orders.find((x) => x.id === orderId)
      if (!o) return
      o.payment_status = 'approved'
      o.paid_at = new Date().toISOString()
      save(db)
    },

    async getAdminCatalog() {
      const db = load()
      return {
        categories: db.categories.sort((a, b) => a.sort_order - b.sort_order),
        products: db.products.filter((p) => p.is_active).sort((a, b) => a.sort_order - b.sort_order),
      }
    },

    async saveProduct(p) {
      await delay()
      const db = load()
      const i = db.products.findIndex((x) => x.id === p.id)
      if (i >= 0) db.products[i] = clone(p)
      else db.products.push(clone(p))
      save(db)
    },

    async deleteProduct(pid) {
      const db = load()
      const p = db.products.find((x) => x.id === pid)
      if (p) p.is_active = false
      save(db)
    },

    async setProductAvailability(pid, available) {
      const db = load()
      const p = db.products.find((x) => x.id === pid)
      if (p) p.is_available = available
      save(db)
    },

    async saveCategory(c) {
      const db = load()
      const i = db.categories.findIndex((x) => x.id === c.id)
      if (i >= 0) db.categories[i] = c
      else db.categories.push(c)
      save(db)
    },

    async deleteCategory(cid) {
      const db = load()
      if (db.products.some((p) => p.category_id === cid && p.is_active))
        throw new Error('La categoría tiene productos. Movelos o eliminalos primero.')
      db.categories = db.categories.filter((c) => c.id !== cid)
      save(db)
    },

    async uploadProductImage(file) {
      return await new Promise<string>((res, rej) => {
        const r = new FileReader()
        r.onload = () => res(r.result as string)
        r.onerror = () => rej(new Error('No se pudo leer la imagen'))
        r.readAsDataURL(file)
      })
    },

    async getSession() {
      try {
        const raw = localStorage.getItem(SESSION_KEY)
        return raw ? (JSON.parse(raw) as StaffSession) : null
      } catch {
        return null
      }
    },

    async signIn(email, password) {
      await delay(400)
      if (!email || password.length < 4) throw new Error('Email o contraseña incorrectos')
      const s: StaffSession = {
        user_id: id(), email, full_name: email.split('@')[0],
        role: email.startsWith('cocina') ? 'kitchen' : 'admin',
      }
      try { localStorage.setItem(SESSION_KEY, JSON.stringify(s)) } catch { /* noop */ }
      return s
    },

    async signOut() {
      try { localStorage.removeItem(SESSION_KEY) } catch { /* noop */ }
    },
  }
}

/** Utilidad de la demo: simula el webhook de MP aprobando el pago */
export function demoApprovePayment(publicToken: string, approved: boolean) {
  const db = load()
  const o = db.orders.find((x) => x.public_token === publicToken)
  if (!o) return
  if (approved) {
    o.payment_status = 'approved'
    o.paid_at = new Date().toISOString()
    if (o.status === 'awaiting_payment') {
      o.status = 'received'
      o.sent_to_kitchen_at = new Date().toISOString()
    }
  } else {
    o.payment_status = 'rejected'
  }
  save(db)
}

export function demoReset() {
  save(seed())
}
