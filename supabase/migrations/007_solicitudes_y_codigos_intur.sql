-- ============================================================================
-- 007_solicitudes_y_codigos_intur.sql
-- Tawanki · INTUR 2026: Flujo institucional de registro y verificación dual
-- Permite:
--  1. Registro inicial sin código previo.
--  2. Generación de código visible en Supabase asociado específicamente al correo.
--  3. Aprobación Dual:
--     - Opción A: Aprobado directo por el Admin TI (sin código).
--     - Opción B: Aprobado previa verificación vía correo con código OTP (INTUR-XXXXXX).
-- ============================================================================

-- 1. Ampliación de columnas en codigos_intur
alter table public.codigos_intur
  add column if not exists email_asignado text,
  add column if not exists nombre_funcionario text,
  add column if not exists codigo_visible text,
  add column if not exists metodo_aprobacion text default 'correo_verificacion',
  add column if not exists estado text default 'pendiente',
  add column if not exists intentos int default 0;

create index if not exists idx_codigos_intur_email on public.codigos_intur (lower(email_asignado));
create index if not exists idx_codigos_intur_estado on public.codigos_intur (estado);

-- ----------------------------------------------------------------------------
-- 2. Función para registrar solicitud institucional (o auto-generarla al registrarse)
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

  if v_email_limpio is null or not (v_email_limpio like '%@intur.gob.ni') then
    raise exception 'El registro institucional requiere un correo oficial terminado en @intur.gob.ni';
  end if;

  -- Generar código legible de 6 dígitos con prefijo INTUR (ej. INTUR-492018)
  v_codigo := 'INTUR-' || lpad(floor(random() * 900000 + 100000)::text, 6, '0');
  v_hash := encode(digest(v_codigo, 'sha256'), 'hex');

  -- Si ya existía solicitud pendiente para este correo, actualizamos el código
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
    'mensaje', 'Solicitud registrada exitosamente. Pendiente de aprobación por TI o verificación por correo.'
  );
end;
$$;

grant execute on function public.solicitar_registro_intur(text, text, text) to anon, authenticated;

-- ----------------------------------------------------------------------------
-- 3. Opción A: Aprobación directa por el Administrador de TI (sin código)
-- ----------------------------------------------------------------------------
create or replace function public.aprobar_intur_directo(p_email text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_email_limpio text;
  v_profile_id uuid;
begin
  v_email_limpio := lower(trim(p_email));

  -- Buscar el perfil por correo
  select id into v_profile_id
  from public.profiles
  where lower(email) = v_email_limpio;

  if v_profile_id is null then
    raise exception 'No se encontró ningún usuario registrado con el correo: %', p_email;
  end if;

  -- 1. Asignar rol institucional activo
  update public.profiles
     set rol = 'intur',
         activo = true
   where id = v_profile_id;

  -- 2. Registrar en tabla de administradores
  insert into public.intur_admins (profile_id)
  values (v_profile_id)
  on conflict (profile_id) do nothing;

  -- 3. Marcar la solicitud como aprobada directamente por TI
  update public.codigos_intur
     set estado = 'aprobado_directo',
         activo = false,
         usado_por = v_profile_id,
         usado_at = now()
   where lower(email_asignado) = v_email_limpio;

  return jsonb_build_object(
    'ok', true,
    'email', v_email_limpio,
    'mensaje', 'Usuario aprobado directamente con rol INTUR.'
  );
end;
$$;

revoke all on function public.aprobar_intur_directo(text) from public, anon;
grant execute on function public.aprobar_intur_directo(text) to service_role;

-- ----------------------------------------------------------------------------
-- 4. Opción B: Canjear / Validar código de verificación institucional
-- Valida que el código coincida y que pertenezca ESPECÍFICAMENTE al correo del usuario.
-- ----------------------------------------------------------------------------
create or replace function public.canjear_codigo_intur(
  p_codigo text,
  p_email text default null
)
returns boolean
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_id uuid;
  v_target_user uuid;
  v_target_email text;
  v_email_asignado text;
  v_hash text;
begin
  if p_codigo is null or length(trim(p_codigo)) < 6 then
    raise exception 'Código de verificación inválido';
  end if;

  -- Identificar el usuario y correo objetivo
  if auth.uid() is not null then
    v_target_user := auth.uid();
    select lower(email) into v_target_email from public.profiles where id = v_target_user;
  elsif p_email is not null then
    v_target_email := lower(trim(p_email));
    select id into v_target_user from public.profiles where lower(email) = v_target_email;
  else
    raise exception 'Debes estar autenticado o proporcionar tu correo institucional';
  end if;

  v_hash := encode(digest(trim(p_codigo), 'sha256'), 'hex');

  -- Buscar código por hash o por coincidencia directa legible
  select id, email_asignado into v_id, v_email_asignado
  from public.codigos_intur
  where (codigo_hash = v_hash or upper(codigo_visible) = upper(trim(p_codigo)))
    and activo = true
    and usado_por is null
    and expira_at > now()
  for update;

  if v_id is null then
    raise exception 'Código de verificación inválido, usado o expirado';
  end if;

  -- Comprobar vinculación estricta al correo
  if v_email_asignado is not null and v_target_email is not null then
    if lower(v_email_asignado) <> v_target_email then
      raise exception 'Este código de verificación no fue emitido para este correo institucional';
    end if;
  end if;

  -- Marcar código como usado
  update public.codigos_intur
     set usado_por = v_target_user,
         usado_at = now(),
         activo = false,
         estado = 'verificado_correo'
   where id = v_id;

  -- Si el perfil existe, promover a intur
  if v_target_user is not null then
    update public.profiles
       set rol = 'intur',
           activo = true
     where id = v_target_user;

    insert into public.intur_admins (profile_id)
    values (v_target_user)
    on conflict (profile_id) do nothing;
  end if;

  return true;
end;
$$;

revoke all on function public.canjear_codigo_intur(text, text) from public;
grant execute on function public.canjear_codigo_intur(text, text) to anon, authenticated, service_role;
