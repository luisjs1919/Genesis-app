# Génesis - Paquete de Corrección de Sincronización Multidispositivo

## Archivos incluidos para reemplazar en tu proyecto
- `components/GenesisDashboard.tsx`:
  - Conecta `GenesisCloudSyncLayer` pasando `{state, setState, localStorageKey: STORAGE_KEY}`.
  - Unifica la clave de caché local (`genesis_business_dashboard_v1` y `genesis_app_v13_state`) y mantiene sincronizados `businessName`, `businessRif` e `invoiceTemplate`.
- `components/GenesisCloudSyncLayer.tsx`:
  - Pasa `currentTaxId` y `currentBusinessName` normalizados desde cualquiera de las propiedades (`invoiceTemplate.taxId`, `businessRif`, `taxId`).
- `components/useGenesisCloudSync.ts`:
  - Hidrata `state` y `localStorage` al recibir datos desde Supabase o al volver a enfocar/mostrar la app (`focus` / `visibilitychange`).
  - Guarda el `app_state` completo y el RIF normalizado en `public.businesses` evitando bucles de reescritura.
  - Al guardar el RIF (`handleRifSaved`), aplica el registro devuelto desde Supabase para que el dispositivo donde se crea/actualiza cargue de inmediato el estado sincronizado.
- `components/RifOnboardingModal.tsx`:
  - Lee `tax_id` y `businessRif`/`taxId` del registro o estado actual y sincroniza `app_state` completo al guardar.
- `lib/cloudSync.ts`:
  - Normaliza `tax_id`, `businessRif`, `taxId` y `businessName` dentro de `app_state` y devuelve el registro actualizado tras `saveBusinessCloudState`.
  - Si un usuario autenticado aún no tiene fila en `business_members` ni en `businesses`, vincula automáticamente al negocio compartido existente cuando exista.
