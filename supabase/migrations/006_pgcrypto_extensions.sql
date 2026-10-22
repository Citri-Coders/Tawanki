-- ============================================================================
-- 006 · Compatibilidad de pgcrypto con el esquema `extensions` de Supabase
-- ============================================================================
-- En Supabase, `pgcrypto` suele estar instalado en el esquema `extensions`,
-- no en `public`. Las funciones de 001 usan `digest()` y `gen_random_bytes()`
-- con `search_path = public`, por lo que fallarían al canjear o emitir un
-- código INTUR.
--
-- Este ajuste mantiene `public` como primer esquema y agrega `extensions`.
-- Es idempotente y debe ejecutarse después de 001.
-- ============================================================================

alter function public.canjear_codigo_intur(text)
  set search_path = public, extensions;

alter function public.emitir_codigo_intur(int)
  set search_path = public, extensions;
