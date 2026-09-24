# La Plancha 🍔

App de pedidos por QR para hamburguesería: menú para el cliente (mobile-first), pantalla de cocina (KDS) en tiempo real y panel de administración y caja con Mercado Pago.

## Correr en local

```bash
npm install
npm run dev
```

Sin variables de entorno la app arranca en **modo demo**: el backend se simula en el navegador y se sincroniza entre pestañas. Abrí `http://localhost:5173` y elegí una vista. Para ver el tiempo real, poné `/menu?mesa=4` y `/kitchen` en dos ventanas lado a lado.

- Login demo: `admin@laplancha.com` o `cocina@laplancha.com`, con cualquier contraseña de 4 o más caracteres.

## Con Supabase

El proyecto `la-plancha` (ref `wnyqcqwnbkmftnsjcgtw`, región São Paulo) ya tiene aplicadas las migraciones y el menú de ejemplo, y el `.env` ya apunta a él. Con `npm run dev` la app usa la base real.

### Usuarios de prueba

| Rol | Email | Entra a |
|---|---|---|
| Admin / Caja | `admin@laplancha.test` | `/admin` (y también `/kitchen`) |
| Cocina | `cocina@laplancha.test` | `/kitchen` |

Las contraseñas están en `CREDENCIALES.local.md`, un archivo local que git ignora y no se sube al repositorio. Para cambiarlas: Supabase → Authentication → Users.

### Proyecto nuevo desde cero

```bash
cp .env.example .env            # completar VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY
supabase link --project-ref <ref>
supabase db push                # aplica supabase/migrations (incluye el menú de ejemplo)
```

Para crear un usuario de staff: registrarlo en Auth y después
`insert into staff (user_id, full_name, role) values ('<uuid>', 'Caja', 'admin');`

Mercado Pago, arquitectura y roadmap: ver [docs/ARQUITECTURA.md](docs/ARQUITECTURA.md).
