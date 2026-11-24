import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

const DATA_DIR = path.join(process.cwd(), 'data');
const SYNC_FILE = path.join(DATA_DIR, 'genesis_red_sync.json');

interface SaleItemPayload {
  productId?: string;
  id?: string;
  name?: string;
  quantity?: number;
  qty?: number;
  price?: number;
}

interface SalePayload {
  id: string;
  items?: SaleItemPayload[];
  total?: number;
  paymentMethod?: string;
  operatorName?: string;
  createdAt?: string;
  [key: string]: unknown;
}

interface SyncPayload {
  action?: 'sync_state' | 'record_sale';
  state?: Record<string, unknown>;
  sale?: SalePayload;
  terminal?: string;
  allowNegativeStock?: boolean;
}

interface CentralStore {
  updatedAt: string;
  lastTerminal: string;
  state: Record<string, unknown> | null;
  processedSaleIds: string[];
  networkSalesLog: Array<Record<string, unknown>>;
}

// Cola secuencial en memoria para evitar escrituras simultáneas entre cajas
let writeQueue: Promise<unknown> = Promise.resolve();

function enqueueOperation<T>(task: () => Promise<T> | T): Promise<T> {
  const next = writeQueue.then(() => task());
  writeQueue = next.catch(() => undefined);
  return next;
}

function ensureSyncStore() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  if (!fs.existsSync(SYNC_FILE)) {
    const initial: CentralStore = {
      updatedAt: new Date().toISOString(),
      lastTerminal: 'PC-PRINCIPAL',
      state: null,
      processedSaleIds: [],
      networkSalesLog: []
    };
    fs.writeFileSync(SYNC_FILE, JSON.stringify(initial, null, 2), 'utf-8');
  }
}

function readStore(): CentralStore {
  ensureSyncStore();
  try {
    const parsed = JSON.parse(fs.readFileSync(SYNC_FILE, 'utf-8'));
    return {
      updatedAt: parsed.updatedAt || new Date().toISOString(),
      lastTerminal: parsed.lastTerminal || 'PC-PRINCIPAL',
      state: parsed.state ?? null,
      processedSaleIds: Array.isArray(parsed.processedSaleIds) ? parsed.processedSaleIds : [],
      networkSalesLog: Array.isArray(parsed.networkSalesLog) ? parsed.networkSalesLog : []
    };
  } catch {
    return {
      updatedAt: new Date().toISOString(),
      lastTerminal: 'PC-PRINCIPAL',
      state: null,
      processedSaleIds: [],
      networkSalesLog: []
    };
  }
}

function writeStore(data: CentralStore) {
  ensureSyncStore();
  const tempFile = `${SYNC_FILE}.tmp`;
  fs.writeFileSync(tempFile, JSON.stringify(data, null, 2), 'utf-8');
  fs.renameSync(tempFile, SYNC_FILE);
}

// GET: Cualquier caja en la red consulta catálogo, stock actualizado, tasas y ventas recientes
export async function GET() {
  const store = readStore();
  return NextResponse.json({
    ok: true,
    updatedAt: store.updatedAt,
    lastTerminal: store.lastTerminal,
    state: store.state,
    networkSalesCount: store.networkSalesLog.length,
    recentNetworkSales: store.networkSalesLog.slice(0, 50)
  });
}

