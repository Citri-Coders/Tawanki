# Tawanki · Turismo Nicaragua Conecta 🇳🇮

Plataforma digital para la articulación comercial B2B entre pequeños productores locales de Nicaragua y empresas del sector turístico (hoteles, restaurantes y tour operadores), respaldada por el monitoreo y validación institucional del **INTUR** (Instituto Nicaragüense de Turismo).

---

## 🚀 Características Principales

- **Catálogo Nacional de Insumos:** Exploración pública de productos locales por departamento y rubro, protegiendo los datos de contacto directo de los productores.
- **Directorio B2B Exclusivo:** Conexión directa y solicitud de cotizaciones entre empresas turísticas registradas y artesanos/productores.
- **Portales Especializados por Rol:**
  - 🧑‍🌾 **Portal del Productor Local:** Gestión de catálogo de productos, visualización de solicitudes y perfil de cooperativa/taller.
  - 🏨 **Portal Empresa Turística:** Búsqueda avanzada, solicitudes formales de cotización y gestión de proveedores.
  - 🏛️ **Panel Institucional INTUR:** Monitoreo en tiempo real de métricas e indicadores de impacto, vinculaciones comerciales asistidas, verificación oficial de productores y emisión de códigos de acreditación.
- **Arquitectura Segura y Ligera:** Frontend estático ultrarrápido con backend robusto serverless sobre Postgres y Supabase.

---

## 🛠️ Arquitectura y Tecnologías

| Componente | Tecnología | Detalle |
| --- | --- | --- |
| **Frontend** | HTML5 semántico + Vanilla JS | Sin dependencias pesadas ni frameworks de empaquetado |
| **Diseño y Estilos** | Tailwind CSS v3 | Compilado a `assets/tailwind.css` |
| **Base de Datos & Auth** | Supabase (PostgreSQL 15+) | Autenticación JWT, Triggers y Row Level Security (RLS) |
| **Almacenamiento** | Supabase Storage | Bucket `avatars` para fotos de perfil y de producto |
| **Métricas** | Chart.js 4.4.3 | Visualización de KPIs en el panel INTUR (con SRI) |
| **Despliegue** | Vercel | Sitio estático con cabeceras de seguridad CSP estrictas |

---

## 📁 Mapa del Sitio y Archivos

| Archivo | Acceso | Descripción |
| --- | --- | --- |
| [`index.html`](index.html) | Público | Portada de bienvenida y selector de roles. |
| [`catalogo.html`](catalogo.html) | Público (solo lectura) | Catálogo nacional de productos. Solicitar cotización exige inicio de sesión empresarial. |
| [`proveedores.html`](proveedores.html) | Autenticado | Directorio B2B de productores y artesanos locales. |
| [`perfil-productor.html`](perfil-productor.html) | Productor | Gestión de productos, pedidos y datos del taller o cooperativa. |
| [`dashboard-intur.html`](dashboard-intur.html) | INTUR | Panel de indicadores, verificación de productores y generación de invitaciones. |
| [`auth_productor.html`](auth_productor.html) | Público | Registro e inicio de sesión para productores. |
| [`auth_empresa.html`](auth_empresa.html) | Público | Registro e inicio de sesión para empresas turísticas. |
| [`auth_intur.html`](auth_intur.html) | Restringido | Acceso institucional para funcionarios INTUR mediante código de invitación. |
| [`reset-password.html`](reset-password.html) | Público | Recuperación de credenciales vía enlace seguro de Supabase. |
| [`404.html`](404.html) | Público | Página de error 404 con navegación integrada. |
| [`supabase-config.js`](supabase-config.js) | Frontend global | Capa unificada de servicios, cliente Supabase, sanitización XSS y utilidades. |

---

## 🔒 Modelo de Seguridad y Auditoría

1. **Autorización en Servidor (RLS & Triggers):**
   - El rol **nunca** se confía desde el cliente ni desde metadatos editables.
   - La elevación al rol `intur` se realiza de manera atómica e irreversible mediante la función segura `canjear_codigo_intur`.
   - Las escrituras críticas usan RPCs con `SECURITY DEFINER` y validación estricta de identidad (`auth.uid()`).
2. **Prevención de XSS:**
   - Todo dato dinámico proveniente de la base de datos se inserta mediante `textContent` o se procesa con `escapeHtml()`.
   - Sanitización de enlaces e imágenes mediante `safeUrl()` y `safeImageUrl()`.
3. **Políticas de Seguridad de Contenido (CSP):**
   - `vercel.json` implementa CSP estricta bloqueando `object-src`, restringiendo orígenes de conexión exclusivamente al dominio de Supabase y sus websockets.
