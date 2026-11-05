-- ============================================================================
-- 008 · Modo demo + rendimiento para la rama version-2
-- ============================================================================
-- Ejecutar DESPUÉS de 000–007. Este archivo:
--   1. Elimina la sobrecarga ambigua de canjear_codigo_intur(text).
--   2. Permite el registro INTUR con cualquier correo (modo demo).
--   3. Crea app_config + activar_intur_demo() para entrar sin código.
--   4. Crea mi_contexto() para reducir llamadas desde el frontend.
--   5. Agrega índices para catálogo, matches y notificaciones.
--   6. Genera notificaciones automáticas al crear/cambiar un match.
--
-- ADVERTENCIA: activar_intur_demo() permite que cualquier usuario
-- autenticado se convierta en INTUR. Es exclusivo para la demo.
-- En producción, desactivar demo_mode o no ejecutar la sección de demo.
-- ============================================================================

begin;

-- ----------------------------------------------------------------------------
-- 1. Sobrecarga ambigua: el frontend usa canjear_codigo_intur(text, text)
-- ----------------------------------------------------------------------------
drop function if exists public.canjear_codigo_intur(text);

-- ----------------------------------------------------------------------------
-- 2. Registro INTUR sin restricción de dominio
-- ----------------------------------------------------------------------------
create or replace function public.solicitar_registro_intur(
  p_nombre text,
  p_email text,
  p_telefono text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_email_limpio text;
  v_codigo text;
  v_hash text;
begin
  v_email_limpio := lower(trim(p_email));

  if v_email_limpio is null or position('@' in v_email_limpio) < 2 then
    raise exception 'Ingresa un correo electrónico válido';
  end if;

  v_codigo := 'INTUR-' || lpad(floor(random() * 900000 + 100000)::text, 6, '0');
  v_hash := encode(digest(v_codigo, 'sha256'), 'hex');

  update public.codigos_intur
     set codigo_visible = v_codigo,
         codigo_hash = v_hash,
         nombre_funcionario = coalesce(p_nombre, nombre_funcionario),
         activo = true,
         estado = 'pendiente',
         intentos = 0,
         expira_at = now() + interval '30 days'
   where lower(email_asignado) = v_email_limpio
     and estado = 'pendiente';

  if not found then
    insert into public.codigos_intur (
      email_asignado,
      nombre_funcionario,
      codigo_visible,
      codigo_hash,
      activo,
      estado,
      expira_at
    ) values (
      v_email_limpio,
      trim(p_nombre),
      v_codigo,
      v_hash,
      true,
      'pendiente',
      now() + interval '30 days'
    );
  end if;

  return jsonb_build_object(
    'ok', true,
    'email', v_email_limpio,
    'mensaje', 'Solicitud registrada. En modo demo la cuenta se activa automáticamente.'
  );
end;
$$;

grant execute on function public.solicitar_registro_intur(text, text, text) to anon, authenticated;

-- ----------------------------------------------------------------------------
-- 3. Configuración de demo
-- ----------------------------------------------------------------------------
create table if not exists public.app_config (
  clave text primary key,
  valor jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.app_config enable row level security;
-- Sin políticas: solo se lee desde funciones SECURITY DEFINER.

insert into public.app_config (clave, valor)
values ('demo_mode', '{"activo": true}'::jsonb)
on conflict (clave) do update
  set valor = excluded.valor,
      updated_at = now();

create or replace function public.demo_mode_activo()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select (valor->>'activo')::boolean
       from public.app_config
      where clave = 'demo_mode'),
    false
  );
$$;

revoke all on function public.demo_mode_activo() from public, anon;
grant execute on function public.demo_mode_activo() to authenticated;

create or replace function public.activar_intur_demo()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'No autenticado';
  end if;

  if not public.demo_mode_activo() then
    raise exception 'El modo demo está desactivado';
  end if;

  update public.profiles
     set rol = 'intur',
         activo = true
   where id = auth.uid();

  insert into public.intur_admins (profile_id)
  values (auth.uid())
  on conflict (profile_id) do nothing;

  return jsonb_build_object('ok', true, 'rol', 'intur');
end;
$$;

