# Tawanki · Versión demo (`version-2`)

Esta rama está pensada para presentar la demo rápido. **No debe desplegarse a producción tal cual**: desactiva la confirmación de correo, permite registrar INTUR con cualquier correo y habilita la auto-promoción a INTUR.

## 1. Configurar Supabase

1. Aplicar las migraciones. Si la base ya existe, ejecutar solo:
   `supabase/migrations/008_demo_mode_y_rendimiento.sql`
   en el SQL Editor de Supabase.
2. En **Authentication → Providers → Email**, desactivar **Confirm email**.
3. En **Authentication → URL Configuration**, registrar:
   - `http://localhost:3000/**`
   - `https://TU-DOMINIO.vercel.app/**`
   - `https://TU-DOMINIO.vercel.app/reset-password.html`
4. Opcional para recuperación de contraseña: configurar SMTP propio. El SMTP integrado de Supabase tiene límites bajos y no es apto para una demo con muchos usuarios.

> Si no puedes desactivar “Confirm email”, los usuarios demo igualmente podrán entrar porque el seed los crea con `email_confirm: true`. El problema afectará a los registros nuevos.

## 2. Sembrar datos demo

La service role key **solo** se usa en el script local. Nunca debe llegar al frontend.

```bash
SUPABASE_SERVICE_ROLE_KEY=... npm run seed:demo
```

El script crea/actualiza:

- `productor@demo.tawanki.ni` / `DemoTawanki2026!`
- `empresa@demo.tawanki.ni` / `DemoTawanki2026!`
- `intur@demo.tawanki.ni` / `DemoTawanki2026!`

Además carga el productor `Café Xalteva`, la empresa `Hotel Granada Suites`, seis productos, cuatro matches y deja que los triggers generen notificaciones.

## 3. Entrar

Hay dos formas:

1. Botones **Acceso rápido demo** en `index.html`.
2. Botón **Entrar como … demo** dentro de cada pantalla de acceso.

También se puede iniciar sesión manualmente con las credenciales anteriores.

## 4. Qué desactiva esta rama

- Validación de dominio `@intur.gob.ni` en el navegador.
- Validación de dominio en la función `solicitar_registro_intur`.
- Confirmación de correo (requiere el paso manual en Supabase).
- Código obligatorio para ser INTUR: `activar_intur_demo()` promueve al usuario autenticado cuando `app_config.demo_mode` está activo.

## 5. Volver a producción

- Desactivar `app_config.demo_mode`:
  ```sql
  update public.app_config
     set valor = '{"activo": false}'::jsonb
   where clave = 'demo_mode';
  ```
- Volver a activar **Confirm email**.
- Restaurar la validación de dominio en `solicitar_registro_intur` y en `auth_intur.html`.
- Eliminar o proteger `activar_intur_demo()`.
- Rotar las credenciales demo y la service role key si se compartió.
