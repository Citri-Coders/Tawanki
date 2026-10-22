const fs = require('fs');
const path = require('path');

const SUPABASE_URL = 'https://kilvjecoetbvcfofphoe.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_5PKZs7ahaASbuEpHLarhlQ_bYVLv5hY';

async function runTests() {
  console.log('=== 1. VERIFICACIÓN DE ASSETS Y ARCHIVOS HTML ===');
  const htmlFiles = fs.readdirSync('.').filter(f => f.endsWith('.html'));
  let assetsOk = true;

  for (const htmlFile of htmlFiles) {
    const content = fs.readFileSync(htmlFile, 'utf8');
    
    // Check local scripts
    const scriptMatches = content.matchAll(/<script\s+[^>]*src=["']([^"']+)["']/gi);
    for (const match of scriptMatches) {
      const src = match[1];
      if (!src.startsWith('http') && !src.startsWith('//')) {
        const localPath = path.resolve(src.split('?')[0]);
        if (!fs.existsSync(localPath)) {
          console.error(`[FAIL] ${htmlFile}: Script local no encontrado -> ${src}`);
          assetsOk = false;
        }
      }
    }

    // Check local CSS stylesheets
    const cssMatches = content.matchAll(/<link\s+[^>]*rel=["']stylesheet["'][^>]*href=["']([^"']+)["']/gi);
    for (const match of cssMatches) {
      const href = match[1];
      if (!href.startsWith('http') && !href.startsWith('//')) {
        const localPath = path.resolve(href.split('?')[0]);
        if (!fs.existsSync(localPath)) {
          console.error(`[FAIL] ${htmlFile}: CSS local no encontrado -> ${href}`);
          assetsOk = false;
        }
      }
    }
  }

  if (assetsOk) {
    console.log('[OK] Todos los scripts y estilos locales referenciados en HTML existen.');
  }

  console.log('\n=== 2. VERIFICACIÓN DE CONEXIÓN Y TABLAS EN SUPABASE ===');
  const tables = [
    'departamentos',
    'rubros',
    'profiles',
    'productores',
    'empresas_turisticas',
    'productos',
    'matches',
    'codigos_intur',
    'intur_admins'
  ];

  for (const table of tables) {
    try {
      const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?select=*&limit=1`, {
        headers: {
          apikey: SUPABASE_ANON_KEY,
          Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
          Prefer: 'count=exact'
        }
      });
      const countHeader = res.headers.get('content-range');
      if (res.ok) {
        console.log(`[OK] Tabla '${table}': responde ${res.status} (Registros: ${countHeader || '0'})`);
      } else {
        console.error(`[FAIL] Tabla '${table}': ${res.status} ${res.statusText}`);
      }
    } catch (e) {
      console.error(`[FAIL] Error consultando '${table}':`, e.message);
    }
  }

  console.log('\n=== 3. VERIFICACIÓN DE CATÁLOGOS BASE (departamentos y rubros) ===');
  const depRes = await fetch(`${SUPABASE_URL}/rest/v1/departamentos?select=id,nombre,region`, {
    headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}` }
  });
  const deps = await depRes.json();
  console.log(`Departamentos en BD (${deps.length}/15 esperados):`, deps.map(d => d.nombre).join(', '));

  const rubRes = await fetch(`${SUPABASE_URL}/rest/v1/rubros?select=id,nombre,icono`, {
    headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}` }
  });
  const rubros = await rubRes.json();
  console.log(`Rubros en BD (${rubros.length}/5 esperados):`, rubros.map(r => r.nombre).join(', '));

  console.log('\n=== 4. VERIFICACIÓN DE RPCs DE NEGOCIO ===');
  // catalogo_publico
  const catRes = await fetch(`${SUPABASE_URL}/rest/v1/rpc/catalogo_publico`, {
    method: 'POST',
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ p_limit: 10 })
  });
  console.log(`RPC catalogo_publico: ${catRes.status} (Items devueltos: ${(await catRes.json()).length})`);

  // canjear_codigo_intur (debe requerir autenticación)
  const canjRes = await fetch(`${SUPABASE_URL}/rest/v1/rpc/canjear_codigo_intur`, {
    method: 'POST',
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ p_codigo: 'INTUR-TEST' })
  });
  console.log(`RPC canjear_codigo_intur (anon): ${canjRes.status} (${canjRes.status === 401 ? 'CORRECTO: Protegido contra anónimos' : 'Inesperado'})`);

  // kpis_intur (debe requerir autenticación)
  const kpiRes = await fetch(`${SUPABASE_URL}/rest/v1/rpc/kpis_intur`, {
    method: 'POST',
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({})
  });
  console.log(`RPC kpis_intur (anon): ${kpiRes.status} (${kpiRes.status === 401 ? 'CORRECTO: Protegido contra anónimos' : 'Inesperado'})`);

  console.log('\n=== 5. VERIFICACIÓN DEL STORAGE (Bucket avatars) ===');
  const storageRes = await fetch(`${SUPABASE_URL}/storage/v1/object/list/avatars`, {
    method: 'POST',
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ prefix: '', limit: 5 })
  });
  console.log(`Storage bucket 'avatars' list: ${storageRes.status} (${storageRes.ok ? 'CORRECTO: Accesible' : 'Error'})`);

  console.log('\n=== RESUMEN DE PRUEBAS COMPLETADO ===');
}

runTests().catch(console.error);
