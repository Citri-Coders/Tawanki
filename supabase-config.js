/**
 * ============================================================
 * supabase-config.js — Capa de Servicios Centralizada
 * Tawanki · Turismo Nicaragua Conecta · INTUR 2026
 * ============================================================
 * Cambios de la auditoría:
 *  - El rol se asigna en servidor (trigger + RPC de invitación).
 *  - getCurrentUser valida con getUser() y no fabrica roles.
 *  - Helpers de escape para todo dato que venga de la base de datos.
 *  - Escrituras sensibles pasan por RPC con autorización en servidor.
 * ============================================================
 */

// ── 1. Inicialización del Cliente ────────────────────────────
const SUPABASE_URL = 'https://kilvjecoetbvcfofphoe.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_5PKZs7ahaASbuEpHLarhlQ_bYVLv5hY';

const { createClient } = supabase;
const supabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ── 1.1 Cuentas Demo y Datos Semilla para Demostración ───────
const DEMO_PRODUCTORES_CATALOG = [
    {
        id: 'prod-001',
        profile_id: 'demo-productor-001',
        nombre_cooperativa_o_taller: 'Taller Alfarero Hermanos López',
        descripcion: 'Piezas de cerámica precolombina y utilitaria torneadas y pintadas a mano con engobes minerales de la zona.',
        municipio: 'San Juan de Oriente',
        telefono_whatsapp: '+505 8888 1001',
        verificado_intur: true,
        emite_factura: true,
        acepta_tarifa_mayorista: true,
        margen_mayorista_porcentaje: 20,
        departamento_id: 2,
        departamentos: { id: 2, nombre: 'Masaya', region: 'Pacífico' },
        rubro_id: 2,
        rubros: { id: 2, nombre: 'Artesanías & Barro', icono: 'palette' },
        profiles: { nombre_completo: 'María Hernández López', email: 'productor.demo@tawanki.ni', avatar_url: 'assets/img/artesano-ceramica-720.webp' },
        ruc: 'J031000000001',
        matricula_municipal: 'MAT-MAS-2026',
        licencia_minsa: null,
        permiso_inafor: null
    },
    {
        id: 'prod-002',
        profile_id: 'demo-productor-002',
        nombre_cooperativa_o_taller: 'Café de Altura Xalteva & Cacao',
        descripcion: 'Café de especialidad en grano y molido, cosechado a más de 1,200 msnm, junto con nibs de cacao criollo fino de aroma.',
        municipio: 'Granada',
        telefono_whatsapp: '+505 8888 1002',
        verificado_intur: true,
        emite_factura: true,
        acepta_tarifa_mayorista: true,
        margen_mayorista_porcentaje: 15,
        departamento_id: 1,
        departamentos: { id: 1, nombre: 'Granada', region: 'Pacífico' },
        rubro_id: 1,
        rubros: { id: 1, nombre: 'Gastronomía & Café', icono: 'coffee' },
        profiles: { nombre_completo: 'Carlos Gómez Rivas', email: 'xalteva@demo.tawanki.ni', avatar_url: '' },
        ruc: 'J031000000002',
        matricula_municipal: 'MAT-GRA-2026',
        licencia_minsa: 'MINSA-GRA-042',
        permiso_inafor: null
    },
    {
        id: 'prod-003',
        profile_id: 'demo-productor-003',
        nombre_cooperativa_o_taller: 'Muebles y Artesanías de Bambú El Raudal',
        descripcion: 'Muebles de terraza, lámparas y bandejas de madera fina certificada y bambú curado de alta resistencia para hoteles.',
        municipio: 'Monimbó',
        telefono_whatsapp: '+505 8888 1003',
        verificado_intur: true,
        emite_factura: true,
        acepta_tarifa_mayorista: true,
        margen_mayorista_porcentaje: 25,
        departamento_id: 2,
        departamentos: { id: 2, nombre: 'Masaya', region: 'Pacífico' },
        rubro_id: 3,
        rubros: { id: 3, nombre: 'Madera & Muebles', icono: 'carpenter' },
        profiles: { nombre_completo: 'José Daniel Gaitán', email: 'bambu@demo.tawanki.ni', avatar_url: '' },
        ruc: 'J031000000003',
        matricula_municipal: 'MAT-MON-2026',
        licencia_minsa: null,
        permiso_inafor: 'INAFOR-EXP-992'
    },
    {
        id: 'prod-004',
        profile_id: 'demo-productor-004',
        nombre_cooperativa_o_taller: 'Tejedoras de Hamacas Tradicionales Masaya',
        descripcion: 'Hamacas matrimoniales de doble cuerpo en hilo de algodón con flecos artesanales bordados a mano.',
        municipio: 'Masaya',
        telefono_whatsapp: '+505 8888 1004',
        verificado_intur: true,
        emite_factura: false,
        acepta_tarifa_mayorista: true,
        margen_mayorista_porcentaje: 18,
        departamento_id: 2,
        departamentos: { id: 2, nombre: 'Masaya', region: 'Pacífico' },
        rubro_id: 4,
        rubros: { id: 4, nombre: 'Textiles & Hamacas', icono: 'chair' },
        profiles: { nombre_completo: 'Rosa Amalia Palacios', email: 'hamacas@demo.tawanki.ni', avatar_url: '' },
        ruc: null,
        matricula_municipal: 'MAT-MAS-2025',
        licencia_minsa: null,
        permiso_inafor: null
    },
    {
        id: 'prod-005',
        profile_id: 'demo-productor-005',
        nombre_cooperativa_o_taller: 'Huerto Agroecológico Valle del Sol',
        descripcion: 'Canastas de frutas de temporada (pitahaya, plátano, cítricos) y hortalizas frescas cultivadas sin pesticidas.',
        municipio: 'Rivas',
        telefono_whatsapp: '+505 8888 1005',
        verificado_intur: false,
        emite_factura: true,
        acepta_tarifa_mayorista: true,
        margen_mayorista_porcentaje: 10,
        departamento_id: 4,
        departamentos: { id: 4, nombre: 'Rivas', region: 'Sur' },
        rubro_id: 5,
        rubros: { id: 5, nombre: 'Frutas & Hortalizas', icono: 'nutrition' },
        profiles: { nombre_completo: 'Ernesto Morales', email: 'huertos@demo.tawanki.ni', avatar_url: '' },
        ruc: 'J041000000005',
        matricula_municipal: 'MAT-RIV-2026',
        licencia_minsa: 'IPSA-FIT-104',
        permiso_inafor: null
    },
    {
        id: 'prod-006',
        profile_id: 'demo-productor-006',
        nombre_cooperativa_o_taller: 'Tabacos San Juan del Norte',
        descripcion: 'Puros artesanales premium hechos a mano con hojas seleccionadas del Valle de Jalapa y Estelí.',
        municipio: 'Estelí',
        telefono_whatsapp: '+505 8888 1006',
        verificado_intur: true,
        emite_factura: true,
        acepta_tarifa_mayorista: true,
        margen_mayorista_porcentaje: 22,
        departamento_id: 6,
        departamentos: { id: 6, nombre: 'Estelí', region: 'Norte' },
        rubro_id: 19,
        rubros: { id: 19, nombre: 'Tabaco & Puros Artesanales', icono: 'smoking_rooms' },
        profiles: { nombre_completo: 'Don Alberto Cerna', email: 'puros@demo.tawanki.ni', avatar_url: '' },
        ruc: 'J061000000006',
        matricula_municipal: 'MAT-EST-2026',
        licencia_minsa: null,
        permiso_inafor: null
    }
];

