/**
 * ============================================================
 * supabase-config.js — Capa de Servicios Centralizada
 * Turismo Nicaragua Conecta (TNC) · INTUR 2026
 * ============================================================
 * Este archivo se carga en TODOS los HTML después del CDN de Supabase.
 * Expone: supabaseClient, authService, profileService, catalogoBaseService,
 *         productosService, productoresService, empresasService,
 *         matchesService, notificacionesService
 * ============================================================
 */

// ── 1. Inicialización del Cliente ────────────────────────────
const SUPABASE_URL = 'https://dthushapfizmpzoutpiw.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_oN_nH5CH0x9VC_sr6K3hXw_qG9a1lyh';

const { createClient } = supabase;
const supabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);


// ── 2. Auth Service ──────────────────────────────────────────
const authService = {

    /**
     * Registrar usuario nuevo en Supabase con su rol y metadatos.
     * @param {{ email: string, password: string, nombreCompleto: string, rol: 'intur'|'productor'|'empresa', telefono?: string }} params
     */
    async signUp({ email, password, nombreCompleto, rol, telefono }) {
        try {
            const { data, error } = await supabaseClient.auth.signUp({
                email,
                password,
                options: {
                    data: {
                        nombre_completo: nombreCompleto,
                        rol: rol,
                        telefono: telefono || ''
                    }
                }
            });

            if (error) {
                return { data: null, error };
            }

            // Si el usuario se creó pero profiles no se creó automáticamente por trigger, intentar crearlo manualmente
            if (data?.user) {
                try {
                    await supabaseClient.from('profiles').upsert({
                        id: data.user.id,
                        email: data.user.email,
                        nombre_completo: nombreCompleto,
                        rol: rol,
                        telefono: telefono || '',
                        activo: true
                    });
                } catch(profileErr) {
                    console.warn("Aviso al guardar perfil secundario:", profileErr);
                }
            }

            return { data, error: null };
        } catch (err) {
            return { data: null, error: err };
        }
    },

    /**
     * Iniciar sesión con email y contraseña.
     */
    async signIn({ email, password }) {
        try {
            const { data, error } = await supabaseClient.auth.signInWithPassword({
                email,
                password
            });

            if (error) {
                return { data: null, error };
            }

            return { data, error: null };
        } catch (err) {
            return { data: null, error: err };
        }
    },

    /**
     * Cerrar sesión en Supabase y limpiar almacenamiento local.
     */
    async signOut() {
        try {
            localStorage.removeItem('tnc_active_user');
            const { error } = await supabaseClient.auth.signOut();
            return { error };
        } catch (err) {
            localStorage.removeItem('tnc_active_user');
            return { error: null };
        }
    },

    /**
     * Obtener usuario autenticado actual y perfil desde Supabase.
     */
    async getCurrentUser() {
        try {
            const { data: { session }, error: sessionError } = await supabaseClient.auth.getSession();
            if (sessionError || !session || !session.user) {
                return { user: null, profile: null, error: sessionError || new Error('No hay sesión activa') };
            }

            const user = session.user;
            const meta = user.user_metadata || {};

            // Intentar leer desde la tabla profiles
            let profile = null;
            try {
                const { data, error: profileError } = await supabaseClient
                    .from('profiles')
                    .select('*')
                    .eq('id', user.id)
                    .maybeSingle();

                if (data) {
                    profile = data;
                }
            } catch (err) {
                console.warn("No se pudo leer profiles desde Supabase:", err);
            }

            // Si no existe fila en profiles, construir perfil desde user_metadata
            if (!profile) {
                profile = {
                    id: user.id,
                    email: user.email,
                    nombre_completo: meta.nombre_completo || user.email.split('@')[0],
                    rol: meta.rol || 'productor',
                    telefono: meta.telefono || '',
                    avatar_url: meta.avatar_url || ''
                };
            }

            return { user, profile, error: null };
        } catch (err) {
            return { user: null, profile: null, error: err };
        }
    },

    /**
     * Listener de cambio de estado de auth.
     */
    onAuthStateChange(callback) {
        return supabaseClient.auth.onAuthStateChange(callback);
    }
};


