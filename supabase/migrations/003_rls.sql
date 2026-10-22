-- ============================================================================
-- 003 · Row Level Security
-- Lectura pública del catálogo sin datos de contacto.
-- Escritura: solo el dueño del recurso o INTUR.
-- matches: escritura exclusivamente vía RPC (004_rpc.sql).
-- ============================================================================

-- ----------------------------------------------------------------------------
-- PROFILES
-- ----------------------------------------------------------------------------
alter table public.profiles enable row level security;

drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles
for select to authenticated
using (id = auth.uid() or public.es_intur());

drop policy if exists profiles_insert on public.profiles;
create policy profiles_insert on public.profiles
for insert to authenticated
with check (id = auth.uid() and rol in ('productor', 'empresa'));

drop policy if exists profiles_update on public.profiles;
create policy profiles_update on public.profiles
for update to authenticated
using (id = auth.uid())
with check (id = auth.uid());

-- rol/activo protegidos por el trigger profiles_proteger_campos.

-- ----------------------------------------------------------------------------
-- PRODUCTORES
-- ----------------------------------------------------------------------------
alter table public.productores enable row level security;

drop policy if exists productores_select on public.productores;
create policy productores_select on public.productores
for select to authenticated
using (true);

drop policy if exists productores_insert on public.productores;
create policy productores_insert on public.productores
for insert to authenticated
with check (profile_id = auth.uid());

drop policy if exists productores_update on public.productores;
create policy productores_update on public.productores
for update to authenticated
using (profile_id = auth.uid())
with check (profile_id = auth.uid());

drop policy if exists productores_admin on public.productores;
create policy productores_admin on public.productores
for all to authenticated
using (public.es_intur())
with check (public.es_intur());

-- verificado_intur/profile_id protegidos por trigger.

-- ----------------------------------------------------------------------------
-- PRODUCTOS
-- ----------------------------------------------------------------------------
alter table public.productos enable row level security;

drop policy if exists productos_select on public.productos;
create policy productos_select on public.productos
for select to anon, authenticated
using (true);

drop policy if exists productos_insert on public.productos;
create policy productos_insert on public.productos
for insert to authenticated
with check (
  exists (
    select 1 from public.productores pr
    where pr.id = productor_id and pr.profile_id = auth.uid()
  )
);

drop policy if exists productos_update on public.productos;
create policy productos_update on public.productos
for update to authenticated
using (
  exists (
    select 1 from public.productores pr
    where pr.id = productor_id and pr.profile_id = auth.uid()
  )
)
with check (
  exists (
    select 1 from public.productores pr
    where pr.id = productor_id and pr.profile_id = auth.uid()
  )
);

drop policy if exists productos_delete on public.productos;
create policy productos_delete on public.productos
for delete to authenticated
using (
  exists (
    select 1 from public.productores pr
    where pr.id = productor_id and pr.profile_id = auth.uid()
  )
);

drop policy if exists productos_admin on public.productos;
create policy productos_admin on public.productos
for all to authenticated
using (public.es_intur())
with check (public.es_intur());

-- productor_id protegido por trigger.

-- ----------------------------------------------------------------------------
-- EMPRESAS TURÍSTICAS
-- ----------------------------------------------------------------------------
alter table public.empresas_turisticas enable row level security;

-- Permite al productor ver los datos básicos de la empresa con la que tiene
-- una conexión, sin abrir el resto del directorio de empresas.
create or replace function public.empresa_en_mi_match(p_empresa_id text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.matches m
    join public.productores p on p.id = m.productor_id
    where m.empresa_id::text = p_empresa_id
      and p.profile_id = auth.uid()
  );
$$;

revoke all on function public.empresa_en_mi_match(text) from public, anon;
grant execute on function public.empresa_en_mi_match(text) to authenticated;

drop policy if exists empresas_select on public.empresas_turisticas;
create policy empresas_select on public.empresas_turisticas
for select to authenticated
using (
  profile_id = auth.uid()
  or public.es_intur()
  or public.empresa_en_mi_match(id::text)
);

drop policy if exists empresas_insert on public.empresas_turisticas;
create policy empresas_insert on public.empresas_turisticas
for insert to authenticated
with check (profile_id = auth.uid());

drop policy if exists empresas_update on public.empresas_turisticas;
create policy empresas_update on public.empresas_turisticas
for update to authenticated
using (profile_id = auth.uid())
with check (profile_id = auth.uid());

drop policy if exists empresas_admin on public.empresas_turisticas;
create policy empresas_admin on public.empresas_turisticas
for all to authenticated
using (public.es_intur())
with check (public.es_intur());

-- verificado_intur/profile_id protegidos por trigger.

-- ----------------------------------------------------------------------------
-- MATCHES: lectura por implicados; sin INSERT/UPDATE/DELETE directo
-- ----------------------------------------------------------------------------
alter table public.matches enable row level security;

drop policy if exists matches_select on public.matches;
create policy matches_select on public.matches
for select to authenticated
using (
  public.es_intur()
  or exists (
    select 1 from public.productores p
    where p.id = productor_id and p.profile_id = auth.uid()
  )
  or exists (
    select 1 from public.empresas_turisticas e
    where e.id = empresa_id and e.profile_id = auth.uid()
  )
);

-- ----------------------------------------------------------------------------
-- NOTIFICACIONES
-- ----------------------------------------------------------------------------
alter table public.notificaciones enable row level security;

drop policy if exists notif_select on public.notificaciones;
create policy notif_select on public.notificaciones
for select to authenticated
using (usuario_id = auth.uid());

drop policy if exists notif_update on public.notificaciones;
create policy notif_update on public.notificaciones
for update to authenticated
using (usuario_id = auth.uid())
with check (usuario_id = auth.uid());

-- ----------------------------------------------------------------------------
-- INTUR ADMINS: lectura propia/INTUR; escritura vía RPC
-- ----------------------------------------------------------------------------
alter table public.intur_admins enable row level security;

drop policy if exists intur_admins_select on public.intur_admins;
create policy intur_admins_select on public.intur_admins
for select to authenticated
using (profile_id = auth.uid() or public.es_intur());

-- ----------------------------------------------------------------------------
-- CATÁLOGOS BASE
-- ----------------------------------------------------------------------------
alter table public.departamentos enable row level security;
alter table public.rubros enable row level security;

drop policy if exists deptos_select on public.departamentos;
create policy deptos_select on public.departamentos
for select to anon, authenticated
using (true);

drop policy if exists rubros_select on public.rubros;
create policy rubros_select on public.rubros
for select to anon, authenticated
using (true);

drop policy if exists deptos_admin on public.departamentos;
create policy deptos_admin on public.departamentos
for all to authenticated
using (public.es_intur())
with check (public.es_intur());

drop policy if exists rubros_admin on public.rubros;
create policy rubros_admin on public.rubros
for all to authenticated
using (public.es_intur())
with check (public.es_intur());