const DEMO_PRODUCTOS_CATALOG = [
    {
        id: 'item-001',
        productor_id: 'prod-001',
        rubro_id: 2,
        nombre: 'Jarrón de Cerámica Tradicional con Grabados Precolombinos',
        descripcion: 'Jarrón modelado a torno de pie, pulido con piedra de río y cocido en horno de leña. Acabado brillante natural.',
        precio_unitario: 850,
        unidad_medida: 'pieza',
        badge_distintivo: 'Tradición y Cultura',
        imagen_url: 'assets/demo/jarron-ceramica.jpg',
        disponible: true,
        rubros: { id: 2, nombre: 'Artesanías & Barro', icono: 'palette' },
        productores: DEMO_PRODUCTORES_CATALOG[0]
    },
    {
        id: 'item-002',
        productor_id: 'prod-001',
        rubro_id: 2,
        nombre: 'Juego de Tazas y Cafetera Rústica de Barro',
        descripcion: 'Set de 4 tazas y jarra esmaltada apta para bebidas calientes. Ideal para servicio de desayunos en hoteles.',
        precio_unitario: 650,
        unidad_medida: 'juego',
        badge_distintivo: 'Uso Hostelería',
        imagen_url: 'assets/demo/juego-tazas-barro.jpg',
        disponible: true,
        rubros: { id: 2, nombre: 'Artesanías & Barro', icono: 'palette' },
        productores: DEMO_PRODUCTORES_CATALOG[0]
    },
    {
        id: 'item-003',
        productor_id: 'prod-002',
        rubro_id: 1,
        nombre: 'Café de Altura Xalteva - Tostado Medio',
        descripcion: 'Café 100% arábica (variedades Caturra y Borbón) con notas de chocolate y caramelo. Envasado con válvula desgasificadora.',
        precio_unitario: 280,
        unidad_medida: 'libra',
        badge_distintivo: 'Taza de Excelencia',
        imagen_url: 'assets/demo/cafe-altura.jpg',
        disponible: true,
        rubros: { id: 1, nombre: 'Gastronomía & Café', icono: 'coffee' },
        productores: DEMO_PRODUCTORES_CATALOG[1]
    },
    {
        id: 'item-004',
        productor_id: 'prod-002',
        rubro_id: 1,
        nombre: 'Nibs de Cacao Criollo Fino de Aroma',
        descripcion: 'Cacao fermentado y tostado artesanalmente en nibs crujientes, listo para repostería, barras de bar y desayunos buffet.',
        precio_unitario: 190,
        unidad_medida: 'libra',
        badge_distintivo: 'Orgánico Certificado',
        imagen_url: 'assets/demo/nibs-cacao.jpg',
        disponible: true,
        rubros: { id: 1, nombre: 'Gastronomía & Café', icono: 'coffee' },
        productores: DEMO_PRODUCTORES_CATALOG[1]
    },
    {
        id: 'item-005',
        productor_id: 'prod-003',
        rubro_id: 3,
        nombre: 'Bandeja Rústica Tallada en Madera de Teca',
        descripcion: 'Bandeja de servicio tratada con ceras alimentarias, resistente a manchas y humedad. Fabricada con madera sostenible.',
        precio_unitario: 620,
        unidad_medida: 'unidad',
        badge_distintivo: 'Forestal Sostenible',
        imagen_url: 'assets/demo/bandeja-teca.jpg',
        disponible: true,
        rubros: { id: 3, nombre: 'Madera & Muebles', icono: 'carpenter' },
        productores: DEMO_PRODUCTORES_CATALOG[2]
    },
    {
        id: 'item-006',
        productor_id: 'prod-004',
        rubro_id: 4,
        nombre: 'Hamaca Matrimonial de Hilo Fino Masaya',
        descripcion: 'Tejido artesanal cerrado super confortable con hermosos detalles de fleco en macramé nicaragüense.',
        precio_unitario: 1450,
        unidad_medida: 'unidad',
        badge_distintivo: 'Diseño Tradicional',
        imagen_url: 'assets/demo/hamaca-masaya.jpg',
        disponible: true,
        rubros: { id: 4, nombre: 'Textiles & Hamacas', icono: 'chair' },
        productores: DEMO_PRODUCTORES_CATALOG[3]
    },
    {
        id: 'item-007',
        productor_id: 'prod-005',
        rubro_id: 5,
        nombre: 'Canasta de Frutas Frescas y Tropicales de Rivas',
        descripcion: 'Surtido directo de huerto con piñas doradas, pitahayas rojas, limones mandarinas y plátanos de primera selección.',
        precio_unitario: 460,
        unidad_medida: 'canasta 15kg',
        badge_distintivo: 'Del Campo a la Mesa',
        imagen_url: 'assets/demo/canasta-frutas.jpg',
        disponible: true,
        rubros: { id: 5, nombre: 'Frutas & Hortalizas', icono: 'nutrition' },
        productores: DEMO_PRODUCTORES_CATALOG[4]
    },
    {
        id: 'item-008',
        productor_id: 'prod-006',
        rubro_id: 19,
        nombre: 'Cofre de Puros Artesanales Robusto Estelí (Caja x 10)',
        descripcion: 'Selección de puros capa Habano añejados 3 años en cedro real, ideales para amenidad premium en hoteles boutique.',
        precio_unitario: 1200,
        unidad_medida: 'caja x 10',
        badge_distintivo: 'Calidad Exportación',
        imagen_url: 'assets/demo/cofre-puros.jpg',
        disponible: true,
        rubros: { id: 19, nombre: 'Tabaco & Puros Artesanales', icono: 'smoking_rooms' },
        productores: DEMO_PRODUCTORES_CATALOG[5]
    }
];