// ── 3. Profile Service ───────────────────────────────────────
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
        const { data, error } = await supabaseClient
            .from('profiles')
            .update({ ...updates, updated_at: new Date().toISOString() })
            .eq('id', userId)
            .select()
            .single();
        return { data, error };
    },

    /**
     * Subir avatar a Supabase Storage y actualizar la URL en profiles.
     */
    async uploadAvatar(userId, file) {
        const fileExt = file.name.split('.').pop();
        const fileName = `${userId}/avatar.${fileExt}`;

        const { data: uploadData, error: uploadError } = await supabaseClient.storage
            .from('avatars')
            .upload(fileName, file, { upsert: true });

        if (uploadError) return { data: null, error: uploadError };

        const { data: { publicUrl } } = supabaseClient.storage
            .from('avatars')
            .getPublicUrl(fileName);

        const { data, error } = await profileService.updateProfile(userId, {
            avatar_url: publicUrl
        });

        return { data, error, publicUrl };
    }
};


// ── 4. Catálogo Base Service (Departamentos y Rubros) ────────
const catalogoBaseService = {

    async getDepartamentos() {
        const { data, error } = await supabaseClient
            .from('departamentos')
            .select('*')
            .order('nombre');
        return { data, error };
    },

    async getRubros() {
        const { data, error } = await supabaseClient
            .from('rubros')
            .select('*')
            .order('nombre');
        return { data, error };
    }
};


