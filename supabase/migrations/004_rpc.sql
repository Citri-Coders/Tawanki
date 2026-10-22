-- ============================================================================
-- 004 · RPC de negocio
-- Las firmas usan `text` para los IDs y hacen cast lógico (`id::text`), de modo
-- que funcionan tanto con PK uuid como bigint. Si todos los PK son uuid se
-- pueden endurecer a uuid.
-- Devuelven json para no atar el contrato al esquema.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Catálogo público: sin teléfonos ni emails.
-- ----------------------------------------------------------------------------
create or replace function public.catalogo_publico(p_limit int default 200)
returns json
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(json_agg(row_to_json(t)), '[]'::json)
  from (
    select
      p.id,
      p.nombre,
      p.descripcion,
      p.precio_unitario,
      p.unidad_medida,
      p.badge_distintivo,
      p.imagen_url,
      p.disponible,
      p.created_at,
      pr.id            as productor_id,
      pr.nombre_cooperativa_o_taller as productor_nombre,
      pr.municipio     as productor_municipio,
      d.nombre         as departamento,
      r.nombre         as rubro,
      pr.verificado_intur as verificado
    from public.productos p
    join public.productores pr on pr.id = p.productor_id
    left join public.departamentos d on d.id = pr.departamento_id
    left join public.rubros r on r.id = pr.rubro_id
    where p.disponible is not false
    order by p.created_at desc
    limit least(coalesce(p_limit, 200), 500)
  ) t;
$$;

grant execute on function public.catalogo_publico(int) to anon, authenticated;

-- ----------------------------------------------------------------------------
-- Crear solicitud de cotización (solo empresa autenticada)
-- ----------------------------------------------------------------------------
create or replace function public.crear_solicitud(
  p_producto_id text,
  p_cantidad int,
  p_mensaje text default null
)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_prod public.productos;
  v_emp public.empresas_turisticas;
  v_match public.matches;
begin
  if auth.uid() is null then
    raise exception 'No autenticado';
  end if;

  select * into v_emp
  from public.empresas_turisticas
  where profile_id = auth.uid()
  limit 1;

  if not found then
    raise exception 'Tu cuenta no tiene una empresa asociada';
  end if;

  select * into v_prod
  from public.productos
  where id::text = p_producto_id;

  if not found then
    raise exception 'El producto no existe';
  end if;

  if v_prod.disponible is false then
    raise exception 'El producto ya no está disponible';
  end if;

  if p_cantidad is null or p_cantidad < 1 or p_cantidad > 100000 then
    raise exception 'Cantidad inválida';
  end if;

  if v_prod.productor_id in (
    select id from public.productores where profile_id = auth.uid()
  ) then
    raise exception 'No puedes cotizar tu propio producto';
  end if;

  if exists (
    select 1 from public.matches m
    where m.producto_id = v_prod.id
      and m.empresa_id = v_emp.id
      and m.estado = 'Pendiente'
  ) then
    raise exception 'Ya existe una solicitud pendiente para este producto';
  end if;

  insert into public.matches (
    productor_id, empresa_id, producto_id, cantidad, compatibilidad,
    descripcion_acuerdo, monto_estimado_cordobas, estado
  ) values (
    v_prod.productor_id,
    v_emp.id,
    v_prod.id,
    p_cantidad,
    0,
    coalesce(
      nullif(trim(p_mensaje), ''),
      format('Solicitud de %s %s', p_cantidad, coalesce(v_prod.unidad_medida, 'unidad'))
    ),
    coalesce(v_prod.precio_unitario, 0) * p_cantidad,
    'Pendiente'
  )
  returning * into v_match;

  return to_jsonb(v_match);
end;
$$;

revoke all on function public.crear_solicitud(text, int, text) from public, anon;
grant execute on function public.crear_solicitud(text, int, text) to authenticated;

-- ----------------------------------------------------------------------------
-- Responder un match (productor dueño o INTUR). Bloquea el producto solicitado.
-- ----------------------------------------------------------------------------
create or replace function public.responder_match(p_match_id text, p_estado text)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_match public.matches;
begin
  if p_estado not in ('Aprobado', 'Rechazado', 'En_Negociacion', 'Finalizado', 'Pendiente') then
    raise exception 'Estado inválido';
  end if;

  select * into v_match
  from public.matches
  where id::text = p_match_id
  for update;

  if not found then
    raise exception 'Match inexistente';
  end if;

  if not public.es_intur() and not exists (
    select 1 from public.productores p
    where p.id = v_match.productor_id and p.profile_id = auth.uid()
  ) then
    raise exception 'No autorizado';
  end if;

  if p_estado = 'Aprobado' and v_match.estado not in ('Pendiente', 'En_Negociacion') then
    raise exception 'Transición no permitida desde %', v_match.estado;
  end if;

  if p_estado = 'Aprobado' and v_match.producto_id is not null then
    update public.productos
       set disponible = false
     where id = v_match.producto_id
       and disponible is distinct from false;
  end if;

  update public.matches
     set estado = p_estado,
         updated_at = now()
   where id::text = p_match_id
  returning * into v_match;

  return to_jsonb(v_match);
