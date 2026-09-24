-- =====================================================================
--  LA PLANCHA · Esquema inicial
--  Pedidos por QR · Cocina (KDS) · Admin/Caja · Mercado Pago
-- =====================================================================
--  Convenciones:
--   * PK uuid (gen_random_uuid) salvo tablas de catálogo chico.
--   * Precios en numeric(12,2) — ARS con centavos.
--   * Todo lo que el cliente ve en un pedido se guarda como SNAPSHOT
--     (nombre + precio al momento de pedir). Si mañana cambia el precio
--     de la hamburguesa, los pedidos históricos no se alteran.
--   * El cliente anónimo NUNCA escribe tablas directo: usa RPCs
--     SECURITY DEFINER que recalculan precios del lado servidor.
-- =====================================================================

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------
-- ENUMS
-- ---------------------------------------------------------------------
create type public.order_status as enum (
  'awaiting_payment', -- MP elegido, preference creada, aún sin pago aprobado (NO se muestra en cocina)
  'received',         -- Entró a cocina
  'preparing',        -- En preparación
  'ready',            -- Listo para servir
  'delivered',        -- Entregado en mesa (cierra el ciclo en cocina)
  'cancelled'
);

create type public.payment_method as enum ('counter', 'mercadopago');
-- counter = Caja / Efectivo / Posnet

create type public.payment_status as enum ('pending', 'approved', 'rejected', 'refunded');

create type public.staff_role as enum ('admin', 'kitchen');

-- ---------------------------------------------------------------------
-- STAFF (perfil de usuarios autenticados)
-- ---------------------------------------------------------------------
create table public.staff (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  full_name  text not null,
  role       public.staff_role not null default 'kitchen',
  created_at timestamptz not null default now()
);

create or replace function public.staff_role()
returns public.staff_role
language sql stable security definer set search_path = public
as $$ select role from public.staff where user_id = auth.uid() $$;

create or replace function public.is_staff()
returns boolean language sql stable security definer set search_path = public
as $$ select exists (select 1 from public.staff where user_id = auth.uid()) $$;

create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public
as $$ select exists (select 1 from public.staff where user_id = auth.uid() and role = 'admin') $$;