// ── 5. Productos Service ─────────────────────────────────────
const productosService = {

    /**
     * Listar productos con filtros opcionales.
     */
    async getProductos({ rubroId, departamentoId, busqueda, soloDisponibles, limit } = {}) {
        try {
            let query = supabaseClient
                .from('productos')
                .select(`
                    *,
                    rubros ( nombre, icono ),
                    productores ( id, nombre_cooperativa_o_taller, municipio, telefono_whatsapp, departamentos ( nombre ) )
                `);

            if (rubroId) query = query.eq('rubro_id', rubroId);
            if (soloDisponibles) query = query.eq('disponible', true);
            if (busqueda) query = query.ilike('nombre', `%${busqueda}%`);
            if (limit) query = query.limit(limit);

            query = query.order('created_at', { ascending: false });

            const { data, error } = await query;

            if (error) {
                console.warn("Consulta relacional falló, intentando consulta plana:", error);
                // Fallback a consulta directa sin joins
                const { data: flatData, error: flatErr } = await supabaseClient
                    .from('productos')
                    .select('*')
                    .order('created_at', { ascending: false });

                if (flatData && flatData.length > 0) {
                    try {
                        const { data: allProds } = await supabaseClient.from('productores').select('id, nombre_cooperativa_o_taller, departamentos(nombre)');
                        const { data: allRubros } = await supabaseClient.from('rubros').select('id, nombre, icono');
                        const prodsMap = {};
                        const rubrosMap = {};
                        if (allProds) allProds.forEach(pr => { prodsMap[pr.id] = pr; });
                        if (allRubros) allRubros.forEach(rb => { rubrosMap[rb.id] = rb; });

                        const enriched = flatData.map(p => ({
                            ...p,
                            productores: prodsMap[p.productor_id] || null,
                            rubros: rubrosMap[p.rubro_id] || null
                        }));
                        return { data: enriched, error: null };
                    } catch (enrichErr) {
                        return { data: flatData, error: null };
                    }
                }

                return { data: flatData || [], error: flatErr };
            }

            // Filtrar por departamento del productor si aplica
            let filtered = data || [];
            if (departamentoId && data) {
                filtered = data.filter(p =>
                    p.productores && p.productores.departamentos && p.productores.departamentos.id === departamentoId
                );
            }

            return { data: filtered, error: null };
        } catch (err) {
            console.error("Excepción en getProductos:", err);
            return { data: [], error: err };
        }
    },

    /**
     * Asegurar y obtener el registro de productor para un profileId dado.
     * Devuelve SIEMPRE { data, error } para que el caller pueda mostrar el error real.
     */
    async ensureProductorRecord(profileId, meta = {}) {
        try {
            if (!profileId) {
                const { data: { session } } = await supabaseClient.auth.getSession();
                profileId = session?.user?.id;
                if (!profileId) {
                    return { data: null, error: new Error('No hay sesión activa. Inicia sesión de nuevo.') };
                }
                meta = session.user.user_metadata || {};
            }

            // 1. Buscar productor existente
            const { data: existing, error: selErr } = await supabaseClient
                .from('productores')
                .select('*')
                .eq('profile_id', profileId)
                .maybeSingle();

            if (selErr) {
                console.error("❌ Error al buscar productor existente:", selErr);
                return { data: null, error: selErr };
            }
            if (existing) return { data: existing, error: null };

            // 2. Resolver departamento_id (existente, o crearlo si la tabla está vacía)
            let deptoId = null;
            const { data: deptos, error: depErr } = await supabaseClient
                .from('departamentos').select('id').order('id').limit(1);
            if (depErr) {
                console.error("❌ Error leyendo departamentos:", depErr);
                return { data: null, error: depErr };
            }
            if (deptos && deptos.length > 0) {
                deptoId = deptos[0].id;
            } else {
                const { data: insDepto, error: insDepErr } = await supabaseClient
                    .from('departamentos')
                    .insert({ nombre: 'Granada', region: 'Pacífico' })
                    .select('id').single();
                if (insDepErr) {
                    console.error("❌ Error creando departamento por defecto:", insDepErr);
                    return { data: null, error: insDepErr };
                }
                deptoId = insDepto.id;
            }

            // 3. Resolver rubro_id (existente, o crearlo si la tabla está vacía)
            let rubroId = null;
            const { data: rubros, error: rubErr } = await supabaseClient
                .from('rubros').select('id').order('id').limit(1);
            if (rubErr) {
                console.error("❌ Error leyendo rubros:", rubErr);
                return { data: null, error: rubErr };
            }
            if (rubros && rubros.length > 0) {
                rubroId = rubros[0].id;
            } else {
                const { data: insRubro, error: insRubErr } = await supabaseClient
                    .from('rubros')
                    .insert({ nombre: 'Gastronomía & Café', icono: 'coffee' })
                    .select('id').single();
                if (insRubErr) {
                    console.error("❌ Error creando rubro por defecto:", insRubErr);
                    return { data: null, error: insRubErr };
                }
                rubroId = insRubro.id;
            }

            // 4. Intentar INSERT directo (más simple y predecible que upsert)
            const newProductor = {
                profile_id: profileId,
                nombre_cooperativa_o_taller: meta.nombre_completo || 'Productor Local',
                departamento_id: deptoId,
                rubro_id: rubroId,
                telefono_whatsapp: meta.telefono || '+505 8888-8888',
                verificado_intur: true
            };

            let { data: inserted, error: insErr } = await supabaseClient
                .from('productores')
                .insert(newProductor)
                .select('*')
                .single();

            if (insErr) {
                // Si falla por duplicado (registro creado entre el SELECT y el INSERT),
                // hacemos un SELECT de nuevo para devolver el existente.
                if (insErr.code === '23505' || /duplicate/i.test(insErr.message || '')) {
                    console.warn("⚠️ Registro de productor ya existía, recuperando:", insErr.message);
                    const { data: refetched, error: refErr } = await supabaseClient
                        .from('productores')
                        .select('*')
                        .eq('profile_id', profileId)
                        .maybeSingle();
                    if (refErr) {
                        console.error("❌ Error al recuperar productor existente:", refErr);
                        return { data: null, error: refErr };
                    }
                    if (refetched) return { data: refetched, error: null };
                }
                console.error("❌ Error al INSERT productor:", insErr, "Payload:", newProductor);
                return { data: null, error: insErr };
            }

            console.log("✅ Productor creado en Supabase con id:", inserted?.id);
            return { data: inserted, error: null };
        } catch (err) {
            console.error("❌ Excepción en ensureProductorRecord:", err);
            return { data: null, error: err };
        }
    },

    async crearProducto({ productorId, rubroId, nombre, descripcion, precioUnitario, unidadMedida, badgeDistintivo, imagenUrl }) {
        try {
            let finalProductorId = productorId;
            let finalRubroId = rubroId;

            // Si no viene productorId, resolverlo de forma garantizada
            if (!finalProductorId) {
                const { data: prod, error: ensureErr } = await productosService.ensureProductorRecord();
                if (ensureErr) {
                    return { data: null, error: ensureErr };
                }
                if (prod) {
                    finalProductorId = prod.id;
                    if (!finalRubroId) finalRubroId = prod.rubro_id;
                }
            }

            // Obtener rubroId válido
            if (!finalRubroId) {
                const { data: rubros } = await supabaseClient.from('rubros').select('id').limit(1);
                finalRubroId = rubros?.[0]?.id || 1;
            }

            // ⚠️ FIX: Validar campos obligatorios antes de hacer el INSERT para no
            // insertar registros vacíos que rompen las FK en Supabase.
            if (!finalProductorId) {
                const err = new Error(
                    'No se encontró un registro de productor asociado a tu usuario. ' +
                    'Cierra sesión y vuelve a entrar para sincronizar tu perfil de productor.'
                );
                console.error("❌ crearProducto abortado: falta productorId", err);
                return { data: null, error: err };
            }
            if (!finalRubroId) {
                const err = new Error('No se pudo resolver el rubro (categoría) del producto. Verifica que existan rubros en la base de datos.');
                console.error("❌ crearProducto abortado: falta rubroId", err);
                return { data: null, error: err };
            }
            if (!nombre || !nombre.trim()) {
                const err = new Error('El nombre del producto es obligatorio.');
                console.error("❌ crearProducto abortado: falta nombre", err);
                return { data: null, error: err };
            }

            const insertPayload = {
                productor_id: finalProductorId,
                rubro_id: finalRubroId,
                nombre: nombre.trim(),
                descripcion: descripcion || `${nombre} de producción artesanal local.`,
                precio_unitario: parseFloat(precioUnitario) || 0,
                unidad_medida: unidadMedida || 'unidad',
                badge_distintivo: badgeDistintivo || 'Disponible',
                imagen_url: imagenUrl || null,
                disponible: true
            };

            const { data, error } = await supabaseClient
                .from('productos')
                .insert(insertPayload)
                .select()
                .single();

            if (error) {
                console.error("❌ Error en insert de productos:", error, "Payload:", insertPayload);
            } else {
                console.log("✅ Producto insertado en Supabase con id:", data?.id);
            }

            return { data, error };
        } catch (err) {
            console.error("❌ Excepción en crearProducto:", err);
            return { data: null, error: err };
        }
    },

    async actualizarProducto(productoId, updates) {
        const { data, error } = await supabaseClient
            .from('productos')
            .update(updates)
            .eq('id', productoId)
            .select()
            .single();
        return { data, error };
    },

    async eliminarProducto(productoId) {
        const { data, error } = await supabaseClient
            .from('productos')
            .delete()
            .eq('id', productoId);
        return { data, error };
    },

    async getProductosByProductor(productorId) {
        const { data, error } = await supabaseClient
            .from('productos')
            .select('*, rubros ( nombre, icono )')
            .eq('productor_id', productorId)
            .order('created_at', { ascending: false });
        return { data, error };
    }
};