const DEMO_MATCHES_CATALOG = [
    {
        id: 'match-001',
        productor_id: 'prod-001',
        empresa_id: 'demo-empresa-001',
        producto_id: 'item-001',
        cantidad: 15,
        compatibilidad: 95,
        estado: 'Pendiente',
        monto_estimado_cordobas: 12750,
        descripcion_acuerdo: 'Solicitud de 15 jarrones decorativos para renovación de lobby del hotel.',
        created_at: new Date(Date.now() - 3600000 * 4).toISOString(),
        productores: DEMO_PRODUCTORES_CATALOG[0],
        empresas_turisticas: { id: 'demo-empresa-001', nombre_comercial: 'Hotel Granada Suites', tipo: 'Hotel', departamentos: { nombre: 'Granada' } },
        producto: DEMO_PRODUCTOS_CATALOG[0]
    },
    {
        id: 'match-002',
        productor_id: 'prod-001',
        empresa_id: 'demo-empresa-002',
        producto_id: 'item-002',
        cantidad: 8,
        compatibilidad: 90,
        estado: 'Aprobado',
        monto_estimado_cordobas: 5200,
        descripcion_acuerdo: 'Pedido de 8 juegos de vajilla rústica para terraza restaurante.',
        created_at: new Date(Date.now() - 3600000 * 24).toISOString(),
        productores: DEMO_PRODUCTORES_CATALOG[0],
        empresas_turisticas: { id: 'demo-empresa-002', nombre_comercial: 'Restaurante El Mirador de Catarina', tipo: 'Restaurante', departamentos: { nombre: 'Masaya' } },
        producto: DEMO_PRODUCTOS_CATALOG[1]
    },
    {
        id: 'match-003',
        productor_id: 'prod-002',
        empresa_id: 'demo-empresa-001',
        producto_id: 'item-003',
        cantidad: 50,
        compatibilidad: 98,
        estado: 'En_Negociacion',
        monto_estimado_cordobas: 14000,
        descripcion_acuerdo: 'Suministro mensual de café en grano para consumo de huéspedes y cafetería.',
        created_at: new Date(Date.now() - 3600000 * 48).toISOString(),
        productores: DEMO_PRODUCTORES_CATALOG[1],
        empresas_turisticas: { id: 'demo-empresa-001', nombre_comercial: 'Hotel Granada Suites', tipo: 'Hotel', departamentos: { nombre: 'Granada' } },
        producto: DEMO_PRODUCTOS_CATALOG[2]
    }
];

const DEMO_ACCOUNTS = Object.freeze({
    productor: {
        email: 'productor.demo@tawanki.ni',
        password: 'Password123!',
        user: { id: 'demo-productor-001', email: 'productor.demo@tawanki.ni', user_metadata: { nombre_completo: 'Taller Alfarero Hermanos López', rol: 'productor' } },
        profile: { id: 'demo-productor-001', email: 'productor.demo@tawanki.ni', nombre_completo: 'Taller Alfarero Hermanos López', rol: 'productor', telefono: '+505 8888 1001', activo: true, avatar_url: 'assets/img/artesano-ceramica-720.webp' },
        productor: DEMO_PRODUCTORES_CATALOG[0]
    },
    empresa: {
        email: 'empresa.demo@tawanki.ni',
        password: 'Password123!',
        user: { id: 'demo-empresa-001', email: 'empresa.demo@tawanki.ni', user_metadata: { nombre_completo: 'Hotel Granada Suites', rol: 'empresa' } },
        profile: { id: 'demo-empresa-001', email: 'empresa.demo@tawanki.ni', nombre_completo: 'Hotel Granada Suites', rol: 'empresa', telefono: '+505 2552-2002', activo: true },
        empresa: { id: 'demo-empresa-001', profile_id: 'demo-empresa-001', nombre_comercial: 'Hotel Granada Suites', tipo: 'Hotel', municipio: 'Granada', telefono_corporativo: '+505 2552-2002', verificado_intur: true, departamento_id: 1, requerimientos_principales: 'Artesanías, café de especialidad, hamacas y frutas frescas para huéspedes.' }
    },
    intur: {
        email: 'funcionario@intur.gob.ni',
        password: 'Password123!',
        user: { id: 'demo-intur-001', email: 'funcionario@intur.gob.ni', user_metadata: { nombre_completo: 'Lic. Funcionario INTUR', rol: 'intur' } },
        profile: { id: 'demo-intur-001', email: 'funcionario@intur.gob.ni', nombre_completo: 'Lic. Funcionario INTUR', rol: 'intur', telefono: '+505 2222-3003', activo: true },
        intur: { id: 'demo-intur-001', profile_id: 'demo-intur-001', cargo: 'Especialista en Fomento Turístico y Ciudades Creativas' }
    }
});

const DEMO_SESSION_KEY = 'tawanki:demo_active_user';

function getActiveDemoSession() {
    try {
        const raw = sessionStorage.getItem(DEMO_SESSION_KEY);
        return raw ? JSON.parse(raw) : null;
    } catch {
        return null;
    }
}

function setActiveDemoSession(accountData) {
    try {
        sessionStorage.setItem(DEMO_SESSION_KEY, JSON.stringify(accountData));
    } catch {}
}

function clearActiveDemoSession() {
    try {
        sessionStorage.removeItem(DEMO_SESSION_KEY);
    } catch {}
}

async function demoLogin(rol) {
    const demo = DEMO_ACCOUNTS[rol];
    if (!demo) {
        if (typeof showToast === 'function') showToast('Rol demo no válido', 'error');
        return;
    }
    setActiveDemoSession(demo);
    if (typeof showToast === 'function') showToast(`Accediendo como ${rol}...`, 'success');
    const targets = {
        productor: 'perfil-productor.html',
        empresa: 'proveedores.html',
        intur: 'dashboard-intur.html'
    };
    setTimeout(() => {
        window.location.replace(targets[rol] || 'index.html');
    }, 300);
}

// ── 2. Límites de validación compartidos ─────────────────────
const LIMITS = Object.freeze({
    nombre: 120,
    descripcion: 2000,
    unidad: 40,
    telefono: 40,
    precioMax: 10000000,
    imagenBytes: 2 * 1024 * 1024
});

// ── 3. Utilidades de seguridad y formato ─────────────────────
/**
 * Escapa texto para interpolarlo en HTML. OBLIGATORIO para todo
 * dato procedente de Supabase antes de usar innerHTML.
 */
function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>"']/g, (c) => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;'
    }[c]));
}

/**
 * Devuelve la URL solo si es http(s). Evita javascript:, data:text/html, etc.
 */
function safeUrl(value) {
    if (typeof value !== 'string') return '';
    const raw = value.trim();
    if (!raw) return '';
    try {
        const url = new URL(raw, window.location.origin);
        return ['http:', 'https:'].includes(url.protocol) ? url.href : '';
    } catch {
        return '';
    }
}

