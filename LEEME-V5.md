# Genesis App — Parche de reemplazo v5

Extrae este ZIP en `C:\Users\Admin\Documents\GitHub\Genesis-app` y sobrescribe cuando lo solicite.

## Contenido
- `app/api/affiliate/route.ts`
- `lib/rif.ts`
- `lib/useSyncedInvoiceRif.ts`
- `lib/InvoiceRifField.tsx`
- `scripts/inspeccionar-membrete.js`

## Uso rápido
1. Extrae el ZIP en `C:\Users\Admin\Documents\GitHub\Genesis-app`.
2. Ejecuta `node scripts/inspeccionar-membrete.js` en `cmd.exe` para ver las líneas exactas alrededor del `<input>` con `placeholder="Ej. J-40123456-7"`.
3. Conecta `<InvoiceRifField />` en `components/GenesisDashboard.tsx` (o pégame esas líneas aquí y te dejo el bloque exacto).
