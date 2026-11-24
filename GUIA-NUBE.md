# Paquete Génesis en la Nube (PC, Tablet y Teléfono)

Este ZIP reúne los archivos base para usar el **mismo usuario** en **PC, tablet y teléfono** con un solo origen de verdad en **Supabase (PostgreSQL)**:

1. `supabase/01_affiliations.sql`: Tabla de afiliación y captación de negocios.
2. `supabase/02_nube_operativa.sql`: Tablas de negocios (`businesses`), miembros (`business_members`), productos (`products`), ventas (`sales`, `sale_items`), gastos (`expenses`), políticas RLS y la función `register_cloud_sale` que registra la venta y descuenta inventario en la nube.
3. `lib/supabaseBrowser.ts`: Cliente de Supabase con sesión persistente y detector de dispositivo (`pc`, `tablet`, `mobile`).
4. `app/login/page.tsx`: Inicio de sesión y creación de cuenta.
5. `app/app/page.tsx`: Panel de trabajo adaptable con facturación rápida, catálogo compartido, ventas sincronizadas y consulta rápida de Génesis IA.
6. `.env.local.example`: Plantilla de variables de entorno.

## Pasos recomendados
1. Ejecuta `supabase/01_affiliations.sql` y `supabase/02_nube_operativa.sql` en el **SQL Editor** de Supabase.
2. Crea `.env.local` en la raíz de tu proyecto Next.js con `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
3. Copia `lib/supabaseBrowser.ts`, `app/login/page.tsx` y `app/app/page.tsx` dentro de tu proyecto Next.js.
4. Inicia sesión con el mismo usuario en tu PC, tablet o teléfono para ver los mismos datos.