/**
 * URL de imagen: http(s) o data:image/* (compatibilidad con base64 antiguos).
 */
function safeImageUrl(value) {
    if (typeof value !== 'string') return '';
    const raw = value.trim();
    if (!raw) return '';
    // Permitir rutas relativas a assets locales (assets/demo/...)
    if (/^assets\/[a-zA-Z0-9/_\-\.]+\.(svg|png|jpg|jpeg|webp|gif)$/i.test(raw)) return raw;
    if (/^data:image\/(png|jpe?g|webp|gif);base64,[a-z0-9+/=\s]+$/i.test(raw)) return raw;
    return safeUrl(raw);
}

function setText(id, value) {
    const el = document.getElementById(id);
    if (el) el.textContent = value ?? '';
}

function normalizeText(value) {
    return (value || '')
        .toString()
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '');
}

function validarTexto(value, max, obligatorio = false) {
    const text = (value || '').toString().trim();
    if (obligatorio && !text) return { ok: false, error: 'Este campo es obligatorio.' };
    if (text.length > max) return { ok: false, error: `Máximo ${max} caracteres.` };
    return { ok: true, value: text };
}

// ── 4. Auth Service ──────────────────────────────────────────
const authService = {

    /**
     * Registrar usuario. El trigger de Supabase crea el perfil y solo
     * acepta los roles 'productor' y 'empresa'; 'intur' se canjea con
     * canjear_codigo_intur (ver auth_intur.html).
     */
    async signUp({ email, password, nombreCompleto, rol, telefono }) {
        try {
            const rolSeguro = rol === 'empresa' ? 'empresa' : 'productor';

            const { data, error } = await supabaseClient.auth.signUp({
                email,
                password,
                options: {
                    data: {
                        nombre_completo: nombreCompleto,
                        rol: rolSeguro,
                        telefono: telefono || ''
                    }
                }
            });

            return { data, error: error || null };
        } catch (err) {
            return { data: null, error: err };
        }
    },

    async signIn({ email, password }) {
        try {
            // Soporte para login instantáneo de credenciales demo
            for (const [key, demo] of Object.entries(DEMO_ACCOUNTS)) {
                if (demo.email.toLowerCase() === (email || '').trim().toLowerCase() && demo.password === password) {
                    setActiveDemoSession(demo);
                    return { data: { user: demo.user, session: { user: demo.user } }, error: null };
                }
            }

            const { data, error } = await supabaseClient.auth.signInWithPassword({ email, password });
            if (!error && data?.user) {
                clearActiveDemoSession();
            }
            return { data, error: error || null };
        } catch (err) {
            return { data: null, error: err };
        }
    },

    async signOut() {
        try {
            clearActiveDemoSession();
            const { error } = await supabaseClient.auth.signOut();
            return { error: error || null };
        } catch (err) {
            return { error: err };
        }
    },

    /**
     * Usuario autenticado + perfil real de la base de datos.
     * Usa getUser() (valida el JWT contra el servidor) y NO infiere el rol
     * desde user_metadata: si no hay fila en profiles, devuelve profile null.
     */
    async getCurrentUser() {
        try {
            const demoSession = getActiveDemoSession();
            if (demoSession?.user && demoSession?.profile) {
                return { user: demoSession.user, profile: demoSession.profile, error: null };
            }

            const { data: { user }, error: userError } = await supabaseClient.auth.getUser();
            if (userError || !user) {
                return { user: null, profile: null, error: userError || new Error('No hay sesión activa') };
            }

            const { data: profile, error: profileError } = await supabaseClient
                .from('profiles')
                .select('*')
                .eq('id', user.id)
                .maybeSingle();

            if (profileError) {
                return { user, profile: null, error: profileError };
            }

            return { user, profile: profile || null, error: null };
        } catch (err) {
            return { user: null, profile: null, error: err };
        }
    },

    onAuthStateChange(callback) {
        return supabaseClient.auth.onAuthStateChange(callback);
    },

    async resetPassword(email) {
        const redirectTo = `${window.location.origin}/reset-password.html`;
        return supabaseClient.auth.resetPasswordForEmail(email, { redirectTo });
    },

    async updatePassword(newPassword) {
        if (typeof newPassword !== 'string' || newPassword.length < 8) {
            return { data: null, error: new Error('La contraseña debe tener al menos 8 caracteres.') };
        }
        const { data, error } = await supabaseClient.auth.updateUser({ password: newPassword });
        return { data, error };
    }
};

// ── 5. Profile Service ───────────────────────────────────────
const CAMPOS_PERFIL_PERMITIDOS = ['nombre_completo', 'telefono', 'avatar_url'];

const profileService = {

    async getProfile(userId) {
        const { data, error } = await supabaseClient
            .from('profiles')
            .select('*')
            .eq('id', userId)
            .maybeSingle();
        return { data, error };
    },

    async updateProfile(userId, updates) {
        const safe = {};
        for (const key of CAMPOS_PERFIL_PERMITIDOS) {
            if (updates[key] !== undefined) safe[key] = updates[key];
        }
        if (typeof safe.nombre_completo === 'string') {
            safe.nombre_completo = safe.nombre_completo.trim().slice(0, LIMITS.nombre);
        }
        if (typeof safe.telefono === 'string') {
            safe.telefono = safe.telefono.trim().slice(0, LIMITS.telefono);
        }
        if (typeof safe.avatar_url === 'string') {
            safe.avatar_url = safeImageUrl(safe.avatar_url);
        }

        const { data, error } = await supabaseClient
            .from('profiles')
            .update({ ...safe, updated_at: new Date().toISOString() })
            .eq('id', userId)
            .select()
            .maybeSingle();
        return { data, error };
    },

    /**
     * Sube el avatar a Storage (bucket `avatars`) y guarda la URL pública.
     * Nunca almacena base64 en la base de datos.
     */
    async uploadAvatar(userId, file) {
        if (!userId || !file) return { data: null, error: new Error('Falta usuario o archivo.') };
        if (!/^image\/(png|jpe?g|webp|gif)$/i.test(file.type)) {
            return { data: null, error: new Error('Formato no permitido. Usa PNG, JPG, WEBP o GIF.') };
        }
        if (file.size > LIMITS.imagenBytes) {
            return { data: null, error: new Error('La imagen supera los 2 MB.') };
        }

        const ext = (file.name.split('.').pop() || 'png').toLowerCase().replace(/[^a-z0-9]/g, '');
        const fileName = `${userId}/avatar.${ext}`;

        const { error: uploadError } = await supabaseClient.storage
            .from('avatars')
            .upload(fileName, file, { upsert: true, cacheControl: '3600' });

        if (uploadError) return { data: null, error: uploadError };

        const { data: { publicUrl } } = supabaseClient.storage
            .from('avatars')
            .getPublicUrl(fileName);

        const { error } = await profileService.updateProfile(userId, { avatar_url: publicUrl });
        return { data: error ? null : publicUrl, error, publicUrl };
    }
};