4. **Almacenamiento Seguro:**
   - Las imágenes se cargan en el bucket `avatars` con aislamiento por carpeta de usuario (`auth.uid()`) y no se almacenan como cadenas base64 en Postgres.

---

## 🗄️ Base de Datos y Migraciones

### Instalación en un proyecto nuevo de Supabase

Si estás configurando una base de datos vacía en Supabase, tienes dos opciones:

#### Opción A: Script consolidado (Recomendado)
Pega y ejecuta el contenido completo de [`supabase/setup_tawanki.sql`](supabase/setup_tawanki.sql) en el **SQL Editor** de Supabase.

#### Opción B: Ejecución por pasos individuales
Ejecuta los archivos de la carpeta [`supabase/migrations/`](supabase/migrations/) en el siguiente orden secuencial:
1. `000_schema_base.sql` — Creación de tablas base (`departamentos`, `rubros`, `profiles`, `productores`, `empresas_turisticas`, `productos`, `matches`).
2. `001_roles_y_perfiles.sql` — Trigger de registro automático, roles y tabla de códigos INTUR.
3. `002_matches_producto.sql` — Columnas de producto y cantidad para cotizaciones B2B.
4. `003_rls.sql` — Políticas de Row Level Security para cada tabla.
5. `004_rpc.sql` — Procedimientos de negocio (`catalogo_publico`, `crear_solicitud`, `responder_match`, `verificar_productor`, `kpis_intur`, `crear_vinculacion_admin`).
6. `005_storage.sql` — Configuración del bucket `avatars` y sus políticas de lectura/escritura.
7. `006_pgcrypto_extensions.sql` — Ajuste de `search_path` para garantizar compatibilidad de cifrado (`digest`, `gen_random_bytes`).
8. `007_solicitudes_y_codigos_intur.sql` — Flujo institucional dual de registro y validación INTUR (directo o vía código a correo oficial).

### Verificación de la Base de Datos

Ejecuta en el SQL Editor de Supabase:

```sql
select 'departamentos' as tabla, count(*) from public.departamentos
union all select 'rubros', count(*) from public.rubros
union all select 'profiles', count(*) from public.profiles
union all select 'productores', count(*) from public.productores
union all select 'empresas_turisticas', count(*) from public.empresas_turisticas
union all select 'productos', count(*) from public.productos
union all select 'matches', count(*) from public.matches;
```

*Deben aparecer 15 departamentos y 5 rubros comerciales.*

---

## 🏛️ Creación de la Primera Cuenta de Funcionario INTUR

Dado que el registro de INTUR está protegido por invitación:

1. En el panel de Supabase (**Authentication → Users → Add user**):
   - Correo: `admin@intur.gob.ni` (o el correo institucional designado).
   - Contraseña segura.
   - Marca la casilla **Auto Confirm User**.
2. En el **SQL Editor** de Supabase, emite un código maestro:
   ```sql
   select public.emitir_codigo_intur(365); -- Genera un código válido por 1 año
   ```
3. Ve a `auth_intur.html`, selecciona la pestaña **Registrarse**, introduce tus datos institucionales y pega el código emitido. Tu cuenta quedará elevada con rol `intur`.

---

## 💻 Desarrollo Local

### 1. Requisitos previos
- Node.js (v18 o superior)
- npm

### 2. Instalación de dependencias y compilación CSS
```bash
npm install
npm run build:css
```

Para observar cambios en caliente durante el desarrollo de estilos:
```bash
npm run watch:css
```

### 3. Ejecutar suite de pruebas de integridad
Para validar la conexión con Supabase, catálogos, RPCs, Storage y rutas de assets locales:
```bash
node test_suite.js
```

### 4. Servir el sitio localmente
Inicia el servidor local de desarrollo con:
```bash
npm run dev
```
O alternativamente con `npm start`. Abre en tu navegador: `http://localhost:3000`

---

## 🚢 Despliegue en Vercel

1. Sube los cambios a tu repositorio en GitHub.
2. Vincula el proyecto en [Vercel](https://vercel.com).
3. Configuración del proyecto en Vercel:
   - **Framework Preset:** `Other`
   - **Root Directory:** `./`
   - **Build Command:** *(dejar vacío)*
   - **Output Directory:** *(dejar vacío)*
4. En **Authentication → URL Configuration** de Supabase, asegúrate de registrar la URL final de Vercel en *Redirect URLs* (ej. `https://tawanki.vercel.app/**` y `https://tawanki.vercel.app/reset-password.html`).

---

## 📄 Licencia

Este proyecto está bajo los términos especificados en el archivo [`LICENSE`](LICENSE).
