# Reemplazo para Genesis-app (Afiliación y Sincronización Automática de RIF)

Extrae el contenido de este ZIP en la carpeta base de tu proyecto y sobrescribe los archivos existentes cuando lo solicite:
`C:\Users\Admin\Documents\GitHub\Genesis-app`

## Archivos incluidos
- `app/api/affiliate/route.ts`
- `lib/rif.ts`
- `lib/useSyncedInvoiceRif.ts`
- `lib/InvoiceRifField.tsx`

## Conexión rápida en tu vista de Factura
```tsx
import { InvoiceRifField } from "@/lib/InvoiceRifField";

<InvoiceRifField
  invoiceHeader={invoiceHeader}
  setInvoiceHeader={setInvoiceHeader}
  sessionRif={sessionRif}
  commerceRif={activeCommerce?.rif}
  persistedRif={appState?.rif}
/>
```