// ── 6. Catálogo Base Service ─────────────────────────────────

// Datos demo de rubros y departamentos para cuando Supabase retorne vacío
const DEMO_RUBROS = [
    { id: 1,  nombre: 'Gastronomía & Café',         icono: 'coffee' },
    { id: 2,  nombre: 'Artesanías & Barro',          icono: 'palette' },
    { id: 3,  nombre: 'Madera & Muebles',            icono: 'carpenter' },
    { id: 4,  nombre: 'Textiles & Hamacas',          icono: 'chair' },
    { id: 5,  nombre: 'Frutas & Hortalizas',         icono: 'nutrition' },
    { id: 19, nombre: 'Tabaco & Puros Artesanales',  icono: 'smoking_rooms' }
];

const DEMO_DEPARTAMENTOS = [
    { id: 1, nombre: 'Granada',   region: 'Pacífico' },
    { id: 2, nombre: 'Masaya',    region: 'Pacífico' },
    { id: 3, nombre: 'Managua',   region: 'Pacífico' },
    { id: 4, nombre: 'Rivas',     region: 'Sur' },
    { id: 5, nombre: 'Carazo',    region: 'Pacífico' },
    { id: 6, nombre: 'Estelí',    region: 'Norte' },
    { id: 7, nombre: 'Matagalpa', region: 'Norte' },
    { id: 8, nombre: 'Jinotega',  region: 'Norte' }
];

const catalogoBaseService = {

    async getDepartamentos() {
        try {
            const { data, error } = await supabaseClient
                .from('departamentos')
                .select('*')
                .order('nombre');
            if (!error && Array.isArray(data) && data.length > 0) {
                return { data, error: null };
            }
        } catch (e) {}
        // Fallback demo
        return { data: DEMO_DEPARTAMENTOS, error: null };
    },

    async getRubros() {
        try {
            const { data, error } = await supabaseClient
                .from('rubros')
                .select('*')
                .order('nombre');
            if (!error && Array.isArray(data) && data.length > 0) {
                return { data, error: null };
            }
        } catch (e) {}
        // Fallback demo
        return { data: DEMO_RUBROS, error: null };
    }
};

