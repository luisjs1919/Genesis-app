# Guía de Despliegue: Launcher de Ventas en Red Local + Sincronización Segura (v2)

Este paquete incluye:
1. **`GenesisCaja-Launcher/`**: Launcher ligero en Electron (`main.js`, `preload.js`, `offline.html`, `package.json`), configuración compartida (`caja-config.json`) y acceso rápido (`Iniciar-Genesis-Caja.bat`).
2. **`Servidor-PC-Principal/app/api/caja-sync/route.ts`**: API centralizada con:
   - **Cola secuencial de escritura**: Evita choques si dos cajas cobran al mismo milisegundo.
   - **Protección contra duplicados (`processedSaleIds`)**: Si hay un microcorte de red y la caja reintenta enviar una factura, no se duplica ni descuenta stock dos veces.
   - **Validación y descuento atómico de inventario**: Cada caja envía únicamente la factura (`action: 'record_sale'`) sin sobrescribir el estado global, y el servidor descuenta el stock real y devuelve `INSUFFICIENT_STOCK` (HTTP 409) si otra caja agotó el producto segundos antes.
3. **`Servidor-PC-Principal/lib/cajaNetworkClient.ts`**: Funciones listas para conectar `PosSalesWindow.tsx` y `GenesisDashboard.tsx` (`fetchCentralCatalogAndState`, `submitNetworkSale`, `publishMasterStateFromMainPc`).

---

## Instalación rápida

### 1. En la PC Principal
1. Copia `Servidor-PC-Principal/app/api/caja-sync/route.ts` en `app/api/caja-sync/route.ts` de tu proyecto.
2. Copia `Servidor-PC-Principal/lib/cajaNetworkClient.ts` en `lib/cajaNetworkClient.ts`.
3. Inicia Génesis escuchando en red local (`npx next start -H 0.0.0.0 -p 3000`) y permite el puerto `3000` (TCP) en el Firewall de Windows.

### 2. En la Carpeta Compartida (`C:\GenesisRed`)
1. Copia el contenido de `GenesisCaja-Launcher/` dentro de `C:\GenesisRed`.
2. Ajusta la IP de tu PC Principal en `caja-config.json` (y en `Iniciar-Genesis-Caja.bat` si usarás el script directo).
3. Comparte `C:\GenesisRed` en la red local.

### 3. En las PCs de Ventas (Cajas)
1. Entra a `\\<IP-PC-PRINCIPAL>\GenesisRed` y crea un acceso directo en el Escritorio hacia `GenesisCaja.exe` o `Iniciar-Genesis-Caja.bat`.
2. Al abrir, la terminal entra directo en `?modo=ventas`, lee el inventario actualizado de la PC Principal y envía cada factura cobrada sin sobrescribir datos de otras cajas.