// POST:
// - Las cajas secundarias envían SOLO { action: 'record_sale', sale, terminal } (nunca pisan state)
// - La PC Principal puede actualizar catálogo/tasas mediante { action: 'sync_state', state, terminal }
export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as SyncPayload;
    const terminal = (body.terminal || 'CAJA-DESCONOCIDA').trim();

    return await enqueueOperation(() => {
      const store = readStore();

      // 1. Actualización maestra de catálogo/tasas desde la PC Principal
      if (body.state && body.action !== 'record_sale') {
        store.state = body.state;
        store.updatedAt = new Date().toISOString();
        store.lastTerminal = terminal;
        writeStore(store);

        return NextResponse.json({
          ok: true,
          mode: 'state_updated',
          updatedAt: store.updatedAt,
          lastTerminal: terminal
        });
      }

      // 2. Registro atómico de venta desde cualquier caja sin sobrescribir el estado global
      if (body.sale) {
        const sale = body.sale;
        if (!sale.id) {
          return NextResponse.json(
            { ok: false, error: 'La venta debe incluir un identificador único (sale.id).' },
            { status: 400 }
          );
        }

        // Idempotencia: si la caja reintenta por microcorte de red, no duplica ni descuenta dos veces
        if (store.processedSaleIds.includes(sale.id)) {
          return NextResponse.json({
            ok: true,
            duplicateIgnored: true,
            saleId: sale.id,
            updatedAt: store.updatedAt
          });
        }

        const saleItems = Array.isArray(sale.items) ? sale.items : [];
        const currentState = (store.state || {}) as Record<string, unknown>;
        const products = Array.isArray(currentState.products)
          ? ([...currentState.products] as Array<Record<string, unknown>>)
          : [];

        // Validación de stock disponible antes de descontar
        if (products.length > 0 && !body.allowNegativeStock) {
          for (const item of saleItems) {
            const targetId = item.productId || item.id;
            const qtySold = Number(item.quantity ?? item.qty ?? 0);
            if (!targetId || qtySold <= 0) continue;

            const prod = products.find((p) => String(p.id) === String(targetId));
            if (prod && typeof prod.stock === 'number') {
              if (prod.stock < qtySold) {
                return NextResponse.json(
                  {
                    ok: false,
                    code: 'INSUFFICIENT_STOCK',
                    error: `Stock insuficiente para "${prod.name || targetId}". Disponible: ${prod.stock}, solicitado: ${qtySold}.`,
                    productId: targetId,
                    availableStock: prod.stock
                  },
                  { status: 409 }
                );
              }
            }
          }
        }

        // Descuento secuencial de stock en el catálogo central
        if (products.length > 0) {
          for (const item of saleItems) {
            const targetId = item.productId || item.id;
            const qtySold = Number(item.quantity ?? item.qty ?? 0);
            if (!targetId || qtySold <= 0) continue;

            const idx = products.findIndex((p) => String(p.id) === String(targetId));
            if (idx !== -1 && typeof products[idx].stock === 'number') {
              const nextStock = Number(products[idx].stock) - qtySold;
              products[idx] = {
                ...products[idx],
                stock: body.allowNegativeStock ? nextStock : Math.max(0, nextStock)
              };
            }
          }
          currentState.products = products;
        }

        // Agregar la venta al listado central de ventas si existe en state
        const centralSales = Array.isArray(currentState.sales)
          ? ([...currentState.sales] as Array<Record<string, unknown>>)
          : [];

        const recordedSale = {
          ...sale,
          _receivedAt: new Date().toISOString(),
          _fromTerminal: terminal
        };

        centralSales.unshift(recordedSale);
        currentState.sales = centralSales;
        store.state = currentState;

        store.processedSaleIds.unshift(sale.id);
        store.processedSaleIds = store.processedSaleIds.slice(0, 5000);

        store.networkSalesLog.unshift(recordedSale);
        store.networkSalesLog = store.networkSalesLog.slice(0, 1000);

        store.updatedAt = new Date().toISOString();
        store.lastTerminal = terminal;
        writeStore(store);

        return NextResponse.json({
          ok: true,
          saleId: sale.id,
          updatedAt: store.updatedAt,
          lastTerminal: terminal,
          updatedProducts: products
        });
      }

      return NextResponse.json(
        { ok: false, error: 'Payload inválido: envía "sale" o "state".' },
        { status: 400 }
      );
    });
  } catch {
    return NextResponse.json(
      { ok: false, error: 'Error procesando sincronización de caja en red' },
      { status: 500 }
    );
  }
}
