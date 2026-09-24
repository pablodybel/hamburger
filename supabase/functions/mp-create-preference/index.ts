// Edge Function: crea la preference de Checkout Pro para un pedido.
// POST { public_token: string }  ->  { init_point, preference_id }
//
// El cliente solo envía el token del pedido. Los ítems y montos se leen
// de la base con service_role: el navegador nunca define el precio.

import { createClient } from 'npm:@supabase/supabase-js@2'

const MP_ACCESS_TOKEN = Deno.env.get('MP_ACCESS_TOKEN')!
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const APP_URL = Deno.env.get('APP_URL')! // ej: https://laplancha.com.ar

const cors = {
  'Access-Control-Allow-Origin': APP_URL,
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })

  try {
    const { public_token } = await req.json()
    if (!public_token) return json({ error: 'public_token requerido' }, 400)

    const db = createClient(SUPABASE_URL, SERVICE_ROLE)
    const { data: order, error } = await db
      .from('orders')
      .select('id, order_number, table_number, total, status, payment_method, mp_preference_id, order_items(product_name, quantity, unit_price)')
      .eq('public_token', public_token)
      .single()

    if (error || !order) return json({ error: 'Pedido no encontrado' }, 404)
    if (order.payment_method !== 'mercadopago' || order.status !== 'awaiting_payment')
      return json({ error: 'El pedido no está esperando pago' }, 409)

    const res = await fetch('https://api.mercadopago.com/checkout/preferences', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${MP_ACCESS_TOKEN}`,
        'Content-Type': 'application/json',
        // Reintentos del cliente no duplican preferences
        'X-Idempotency-Key': `pref-${order.id}`,
      },
      body: JSON.stringify({
        items: order.order_items.map((i: { product_name: string; quantity: number; unit_price: number }) => ({
          title: i.product_name,
          quantity: i.quantity,
          unit_price: Number(i.unit_price),
          currency_id: 'ARS',
        })),
        external_reference: order.id, // clave para reconciliar en el webhook
        statement_descriptor: 'LA PLANCHA',
        notification_url: `${SUPABASE_URL}/functions/v1/mp-webhook`,
        back_urls: {
          success: `${APP_URL}/pedido/${public_token}`,
          pending: `${APP_URL}/pedido/${public_token}`,
          failure: `${APP_URL}/pedido/${public_token}?pago=fallido`,
        },
        auto_return: 'approved',
        expires: true,
        expiration_date_to: new Date(Date.now() + 30 * 60_000).toISOString(),
        metadata: { order_number: order.order_number, table: order.table_number },
      }),
    })

    if (!res.ok) {
      console.error('MP preference error', res.status, await res.text())
      return json({ error: 'No se pudo iniciar el pago' }, 502)
    }
    const pref = await res.json()

    await db.from('orders').update({ mp_preference_id: pref.id }).eq('id', order.id)

    return json({ init_point: pref.init_point, preference_id: pref.id })
  } catch (e) {
    console.error(e)
    return json({ error: 'Error inesperado' }, 500)
  }
})

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } })
}
