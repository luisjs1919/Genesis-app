# Parche Genesis-app (Afiliación y Sincronización Automática de RIF)

Extrae el contenido de este ZIP directamente dentro de la carpeta raíz de tu proyecto:
`C:\Users\Admin\Documents\GitHub\Genesis-app`

## Estructura incluida en el ZIP
- `app/api/affiliate/route.ts`: Endpoint `POST /api/affiliate` en la carpeta `app/` de la raíz para App Router de Next.js.
- `lib/rif.ts`: Funciones `normalizeRif` y `isValidRif` para normalizar y validar RIF venezolanos (ej. `J-4527157155`).
- `lib/useSyncedInvoiceRif.ts`: Hook reutilizable para autocompletar y bloquear automáticamente el RIF activo en el membrete de la factura.

## Cómo usar `useSyncedInvoiceRif` en tu vista de Factura / Membrete
```tsx
import { useSyncedInvoiceRif } from "@/lib/useSyncedInvoiceRif";

// Dentro de tu componente:
const activeRif = sessionRif || affiliatedCommerce?.rif || "";
const { isRifLocked } = useSyncedInvoiceRif(activeRif, setInvoiceHeader);

// En el input de RIF / Identificación fiscal:
<input
  type="text"
  value={invoiceHeader.rif}
  readOnly={isRifLocked}
  onChange={(e) => {
    if (isRifLocked) return;
    setInvoiceHeader((prev) => ({ ...prev, rif: e.target.value }));
  }}
  placeholder="Ej. J-40123456-7"
  className={isRifLocked ? "cursor-not-allowed opacity-80" : ""}
/>
```

## Variables requeridas en `.env.local`
```env
NEXT_PUBLIC_SUPABASE_URL=https://osmdjqzfodfyttubayoc.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=tu_anon_or_publishable_key
SUPABASE_SERVICE_ROLE_KEY=tu_service_role_key
COMMERCE_PIN_SALT=una_clave_secreta_larga_para_tu_hash
```
