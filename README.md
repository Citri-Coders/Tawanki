# Tawanki · Turismo Nicaragua Conecta

Sitio estático de conexión B2B entre pequeños productores locales de Nicaragua y empresas turísticas (hoteles, restaurantes y tour operadores). Incluye catálogo público, directorio privado, portales por rol y un panel institucional para INTUR.

## Arquitectura

- **Frontend:** HTML estático + Tailwind CSS (CDN) + JavaScript sin framework. Supabase JS `2.45.4` y Chart.js `4.4.3` se cargan con versión fija e `integrity` (SRI).
- **Datos y autenticación:** Supabase (Postgres + Auth + Storage + RLS).
- **Despliegue:** Vercel (sitio estático).
- **Capa de datos:** `supabase-config.js` centraliza autenticación, consultas, RPC, validaciones y utilidades de escape.

## Páginas

| Archivo | Acceso | Descripción |
| --- | --- | --- |
| `index.html` | Público | Portada y selector de rol. |
| `catalogo.html` | Público (solo lectura) | Catálogo de productos; cotizar requiere sesión de empresa. |
| `auth_empresa.html` | Público | Registro y acceso de empresas turísticas. |
| `auth_productor.html` | Público | Registro y acceso de productores locales. |
| `auth_intur.html` | Público con invitación | Acceso institucional; el rol INTUR se activa canjeando un código. |
| `proveedores.html` | Sesión requerida | Directorio B2B de productores. |
| `perfil-productor.html` | Productor | Productos, solicitudes y perfil del productor. |
| `dashboard-intur.html` | INTUR | KPIs, conexiones, verificación y reportes. |
| `reset-password.html` | Público | Recuperación de contraseña vía enlace de Supabase. |
| `404.html` | Público | Página de error personalizada. |

## Seguridad

- El rol **nunca** se toma de `user_metadata`: el trigger de base de datos lo fija y el cambio a INTUR solo ocurre mediante `canjear_codigo_intur`.
- El registro INTUR está cerrado por defecto. Los códigos se emiten con `emitir_codigo_intur` (función administrativa).
- Las políticas RLS son la frontera real de seguridad. El cliente no debe considerarse confiable.
- Las operaciones sensibles usan RPC `security definer`: `crear_solicitud`, `responder_match`, `verificar_productor`, `kpis_intur` y `crear_vinculacion_admin`.
- Los textos de usuarios se insertan con `textContent` o `escapeHtml`; las URLs pasan por `safeImageUrl`.
- Las imágenes se suben al bucket `avatars` (rutas por usuario) y no se guardan como base64 en Postgres.
- La clave `sb_publishable_...` es pública por diseño. No debe existir una `service_role` en el frontend.
- `vercel.json` envía una CSP. Como Tailwind se sirve por CDN en esta iteración, la política permite `'unsafe-inline'` y `'unsafe-eval'`; al compilar Tailwind a CSS local se pueden retirar ambos.

## Base de datos

Aplica las migraciones en orden desde el SQL Editor de Supabase:

1. `supabase/migrations/001_roles_y_perfiles.sql`
2. `supabase/migrations/002_matches_producto.sql`
3. `supabase/migrations/003_rls.sql`
4. `supabase/migrations/004_rpc.sql`
5. `supabase/migrations/005_storage.sql`

> Las migraciones usan comparaciones `id::text` para tolerar claves primarias `uuid` o `bigint`. Revisa las notas al inicio de cada archivo y ajusta nombres de columnas si tu esquema difiere.

### Crear el primer funcionario INTUR

1. Crea el usuario desde Supabase Auth (o regístralo en `auth_intur.html`).
2. Ejecuta en SQL:

```sql
select public.emitir_codigo_intur(24); -- devuelve un código INTUR-...
```

3. Inicia sesión con esa cuenta y canjea el código en `auth_intur.html` (pestaña Registrarse). El rol se eleva a `intur`.

### Variables y configuración

La URL y la clave publicable están en `supabase-config.js`. Para otro proyecto, cámbialas allí.

En **Authentication → URL Configuration** de Supabase agrega:

- `http://localhost:3000`
- `https://tawanki.vercel.app`
- `https://tawanki.vercel.app/reset-password.html`

## Desarrollo local

Al ser archivos estáticos, sirve la carpeta con cualquier servidor HTTP:

```bash
npx serve .
```

o

```bash
python -m http.server 3000
```

Abre `http://localhost:3000`.

## Despliegue en Vercel

1. Importa el repositorio en Vercel.
2. Framework preset: **Other**. Sin build command. Output directory: raíz del proyecto.
3. `vercel.json` define cabeceras de seguridad y cache de assets.
4. Actualiza `robots.txt` y `sitemap.xml` si cambia el dominio.

## Estructura

```
.
├── assets/
│   ├── favicon.svg
│   └── mosaico-nic.jpg
├── supabase/migrations/
├── auth_*.html
├── catalogo.html
├── dashboard-intur.html
├── index.html
├── perfil-productor.html
├── proveedores.html
├── reset-password.html
├── supabase-config.js
├── vercel.json
├── robots.txt
└── sitemap.xml
```

## Licencia

Ver `LICENSE`.