end;
$$;

revoke all on function public.responder_match(text, text) from public, anon;
grant execute on function public.responder_match(text, text) to authenticated;

-- ----------------------------------------------------------------------------
-- Verificación INTUR de productores/empresas
-- ----------------------------------------------------------------------------
create or replace function public.verificar_productor(p_productor_id text, p_verificado boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.es_intur() then
    raise exception 'No autorizado';
  end if;

  update public.productores
     set verificado_intur = p_verificado
   where id::text = p_productor_id;
end;
$$;

revoke all on function public.verificar_productor(text, boolean) from public, anon;
grant execute on function public.verificar_productor(text, boolean) to authenticated;

-- ----------------------------------------------------------------------------
-- KPIs reales del dashboard INTUR
-- ----------------------------------------------------------------------------
create or replace function public.kpis_intur()
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v json;
begin
  if not public.es_intur() then
    raise exception 'No autorizado';
  end if;

  select json_build_object(
    'productores', (select count(*) from public.productores),
    'empresas', (select count(*) from public.empresas_turisticas),
    'matches', (select count(*) from public.matches),
    'volumen', (
      select coalesce(sum(monto_estimado_cordobas), 0)
      from public.matches
      where estado in ('Aprobado', 'Finalizado')
    ),
    'por_estado', coalesce((
      select json_object_agg(estado, total)
      from (select estado, count(*) as total from public.matches group by estado) s
    ), '{}'::json),
    'por_departamento', coalesce((
      select json_object_agg(nombre, total)
      from (
        select d.nombre, count(*) as total
        from public.matches m
        join public.productores p on p.id = m.productor_id
        join public.departamentos d on d.id = p.departamento_id
        group by d.nombre
      ) s
    ), '{}'::json),
    'por_rubro', coalesce((
      select json_object_agg(nombre, total)
      from (
        select r.nombre, count(*) as total
        from public.matches m
        join public.productores p on p.id = m.productor_id
        join public.rubros r on r.id = p.rubro_id
        group by r.nombre
      ) s
    ), '{}'::json)
  ) into v;

  return v;
end;
$$;

revoke all on function public.kpis_intur() from public, anon;
grant execute on function public.kpis_intur() to authenticated;

-- ----------------------------------------------------------------------------
-- Vinculación manual creada por INTUR (reemplaza el formulario de texto libre)
-- ----------------------------------------------------------------------------
create or replace function public.crear_vinculacion_admin(
  p_productor_id text,
  p_empresa_id text,
  p_producto_id text default null,
  p_cantidad int default 1,
  p_notas text default null,
  p_estado text default 'Pendiente'
)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_match public.matches;
  v_prod public.productos;
  v_monto numeric := 0;
begin
  if not public.es_intur() then
    raise exception 'No autorizado';
  end if;

  if p_estado not in ('Pendiente', 'Aprobado', 'En_Negociacion', 'Finalizado') then
    raise exception 'Estado inválido';
  end if;

  if p_cantidad is null or p_cantidad < 1 or p_cantidad > 100000 then
    raise exception 'Cantidad inválida';
  end if;

  if p_producto_id is not null then
    select * into v_prod from public.productos where id::text = p_producto_id;
    if not found then
      raise exception 'El producto no existe';
    end if;
    if v_prod.productor_id::text <> p_productor_id then
      raise exception 'El producto no pertenece al productor seleccionado';
    end if;
    v_monto := coalesce(v_prod.precio_unitario, 0) * p_cantidad;
  end if;

  insert into public.matches (
    productor_id, empresa_id, producto_id, cantidad,
    compatibilidad, descripcion_acuerdo, monto_estimado_cordobas, estado
  ) values (
    (select id from public.productores where id::text = p_productor_id),
    (select id from public.empresas_turisticas where id::text = p_empresa_id),
    case when p_producto_id is null then null else (select id from public.productos where id::text = p_producto_id) end,
    greatest(coalesce(p_cantidad, 1), 1),
    0,
    coalesce(nullif(trim(p_notas), ''), 'Vinculación registrada por INTUR'),
    v_monto,
    p_estado
  )
  returning * into v_match;

  return to_jsonb(v_match);
end;
$$;

revoke all on function public.crear_vinculacion_admin(text, text, text, int, text, text) from public, anon;
grant execute on function public.crear_vinculacion_admin(text, text, text, int, text, text) to authenticated;