-- ---------------------------------------------------------------------
-- MESAS
-- ---------------------------------------------------------------------
create table public.tables (
  id         smallint generated always as identity primary key,
  number     smallint not null unique check (number > 0),
  label      text,                                   -- "Terraza 2", "Barra"
  qr_token   uuid not null default gen_random_uuid(), -- anti-spoofing opcional (?mesa=4&t=...)
  is_active  boolean not null default true,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- CATÁLOGO
-- ---------------------------------------------------------------------
create table public.categories (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  slug       text not null unique,
  sort_order int  not null default 0,
  is_active  boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.products (
  id           uuid primary key default gen_random_uuid(),
  category_id  uuid not null references public.categories(id) on delete restrict,
  name         text not null,
  description  text,
  price        numeric(12,2) not null check (price >= 0),
  image_url    text,
  is_available boolean not null default true,   -- toggle rápido "Agotado"
  is_active    boolean not null default true,   -- soft delete / oculto del menú
  sort_order   int not null default 0,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index products_category_idx on public.products(category_id, sort_order);

-- Grupo de variantes/modificadores de un producto.
--   "Medallón"   min 1 / max 1  -> radio (Simple, Doble +$2500, Triple +$4800)
--   "Extras"     min 0 / max 5  -> cada opción con su adicional (Doble cheddar +$1200...)
--   "Hacelo combo" min 0 / max 1 -> opcional
--   "Aderezos"   min 0 / max 4  -> checkboxes
create table public.product_variant_groups (
  id         uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  name       text not null,
  min_select smallint not null default 0 check (min_select >= 0),
  max_select smallint not null default 1 check (max_select >= 1),
  sort_order int not null default 0,
  check (min_select <= max_select)
);
create index pvg_product_idx on public.product_variant_groups(product_id, sort_order);

create table public.product_variants (
  id           uuid primary key default gen_random_uuid(),
  group_id     uuid not null references public.product_variant_groups(id) on delete cascade,
  name         text not null,
  price_delta  numeric(12,2) not null default 0,
  is_default   boolean not null default false,
  is_available boolean not null default true,
  sort_order   int not null default 0
);
create index pv_group_idx on public.product_variants(group_id, sort_order);
comment on column public.product_variants.price_delta is 'Adicional en $ que suma esta opción al precio base del producto (0 = sin cargo). Ej: Doble cheddar +1200';

-- ---------------------------------------------------------------------
-- PEDIDOS
-- ---------------------------------------------------------------------
create table public.orders (
  id               uuid primary key default gen_random_uuid(),
  order_number     int generated always as identity,             -- "#0142" visible en cocina/ticket
  public_token     uuid not null unique default gen_random_uuid(), -- capability URL del cliente
  table_id         smallint not null references public.tables(id),
  table_number     smallint not null,                              -- snapshot
  status           public.order_status not null default 'received',
  payment_method   public.payment_method not null,
  payment_status   public.payment_status not null default 'pending',
  subtotal         numeric(12,2) not null default 0,
  total            numeric(12,2) not null default 0,
  customer_note    text,
  mp_preference_id text,
  mp_payment_id    text,
  paid_at          timestamptz,
  paid_by          uuid references auth.users(id),  -- quién marcó el cobro en caja
  sent_to_kitchen_at timestamptz,                   -- momento en que entra a la cola (orden del KDS)
  preparing_at     timestamptz,
  ready_at         timestamptz,
  delivered_at     timestamptz,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
create index orders_active_idx on public.orders(status, sent_to_kitchen_at)
  where status in ('received','preparing','ready');
create index orders_table_idx on public.orders(table_id, created_at desc);
create index orders_created_idx on public.orders(created_at desc);

create table public.order_items (
  id           uuid primary key default gen_random_uuid(),
  order_id     uuid not null references public.orders(id) on delete cascade,
  product_id   uuid references public.products(id) on delete set null,
  product_name text not null,                 -- snapshot
  unit_price   numeric(12,2) not null,        -- snapshot: base + deltas
  quantity     smallint not null check (quantity between 1 and 50),
  comment      text check (char_length(comment) <= 140), -- "sin sal", "bien cocida"
  line_total   numeric(12,2) not null,
  sort_order   smallint not null default 0
);
create index order_items_order_idx on public.order_items(order_id);

create table public.order_item_variants (
  id            uuid primary key default gen_random_uuid(),
  order_item_id uuid not null references public.order_items(id) on delete cascade,
  variant_id    uuid references public.product_variants(id) on delete set null,
  group_name    text not null,               -- snapshot "Medallón"
  variant_name  text not null,               -- snapshot "Doble"
  price_delta   numeric(12,2) not null default 0
);
create index oiv_item_idx on public.order_item_variants(order_item_id);

-- Registro de pagos (idempotencia del webhook + auditoría)
create table public.payments (
  id                  uuid primary key default gen_random_uuid(),
  order_id            uuid not null references public.orders(id) on delete cascade,
  provider            text not null check (provider in ('mercadopago','counter')),
  provider_payment_id text,
  status              text not null,          -- status crudo del proveedor
  amount              numeric(12,2) not null,
  raw                 jsonb,
  created_at          timestamptz not null default now(),
  unique (provider, provider_payment_id)
);

-- ---------------------------------------------------------------------
-- TRIGGERS: updated_at + timestamps de estado
-- ---------------------------------------------------------------------
create or replace function public.touch_updated_at() returns trigger
language plpgsql set search_path = public as $$ begin new.updated_at := now(); return new; end $$;

create trigger products_touch before update on public.products
  for each row execute function public.touch_updated_at();

create or replace function public.orders_before_update() returns trigger
language plpgsql set search_path = public as $$
begin
  new.updated_at := now();
  if new.status is distinct from old.status then
    if new.status = 'received'  and new.sent_to_kitchen_at is null then new.sent_to_kitchen_at := now(); end if;
    if new.status = 'preparing' then new.preparing_at := coalesce(new.preparing_at, now()); end if;
    if new.status = 'ready'     then new.ready_at     := coalesce(new.ready_at, now()); end if;
    if new.status = 'delivered' then new.delivered_at := coalesce(new.delivered_at, now()); end if;
  end if;
  if new.payment_status = 'approved' and old.payment_status <> 'approved' then
    new.paid_at := coalesce(new.paid_at, now());
  end if;
  return new;
end $$;

create trigger orders_before_update before update on public.orders
  for each row execute function public.orders_before_update();

-- Transiciones de estado válidas (evita que un doble click retroceda un pedido)
create or replace function public.orders_guard_transition() returns trigger
language plpgsql set search_path = public as $$
begin
  if new.status = old.status then return new; end if;
  if not (
       (old.status = 'awaiting_payment' and new.status in ('received','cancelled'))
    or (old.status = 'received'  and new.status in ('preparing','cancelled'))
    or (old.status = 'preparing' and new.status in ('ready','received','cancelled'))
    or (old.status = 'ready'     and new.status in ('delivered','preparing'))
  ) then
    raise exception 'Transición inválida: % -> %', old.status, new.status using errcode = 'P0001';
  end if;
  return new;
end $$;

create trigger orders_guard_transition before update of status on public.orders
  for each row execute function public.orders_guard_transition();

-- ---------------------------------------------------------------------
-- REALTIME
--  * Staff (cocina/admin): postgres_changes sobre orders (respeta RLS).
--  * Cliente anónimo: Broadcast en el tópico "order:<public_token>".
--    El token es un uuid imposible de adivinar => funciona como
--    capability URL sin exponer la tabla orders al rol anon.
-- ---------------------------------------------------------------------
alter publication supabase_realtime add table public.orders;

create or replace function public.broadcast_order_status() returns trigger
language plpgsql security definer set search_path = public, realtime
as $$
begin
  if tg_op = 'INSERT' or new.status is distinct from old.status
     or new.payment_status is distinct from old.payment_status then
    perform realtime.send(
      jsonb_build_object(
        'status', new.status,
        'payment_status', new.payment_status,
        'updated_at', new.updated_at
      ),
      'status_changed',                    -- event
      'order:' || new.public_token::text,  -- topic
      false                                -- public channel
    );
  end if;
  return new;
end $$;

create trigger orders_broadcast after insert or update on public.orders
  for each row execute function public.broadcast_order_status();

-- ---------------------------------------------------------------------
-- RPC: crear pedido (cliente anónimo)
--  p_items = [
--    { "product_id": "...", "quantity": 2, "comment": "sin sal",
--      "variant_ids": ["...", "..."] }
--  ]
--  Recalcula TODO en servidor; valida disponibilidad y min/max por grupo.
-- ---------------------------------------------------------------------
create or replace function public.create_order(
  p_table_number   smallint,
  p_payment_method public.payment_method,
  p_items          jsonb,
  p_customer_note  text default null
)
returns table (order_id uuid, public_token uuid, order_number int, total numeric)
language plpgsql security definer set search_path = public
as $$
#variable_conflict use_column
declare
  v_table     public.tables;
  v_order     public.orders;
  v_item      jsonb;
  v_product   public.products;
  v_item_id   uuid;
  v_unit      numeric(12,2);
  v_qty       int;
  v_subtotal  numeric(12,2) := 0;
  v_idx       int := 0;
  v_group     record;
  v_count     int;
begin
  select * into v_table from public.tables where number = p_table_number and is_active;
  if not found then raise exception 'Mesa inválida' using errcode = 'P0001'; end if;

  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'El pedido está vacío' using errcode = 'P0001';
  end if;

  insert into public.orders (table_id, table_number, payment_method, status, customer_note, sent_to_kitchen_at)
  values (
    v_table.id, v_table.number, p_payment_method,
    case when p_payment_method = 'mercadopago' then 'awaiting_payment'::order_status else 'received'::order_status end,
    left(p_customer_note, 280),
    case when p_payment_method = 'counter' then now() end
  )
  returning * into v_order;

  for v_item in select * from jsonb_array_elements(p_items) loop
    v_idx := v_idx + 1;
    v_qty := greatest(1, least(50, coalesce((v_item->>'quantity')::int, 1)));

    select * into v_product from public.products
     where id = (v_item->>'product_id')::uuid and is_active and is_available;
    if not found then raise exception 'Producto no disponible' using errcode = 'P0001'; end if;

    -- validar min/max por grupo
    for v_group in select g.* from public.product_variant_groups g where g.product_id = v_product.id loop
      select count(*) into v_count
        from public.product_variants v
       where v.group_id = v_group.id and v.is_available
         and v.id in (select (jsonb_array_elements_text(coalesce(v_item->'variant_ids','[]'::jsonb)))::uuid);
      if v_count < v_group.min_select or v_count > v_group.max_select then
        raise exception 'Selección inválida en "%"', v_group.name using errcode = 'P0001';
      end if;
    end loop;

    select v_product.price + coalesce(sum(v.price_delta), 0) into v_unit
      from public.product_variants v
      join public.product_variant_groups g on g.id = v.group_id and g.product_id = v_product.id
     where v.is_available
       and v.id in (select (jsonb_array_elements_text(coalesce(v_item->'variant_ids','[]'::jsonb)))::uuid);

    insert into public.order_items (order_id, product_id, product_name, unit_price, quantity, comment, line_total, sort_order)
    values (v_order.id, v_product.id, v_product.name, v_unit, v_qty,
            nullif(left(trim(v_item->>'comment'), 140), ''), v_unit * v_qty, v_idx)
    returning id into v_item_id;

    insert into public.order_item_variants (order_item_id, variant_id, group_name, variant_name, price_delta)
    select v_item_id, v.id, g.name, v.name, v.price_delta
      from public.product_variants v
      join public.product_variant_groups g on g.id = v.group_id and g.product_id = v_product.id
     where v.id in (select (jsonb_array_elements_text(coalesce(v_item->'variant_ids','[]'::jsonb)))::uuid)
     order by g.sort_order, v.sort_order;

    v_subtotal := v_subtotal + v_unit * v_qty;
  end loop;

  update public.orders o set subtotal = v_subtotal, total = v_subtotal
   where o.id = v_order.id;

  return query select v_order.id, v_order.public_token, v_order.order_number, v_subtotal;
end $$;

-- RPC: estado del pedido para el cliente (fallback de polling + carga inicial)
create or replace function public.get_order_by_token(p_token uuid)
returns jsonb
language sql stable security definer set search_path = public
as $$
  select jsonb_build_object(
    'id', o.id, 'order_number', o.order_number, 'table_number', o.table_number,
    'status', o.status, 'payment_method', o.payment_method, 'payment_status', o.payment_status,
    'total', o.total, 'created_at', o.created_at,
    'items', coalesce((
      select jsonb_agg(jsonb_build_object(
        'product_name', i.product_name, 'quantity', i.quantity, 'comment', i.comment,
        'line_total', i.line_total,
        'variants', coalesce((select jsonb_agg(jsonb_build_object('group_name', v.group_name, 'variant_name', v.variant_name, 'price_delta', v.price_delta))
                                from public.order_item_variants v where v.order_item_id = i.id), '[]'::jsonb)
      ) order by i.sort_order)
      from public.order_items i where i.order_id = o.id), '[]'::jsonb)
  )
  from public.orders o where o.public_token = p_token
$$;

-- RPC: cobrar en caja (admin)
create or replace function public.mark_order_paid(p_order_id uuid)
returns void language plpgsql security definer set search_path = public
as $$
declare v_order public.orders;
begin
  if not public.is_admin() then raise exception 'No autorizado' using errcode = '42501'; end if;
  update public.orders set payment_status = 'approved', paid_by = auth.uid()
   where id = p_order_id and payment_method = 'counter' and payment_status = 'pending'
   returning * into v_order;
  if found then
    insert into public.payments (order_id, provider, status, amount)
    values (v_order.id, 'counter', 'approved', v_order.total);
  end if;
end $$;

-- ---------------------------------------------------------------------
-- VISTA para KDS (una sola query con ítems y variantes anidadas)
-- security_invoker => respeta RLS del usuario que consulta
-- ---------------------------------------------------------------------
create or replace view public.kitchen_orders with (security_invoker = true) as
select
  o.id, o.order_number, o.table_number, o.status, o.payment_method, o.payment_status,
  o.customer_note, o.sent_to_kitchen_at, o.preparing_at, o.ready_at, o.created_at,
  coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', i.id, 'product_name', i.product_name, 'quantity', i.quantity, 'comment', i.comment,
      'variants', coalesce((select jsonb_agg(jsonb_build_object('group_name', v.group_name, 'variant_name', v.variant_name))
                              from public.order_item_variants v where v.order_item_id = i.id), '[]'::jsonb)
    ) order by i.sort_order)
    from public.order_items i where i.order_id = o.id), '[]'::jsonb) as items
