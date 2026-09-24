-- Índices para FKs
create index if not exists oiv_variant_idx       on public.order_item_variants(variant_id);
create index if not exists order_items_product_idx on public.order_items(product_id);
create index if not exists orders_paid_by_idx     on public.orders(paid_by);
create index if not exists payments_order_idx     on public.payments(order_id);

-- Las policies "write" eran FOR ALL (incluían SELECT) => duplicaban la de lectura.
-- Se separan en insert/update/delete y se envuelven las funciones en (select ...) para evaluarlas una vez.
do $$
declare t text;
begin
  foreach t in array array['categories','products','product_variant_groups','product_variants','tables'] loop
    execute format('drop policy if exists %I on public.%I',
      case t when 'categories' then 'menu write' when 'products' then 'products write'
             when 'product_variant_groups' then 'pvg write' when 'product_variants' then 'pv write'
             else 'tables write' end, t);
    execute format('create policy "admin insert" on public.%I for insert to authenticated with check ((select private.is_admin()))', t);
    execute format('create policy "admin update" on public.%I for update to authenticated using ((select private.is_admin())) with check ((select private.is_admin()))', t);
    execute format('create policy "admin delete" on public.%I for delete to authenticated using ((select private.is_admin()))', t);
  end loop;
end $$;

drop policy "menu read" on public.categories;
create policy "menu read" on public.categories for select using (is_active or (select private.is_admin()));
drop policy "products read" on public.products;
create policy "products read" on public.products for select using (is_active or (select private.is_admin()));
drop policy "tables read" on public.tables;
create policy "tables read" on public.tables for select using (is_active or (select private.is_admin()));

drop policy "staff self read" on public.staff;
drop policy "staff admin write" on public.staff;
create policy "staff read"   on public.staff for select using (user_id = (select auth.uid()) or (select private.is_admin()));
create policy "staff insert" on public.staff for insert to authenticated with check ((select private.is_admin()));
create policy "staff update" on public.staff for update to authenticated using ((select private.is_admin())) with check ((select private.is_admin()));
create policy "staff delete" on public.staff for delete to authenticated using ((select private.is_admin()));

drop policy "orders staff read" on public.orders;
drop policy "orders staff update" on public.orders;
drop policy "orders admin delete" on public.orders;
create policy "orders staff read"   on public.orders for select to authenticated using ((select private.is_staff()));
create policy "orders staff update" on public.orders for update to authenticated using ((select private.is_staff())) with check ((select private.is_staff()));
create policy "orders admin delete" on public.orders for delete to authenticated using ((select private.is_admin()));

drop policy "items staff read" on public.order_items;
drop policy "itemvar staff read" on public.order_item_variants;
drop policy "payments admin read" on public.payments;
create policy "items staff read"    on public.order_items         for select to authenticated using ((select private.is_staff()));
create policy "itemvar staff read"  on public.order_item_variants for select to authenticated using ((select private.is_staff()));
create policy "payments admin read" on public.payments            for select to authenticated using ((select private.is_admin()));

drop policy "product images admin write"  on storage.objects;
drop policy "product images admin update" on storage.objects;
drop policy "product images admin delete" on storage.objects;
create policy "product images admin write"  on storage.objects for insert to authenticated with check (bucket_id = 'product-images' and (select private.is_admin()));
create policy "product images admin update" on storage.objects for update to authenticated using (bucket_id = 'product-images' and (select private.is_admin()));
create policy "product images admin delete" on storage.objects for delete to authenticated using (bucket_id = 'product-images' and (select private.is_admin()));
