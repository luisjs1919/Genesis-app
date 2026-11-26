# Guía de reemplazo y conexión — Genesis-app

Extrae este ZIP directamente en `C:\Users\Admin\Documents\GitHub\Genesis-app` y sobrescribe los archivos cuando lo pida.

## Qué incluye este paquete (`genesis-app-reemplazo-v3.zip`)
- `app/api/affiliate/route.ts`: endpoint de afiliación en App Router (`app/` de la raíz).
- `lib/rif.ts`: normalización y validación del RIF.
- `lib/useSyncedInvoiceRif.ts`: busca automáticamente el RIF guardado en props o en `localStorage` / `sessionStorage` (`genesis_active_rif`, `genesis_rif`, `genesis_session`, `app_state`, etc.) y lo sincroniza en `invoiceHeader`.
- `lib/InvoiceRifField.tsx`: campo `RIF / Identificación fiscal` listo para bloquearse cuando exista un RIF vinculado.

## Qué hacer ahora si el formulario de Factura sigue sin mostrar el RIF
1. Extrae el ZIP en `C:\Users\Admin\Documents\GitHub\Genesis-app`.
2. Revisa el archivo donde se renderiza **Membrete y Texto de Impresión** (el que tiene el `<input>` con placeholder `Ej. J-40123456-7`) y conecta `<InvoiceRifField />` ahí.
3. Si guardas la sesión o el RIF con otro nombre de clave en `localStorage` o en un estado de React, pásalo por props (`sessionRif`, `commerceRif` o `persistedRif`) o dime el nombre del archivo para adaptarlo directamente.
