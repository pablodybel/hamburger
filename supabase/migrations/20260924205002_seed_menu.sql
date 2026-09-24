-- Menú inicial, mesas y variantes con sus adicionales (price_delta)
insert into public.tables (number, label)
select n, case when n > 10 then 'Terraza ' || (n - 10) else null end
from generate_series(1, 14) n;

insert into public.categories (name, slug, sort_order) values
  ('Hamburguesas', 'hamburguesas', 1),
  ('Acompañamientos', 'acompanamientos', 2),
  ('Bebidas', 'bebidas', 3),
  ('Postres', 'postres', 4);

with c as (select id, slug from public.categories)
insert into public.products (category_id, name, description, price, sort_order)
select c.id, p.name, p.descr, p.price, p.ord
from (values
  ('hamburguesas', 'La Clásica',   'Smash de 110g, cheddar, cebolla, pepinos y salsa de la casa.', 8900, 1),
  ('hamburguesas', 'Bacon Brava',  'Doble cheddar, panceta crocante, barbacoa ahumada.',          10900, 2),
  ('hamburguesas', 'La Picante',   'Pepper jack, jalapeños encurtidos, mayo de chipotle.',          10400, 3),
  ('hamburguesas', 'Hongo Negro',  'Medallón de hongos y porotos, provoleta, rúcula.',              9800, 4),
  ('acompanamientos', 'Papas Bastón', 'Doble cocción, sal de mar.',                                  4200, 1),
  ('acompanamientos', 'Papas Cheddar & Verdeo', 'Con salsa cheddar y cebolla de verdeo.',            5600, 2),
  ('acompanamientos', 'Aros de Cebolla', 'Rebozado de cerveza, dip ranch.',                          4900, 3),
  ('bebidas', 'Limonada de la Casa', 'Menta y jengibre. 500ml.',                                     3200, 1),
  ('bebidas', 'Gaseosa Línea Coca', 'Lata 354ml.',                                                    2400, 2),
  ('bebidas', 'IPA Tirada', 'Pinta 473ml.',                                                          4800, 3),
  ('postres', 'Brownie Tibio', 'Con helado de crema americana.',                                     4600, 1),
  ('postres', 'Milkshake Dulce de Leche', '400ml, crema batida.',                                    5200, 2)
) as p(cat, name, descr, price, ord)
join c on c.slug = p.cat;

-- Variantes para todas las hamburguesas
do $$
declare r record; g_med uuid; g_ext uuid; g_combo uuid; g_ad uuid;
begin
  for r in select p.id from public.products p join public.categories c on c.id = p.category_id where c.slug = 'hamburguesas' loop
    insert into public.product_variant_groups (product_id, name, min_select, max_select, sort_order)
      values (r.id, 'Medallón', 1, 1, 1) returning id into g_med;
    insert into public.product_variants (group_id, name, price_delta, is_default, sort_order) values
      (g_med, 'Simple', 0, true, 1), (g_med, 'Doble', 2500, false, 2), (g_med, 'Triple', 4800, false, 3);

    -- Extras: cada opción suma su price_delta al precio base (editable desde /admin/menu)
    insert into public.product_variant_groups (product_id, name, min_select, max_select, sort_order)
      values (r.id, 'Extras', 0, 5, 2) returning id into g_ext;
    insert into public.product_variants (group_id, name, price_delta, sort_order) values
      (g_ext, 'Doble cheddar', 1200, 1), (g_ext, 'Panceta extra', 1500, 2), (g_ext, 'Huevo frito', 1000, 3),
      (g_ext, 'Cebolla caramelizada', 900, 4), (g_ext, 'Pepinos extra', 500, 5);

    insert into public.product_variant_groups (product_id, name, min_select, max_select, sort_order)
      values (r.id, 'Hacelo combo', 0, 1, 3) returning id into g_combo;
    insert into public.product_variants (group_id, name, price_delta, sort_order) values
      (g_combo, 'Con papas + bebida', 4900, 1);

    insert into public.product_variant_groups (product_id, name, min_select, max_select, sort_order)
      values (r.id, 'Aderezos', 0, 4, 4) returning id into g_ad;
    insert into public.product_variants (group_id, name, price_delta, sort_order) values
      (g_ad, 'Mayo de ajo', 0, 1), (g_ad, 'Barbacoa', 0, 2), (g_ad, 'Ketchup', 0, 3), (g_ad, 'Mostaza', 0, 4), (g_ad, 'Salsa cheddar extra', 900, 5);
  end loop;
end $$;
