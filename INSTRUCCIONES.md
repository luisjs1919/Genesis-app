# Paquete de Afiliación Génesis App + Supabase

Este archivo ZIP reúne lo necesario para montar la página de afiliación y conectarla con Supabase:

1. `app/page.tsx`: Página web de afiliación y captación de clientes con formulario conectado a Supabase.
2. `supabase/affiliations.sql`: Script SQL para ejecutar en el **SQL Editor** de Supabase y crear la tabla `affiliations`.
3. `.env.local.example`: Plantilla de variables de entorno (renómbrala a `.env.local` en la raíz de tu proyecto y coloca tu URL y clave `anon` de Supabase).

## Pasos rápidos
1. En Supabase -> **SQL Editor**, ejecuta el contenido de `supabase/affiliations.sql`.
2. En la raíz de tu proyecto Next.js, crea `.env.local` a partir de `.env.local.example` con tus datos de Supabase.
3. Copia `app/page.tsx` en la carpeta `app/` de tu proyecto e instala `@supabase/supabase-js` (`npm install @supabase/supabase-js`).
