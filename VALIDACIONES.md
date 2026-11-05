# Tawanki · Versión 3: validaciones desactivadas

Esta rama solo relaja las validaciones de INTUR y correo. **No** incluye modo demo, auto-promoción de roles, seed de datos ni cambios de rendimiento.

## Qué se desactivó

- El frontend de `auth_intur.html` ya no exige que el correo termine en `@intur.gob.ni`.
- La función `solicitar_registro_intur()` acepta cualquier correo con formato básico.
- Se eliminó la validación regex de correo en los formularios de productor y empresa; el navegador y Supabase siguen validando que el correo tenga formato válido.
- El registro INTUR ya no bloquea por dominio. La aprobación/código sigue siendo necesaria para obtener el rol `intur`, porque eso es autorización y no una validación de correo.

## Qué no se puede desactivar desde el repositorio

La confirmación de correo es una configuración del proyecto de Supabase. Para desactivarla:

1. Entrar a **Supabase Dashboard → Authentication → Providers → Email**.
2. Desactivar **Confirm email**.
3. Guardar.

Alternativa para usuarios existentes: crearlos desde **Authentication → Users** con el correo ya confirmado.

## Aplicar el cambio en la base de datos

Si la base ya existe, ejecutar en el SQL Editor:

```sql
-- Contenido de supabase/migrations/008_desactivar_validaciones.sql
```

Si se instala desde cero, `supabase/setup_tawanki.sql` ya incluye esta migración al final.

## Importante

- El registro INTUR sigue creando la solicitud y el código; no se elimina el flujo de aprobación.
- La validación en el navegador no es seguridad: RLS y las funciones `SECURITY DEFINER` siguen siendo la autoridad.
- Para producción conviene volver a exigir un dominio institucional o una lista de correos autorizados.
