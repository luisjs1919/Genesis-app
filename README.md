# Genesis Cloud Sync (RIF + app_state en Supabase)

Este paquete contiene los archivos necesarios para conectar tu app en Next.js con `public.businesses` en Supabase:

1. `supabase/03_businesses_cloud_sync.sql`
   - Ejecútalo en el **SQL Editor** de Supabase si aún no aplicaste las columnas `tax_id`, `app_state` o las políticas de `business_members`.

2. `lib/cloudSync.ts`
   - Cópialo en la carpeta `lib/` de tu proyecto Next.js.
   - Asegúrate de que `../lib/supabaseBrowser` coincida con la ruta real de tu helper de Supabase en el navegador.

3. `components/RifOnboardingModal.tsx`
   - Cópialo en la carpeta `components/` de tu proyecto Next.js.
   - Si el usuario no tiene `tax_id` registrado en su negocio, muestra el modal para capturarlo y guardarlo de por vida en Supabase.

4. `INTEGRACION_DASHBOARD.txt`
   - Contiene el patrón para cargar `app_state` y `tax_id` desde Supabase al entrar y sincronizar cambios automáticamente sin bucles infinitos.
