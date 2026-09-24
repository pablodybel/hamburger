// Edge Function: webhook de Mercado Pago (notification_url).
//
// 1. Valida la firma x-signature (HMAC-SHA256 con MP_WEBHOOK_SECRET).
// 2. NUNCA confía en el body: consulta GET /v1/payments/{id} a MP.
// 3. Verifica external_reference (order.id) y que el monto coincida.
// 4. Inserta en payments (unique provider+provider_payment_id => idempotente).
// 5. Actualiza orders: payment_status=approved, status awaiting_payment->received.
//    Eso dispara: Realtime postgres_changes (cocina suena) + broadcast al cliente.
// 6. Responde 200 rápido; MP reintenta ante cualquier otro código.
//
// Deploy: supabase functions deploy mp-webhook --no-verify-jwt

import { createClient } from 'npm:@supabase/supabase-js@2'

const MP_ACCESS_TOKEN = Deno.env.get('MP_ACCESS_TOKEN')!
const MP_WEBHOOK_SECRET = Deno.env.get('MP_WEBHOOK_SECRET')!
const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)

Deno.serve(async (req) => {
  if (req.method !== 'POST') return new Response('ok')

  const url = new URL(req.url)
  const body = await req.json().catch(() => ({}))
  const type = body.type ?? url.searchParams.get('type') ?? url.searchParams.get('topic')
  const paymentId: string | undefined = body?.data?.id ?? url.searchParams.get('data.id') ?? undefined

  if (type !== 'payment' || !paymentId) return new Response('ignored', { status: 200 })

  if (!(await isValidSignature(req, paymentId))) {
    console.warn('Firma inválida', paymentId)
    return new Response('invalid signature', { status: 401 })
  }

  // Fuente de verdad: la API de MP
  const res = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
    headers: { Authorization: `Bearer ${MP_ACCESS_TOKEN}` },
  })
  if (!res.ok) return new Response('mp fetch failed', { status: 502 }) // MP reintentará
  const payment = await res.json()

  const orderId: string | undefined = payment.external_reference
  if (!orderId) return new Response('no reference', { status: 200 })

  const { data: order } = await db.from('orders').select('id, total, status, payment_status').eq('id', orderId).single()
  if (!order) return new Response('order not found', { status: 200 })

  // Idempotencia: el mismo pago puede notificarse varias veces
  const { error: dupErr } = await db.from('payments').upsert(
    {
      order_id: order.id,
      provider: 'mercadopago',
      provider_payment_id: String(payment.id),
      status: payment.status,
      amount: payment.transaction_amount,
      raw: payment,
    },
    { onConflict: 'provider,provider_payment_id' },
  )
  if (dupErr) console.error(dupErr)

  const amountOk = Math.abs(Number(payment.transaction_amount) - Number(order.total)) < 0.01

  if (payment.status === 'approved' && amountOk && order.payment_status !== 'approved') {
    await db
      .from('orders')
      .update({
        payment_status: 'approved',
        mp_payment_id: String(payment.id),
        // Solo avanza si seguía esperando el pago (no pisa estados posteriores)
        ...(order.status === 'awaiting_payment' ? { status: 'received' } : {}),
      })
      .eq('id', order.id)
  } else if (payment.status === 'approved' && !amountOk) {
    console.error('Monto no coincide', { orderId, paid: payment.transaction_amount, total: order.total })
  } else if (['rejected', 'cancelled'].includes(payment.status) && order.payment_status === 'pending') {
    await db.from('orders').update({ payment_status: 'rejected' }).eq('id', order.id)
  }

  return new Response('ok', { status: 200 })
})

// https://www.mercadopago.com.ar/developers/es/docs/your-integrations/notifications/webhooks
// x-signature: "ts=1704908010,v1=618c85345248dd820d5fd456117c2ab2ef8eda45a0282ff693eac24131a5e839"
// manifest:    "id:{data.id};request-id:{x-request-id};ts:{ts};"
async function isValidSignature(req: Request, dataId: string) {
  const sig = req.headers.get('x-signature')
  const requestId = req.headers.get('x-request-id')
  if (!sig || !requestId) return false

  const parts = Object.fromEntries(sig.split(',').map((p) => p.trim().split('=') as [string, string]))
  if (!parts.ts || !parts.v1) return false

  const manifest = `id:${dataId.toLowerCase()};request-id:${requestId};ts:${parts.ts};`
  const key = await crypto.subtle.importKey(
    'raw', new TextEncoder().encode(MP_WEBHOOK_SECRET), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'],
  )
  const mac = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(manifest))
  const hex = [...new Uint8Array(mac)].map((b) => b.toString(16).padStart(2, '0')).join('')

  // comparación en tiempo constante
  if (hex.length !== parts.v1.length) return false
  let diff = 0
  for (let i = 0; i < hex.length; i++) diff |= hex.charCodeAt(i) ^ parts.v1.charCodeAt(i)
  return diff === 0
}
