#!/usr/bin/env node
/**
 * Seed de demo para Tawanki · rama version-2
 *
 * Requisitos:
 *   SUPABASE_SERVICE_ROLE_KEY=...  (NUNCA subir esta clave al frontend)
 *   SUPABASE_URL=https://...       (opcional; usa la URL del proyecto)
 *
 * Uso:
 *   node scripts/seed_demo.js
 *
 * El script es idempotente para los datos de demo: reutiliza los usuarios
 * demo si ya existen y reemplaza productos/matches marcados como "Demo".
 */
const BASE_URL = (process.env.SUPABASE_URL || 'https://kilvjecoetbvcfofphoe.supabase.co').replace(/\/$/, '');
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SERVICE_KEY) {
  console.error('Falta SUPABASE_SERVICE_ROLE_KEY. Ejemplo:');
  console.error('  SUPABASE_SERVICE_ROLE_KEY=... node scripts/seed_demo.js');
  process.exit(1);
}

const DEMO_PASSWORD = 'DemoTawanki2026!';
const headers = {
  apikey: SERVICE_KEY,
  Authorization: `Bearer ${SERVICE_KEY}`,
  'Content-Type': 'application/json'
};

async function api(path, options = {}) {
  const response = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers: { ...headers, ...(options.headers || {}) }
  });

  const text = await response.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = text; }

  if (!response.ok) {
    const message = typeof data === 'object' && data ? (data.message || data.error_description || data.hint) : data;
    throw new Error(`${options.method || 'GET'} ${path} → ${response.status}: ${message || text}`);
  }
  return data;
}

async function listUsers() {
  return api('/auth/v1/admin/users?page=1&per_page=1000');
}

async function ensureUser({ email, nombre, rol, telefono }) {
  const metadata = { nombre_completo: nombre, rol, telefono };

  try {
    const created = await api('/auth/v1/admin/users', {
      method: 'POST',
      body: JSON.stringify({
        email,
        password: DEMO_PASSWORD,
        email_confirm: true,
        user_metadata: metadata
      })
    });
    console.log(`  + usuario creado: ${email}`);
    return created;
  } catch (error) {
    if (!/already|exist|registered/i.test(error.message)) throw error;
  }

  const users = await listUsers();
  const existing = (users?.users || []).find((u) => (u.email || '').toLowerCase() === email.toLowerCase());
  if (!existing) throw new Error(`No se encontró el usuario existente ${email}`);

  await api(`/auth/v1/admin/users/${existing.id}`, {
    method: 'PUT',
    body: JSON.stringify({
      password: DEMO_PASSWORD,
      email_confirm: true,
      user_metadata: metadata
    })
  });
  console.log(`  = usuario actualizado: ${email}`);
  return { ...existing, ...metadata };
}

async function updateProfile(userId, email, payload) {
  const rows = await api(`/rest/v1/profiles?id=eq.${userId}`, {
    method: 'PATCH',
    headers: { Prefer: 'return=representation' },
    body: JSON.stringify(payload)
  });

  if (Array.isArray(rows) && rows.length) return rows[0];

  // Si el trigger no creó el perfil, lo creamos como respaldo.
  return upsertRow('profiles', { id: userId, email, ...payload }, 'id');
}

async function upsertRow(table, payload, onConflict) {
  const query = onConflict ? `?on_conflict=${encodeURIComponent(onConflict)}` : '';
  const rows = await api(`/rest/v1/${table}${query}`, {
    method: 'POST',
    headers: { Prefer: 'resolution=merge-duplicates,return=representation' },
    body: JSON.stringify(payload)
  });
  return Array.isArray(rows) ? rows[0] : rows;
}