// ── 6. Productores Service ───────────────────────────────────
const productoresService = {

    async getProductores({ departamentoId, rubroId, soloVerificados } = {}) {
        try {
            let query = supabaseClient
                .from('productores')
                .select(`
                    *,
                    profiles ( nombre_completo, email, avatar_url ),
                    departamentos ( nombre, region ),
                    rubros ( nombre, icono )
                `);

            if (departamentoId) query = query.eq('departamento_id', departamentoId);
            if (rubroId) query = query.eq('rubro_id', rubroId);
            if (soloVerificados) query = query.eq('verificado_intur', true);

            query = query.order('created_at', { ascending: false });
            const { data, error } = await query;
            if (error) {
                console.warn("Consulta relacional de productores falló, fallback directo:", error);
                const { data: flatData, error: flatErr } = await supabaseClient
                    .from('productores')
                    .select('*')
                    .order('created_at', { ascending: false });
                return { data: flatData || [], error: flatErr };
            }
            return { data: data || [], error: null };
        } catch (err) {
            console.error("Excepción en getProductores:", err);
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

    async upsertProductor(productorData) {
        const { data, error } = await supabaseClient
            .from('productores')
            .upsert(productorData, { onConflict: 'profile_id' })
            .select()
            .single();
        return { data, error };
    }
};


// ── 7. Empresas Turísticas Service ───────────────────────────
const empresasService = {

    async getEmpresas({ tipo, departamentoId } = {}) {
        let query = supabaseClient
            .from('empresas_turisticas')
            .select(`
                *,
                profiles ( nombre_completo, email, avatar_url ),
                departamentos ( nombre, region )
            `);

        if (tipo) query = query.eq('tipo', tipo);
        if (departamentoId) query = query.eq('departamento_id', departamentoId);

        query = query.order('created_at', { ascending: false });
        const { data, error } = await query;
        return { data, error };
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
        const { data, error } = await supabaseClient
            .from('empresas_turisticas')
            .upsert(empresaData, { onConflict: 'profile_id' })
            .select()
            .single();
        return { data, error };
    }
};


// ── 8. Matches Service ───────────────────────────────────────
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
            console.warn("Consulta relacional de matches falló, fallback directo:", error);
            const { data: flatData, error: flatErr } = await supabaseClient
                .from('matches')
                .select('*')
                .order('created_at', { ascending: false });
            return { data: flatData || [], error: flatErr };
        }
        return { data: data || [], error: null };
    },

    async crearMatch({ productorId, empresaId, compatibilidad, descripcionAcuerdo, montoEstimado }) {
        const { data, error } = await supabaseClient
            .from('matches')
            .insert({
                productor_id: productorId,
                empresa_id: empresaId,
                compatibilidad: compatibilidad || 0,
                descripcion_acuerdo: descripcionAcuerdo || '',
                monto_estimado_cordobas: montoEstimado || 0
            })
            .select()
            .single();
        return { data, error };
    },

    async actualizarEstado(matchId, nuevoEstado) {
        const { data, error } = await supabaseClient
            .from('matches')
            .update({ estado: nuevoEstado })
            .eq('id', matchId)
            .select()
            .single();
        return { data, error };
    },

    /**
     * Crear una solicitud de cotización (match) entre una empresa y un productor.
     * Por defecto el estado es "Pendiente" y queda esperando la aprobación del productor.
     */
    async crearSolicitud({ productorId, empresaId, productoId, compatibilidad, descripcionAcuerdo, montoEstimado, cantidadSolicitada }) {
        try {
            // Primero verificamos que el producto esté disponible
            const { data: prod, error: prodErr } = await supabaseClient
                .from('productos')
                .select('id, disponible, nombre')
                .eq('id', productoId)
                .maybeSingle();
            if (prodErr) return { data: null, error: prodErr };
            if (!prod) return { data: null, error: new Error('El producto no existe') };
            if (prod.disponible === false) {
                return { data: null, error: new Error(`El producto "${prod.nombre}" ya no está disponible`) };
            }

            const { data, error } = await supabaseClient
                .from('matches')
                .insert({
                    productor_id: productorId,
                    empresa_id: empresaId,
                    compatibilidad: compatibilidad || 0,
                    descripcion_acuerdo: descripcionAcuerdo || `Solicitud de ${cantidadSolicitada || ''} unidad(es)`.trim(),
                    monto_estimado_cordobas: montoEstimado || 0
                })
                .select()
                .single();
            return { data, error };
        } catch (err) {
            return { data: null, error: err };
        }
    },

    /**
     * Concretar un match: lo marca como "Aprobado" o "Finalizado" y, si el parámetro
     * `marcarProductoNoDisponible` es true, también marca el producto relacionado
     * como `disponible = false` (porque ya se cerró la venta).
     *
     * Devuelve { match, producto, error } para que el caller sepa qué pasó en cada lado.
     */
    async concretarMatch(matchId, { nuevoEstado = 'Aprobado', marcarProductoNoDisponible = true, productoId = null } = {}) {
        try {
            // 1. Actualizar el match
            const { data: match, error: matchErr } = await supabaseClient
                .from('matches')
                .update({ estado: nuevoEstado })
                .eq('id', matchId)
                .select()
                .single();
            if (matchErr) return { match: null, producto: null, error: matchErr };

            // 2. Si se debe marcar el producto como no disponible, hacerlo
            let producto = null;
            let prodErr = null;
            if (marcarProductoNoDisponible && productoId) {
                const r = await supabaseClient
                    .from('productos')
                    .update({ disponible: false })
                    .eq('id', productoId)
                    .select()
                    .single();
                producto = r.data;
                prodErr = r.error;
            }
            return { match, producto, error: prodErr || null };
        } catch (err) {
            return { match: null, producto: null, error: err };
        }
    },

    async getMatchesCount() {
        const estados = ['Pendiente', 'Aprobado', 'Rechazado', 'En_Negociacion', 'Finalizado'];
        const counts = {};
        for (const estado of estados) {
            const { count } = await supabaseClient
                .from('matches')
                .select('*', { count: 'exact', head: true })
                .eq('estado', estado);
            counts[estado] = count || 0;
        }
        // Total
        const { count: total } = await supabaseClient
            .from('matches')
            .select('*', { count: 'exact', head: true });
        counts.total = total || 0;

        return counts;
    }
};


