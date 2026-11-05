-- ============================================================================
-- 008_normativa_y_rubros_creativos.sql
-- Tawanki · INTUR 2026: Catálogo de Ciudades Creativas y Verificación Normativa
-- (Leyes N.º 645, 495 y Reglamentos INTUR / MINSA / IPSA / MIFIC)
-- ============================================================================

begin;

-- ----------------------------------------------------------------------------
-- 1. Actualización y Ampliación de Rubros de Ciudades Creativas
-- ----------------------------------------------------------------------------
insert into public.rubros (nombre, descripcion, icono) values
  ('Café Especial & Cacao',                 'Café de altura, barismo, cacao criollo y chocolatería artesanal (Matagalpa, Estelí, Granada)', 'coffee'),
  ('Cerámica, Alfarería & Barro',           'Cerámica de San Juan de Oriente, cerámica negra de Matagalpa y piezas precolombinas',          'palette'),
  ('Cuero, Calzado & Talabartería',         'Calzado tradicional de Masaya, albardas, botas y marroquinería chontaleña',                    'shopping_bag'),
  ('Textiles, Hamacas & Bordados',           'Hamacas artesanales, telares indígenas, bordados y confección tradicional',                    'chair'),
  ('Madera, Muebles & Bambú',               'Mueblería fina, artesanías en bambú de Matagalpa, juguetes y máscaras folclóricas',             'carpenter'),
  ('Gastronomía Típica & Dulcería',         'Quesillo de Nagarote, vigorón granadino, baho, buñuelos y dulcería caribeña',                  'restaurant'),
  ('Lácteos & Agroindustria Local',         'Quesos artesanales, cuajadas, crema y rosquillas tradicionales de Chontales',                  'local_dining'),
  ('Tabaco & Puros Artesanales',            'Puros premium elaborados a mano y manufactura de tabaco de Estelí',                            'smoking_rooms'),
  ('Artes Plásticas, Piedra & Pintura',     'Escultura en marmolina, pintura primitivista, imaginería sacra y muralismo',                   'brush'),
  ('Fibras Naturales & Artesanías Variadas', 'Artesanías en tusa de maíz, fibra de palma, conchas y palo de rosa',                         'nature')
on conflict (nombre) do update
  set descripcion = excluded.descripcion,
      icono       = excluded.icono;

-- ----------------------------------------------------------------------------
-- 2. Ampliación de Columnas Normativas en tabla productores
-- ----------------------------------------------------------------------------
alter table public.productores
  -- Requisitos Transversales Base (Ley 645, DGI, Alcaldía, MIFIC, INTUR)
  add column if not exists cedula_o_constitucion text default '',
  add column if not exists matricula_municipal text default '',
  add column if not exists ruc text default '',
  add column if not exists regimen_fiscal text default 'simplificado',
  add column if not exists certificado_mific text default '',
  add column if not exists licencia_intur text default '',

  -- Requisitos Específicos por Rubro (MINSA, Bomberos, IPSA, INAFOR, RPI)
  add column if not exists licencia_minsa text default '',
  add column if not exists certificacion_bomberos text default '',
  add column if not exists registro_ipsa text default '',
  add column if not exists permiso_inafor text default '',
  add column if not exists registro_rpi text default '',
  add column if not exists certificado_origen text default '',

  -- Operaciones Comerciales B2B y Tour Operadoras
  add column if not exists emite_factura boolean not null default false,
  add column if not exists acepta_tarifa_mayorista boolean not null default false,
  add column if not exists margen_mayorista_porcentaje int default 15,
  add column if not exists politica_reservas text default '',

  -- Estado de Verificación Normativa Institucional
  add column if not exists estado_normativo text not null default 'en_revision';

-- Índices de búsqueda y filtrado institucional
create index if not exists idx_productores_ruc on public.productores(ruc);
create index if not exists idx_productores_estado_normativo on public.productores(estado_normativo);

commit;
