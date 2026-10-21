-- ============================================================================
-- 001 · Roles, perfiles y códigos de invitación INTUR
-- Ejecutar en el SQL Editor de Supabase (o con `supabase db push`).
-- Ajustar tipos (uuid -> bigint) si las claves primarias no son UUID.
-- ============================================================================

create extension if not exists pgcrypto;

-- ----------------------------------------------------------------------------
-- Helpers (SECURITY DEFINER para evitar recursión de RLS sobre profiles)
-- ----------------------------------------------------------------------------
create or replace function public.mi_rol()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select rol
  from public.profiles
  where id = auth.uid()
    and coalesce(activo, true)
$$;

create or replace function public.es_intur()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(public.mi_rol() = 'intur', false)
$$;

revoke all on function public.mi_rol() from public, anon;
revoke all on function public.es_intur() from public, anon;
grant execute on function public.mi_rol() to authenticated;
grant execute on function public.es_intur() to authenticated;

-- ----------------------------------------------------------------------------
-- Códigos de invitación INTUR (nunca en texto plano)
-- ----------------------------------------------------------------------------
create table if not exists public.codigos_intur (
  id uuid primary key default gen_random_uuid(),
  codigo_hash text not null unique,
  activo boolean not null default true,
  usado_por uuid references auth.users(id) on delete set null,
  usado_at timestamptz,
  expira_at timestamptz not null default now() + interval '30 days',
  created_at timestamptz not null default now()
);

alter table public.codigos_intur enable row level security;
-- Sin políticas: solo accesible vía RPC o service_role.

-- ----------------------------------------------------------------------------
-- Perfil automático al registrarse. NUNCA acepta 'intur' desde metadata.
-- ----------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_rol text;
begin
  v_rol := case
    when new.raw_user_meta_data->>'rol' in ('empresa', 'productor')
      then new.raw_user_meta_data->>'rol'
    else 'productor'
  end;

  insert into public.profiles (id, email, nombre_completo, rol, telefono, activo)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'nombre_completo', split_part(new.email, '@', 1)),
    v_rol,
    new.raw_user_meta_data->>'telefono',
    true
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

-- ----------------------------------------------------------------------------
-- Canje del código: única vía para obtener rol intur
-- ----------------------------------------------------------------------------
create or replace function public.canjear_codigo_intur(p_codigo text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  if auth.uid() is null then
    raise exception 'No autenticado';
  end if;

  if p_codigo is null or length(trim(p_codigo)) < 8 then
    raise exception 'Código inválido';
  end if;

  select id into v_id
  from public.codigos_intur
  where codigo_hash = encode(digest(trim(p_codigo), 'sha256'), 'hex')
    and activo = true
    and usado_por is null
    and expira_at > now()
  for update;

  if v_id is null then
    raise exception 'Código inválido o expirado';
  end if;

  update public.codigos_intur
     set usado_por = auth.uid(),
         usado_at = now(),
         activo = false
   where id = v_id;

  update public.profiles
     set rol = 'intur'
   where id = auth.uid();

  -- Solo se asume la columna profile_id. Si intur_admins exige otras columnas
  -- NOT NULL, agrégalas aquí con valores por defecto.
  insert into public.intur_admins (profile_id)
  values (auth.uid())
  on conflict (profile_id) do nothing;

  return true;
end;
$$;

revoke all on function public.canjear_codigo_intur(text) from public, anon;
grant execute on function public.canjear_codigo_intur(text) to authenticated;

-- ----------------------------------------------------------------------------
-- Emisión de códigos (solo service_role / SQL Editor)
-- ----------------------------------------------------------------------------
create or replace function public.emitir_codigo_intur(p_dias int default 30)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_codigo text;
begin
  v_codigo := 'INTUR-' || encode(gen_random_bytes(12), 'hex');

  insert into public.codigos_intur (codigo_hash, expira_at)
  values (
    encode(digest(v_codigo, 'sha256'), 'hex'),
    now() + make_interval(days => coalesce(p_dias, 30))
  );

  -- Mostrarlo una sola vez: no se puede recuperar después.
  return v_codigo;
end;
$$;

revoke all on function public.emitir_codigo_intur(int) from public, anon, authenticated;
grant execute on function public.emitir_codigo_intur(int) to service_role;

-- ----------------------------------------------------------------------------
-- Blindaje de columnas privilegiadas.
-- Los GRANT por columna no bastan si existe GRANT a nivel tabla; se usan
-- triggers que se ejecutan como definer (postgres) dentro de las RPC.
-- ----------------------------------------------------------------------------
create or replace function public.proteger_campos_privilegiados()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if current_user in ('postgres', 'supabase_admin', 'service_role') then
    return new;
  end if;

  if tg_op = 'INSERT' then
    if tg_table_name in ('productores', 'empresas_turisticas') then
      new.verificado_intur := false;
    end if;
    return new;
  end if;

  if not public.es_intur() then
    if tg_table_name = 'profiles' then
      new.rol := old.rol;
      new.activo := old.activo;
    elsif tg_table_name in ('productores', 'empresas_turisticas') then
      new.verificado_intur := old.verificado_intur;
    elsif tg_table_name = 'productos' then
      new.productor_id := old.productor_id;
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists profiles_proteger_campos on public.profiles;
create trigger profiles_proteger_campos
before update on public.profiles
for each row execute function public.proteger_campos_privilegiados();

drop trigger if exists productores_proteger_campos on public.productores;
create trigger productores_proteger_campos
before insert or update on public.productores
for each row execute function public.proteger_campos_privilegiados();

drop trigger if exists empresas_proteger_campos on public.empresas_turisticas;
create trigger empresas_proteger_campos
before insert or update on public.empresas_turisticas
for each row execute function public.proteger_campos_privilegiados();

drop trigger if exists productos_proteger_campos on public.productos;
create trigger productos_proteger_campos
before update on public.productos
for each row execute function public.proteger_campos_privilegiados();