// ── 7. Productos Service ─────────────────────────────────────
const productosService = {

    /**
     * Sube la foto de un producto al bucket `avatars` (ruta del usuario) y
     * devuelve la URL pública. Evita guardar base64 en la base de datos.
     */
    async uploadProductImage(userId, file) {
        if (!userId || !file) return { publicUrl: null, error: new Error('Falta usuario o archivo.') };
        if (!/^image\/(png|jpe?g|webp|gif)$/i.test(file.type)) {
            return { publicUrl: null, error: new Error('Formato no permitido. Usa PNG, JPG, WEBP o GIF.') };
        }
        if (file.size > LIMITS.imagenBytes) {
            return { publicUrl: null, error: new Error('La imagen supera los 2 MB.') };
        }

        const ext = (file.name.split('.').pop() || 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '');
        const unique = (crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36));
        const path = `${userId}/productos/${unique}.${ext}`;

        const { error: uploadError } = await supabaseClient.storage
            .from('avatars')
            .upload(path, file, { upsert: false, cacheControl: '3600' });

        if (uploadError) return { publicUrl: null, error: uploadError };

        const { data: { publicUrl } } = supabaseClient.storage
            .from('avatars')
            .getPublicUrl(path);

        return { publicUrl, error: null };
    },

    /**
     * Catálogo público (sin datos de contacto) para visitantes anónimos.
     */
    async getCatalogoPublico(limit = 500) {
        try {
            const { data, error } = await supabaseClient.rpc('catalogo_publico', { p_limit: limit });
            if (!error && Array.isArray(data) && data.length > 0) {
                return { data, error: null };
            }
        } catch (e) {}
        // Fallback a catálogo demo enriquecido
        return {
            data: DEMO_PRODUCTOS_CATALOG.map(p => ({
                id: p.id,
                nombre: p.nombre,
                descripcion: p.descripcion,
                precio_unitario: p.precio_unitario,
                unidad_medida: p.unidad_medida,
                imagen_url: p.imagen_url,
                rubro: p.rubros?.nombre,
                departamento: p.productores?.departamentos?.nombre,
                productor_id: p.productor_id,
                productor_nombre: p.productores?.nombre_cooperativa_o_taller,
                verificado: p.productores?.verificado_intur,
                disponible: p.disponible
            })),
            error: null
        };
    },

    async getProductos({ rubroId, departamentoId, busqueda, soloDisponibles, limit } = {}) {
        try {
            let query = supabaseClient
                .from('productos')
                .select(`
                    *,
                    rubros ( id, nombre, icono ),
                    productores ( id, nombre_cooperativa_o_taller, municipio, telefono_whatsapp, verificado_intur, departamentos ( id, nombre ) )
                `);

            if (rubroId) query = query.eq('rubro_id', rubroId);
            if (soloDisponibles) query = query.eq('disponible', true);
            if (busqueda) query = query.ilike('nombre', `%${busqueda}%`);
            if (limit) query = query.limit(limit);

            query = query.order('created_at', { ascending: false });

            const { data, error } = await query;

            if (!error && Array.isArray(data) && data.length > 0) {
                let filtered = data;
                if (departamentoId) {
                    filtered = filtered.filter((p) => p.productores?.departamentos?.id === departamentoId);
                }
                return { data: filtered, error: null };
            }
        } catch (err) {}

        // Fallback demo cuando la BD no tiene productos registrados
        let filtered = [...DEMO_PRODUCTOS_CATALOG];
        if (rubroId) filtered = filtered.filter(p => String(p.rubro_id) === String(rubroId));
        if (departamentoId) filtered = filtered.filter(p => p.productores?.departamento_id === Number(departamentoId) || p.productores?.departamentos?.id === Number(departamentoId));
        if (soloDisponibles) filtered = filtered.filter(p => p.disponible !== false);
        if (busqueda) {
            const q = normalizeText(busqueda);
            filtered = filtered.filter(p => normalizeText(p.nombre).includes(q) || normalizeText(p.descripcion).includes(q));
        }
        if (limit) filtered = filtered.slice(0, limit);
        return { data: filtered, error: null };
    },

    async ensureProductorRecord(profileId, meta = {}) {
        try {
            const demoSession = getActiveDemoSession();
            if (demoSession?.productor) {
                return { data: demoSession.productor, error: null };
            }

            if (!profileId) {
                const { data: { user } } = await supabaseClient.auth.getUser();
                profileId = user?.id;
                if (!profileId) {
                    return { data: null, error: new Error('No hay sesión activa. Inicia sesión de nuevo.') };
                }
                meta = user.user_metadata || {};
            }

            const { data: existing, error: selErr } = await supabaseClient
                .from('productores')
                .select('*')
                .eq('profile_id', profileId)
                .maybeSingle();

            if (selErr) return { data: null, error: selErr };
            if (existing) return { data: existing, error: null };

            // Resolver departamento y rubro: los recibidos o el primero disponible.
            let deptoId = meta.departamento_id ?? null;
            let rubroId = meta.rubro_id ?? null;

            if (!deptoId) {
                const { data: deptos } = await supabaseClient
                    .from('departamentos').select('id').order('id').limit(1);
                deptoId = deptos?.[0]?.id ?? null;
            }
            if (!rubroId) {
                const { data: rubros } = await supabaseClient
                    .from('rubros').select('id').order('id').limit(1);
                rubroId = rubros?.[0]?.id ?? null;
            }

            if (!deptoId || !rubroId) {
                return {
                    data: null,
                    error: new Error('No hay departamentos/rubros configurados. Pide a INTUR que complete el catálogo base.')
                };
            }

            const newProductor = {
                profile_id: profileId,
                nombre_cooperativa_o_taller: (meta.nombre_completo || 'Productor Local').slice(0, LIMITS.nombre),
                departamento_id: deptoId,
                rubro_id: rubroId,
                telefono_whatsapp: (meta.telefono || '').slice(0, LIMITS.telefono),
                verificado_intur: false
            };

            const { data: inserted, error: insErr } = await supabaseClient
                .from('productores')
                .insert(newProductor)
                .select('*')
                .single();

            if (insErr) {
                if (insErr.code === '23505') {
                    const { data: refetched } = await supabaseClient
                        .from('productores')
                        .select('*')
                        .eq('profile_id', profileId)
                        .maybeSingle();
                    if (refetched) return { data: refetched, error: null };
                }
                return { data: null, error: insErr };
            }

            return { data: inserted, error: null };
        } catch (err) {
            console.error('Excepción en ensureProductorRecord:', err);
            return { data: null, error: err };
        }
    },

    async crearProducto({ productorId, rubroId, nombre, descripcion, precioUnitario, unidadMedida, badgeDistintivo, imagenUrl }) {
        try {
            const nombreVal = validarTexto(nombre, LIMITS.nombre, true);
            if (!nombreVal.ok) return { data: null, error: new Error(nombreVal.error) };

            const descVal = validarTexto(descripcion, LIMITS.descripcion);
            if (!descVal.ok) return { data: null, error: new Error(descVal.error) };

            const unidadVal = validarTexto(unidadMedida || 'unidad', LIMITS.unidad);
            if (!unidadVal.ok) return { data: null, error: new Error(unidadVal.error) };

            const precio = Number(precioUnitario);
            if (!Number.isFinite(precio) || precio < 0 || precio > LIMITS.precioMax) {
                return { data: null, error: new Error('Precio inválido.') };
            }

            let finalProductorId = productorId;
            let finalRubroId = rubroId;

            if (!finalProductorId) {
                const { data: prod, error: ensureErr } = await productosService.ensureProductorRecord();
                if (ensureErr) return { data: null, error: ensureErr };
                finalProductorId = prod?.id;
                finalRubroId = finalRubroId || prod?.rubro_id;
            }

            if (!finalProductorId) {
                return { data: null, error: new Error('No se encontró un registro de productor asociado a tu usuario.') };
            }

            if (!finalRubroId) {
                const { data: rubros } = await supabaseClient.from('rubros').select('id').limit(1);
                finalRubroId = rubros?.[0]?.id ?? null;
            }
            if (!finalRubroId) {
                return { data: null, error: new Error('No se pudo resolver el rubro del producto.') };
            }

            const insertPayload = {
                productor_id: finalProductorId,
                rubro_id: finalRubroId,
                nombre: nombreVal.value,
                descripcion: descVal.value || `${nombreVal.value} de producción artesanal local.`,
                precio_unitario: precio,
                unidad_medida: unidadVal.value || 'unidad',
                badge_distintivo: (badgeDistintivo || 'Disponible').slice(0, 60),
                imagen_url: safeImageUrl(imagenUrl) || null,
                disponible: true
            };

            const { data, error } = await supabaseClient
                .from('productos')
                .insert(insertPayload)
                .select()
                .single();

            return { data, error };
        } catch (err) {
            console.error('Excepción en crearProducto:', err);
            return { data: null, error: err };
        }
    },

    async actualizarProducto(productoId, updates) {
        const permitidos = ['nombre', 'descripcion', 'precio_unitario', 'unidad_medida', 'badge_distintivo', 'imagen_url', 'disponible'];
        const safe = {};
        for (const key of permitidos) {
            if (updates[key] !== undefined) safe[key] = updates[key];
        }
        if (safe.imagen_url !== undefined) safe.imagen_url = safeImageUrl(safe.imagen_url) || null;

        const { data, error } = await supabaseClient
            .from('productos')
            .update(safe)
            .eq('id', productoId)
            .select()
            .maybeSingle();
        return { data, error };
    },

    async eliminarProducto(productoId) {
        const { data, error } = await supabaseClient
            .from('productos')
            .delete()
            .eq('id', productoId)
            .select();
        return { data, error };
    },

    async getProductosByProductor(productorId) {
        try {
            const { data, error } = await supabaseClient
                .from('productos')
                .select('*, rubros ( id, nombre, icono )')
                .eq('productor_id', productorId)
                .order('created_at', { ascending: false });
            if (!error && Array.isArray(data) && data.length > 0) {
                return { data, error: null };
            }
        } catch (e) {}
        const demoProds = DEMO_PRODUCTOS_CATALOG.filter(p => String(p.productor_id) === String(productorId));
        return { data: demoProds, error: null };
    }
};

