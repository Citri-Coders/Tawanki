-- ============================================================================
-- 002 · Matches: producto y cantidad
-- ============================================================================

alter table public.matches
  add column if not exists producto_id uuid references public.productos(id) on delete set null,
  add column if not exists cantidad int not null default 1 check (cantidad > 0),
  add column if not exists updated_at timestamptz not null default now();

create index if not exists matches_producto_idx on public.matches(producto_id);
create index if not exists matches_empresa_idx on public.matches(empresa_id);
create index if not exists matches_productor_idx on public.matches(productor_id);
