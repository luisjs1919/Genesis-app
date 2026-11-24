# Sincronización por RIF + Nombre y RIF Inmutables (v3)

Este paquete configura la base de datos y la capa de consulta para que:
1. El establecimiento y sus facturas/ventas queden sincronizados directamente por el **RIF** normalizado.
2. Una vez creados, ni el **nombre** (`name`) ni el **RIF** (`rif`) puedan modificarse (`trg_lock_business_name_and_rif` en PostgreSQL + validación en `rifSync.js`).

## Archivos incluidos
- `supabase_rif_sync.sql`: agrega `rif` e índices, crea el trigger `trg_sync_sale_business_rif` para ventas/facturas y crea el trigger `trg_lock_business_name_and_rif` para bloquear cambios posteriores de nombre y RIF.
- `rifSync.js`: utilidades de búsqueda por RIF, creación sin duplicados, actualización segura de otros campos y registro sincronizado de facturas.
