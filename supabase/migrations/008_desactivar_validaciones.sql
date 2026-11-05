-- ============================================================================
-- 008 · Desactivar validación de dominio INTUR (rama version-3)
-- ============================================================================
-- Esta migración NO crea modo demo ni auto-promoción de roles.
-- Solo permite que solicitar_registro_intur() acepte cualquier correo.
--
-- La confirmación de correo se desactiva en Supabase Dashboard:
--   Authentication → Providers → Email → Confirm email = OFF
-- (no se puede cambiar desde SQL).
-- ============================================================================

begin;

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
    'mensaje', 'Solicitud registrada.'
  );
end;
$$;

grant execute on function public.solicitar_registro_intur(text, text, text) to anon, authenticated;

commit;