async function main() {
  console.log(`\nTawanki demo seed → ${BASE_URL}\n`);

  const departamentos = await api('/rest/v1/departamentos?select=id,nombre');
  const rubros = await api('/rest/v1/rubros?select=id,nombre');

  const depto = (name) => {
    const row = departamentos.find((d) => d.nombre === name);
    if (!row) throw new Error(`Departamento no encontrado: ${name}`);
    return row.id;
  };
  const rubro = (name) => {
    const row = rubros.find((r) => r.nombre === name);
    if (!row) throw new Error(`Rubro no encontrado: ${name}`);
    return row.id;
  };

  console.log('1. Usuarios demo');
  const productorUser = await ensureUser({
    email: 'productor@demo.tawanki.ni',
    nombre: 'Café Xalteva',
    rol: 'productor',
    telefono: '+505 8888 1001'
  });
  const empresaUser = await ensureUser({
    email: 'empresa@demo.tawanki.ni',
    nombre: 'Hotel Granada Suites',
    rol: 'empresa',
    telefono: '+505 2552 2002'
  });
  const inturUser = await ensureUser({
    email: 'intur@demo.tawanki.ni',
    nombre: 'Funcionario INTUR Demo',
    rol: 'intur',
    telefono: '+505 2222 3003'
  });

  // El trigger handle_new_user crea el perfil. Nos aseguramos de que exista
  // y de que el rol sea el correcto (service_role salta la protección).
  await updateProfile(productorUser.id, 'productor@demo.tawanki.ni', { rol: 'productor', nombre_completo: 'Café Xalteva', telefono: '+505 8888 1001', activo: true });
  await updateProfile(empresaUser.id, 'empresa@demo.tawanki.ni', { rol: 'empresa', nombre_completo: 'Hotel Granada Suites', telefono: '+505 2552 2002', activo: true });
  await updateProfile(inturUser.id, 'intur@demo.tawanki.ni', { rol: 'intur', nombre_completo: 'Funcionario INTUR Demo', telefono: '+505 2222 3003', activo: true });

  console.log('2. Fichas de productor / empresa / INTUR');
  const productor = await upsertRow('productores', {
    profile_id: productorUser.id,
    nombre_cooperativa_o_taller: 'Café Xalteva',
    descripcion: 'Café de altura, cacao y derivados de pequeños productores de Granada.',
    municipio: 'Granada',
    telefono_whatsapp: '+505 8888 1001',
    departamento_id: depto('Granada'),
    rubro_id: rubro('Gastronomía & Café'),
    verificado_intur: true
  }, 'profile_id');

  const empresa = await upsertRow('empresas_turisticas', {
    profile_id: empresaUser.id,
    nombre_comercial: 'Hotel Granada Suites',
    tipo: 'Hotel',
    departamento_id: depto('Granada'),
    municipio: 'Granada',
    registro_turistico_intur: 'INTUR-DEMO-001',
    telefono_corporativo: '+505 2552 2002',
    requerimientos_principales: 'Café, frutas, textiles y artesanías para amenidades y tienda del hotel.',
    verificado_intur: true
  }, 'profile_id');

  await upsertRow('intur_admins', {
    profile_id: inturUser.id,
    departamento_id: depto('Managua'),
    cargo: 'Funcionario INTUR Demo'
  }, 'profile_id');

  console.log('3. Productos demo');
  // Limpiar primero las solicitudes de demo para no dejar productos huérfanos.
  await api('/rest/v1/matches?descripcion_acuerdo=like.Demo%25', { method: 'DELETE' });
  await api('/rest/v1/productos?badge_distintivo=eq.Demo', { method: 'DELETE' });

  const productSeed = [
    {
      nombre: 'Café de altura Xalteva',
      descripcion: 'Café tostado artesanal de altura, cosecha 2026.',
      rubro: 'Gastronomía & Café',
      precio: 280,
      unidad: 'libra',
      imagen: '/assets/demo/cafe.svg'
    },
    {
      nombre: 'Cacao criollo en nibs',
      descripcion: 'Nibs de cacao criollo fermentado y secado al sol.',
      rubro: 'Gastronomía & Café',
      precio: 190,
      unidad: 'libra',
      imagen: '/assets/demo/cafe.svg'
    },
    {
      nombre: 'Juego de vasijas de barro',
      descripcion: 'Cerámica utilitaria hecha a mano en San Juan de Oriente.',
      rubro: 'Artesanías & Barro',
      precio: 850,
      unidad: 'juego',
      imagen: '/assets/demo/barro.svg'
    },
    {
      nombre: 'Bandeja de madera de teca',
      descripcion: 'Bandeja rústica tallada y pulida a mano.',
      rubro: 'Madera & Muebles',
      precio: 620,
      unidad: 'unidad',
      imagen: '/assets/demo/madera.svg'
    },
    {
      nombre: 'Hamaca doble de algodón',
      descripcion: 'Hamaca tejida en telar tradicional de Masaya.',
      rubro: 'Textiles & Hamacas',
      precio: 1450,
      unidad: 'unidad',
      imagen: '/assets/demo/textil.svg'
    },
    {
      nombre: 'Canasta de frutas de temporada',
      descripcion: 'Selección de frutas frescas de huertos de Rivas.',
      rubro: 'Frutas & Hortalizas',
      precio: 460,
      unidad: 'canasta',
      imagen: '/assets/demo/frutas.svg'
    }
  ];

  const productos = await api('/rest/v1/productos', {
    method: 'POST',
    headers: { Prefer: 'return=representation' },
    body: JSON.stringify(productSeed.map((p) => ({
      productor_id: productor.id,
      rubro_id: rubro(p.rubro),
      nombre: p.nombre,
      descripcion: p.descripcion,
      precio_unitario: p.precio,
      unidad_medida: p.unidad,
      badge_distintivo: 'Demo',
      imagen_url: p.imagen,
      disponible: true
    })))
  });

  console.log(`  + ${productos.length} productos`);

  console.log('4. Solicitudes / matches demo');
  const matchSeed = [
    { producto: productos[0], cantidad: 12, estado: 'Pendiente', compatibilidad: 92 },
    { producto: productos[2], cantidad: 4, estado: 'Aprobado', compatibilidad: 88 },
    { producto: productos[4], cantidad: 3, estado: 'En_Negociacion', compatibilidad: 81 },
    { producto: productos[5], cantidad: 8, estado: 'Finalizado', compatibilidad: 95 }
  ];

  const matches = matchSeed.map((m) => ({
    productor_id: productor.id,
    empresa_id: empresa.id,
    producto_id: m.producto.id,
    cantidad: m.cantidad,
    compatibilidad: m.compatibilidad,
    descripcion_acuerdo: `Demo · ${m.producto.nombre}`,
    monto_estimado_cordobas: Number(m.producto.precio_unitario) * m.cantidad,
    estado: m.estado
  }));

  const insertedMatches = await api('/rest/v1/matches', {
    method: 'POST',
    headers: { Prefer: 'return=representation' },
    body: JSON.stringify(matches)
  });

  console.log(`  + ${insertedMatches.length} matches`);
  console.log('\nDemo lista. Credenciales:');
  console.log('  productor@demo.tawanki.ni / DemoTawanki2026!');
  console.log('  empresa@demo.tawanki.ni   / DemoTawanki2026!');
  console.log('  intur@demo.tawanki.ni     / DemoTawanki2026!\n');
}

main().catch((error) => {
  console.error('\nError en el seed:', error.message);
  process.exit(1);
});