// ── 8. Productores Service ───────────────────────────────────
const productoresService = {

    async getProductores({ departamentoId, rubroId, soloVerificados } = {}) {
        try {
            let query = supabaseClient
                .from('productores')
                .select(`
                    *,
                    profiles ( nombre_completo, email, avatar_url ),
                    departamentos ( id, nombre, region ),
                    rubros ( id, nombre, icono )
                `);

            if (departamentoId) query = query.eq('departamento_id', departamentoId);
            if (rubroId) query = query.eq('rubro_id', rubroId);
            if (soloVerificados) query = query.eq('verificado_intur', true);

            query = query.order('created_at', { ascending: false });
            const { data, error } = await query;

            if (!error && Array.isArray(data) && data.length > 0) {
                return { data, error: null };
            }
        } catch (err) {}

        // Fallback a productores demo
        let list = [...DEMO_PRODUCTORES_CATALOG];
        if (departamentoId) list = list.filter(p => String(p.departamento_id) === String(departamentoId));
        if (rubroId) list = list.filter(p => String(p.rubro_id) === String(rubroId));
        if (soloVerificados) list = list.filter(p => p.verificado_intur === true);
        return { data: list, error: null };
    },

    async getProductorByProfileId(profileId) {
        try {
            const { data, error } = await supabaseClient
                .from('productores')
                .select(`
                    *,
                    profiles ( nombre_completo, email, avatar_url, telefono ),
                    departamentos ( id, nombre, region ),
                    rubros ( id, nombre, icono )
                `)
                .eq('profile_id', profileId)
                .maybeSingle();
            if (!error && data) {
                return { data, error: null };
            }
        } catch (e) {}

        const match = DEMO_PRODUCTORES_CATALOG.find(p => String(p.profile_id) === String(profileId));
        return { data: match || DEMO_PRODUCTORES_CATALOG[0], error: null };
    },

    async verificarProductor(productorId, verificado) {
        const { data, error } = await supabaseClient.rpc('verificar_productor', {
            p_productor_id: String(productorId),
            p_verificado: !!verificado
        });
        return { data, error };
    },

    async upsertProductor(productorData) {
        const permitidos = [
            'profile_id', 'nombre_cooperativa_o_taller', 'departamento_id', 'rubro_id', 'descripcion', 'municipio', 'telefono_whatsapp',
            'cedula_o_constitucion', 'matricula_municipal', 'ruc', 'regimen_fiscal', 'certificado_mific', 'licencia_intur',
            'licencia_minsa', 'certificacion_bomberos', 'registro_ipsa', 'permiso_inafor', 'registro_rpi', 'certificado_origen',
            'emite_factura', 'acepta_tarifa_mayorista', 'margen_mayorista_porcentaje', 'politica_reservas', 'estado_normativo'
        ];
        const safe = {};
        for (const key of permitidos) {
            if (productorData[key] !== undefined) safe[key] = productorData[key];
        }

        const { data, error } = await supabaseClient
            .from('productores')
            .upsert(safe, { onConflict: 'profile_id' })
            .select()
            .single();
        return { data, error };
    }
};

// ── 9. Empresas Turísticas Service ───────────────────────────
const empresasService = {

    async getEmpresas({ tipo, departamentoId } = {}) {
        let query = supabaseClient
            .from('empresas_turisticas')
            .select(`
                *,
                profiles ( nombre_completo, email, avatar_url ),
                departamentos ( id, nombre, region )
            `);

        if (tipo) query = query.eq('tipo', tipo);
        if (departamentoId) query = query.eq('departamento_id', departamentoId);

        query = query.order('created_at', { ascending: false });
        const { data, error } = await query;
        return { data: data || [], error };
    },

    async getEmpresaByProfileId(profileId) {
        const { data, error } = await supabaseClient
            .from('empresas_turisticas')
            .select(`
                *,
                profiles ( nombre_completo, email, avatar_url, telefono ),
                departamentos ( id, nombre, region )
            `)
            .eq('profile_id', profileId)
            .maybeSingle();
        return { data, error };
    },

    async upsertEmpresa(empresaData) {
        const permitidos = [
            'profile_id', 'nombre_comercial', 'tipo', 'departamento_id',
            'registro_turistico_intur', 'telefono_corporativo', 'requerimientos_principales', 'municipio'
        ];
        const safe = {};
        for (const key of permitidos) {
            if (empresaData[key] !== undefined) safe[key] = empresaData[key];
        }

        const { data, error } = await supabaseClient
            .from('empresas_turisticas')
            .upsert(safe, { onConflict: 'profile_id' })
            .select()
            .single();
        return { data, error };
    },

    /**
     * Crea la ficha de empresa si el usuario confirmó el correo después del
     * registro. Usa los metadatos guardados por el formulario de registro.
     */
    async ensureEmpresaRecord(profileId, meta = {}) {
        try {
            const demoSession = getActiveDemoSession();
            if (demoSession?.empresa) {
                return { data: demoSession.empresa, error: null };
            }

            if (!profileId) {
                const { data: { user } } = await supabaseClient.auth.getUser();
                if (!user) return { data: null, error: new Error('No hay sesión activa.') };
                profileId = user.id;
                meta = user.user_metadata || {};
            }

            const { data: existing, error: selErr } = await supabaseClient
                .from('empresas_turisticas')
                .select('*')
                .eq('profile_id', profileId)
                .maybeSingle();

            if (selErr) return { data: null, error: selErr };
            if (existing) return { data: existing, error: null };

            let deptoId = meta.departamento_id ?? null;
            if (!deptoId) {
                const { data: deptos } = await supabaseClient
                    .from('departamentos').select('id').order('id').limit(1);
                deptoId = deptos?.[0]?.id ?? null;
            }
            if (!deptoId) {
                return { data: null, error: new Error('No hay departamentos configurados. Contacta a INTUR.') };
            }

            const payload = {
                profile_id: profileId,
                nombre_comercial: (meta.nombre_completo || 'Empresa Turística').slice(0, LIMITS.nombre),
                tipo: meta.tipo || 'Hotel',
                departamento_id: deptoId,
                registro_turistico_intur: meta.ruc || null,
                telefono_corporativo: (meta.telefono || '').slice(0, LIMITS.telefono),
                requerimientos_principales: (meta.necesidades || '').slice(0, 1000)
            };

            const { data, error } = await supabaseClient
                .from('empresas_turisticas')
                .insert(payload)
                .select('*')
                .single();

            if (error && error.code === '23505') {
                const { data: refetched } = await supabaseClient
                    .from('empresas_turisticas')
                    .select('*')
                    .eq('profile_id', profileId)
                    .maybeSingle();
                if (refetched) return { data: refetched, error: null };
            }

            return { data, error };
        } catch (err) {
            console.error('Excepción en ensureEmpresaRecord:', err);
            return { data: null, error: err };
        }
    }
};