// ── 9. INTUR Admin Service ───────────────────────────────────
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
    }
};


// ── 10. Notificaciones Service ───────────────────────────────
const notificacionesService = {

    async getNotificaciones(userId) {
        const { data, error } = await supabaseClient
            .from('notificaciones')
            .select('*')
            .eq('usuario_id', userId)
            .order('created_at', { ascending: false });
        return { data, error };
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


// ── 11. Auth Guard Helper ────────────────────────────────────
/**
 * Verifica sesión activa y rol autorizado. Si falla, redirige a index.html.
 * @param {string|string[]} rolesPermitidos - Rol(es) permitidos para esta vista.
 * @returns {Promise<{user: object, profile: object}|null>}
 */
async function authGuard(rolesPermitidos) {
    const { user, profile, error } = await authService.getCurrentUser();

    if (error || !user || !profile) {
        window.location.href = 'index.html';
        return null;
    }

    const roles = Array.isArray(rolesPermitidos) ? rolesPermitidos : [rolesPermitidos];
    if (!roles.includes(profile.rol)) {
        window.location.href = 'index.html';
        return null;
    }

    return { user, profile };
}


// ── 12. Utilidades Compartidas ───────────────────────────────
/**
 * Formatear moneda en Córdobas.
 */
function formatCordobas(amount) {
    return `C$ ${parseFloat(amount || 0).toLocaleString('es-NI', { minimumFractionDigits: 2 })}`;
}

/**
 * Formatear fecha legible.
 */
function formatFecha(dateStr) {
    if (!dateStr) return '—';
    return new Date(dateStr).toLocaleDateString('es-NI', {
        day: '2-digit', month: 'short', year: 'numeric'
    });
}

// No se insertan datos ficticios ni semillas de catálogo en la carga inicial.
// La aplicación debe mostrar únicamente registros reales almacenados en Supabase.
console.log('✅ Supabase Config cargado — TNC INTUR 2026');