revoke all on function public.activar_intur_demo() from public, anon;
grant execute on function public.activar_intur_demo() to authenticated;

-- ----------------------------------------------------------------------------
-- 4. Contexto de sesión en una sola llamada
-- ----------------------------------------------------------------------------
create or replace function public.mi_contexto()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'profile', to_jsonb(p),
    'productor', (
      select to_jsonb(pr)
      from public.productores pr
      where pr.profile_id = p.id
      limit 1
    ),
    'empresa', (
      select to_jsonb(e)
      from public.empresas_turisticas e
      where e.profile_id = p.id
      limit 1
    ),
    'intur', (
      select to_jsonb(i)
      from public.intur_admins i
      where i.profile_id = p.id
      limit 1
    )
  )
  from public.profiles p
  where p.id = auth.uid();
$$;

revoke all on function public.mi_contexto() from public, anon;
grant execute on function public.mi_contexto() to authenticated;

-- ----------------------------------------------------------------------------
-- 5. Índices de rendimiento
-- ----------------------------------------------------------------------------
create index if not exists productos_disponibles_idx
  on public.productos (rubro_id, created_at desc)
  where disponible;

create index if not exists productores_depto_rubro_idx
  on public.productores (departamento_id, rubro_id);

create index if not exists matches_empresa_created_idx
  on public.matches (empresa_id, created_at desc);

create index if not exists matches_productor_created_idx
  on public.matches (productor_id, created_at desc);

create index if not exists matches_estado_created_idx
  on public.matches (estado, created_at desc);

create index if not exists notif_usuario_leido_idx
  on public.notificaciones (usuario_id, leido);

create index if not exists profiles_email_lower_idx
  on public.profiles (lower(email));

create index if not exists intur_admins_departamento_idx
  on public.intur_admins (departamento_id);

create index if not exists codigos_intur_email_estado_idx
  on public.codigos_intur (lower(email_asignado), estado);

create extension if not exists pg_trgm;

create index if not exists productos_nombre_trgm_idx
  on public.productos using gin (nombre gin_trgm_ops);

create index if not exists productores_nombre_trgm_idx
  on public.productores using gin (nombre_cooperativa_o_taller gin_trgm_ops);

-- ----------------------------------------------------------------------------
-- 6. Notificaciones automáticas de matches
-- ----------------------------------------------------------------------------
create or replace function public.notificar_match()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    insert into public.notificaciones (usuario_id, titulo, mensaje, tipo)
    select pr.profile_id,
           'Nueva solicitud de cotización',
           format('La empresa %s solicitó %s %s.', e.nombre_comercial, new.cantidad, coalesce(pr2.unidad_medida, 'unidad')),
           'match'
    from public.productores pr
    join public.empresas_turisticas e on e.id = new.empresa_id
    left join public.productos pr2 on pr2.id = new.producto_id
    where pr.id = new.productor_id;

    insert into public.notificaciones (usuario_id, titulo, mensaje, tipo)
    select e.profile_id,
           'Solicitud enviada',
           format('Tu solicitud al productor %s fue registrada.', pr.nombre_cooperativa_o_taller),
           'match'
    from public.empresas_turisticas e
    join public.productores pr on pr.id = new.productor_id
    where e.id = new.empresa_id;
  elsif tg_op = 'UPDATE' and old.estado is distinct from new.estado then
    insert into public.notificaciones (usuario_id, titulo, mensaje, tipo)
    select pr.profile_id,
           'Solicitud actualizada',
           format('La solicitud cambió de %s a %s.', old.estado, new.estado),
           'match'
    from public.productores pr
    where pr.id = new.productor_id;

    insert into public.notificaciones (usuario_id, titulo, mensaje, tipo)
    select e.profile_id,
           'Solicitud actualizada',
           format('La solicitud cambió de %s a %s.', old.estado, new.estado),
           'match'
    from public.empresas_turisticas e
    where e.id = new.empresa_id;
  end if;

  return new;
end;
$$;

drop trigger if exists matches_notificar on public.matches;
create trigger matches_notificar
after insert or update of estado on public.matches
for each row execute function public.notificar_match();

commit;
