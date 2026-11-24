// Cliente de sincronización en red local para Génesis POS
// Úsalo en PosSalesWindow.tsx y GenesisDashboard.tsx

export interface NetworkSaleItem {
  productId: string;
  name: string;
  quantity: number;
  price: number;
}

export interface NetworkSalePayload {
  id: string;
  items: NetworkSaleItem[];
  total: number;
  paymentMethod: string;
  operatorName?: string;
  createdAt: string;
  [key: string]: unknown;
}

export function isNetworkSalesMode(): boolean {
  if (typeof window === 'undefined') return false;
  const params = new URLSearchParams(window.location.search);
  return params.get('modo') === 'ventas' || Boolean(params.get('terminal'));
}

export function getTerminalName(): string {
  if (typeof window === 'undefined') return 'PC-PRINCIPAL';
  const params = new URLSearchParams(window.location.search);
  const fromUrl = params.get('terminal');
  if (fromUrl) return fromUrl;
  const winObj = window as unknown as { genesisTerminal?: { hostname?: string } };
  return winObj.genesisTerminal?.hostname || 'PC-PRINCIPAL';
}

// 1. Consultar catálogo, stock y tasas frescas desde la PC Principal
export async function fetchCentralCatalogAndState() {
  const res = await fetch('/api/caja-sync', { cache: 'no-store' });
  if (!res.ok) throw new Error('No se pudo leer el estado central');
  return res.json();
}

// 2. Enviar SOLO la venta cobrada desde cualquier caja (descuenta stock en servidor sin pisar datos)
export async function submitNetworkSale(sale: NetworkSalePayload) {
  const res = await fetch('/api/caja-sync', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      action: 'record_sale',
      terminal: getTerminalName(),
      sale
    })
  });

  const data = await res.json();
  if (!res.ok || !data.ok) {
    throw new Error(data.error || 'Error registrando la venta en la PC Principal');
  }
  return data;
}

// 3. Publicar estado maestro desde la PC Principal (catálogo, precios, tasas)
export async function publishMasterStateFromMainPc(state: Record<string, unknown>) {
  if (isNetworkSalesMode()) return null; // Las cajas secundarias nunca sobrescriben el estado global
  const res = await fetch('/api/caja-sync', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      action: 'sync_state',
      terminal: 'PC-PRINCIPAL',
      state
    })
  });
  return res.json();
}
