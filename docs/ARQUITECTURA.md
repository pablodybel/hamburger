# La Plancha: arquitectura

Pedidos por QR · Cocina (KDS) en tiempo real · Administración y caja · Mercado Pago.

Stack: **React 19 + Vite + Tailwind v4 + Lucide** · **TanStack Query** (estado del servidor) · **Zustand** (carrito) · **Supabase** (Postgres, Auth, Realtime, Storage, Edge Functions) · **Mercado Pago Checkout Pro + Webhooks**.

---

## 1. Esquema de base de datos

Archivo: [`supabase/migrations/20260924000001_init.sql`](../supabase/migrations/20260924000001_init.sql) · datos de ejemplo en [`supabase/seed.sql`](../supabase/seed.sql)

```
auth.users ─1:1─ staff (role: admin | kitchen)

tables ─────────────┐
                    │ 1:N
categories ─1:N─ products ─1:N─ product_variant_groups ─1:N─ product_variants
                    ┆ (ref. débil, set null)          ┆
orders ─1:N─ order_items ─1:N─ order_item_variants ┄┄┄┘
   │
   └─1:N─ payments (unique provider + provider_payment_id → idempotencia)
```

| Tabla | Propósito | Campos clave |
|---|---|---|
| `tables` | Mesas físicas | `number` único, `qr_token` (anti-spoofing opcional), `is_active` |
| `categories` | Hamburguesas, Acompañamientos… | `slug`, `sort_order`, `is_active` |
| `products` | Ítems del menú | `price`, `image_url`, **`is_available`** (toggle agotado), `is_active` (soft delete) |
| `product_variant_groups` | "Medallón", "Aderezos", "Hacelo combo" | **`min_select` / `max_select`**: 1/1 = radio obligatorio, 0/1 = opcional, 0/4 = checkboxes |
| `product_variants` | "Doble +$2500" | `price_delta`, `is_default`, `is_available` |
| `orders` | Pedido | `order_number` (visible, #0142), **`public_token`** (URL del cliente), `status`, `payment_method`, `payment_status`, `total`, timestamps por etapa |
| `order_items` | Línea del pedido | **snapshot** de `product_name` y `unit_price`, `quantity`, `comment` ("sin sal") |
| `order_item_variants` | Variantes elegidas | **snapshot** de `group_name`, `variant_name`, `price_delta` |
| `payments` | Auditoría de cobros | `provider_payment_id`, `status`, `raw` (jsonb completo de MP) |
| `staff` | Perfil y rol del usuario autenticado | `role` |

### Máquinas de estado

```
order_status:
  awaiting_payment ──(webhook MP approved)──► received ──► preparing ──► ready ──► delivered
        │                                        │             ▲  │         ▲ │
        └──────────► cancelled ◄─────────────────┘             └──┘         └─┘  (deshacer)

payment_method: counter (caja/efectivo/posnet) | mercadopago
payment_status: pending ──► approved | rejected | refunded
```

- **Pago en caja:** el pedido nace como `received` con `pending`. Entra a cocina al instante y en el KDS se ve "COBRAR EN CAJA". El admin lo marca cobrado con `mark_order_paid()`.
- **Mercado Pago:** el pedido nace como `awaiting_payment` y **no aparece en cocina** hasta que el webhook confirma el pago.
- El trigger `orders_guard_transition` rechaza transiciones inválidas, por ejemplo un doble click que retrocede el estado.

### Decisiones de diseño

1. **Snapshots en los pedidos.** Si mañana cambia el precio o el nombre de un producto, los pedidos históricos no se alteran. Por eso las FK a productos usan `on delete set null`.
2. **El cliente anónimo nunca escribe tablas.** Crea pedidos con el RPC `create_order()` (`SECURITY DEFINER`), que **recalcula precios en el servidor**, valida `min/max` por grupo y verifica disponibilidad. El navegador solo envía ids y cantidades.
3. **RLS en todas las tablas.** El menú tiene lectura pública. `orders` solo lo leen usuarios staff. Cocina puede actualizar **únicamente la columna `status`** (`grant update (status)`) y no puede tocar montos ni pagos.
4. **`public_token` como capability URL.** El cliente sigue su pedido en `/pedido/<uuid>` sin login y sin exponer la tabla. El uuid no se puede adivinar.
5. **Vista `kitchen_orders`** (`security_invoker`): devuelve en una sola query los pedidos activos con ítems y variantes anidados en JSON.

### Realtime

| Quién | Mecanismo | Por qué |
|---|---|---|
| Cocina y Admin | `postgres_changes` sobre `orders` | Respeta RLS; el staff está autenticado. Cada evento invalida la query de TanStack y se hace refetch de la vista. |
| Cliente (anónimo) | **Broadcast** en el tópico `order:<public_token>`, emitido por el trigger `orders_broadcast` con `realtime.send()` | El anónimo no tiene acceso a `orders` por RLS; recibe solo su propio estado. Hay polling cada 15 s como respaldo. |

El KDS detecta "pedido nuevo" **comparando ids entre renders** (`useNewOrderAlert`), no mirando el tipo de evento. Así suena igual si el pedido llegó por `INSERT` (caja) o por `UPDATE awaiting_payment → received` (webhook de MP).

---

## 2. Estructura de carpetas y rutas

```
la-plancha/
├── supabase/
│   ├── migrations/20260924000001_init.sql   esquema, RLS, RPCs, triggers, realtime, storage
│   ├── seed.sql
│   └── functions/
│       ├── mp-create-preference/index.ts    crea la preference de Checkout Pro
│       └── mp-webhook/index.ts              valida firma, consulta el pago y actualiza el pedido
├── src/
│   ├── main.tsx                             QueryClientProvider
│   ├── App.tsx                              router con lazy() por área
│   ├── styles/index.css                     tokens (@theme), texturas y animaciones
│   ├── types/domain.ts                      tipos de dominio compartidos
│   ├── lib/                                 supabase client, format, sonido (WebAudio)
│   ├── services/
│   │   ├── types.ts                         contrato `Api` (lo único que conoce la UI)
│   │   ├── supabaseApi.ts                   implementación real
│   │   ├── demoApi.ts                       backend simulado (localStorage + BroadcastChannel)
│   │   └── api.ts                           elige la implementación según las env vars
│   ├── stores/cartStore.ts                  Zustand + persist (sessionStorage)
│   ├── hooks/queries.ts                     queries, mutations y suscripciones realtime
│   ├── components/                          Brand, FoodGlyph (ilustraciones)
│   ├── routes/                              RequireStaff (guard), HomePage
│   └── features/
│       ├── menu/        MenuPage, CheckoutPage, OrderStatusPage, components/{ProductSheet, CartBar}
│       ├── kitchen/     KitchenPage, useNewOrderAlert, components/Ticket
│       └── admin/       LoginPage, AdminLayout, OrdersPage, MenuManagerPage,
│                        components/{ProductEditor, CategoryPanel, Switch}
└── docs/ARQUITECTURA.md
```

| Ruta | Acceso | Pantalla |
|---|---|---|
| `/menu?mesa=4` | público | Menú por categorías (scroll-spy), hoja de personalización |
| `/menu/pedido` | público | Resumen tipo ticket y elección de pago |
| `/pedido/:token` | público (capability) | Seguimiento en vivo |
| `/login` | público | Login de staff |
| `/kitchen` | `kitchen` o `admin` | KDS |
| `/admin` | `admin` | Salón (mapa de mesas), KPIs, caja por cobrar, feed de pedidos |
| `/admin/menu` | `admin` | ABM de productos, variantes, categorías y stock |

Cada área es un chunk separado, así el celular del cliente no descarga el código de cocina ni el del admin.

---

## 3. Mercado Pago con Supabase: flujo de confirmación

```mermaid
sequenceDiagram
  autonumber
  participant C as Cliente (web)
  participant DB as Supabase Postgres
  participant EF1 as Edge fn mp-create-preference
  participant MP as Mercado Pago
  participant EF2 as Edge fn mp-webhook
  participant K as Cocina (KDS)

  C->>DB: rpc create_order(mesa, 'mercadopago', items)
  DB-->>C: {public_token, total} (status = awaiting_payment)
  C->>EF1: POST {public_token}
  EF1->>DB: lee pedido + ítems (service_role)
  EF1->>MP: POST /checkout/preferences<br/>external_reference = order.id<br/>notification_url = …/mp-webhook
  MP-->>EF1: {id, init_point}
  EF1->>DB: orders.mp_preference_id = id
  EF1-->>C: init_point
  C->>MP: redirect a Checkout Pro y paga
  MP-->>C: back_url → /pedido/:token (auto_return)
  MP->>EF2: POST notificación {type: payment, data.id}<br/>headers x-signature, x-request-id
  EF2->>EF2: valida HMAC-SHA256(secret, "id:…;request-id:…;ts:…;")
  EF2->>MP: GET /v1/payments/{id} (fuente de verdad)
  EF2->>DB: upsert payments (idempotente)
  EF2->>DB: update orders set payment_status='approved', status='received'
  DB-->>K: postgres_changes → refetch + timbre
  DB-->>C: broadcast order:<token> → "Recibido"
  EF2-->>MP: 200 OK
```

### Reglas que importan

1. **Nunca confiar en el body del webhook.** Solo se usa `data.id` para consultar `GET /v1/payments/{id}` con el access token.
2. **Validar la firma** `x-signature` con el secret del panel de MP (Tus integraciones → Webhooks). Si no coincide, se responde 401.
3. **Verificar el monto:** `transaction_amount` tiene que coincidir con `orders.total`. Si no coincide, no se aprueba y queda en el log.
4. **Idempotencia:** MP reintenta las notificaciones. `payments` tiene `unique(provider, provider_payment_id)` y el `update` solo avanza el pedido si seguía en `awaiting_payment`.
5. **Responder 200 rápido.** Cualquier otro código hace que MP reintente con backoff.
6. **El `back_url` no confirma nada.** La página `/pedido/:token` muestra "Esperando confirmación" hasta que llega el webhook. Si el pago falla, ofrece reintentar (se crea una preference nueva para el mismo pedido).
7. La preference **expira a los 30 minutos**. Conviene programar un job con `pg_cron` que cancele los pedidos que sigan en `awaiting_payment` después de ese plazo.

### Deploy

```bash
supabase secrets set MP_ACCESS_TOKEN=APP_USR-… MP_WEBHOOK_SECRET=… APP_URL=https://tu-dominio
supabase functions deploy mp-create-preference
supabase functions deploy mp-webhook --no-verify-jwt   # MP no envía JWT de Supabase
```

En el panel de MP, configurar la URL `https://<ref>.supabase.co/functions/v1/mp-webhook` con el evento **Pagos**.

---

## 4. Roadmap al MVP

| Fase | Entregable | Estado |
|---|---|---|
| **0 · Setup** | Vite + React + TS + Tailwind v4, alias `@/`, proyecto Supabase, `.env` | ✅ |
| **1 · Datos** | Migración: tablas, enums, RLS, RPCs, triggers, vista KDS, bucket de imágenes, seed | ✅ |
| **2 · Menú cliente** | `/menu?mesa=N`, categorías con scroll-spy, hoja de variantes con validación min/max, comentarios rápidos, carrito Zustand | ✅ |
| **3 · Checkout con pago en caja** | `create_order` RPC, pantalla de seguimiento con Broadcast y polling | ✅ |
| **4 · KDS** | Tickets por antigüedad, timers con semáforo (8 y 15 min), comentarios resaltados, timbre y flash, pase de listos, deshacer | ✅ |
| **5 · Admin** | Login, guard por rol, salón y KPIs, caja por cobrar, ABM de productos, variantes y categorías, toggle de stock, subida de fotos | ✅ |
| **6 · Mercado Pago** | Edge Functions de preference y webhook, flujo de reintento | ✅ código · ⏳ probar con credenciales de prueba |
| **7 · Producción** | Crear usuarios staff (`insert into staff`), generar e imprimir los QR (`/menu?mesa=N&t=<qr_token>`), deploy del front (Vercel o Netlify) con fallback SPA, dominio | ⏳ |
| **8 · Endurecimiento** | Validar `qr_token` en `create_order`, rate-limit por mesa, `pg_cron` para vencer pedidos MP, service worker PWA offline para el menú, tests E2E (Playwright) | ⏳ |
| **Después del MVP** | Cierre de caja diario y reportes, impresión térmica (ESC/POS), varias sucursales, propinas, llamar al mozo | 💡 |