from public.orders o
where o.status in ('received','preparing','ready');

-- ---------------------------------------------------------------------
-- ROW LEVEL SECURITY
-- ---------------------------------------------------------------------
alter table public.staff                  enable row level security;
alter table public.tables                 enable row level security;
alter table public.categories             enable row level security;
alter table public.products               enable row level security;
alter table public.product_variant_groups enable row level security;
alter table public.product_variants       enable row level security;
alter table public.orders                 enable row level security;
alter table public.order_items            enable row level security;
alter table public.order_item_variants    enable row level security;
alter table public.payments               enable row level security;

-- Catálogo: lectura pública (menú), escritura solo admin
create policy "menu read"  on public.categories for select using (is_active or public.is_admin());
create policy "menu write" on public.categories for all using (public.is_admin()) with check (public.is_admin());

create policy "products read"  on public.products for select using (is_active or public.is_admin());
create policy "products write" on public.products for all using (public.is_admin()) with check (public.is_admin());

create policy "pvg read"  on public.product_variant_groups for select using (true);
create policy "pvg write" on public.product_variant_groups for all using (public.is_admin()) with check (public.is_admin());

create policy "pv read"  on public.product_variants for select using (true);
create policy "pv write" on public.product_variants for all using (public.is_admin()) with check (public.is_admin());

