-- Helpers de RLS fuera del esquema expuesto por la API + EXECUTE mínimo en funciones SECURITY DEFINER
create schema if not exists private;
grant usage on schema private to anon, authenticated;

alter function public.is_admin()   set schema private;
alter function public.is_staff()   set schema private;
alter function public.staff_role() set schema private;
alter function private.is_admin()   set search_path = public;
alter function private.is_staff()   set search_path = public;
alter function private.staff_role() set search_path = public;

revoke execute on function public.broadcast_order_status() from public, anon, authenticated;
revoke execute on function public.mark_order_paid(uuid) from public, anon;
grant  execute on function public.mark_order_paid(uuid) to authenticated;
revoke execute on function public.create_order(smallint, public.payment_method, jsonb, text) from public;
grant  execute on function public.create_order(smallint, public.payment_method, jsonb, text) to anon, authenticated;
revoke execute on function public.get_order_by_token(uuid) from public;
grant  execute on function public.get_order_by_token(uuid) to anon, authenticated;

create or replace function public.mark_order_paid(p_order_id uuid)
returns void language plpgsql security definer set search_path = public
as $$
declare v_order public.orders;
begin
  if not private.is_admin() then raise exception 'No autorizado' using errcode = '42501'; end if;
  update public.orders set payment_status = 'approved', paid_by = auth.uid()
   where id = p_order_id and payment_method = 'counter' and payment_status = 'pending'
   returning * into v_order;
  if found then
    insert into public.payments (order_id, provider, status, amount)
    values (v_order.id, 'counter', 'approved', v_order.total);
  end if;
end $$;