// ── 10. Matches Service ──────────────────────────────────────
const matchesService = {

    async getMatches(filtros = {}) {
        try {
            let query = supabaseClient
                .from('matches')
                .select(`
                    *,
                    productores ( id, nombre_cooperativa_o_taller, telefono_whatsapp, municipio, departamentos ( nombre ), rubros ( nombre ) ),
                    empresas_turisticas ( id, nombre_comercial, tipo, departamentos ( nombre ) )
                `);

            if (filtros.estado) query = query.eq('estado', filtros.estado);
            if (filtros.productorId) query = query.eq('productor_id', filtros.productorId);
            if (filtros.empresaId) query = query.eq('empresa_id', filtros.empresaId);

            query = query.order('created_at', { ascending: false });
            const { data, error } = await query;
            if (!error && Array.isArray(data) && data.length > 0) {
                return { data, error: null };
            }
        } catch (e) {}

        // Fallback a matches demo
        let list = [...DEMO_MATCHES_CATALOG];
        if (filtros.estado) list = list.filter(m => m.estado === filtros.estado);
        return { data: list, error: null };
    },

    /**
     * La empresa autenticada crea la solicitud. El monto, el productor y el
     * producto se resuelven en servidor (RPC crear_solicitud).
     */
    async crearSolicitud({ productoId, cantidad, mensaje }) {
        const { data, error } = await supabaseClient.rpc('crear_solicitud', {
            p_producto_id: String(productoId),
            p_cantidad: Number(cantidad) || 1,
            p_mensaje: mensaje || null
        });
        return { data, error };
    },

    async actualizarEstado(matchId, nuevoEstado) {
        const { data, error } = await supabaseClient.rpc('responder_match', {
            p_match_id: String(matchId),
            p_estado: nuevoEstado
        });
        return { data, error };
    },

    /**
     * Backwards-compatible: aprobar/rechazar con bloqueo atómico del producto.
     */
    async concretarMatch(matchId, { nuevoEstado = 'Aprobado' } = {}) {
        const { data, error } = await matchesService.actualizarEstado(matchId, nuevoEstado);
        return { match: data, producto: null, error };
    },

    async crearVinculacionAdmin({ productorId, empresaId, productoId, cantidad, notas, estado }) {
        const { data, error } = await supabaseClient.rpc('crear_vinculacion_admin', {
            p_productor_id: String(productorId),
            p_empresa_id: String(empresaId),
            p_producto_id: productoId ? String(productoId) : null,
            p_cantidad: Number(cantidad) || 1,
            p_notas: notas || null,
            p_estado: estado || 'Pendiente'
        });
        return { data, error };
    },

    async getMatchesCount() {
        const { data, error } = await supabaseClient
            .from('matches')
            .select('estado');
        if (error) return { total: 0, porEstado: {}, error };

        const porEstado = {};
        for (const row of data || []) {
            const estado = row.estado || 'Pendiente';
            porEstado[estado] = (porEstado[estado] || 0) + 1;
        }
        return { total: (data || []).length, porEstado, error: null };
    }
};

// ── 11. INTUR Admin Service ──────────────────────────────────
const inturAdminService = {

    async getAdminByProfileId(profileId) {
        const { data, error } = await supabaseClient
            .from('intur_admins')
            .select(`
                *,
                profiles ( nombre_completo, email, avatar_url, telefono ),
                departamentos ( id, nombre, region )
            `)
            .eq('profile_id', profileId)
            .maybeSingle();
        return { data, error };
    },

    async upsertAdmin(adminData) {
        const { data, error } = await supabaseClient
            .from('intur_admins')
            .upsert(adminData, { onConflict: 'profile_id' })
            .select()
            .single();
        return { data, error };
    },

    async kpis() {
        const { data, error } = await supabaseClient.rpc('kpis_intur');
        return { data: data || null, error };
    }
};

// ── 12. Notificaciones Service ───────────────────────────────
const notificacionesService = {

    async getNotificaciones(userId) {
        const { data, error } = await supabaseClient
            .from('notificaciones')
            .select('*')
            .eq('usuario_id', userId)
            .order('created_at', { ascending: false });
        return { data: data || [], error };
    },

    async marcarComoLeida(notificacionId) {
        const { data, error } = await supabaseClient
            .from('notificaciones')
            .update({ leido: true })
            .eq('id', notificacionId);
        return { data, error };
    },

    async contarNoLeidas(userId) {
        const { count, error } = await supabaseClient
            .from('notificaciones')
            .select('*', { count: 'exact', head: true })
            .eq('usuario_id', userId)
            .eq('leido', false);
        return { count: count || 0, error };
    }
};

// ── 13. Auth Guard Helper ────────────────────────────────────
/**
 * Verifica sesión activa y rol autorizado. Si falla, cierra la sesión
 * inválida y redirige a index.html.
 */
async function authGuard(rolesPermitidos, options = {}) {
    const redirect = options.redirect !== false;
    const redirectTo = options.redirectTo || 'index.html';

    const { user, profile, error } = await authService.getCurrentUser();

    if (error || !user || !profile) {
        if (redirect) {
            await authService.signOut().catch(() => {});
            window.location.replace(redirectTo);
        }
        return null;
    }

    if (profile.activo === false) {
        if (redirect) {
            await authService.signOut().catch(() => {});
            window.location.replace(redirectTo);
        }
        return null;
    }

    const roles = Array.isArray(rolesPermitidos) ? rolesPermitidos : [rolesPermitidos];
    if (!roles.includes(profile.rol)) {
        if (redirect) {
            window.location.replace(redirectTo);
        }
        return null;
    }

    return { user, profile };
}

// ── 14. Utilidades de formato ────────────────────────────────
function formatCordobas(amount) {
    const value = Number(amount);
    if (!Number.isFinite(value)) return 'C$ 0.00';
    return `C$ ${value.toLocaleString('es-NI', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatFecha(dateStr) {
    if (!dateStr) return '—';
    const date = new Date(dateStr);
    if (Number.isNaN(date.getTime())) return '—';
    return date.toLocaleDateString('es-NI', { day: '2-digit', month: 'short', year: 'numeric' });
}

function showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    if (!container) return;

    let bgClass = 'bg-on-surface text-white';
    let iconName = 'info';
    if (type === 'success') { bgClass = 'bg-primary text-white'; iconName = 'check_circle'; }
    if (type === 'warning') { bgClass = 'bg-warning-orange text-white'; iconName = 'warning'; }
    if (type === 'error') { bgClass = 'bg-error text-white'; iconName = 'error'; }

    const toast = document.createElement('div');
    toast.className = `${bgClass} px-4 py-3 rounded-xl shadow-lg text-xs font-medium flex items-center gap-2.5 pointer-events-auto transition-all transform translate-y-2 opacity-0 duration-200 border border-white/20`;

    const icon = document.createElement('span');
    icon.className = 'material-symbols-outlined text-lg shrink-0';
    icon.textContent = iconName;

    const text = document.createElement('span');
    text.textContent = message; // textContent: nunca interpreta HTML

    toast.append(icon, text);
    container.appendChild(toast);
    setTimeout(() => toast.classList.remove('translate-y-2', 'opacity-0'), 10);
    setTimeout(() => {
        toast.classList.add('opacity-0', 'translate-y-2');
        setTimeout(() => toast.remove(), 300);
    }, 3500);
}

console.log('✅ Supabase Config cargado — Tawanki 2026');