create policy "tables read"  on public.tables for select using (is_active or public.is_admin());
create policy "tables write" on public.tables for all using (public.is_admin()) with check (public.is_admin());

-- Staff
create policy "staff self read" on public.staff for select using (user_id = auth.uid() or public.is_admin());
create policy "staff admin write" on public.staff for all using (public.is_admin()) with check (public.is_admin());

-- Pedidos: solo staff lee. Cocina puede actualizar (estado); admin todo.
-- El anon NO tiene policies => sin acceso directo (usa RPCs).
create policy "orders staff read"   on public.orders for select using (public.is_staff());
create policy "orders staff update" on public.orders for update using (public.is_staff()) with check (public.is_staff());
create policy "orders admin delete" on public.orders for delete using (public.is_admin());

create policy "items staff read"    on public.order_items         for select using (public.is_staff());
create policy "itemvar staff read"  on public.order_item_variants for select using (public.is_staff());
create policy "payments admin read" on public.payments            for select using (public.is_admin());

-- Cocina solo puede tocar la columna status (no montos ni pagos)
revoke update on public.orders from authenticated;
grant  update (status) on public.orders to authenticated;

grant execute on function public.create_order(smallint, public.payment_method, jsonb, text) to anon, authenticated;
grant execute on function public.get_order_by_token(uuid) to anon, authenticated;
grant execute on function public.mark_order_paid(uuid) to authenticated;
grant select on public.kitchen_orders to authenticated;

-- ---------------------------------------------------------------------
-- STORAGE: fotos de productos
-- ---------------------------------------------------------------------
insert into storage.buckets (id, name, public) values ('product-images', 'product-images', true)
on conflict (id) do nothing;

-- bucket público: las URLs públicas se sirven sin policy de SELECT (evita permitir listar el bucket)
create policy "product images admin write" on storage.objects for insert
  with check (bucket_id = 'product-images' and public.is_admin());
create policy "product images admin update" on storage.objects for update
  using (bucket_id = 'product-images' and public.is_admin());
create policy "product images admin delete" on storage.objects for delete
  using (bucket_id = 'product-images' and public.is_admin());
