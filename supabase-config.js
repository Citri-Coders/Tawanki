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
const SUPABASE_URL = 'https://dthushapfizmpzoutpiw.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_oN_nH5CH0x9VC_sr6K3hXw_qG9a1lyh';

const { createClient } = supabase;
const supabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

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
            const { data, error } = await supabaseClient.auth.signInWithPassword({ email, password });
            return { data, error: error || null };
        } catch (err) {
            return { data: null, error: err };
        }
    },

    async signOut() {
        try {
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
const catalogoBaseService = {

    async getDepartamentos() {
        const { data, error } = await supabaseClient
            .from('departamentos')
            .select('*')
            .order('nombre');
        return { data: data || [], error };
    },

    async getRubros() {
        const { data, error } = await supabaseClient
            .from('rubros')
            .select('*')
            .order('nombre');
        return { data: data || [], error };
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
        const { data, error } = await supabaseClient.rpc('catalogo_publico', { p_limit: limit });
        return { data: Array.isArray(data) ? data : [], error };
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

            if (error) {
                // Fallback sin joins: se aplican los mismos filtros en memoria.
                const { data: flatData, error: flatErr } = await supabaseClient
                    .from('productos')
                    .select('*')
                    .order('created_at', { ascending: false });

                if (flatErr) return { data: [], error: flatErr };

                let filtered = flatData || [];
                if (rubroId) filtered = filtered.filter((p) => p.rubro_id === rubroId);
                if (soloDisponibles) filtered = filtered.filter((p) => p.disponible !== false);
                if (busqueda) {
                    const q = normalizeText(busqueda);
                    filtered = filtered.filter((p) => normalizeText(p.nombre).includes(q));
                }
                if (limit) filtered = filtered.slice(0, limit);

                return { data: filtered, error: null };
            }

            let filtered = data || [];
            if (departamentoId) {
                filtered = filtered.filter((p) => p.productores?.departamentos?.id === departamentoId);
            }

            return { data: filtered, error: null };
        } catch (err) {
            console.error('Excepción en getProductos:', err);
            return { data: [], error: err };
        }
    },

    async ensureProductorRecord(profileId, meta = {}) {
        try {
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
        const { data, error } = await supabaseClient
            .from('productos')
            .select('*, rubros ( id, nombre, icono )')
            .eq('productor_id', productorId)
            .order('created_at', { ascending: false });
        return { data: data || [], error };
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

            if (error) {
                const { data: flatData, error: flatErr } = await supabaseClient
                    .from('productores')
                    .select('*')
                    .order('created_at', { ascending: false });
                return { data: flatData || [], error: flatErr };
            }
            return { data: data || [], error: null };
        } catch (err) {
            console.error('Excepción en getProductores:', err);
            return { data: [], error: err };
        }
    },

    async getProductorByProfileId(profileId) {
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
        return { data, error };
    },

    async verificarProductor(productorId, verificado) {
        const { data, error } = await supabaseClient.rpc('verificar_productor', {
            p_productor_id: String(productorId),
            p_verificado: !!verificado
        });
        return { data, error };
    },

    async upsertProductor(productorData) {
        const permitidos = ['profile_id', 'nombre_cooperativa_o_taller', 'departamento_id', 'rubro_id', 'descripcion', 'municipio', 'telefono_whatsapp'];
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

        if (error) {
            const { data: flatData, error: flatErr } = await supabaseClient
                .from('matches')
                .select('*')
                .order('created_at', { ascending: false });
            return { data: flatData || [], error: flatErr };
        }
        return { data: data || [], error: null };
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
async function authGuard(rolesPermitidos) {
    const { user, profile, error } = await authService.getCurrentUser();

    if (error || !user || !profile) {
        await authService.signOut().catch(() => {});
        window.location.replace('index.html');
        return null;
    }

    if (profile.activo === false) {
        await authService.signOut().catch(() => {});
        window.location.replace('index.html');
        return null;
    }

    const roles = Array.isArray(rolesPermitidos) ? rolesPermitidos : [rolesPermitidos];
    if (!roles.includes(profile.rol)) {
        window.location.replace('index.html');
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
