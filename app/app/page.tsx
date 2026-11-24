'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  getSupabaseBrowserClient,
  detectDeviceLabel
} from '../../lib/supabaseBrowser';

interface ProductRow {
  id: string;
  name: string;
  price_usd: number;
  stock: number;
}

interface SaleRow {
  id: string;
  total_usd: number;
  payment_method: string;
  device_label: string;
  created_at: string;
}

interface BusinessRow {
  id: string;
  name: string;
  bcv_usd_rate: number;
}

export default function GenesisCloudWorkspacePage() {
  const router = useRouter();
  const [userEmail, setUserEmail] = useState<string>('');
  const [userId, setUserId] = useState<string>('');
  const [deviceLabel, setDeviceLabel] = useState<'pc' | 'tablet' | 'mobile'>('pc');
  const [business, setBusiness] = useState<BusinessRow | null>(null);
  const [newBusinessName, setNewBusinessName] = useState('');
  const [products, setProducts] = useState<ProductRow[]>([]);
  const [sales, setSales] = useState<SaleRow[]>([]);
  const [selectedProductId, setSelectedProductId] = useState('');
  const [saleQty, setSaleQty] = useState(1);
  const [paymentMethod, setPaymentMethod] = useState('efectivo');
  const [newProdName, setNewProdName] = useState('');
  const [newProdPrice, setNewProdPrice] = useState('');
  const [newProdStock, setNewProdStock] = useState('10');
  const [aiQuestion, setAiQuestion] = useState('');
  const [aiAnswer, setAiAnswer] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [banner, setBanner] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  const loadWorkspace = useCallback(async () => {
    setLoading(true);
    try {
      const supabase = getSupabaseBrowserClient();
      const { data: authData } = await supabase.auth.getUser();
      if (!authData.user) {
        router.push('/login');
        return;
      }

      setUserEmail(authData.user.email || 'Usuario');
      setUserId(authData.user.id);

      const { data: bizList, error: bizErr } = await supabase
        .from('businesses')
        .select('id, name, bcv_usd_rate')
        .order('created_at', { ascending: true })
        .limit(1);

      if (bizErr) throw bizErr;

      const activeBiz = bizList && bizList.length > 0 ? (bizList[0] as BusinessRow) : null;
      setBusiness(activeBiz);

      if (activeBiz) {
        const [{ data: prods }, { data: recentSales }] = await Promise.all([
          supabase
            .from('products')
            .select('id, name, price_usd, stock')
            .eq('business_id', activeBiz.id)
            .eq('active', true)
            .order('name', { ascending: true }),
          supabase
            .from('sales')
            .select('id, total_usd, payment_method, device_label, created_at')
            .eq('business_id', activeBiz.id)
            .order('created_at', { ascending: false })
            .limit(20)
        ]);

        const listProds = (prods || []) as ProductRow[];
        setProducts(listProds);
        if (listProds.length > 0 && !selectedProductId) {
          setSelectedProductId(listProds[0].id);
        }
        setSales((recentSales || []) as SaleRow[]);
      }
    } catch (err: unknown) {
      setBanner({
        type: 'err',
        text: err instanceof Error ? err.message : 'Error cargando espacio en la nube'
      });
    } finally {
      setLoading(false);
    }
  }, [router, selectedProductId]);

  useEffect(() => {
    setDeviceLabel(detectDeviceLabel());
    loadWorkspace();
  }, [loadWorkspace]);

  async function handleCreateBusiness(e: React.FormEvent) {
    e.preventDefault();
    if (!newBusinessName.trim() || !userId) return;
    setBusy(true);
    setBanner(null);
    try {
      const supabase = getSupabaseBrowserClient();
      const { error } = await supabase.from('businesses').insert({
        name: newBusinessName.trim(),
        owner_user_id: userId
      });
      if (error) throw error;
      setNewBusinessName('');
      setBanner({ type: 'ok', text: 'Negocio creado y vinculado a tu cuenta en la nube.' });
      await loadWorkspace();
    } catch (err: unknown) {
      setBanner({
        type: 'err',
        text: err instanceof Error ? err.message : 'No se pudo crear el negocio'
      });
    } finally {
      setBusy(false);
    }
  }

  async function handleAddProduct(e: React.FormEvent) {
    e.preventDefault();
    if (!business || !newProdName.trim()) return;
    setBusy(true);
    setBanner(null);
    try {
      const supabase = getSupabaseBrowserClient();
      const { error } = await supabase.from('products').insert({
        business_id: business.id,
        name: newProdName.trim(),
        price_usd: Number(newProdPrice) || 0,
        stock: Number(newProdStock) || 0
      });
      if (error) throw error;
      setNewProdName('');
      setNewProdPrice('');
      setNewProdStock('10');
      setBanner({ type: 'ok', text: 'Producto guardado en la nube para todos tus equipos.' });
      await loadWorkspace();
    } catch (err: unknown) {
      setBanner({
        type: 'err',
        text: err instanceof Error ? err.message : 'Error agregando producto'
      });
    } finally {
      setBusy(false);
    }
  }

  async function handleQuickSale(e: React.FormEvent) {
    e.preventDefault();
    if (!business) return;
    const prod = products.find((p) => p.id === selectedProductId);
    if (!prod) {
      setBanner({ type: 'err', text: 'Selecciona un producto válido para facturar.' });
      return;
    }

    const qty = Math.max(1, Number(saleQty) || 1);
    const totalUsd = Number((prod.price_usd * qty).toFixed(2));
    const rate = Number(business.bcv_usd_rate) || 1;
    const totalBs = Number((totalUsd * rate).toFixed(2));

    setBusy(true);
    setBanner(null);
    try {
      const supabase = getSupabaseBrowserClient();
      const { error } = await supabase.rpc('register_cloud_sale', {
        p_business_id: business.id,
        p_device_label: deviceLabel,
        p_payment_method: paymentMethod,
        p_total_usd: totalUsd,
        p_total_bs: totalBs,
        p_items: [
          {
            product_id: prod.id,
            product_name: prod.name,
            quantity: qty,
            unit_price_usd: prod.price_usd
          }
        ]
      });
      if (error) throw error;

      setSaleQty(1);
      setBanner({
        type: 'ok',
        text: `Venta registrada ($${totalUsd.toFixed(2)}) desde ${deviceLabel.toUpperCase()} y stock descontado en la nube.`
      });
      await loadWorkspace();
    } catch (err: unknown) {
      setBanner({
        type: 'err',
        text: err instanceof Error ? err.message : 'No se pudo registrar la venta'
      });
    } finally {
      setBusy(false);
    }
  }

  function handleAskGenesisAi(e: React.FormEvent) {
    e.preventDefault();
    const totalVentasUsd = sales.reduce((acc, s) => acc + Number(s.total_usd || 0), 0);
    const lowStock = products.filter((p) => Number(p.stock) <= 3).map((p) => p.name);
    const q = aiQuestion.trim() || 'resumen';

    setAiAnswer(
      `Consulta "${q}": En "${business?.name || 'tu negocio'}" tienes ${sales.length} ventas recientes por un total de $${totalVentasUsd.toFixed(2)} USD y ${products.length} productos activos. ${
        lowStock.length > 0
          ? `Productos con stock bajo (<=3): ${lowStock.join(', ')}.`
          : 'No hay productos con stock crítico (<=3).'
      }`
    );
  }

  async function handleLogout() {
    const supabase = getSupabaseBrowserClient();
    await supabase.auth.signOut();
    router.push('/login');
    router.refresh();
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950 text-slate-300">
        Cargando tu espacio de Génesis en la nube...
      </div>
    );
  }

  const totalVentasUsd = sales.reduce((acc, s) => acc + Number(s.total_usd || 0), 0);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <header className="border-b border-slate-800 bg-slate-900">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-4 sm:px-6">
          <div>
            <div className="flex items-center gap-2">
              <span className="rounded-lg bg-sky-500 px-2.5 py-1 text-xs font-bold text-slate-950">
                GÉNESIS NUBE
              </span>
              <span className="rounded-lg border border-slate-700 bg-slate-950 px-2.5 py-1 text-xs uppercase text-sky-300">
                Dispositivo: {deviceLabel}
              </span>
            </div>
            <p className="mt-1 text-xs text-slate-400">
              Usuario activo: <strong className="text-slate-200">{userEmail}</strong>
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={loadWorkspace}
              className="rounded-xl border border-slate-700 bg-slate-950 px-3.5 py-2 text-xs font-semibold text-slate-200 hover:border-sky-500"
            >
              Sincronizar ahora
            </button>
            <button
              type="button"
              onClick={handleLogout}
              className="rounded-xl bg-slate-800 px-3.5 py-2 text-xs font-semibold text-slate-200 hover:bg-rose-600 hover:text-white"
            >
              Cerrar sesión
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl space-y-6 px-4 py-6 sm:px-6">
        {banner && (
          <div
            className={`rounded-xl border px-4 py-3 text-sm ${
              banner.type === 'ok'
                ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300'
                : 'border-rose-500/40 bg-rose-500/10 text-rose-300'
            }`}
          >
            {banner.text}
          </div>
        )}

        {!business ? (
          <form
            onSubmit={handleCreateBusiness}
            className="rounded-2xl border border-slate-800 bg-slate-900 p-6"
          >
            <h2 className="text-lg font-bold text-white">
              Crea tu negocio para iniciar en la nube
            </h2>
            <p className="mt-1 text-sm text-slate-400">
              Tu usuario quedará vinculado a este comercio en PC, tablet y teléfono.
            </p>
            <div className="mt-4 flex flex-col gap-3 sm:flex-row">
              <input
                type="text"
                required
                value={newBusinessName}
                onChange={(e) => setNewBusinessName(e.target.value)}
                placeholder="Nombre del negocio"
                className="flex-1 rounded-xl border border-slate-700 bg-slate-950 px-4 py-2.5 text-sm text-white focus:border-sky-500 focus:outline-none"
              />
              <button
                type="submit"
                disabled={busy}
                className="rounded-xl bg-sky-500 px-5 py-2.5 text-sm font-bold text-slate-950 hover:bg-sky-400"
              >
                Crear negocio
              </button>
            </div>
          </form>
        ) : (
          <>
            {/* Métricas rápidas */}
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
                <span className="text-xs text-slate-400">Negocio activo</span>
                <div className="mt-1 text-xl font-bold text-white">{business.name}</div>
              </div>
              <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
                <span className="text-xs text-slate-400">Ventas registradas (USD)</span>
                <div className="mt-1 text-xl font-bold text-emerald-400">
                  ${totalVentasUsd.toFixed(2)}
                </div>
              </div>
              <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
                <span className="text-xs text-slate-400">Productos en catálogo</span>
                <div className="mt-1 text-xl font-bold text-sky-400">
                  {products.length}
                </div>
              </div>
            </div>

            {/* Facturación rápida + Génesis IA */}
            <div className="grid gap-6 lg:grid-cols-2">
              <form
                onSubmit={handleQuickSale}
                className="rounded-2xl border border-slate-800 bg-slate-900 p-6 space-y-4"
              >
                <h2 className="text-lg font-bold text-white">
                  Facturación rápida en la nube
                </h2>

                <div>
                  <label className="mb-1 block text-xs text-slate-300">
                    Producto
                  </label>
                  <select
                    value={selectedProductId}
                    onChange={(e) => setSelectedProductId(e.target.value)}
                    className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3.5 py-2.5 text-sm text-white"
                  >
                    {products.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name} — ${Number(p.price_usd).toFixed(2)} (Stock: {p.stock})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="mb-1 block text-xs text-slate-300">
                      Cantidad
                    </label>
                    <input
                      type="number"
                      min={1}
                      value={saleQty}
                      onChange={(e) => setSaleQty(Number(e.target.value))}
                      className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3.5 py-2.5 text-sm text-white"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs text-slate-300">
                      Método de pago
                    </label>
                    <select
                      value={paymentMethod}
                      onChange={(e) => setPaymentMethod(e.target.value)}
                      className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3.5 py-2.5 text-sm text-white"
                    >
                      <option value="efectivo">Efectivo</option>
                      <option value="pago_movil">Pago Móvil</option>
                      <option value="punto_venta">Punto de Venta</option>
                      <option value="transferencia">Transferencia</option>
                    </select>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={busy || products.length === 0}
                  className="w-full rounded-xl bg-emerald-500 py-3 text-sm font-bold text-slate-950 hover:bg-emerald-400 disabled:opacity-50"
                >
                  Cobrar y sincronizar venta
                </button>
              </form>

              <div className="rounded-2xl border border-slate-800 bg-slate-900 p-6 space-y-4">
                <h2 className="text-lg font-bold text-white">
                  Génesis IA — Consulta rápida
                </h2>
                <p className="text-xs text-slate-400">
                  Ideal para consultar ventas, flujo de caja o stock bajo desde tu teléfono o tablet.
                </p>
                <form onSubmit={handleAskGenesisAi} className="flex gap-2">
                  <input
                    type="text"
                    value={aiQuestion}
                    onChange={(e) => setAiQuestion(e.target.value)}
                    placeholder="Ej. ¿Cómo van las ventas y el stock?"
                    className="flex-1 rounded-xl border border-slate-700 bg-slate-950 px-3.5 py-2.5 text-sm text-white"
                  />
                  <button
                    type="submit"
                    className="rounded-xl bg-sky-500 px-4 py-2.5 text-xs font-bold text-slate-950 hover:bg-sky-400"
                  >
                    Consultar
                  </button>
                </form>
                {aiAnswer && (
                  <div className="rounded-xl border border-sky-500/30 bg-slate-950 p-4 text-sm text-slate-200">
                    {aiAnswer}
                  </div>
                )}
              </div>
            </div>

            {/* Agregar producto + Ventas recientes */}
            <div className="grid gap-6 lg:grid-cols-2">
              <form
                onSubmit={handleAddProduct}
                className="rounded-2xl border border-slate-800 bg-slate-900 p-6 space-y-3"
              >
                <h3 className="text-base font-bold text-white">
                  Agregar producto al catálogo compartido
                </h3>
                <input
                  type="text"
                  required
                  value={newProdName}
                  onChange={(e) => setNewProdName(e.target.value)}
                  placeholder="Nombre del producto"
                  className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3.5 py-2 text-sm text-white"
                />
                <div className="grid grid-cols-2 gap-3">
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={newProdPrice}
                    onChange={(e) => setNewProdPrice(e.target.value)}
                    placeholder="Precio USD"
                    className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3.5 py-2 text-sm text-white"
                  />
                  <input
                    type="number"
                    step="1"
                    required
                    value={newProdStock}
                    onChange={(e) => setNewProdStock(e.target.value)}
                    placeholder="Stock inicial"
                    className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3.5 py-2 text-sm text-white"
                  />
                </div>
                <button
                  type="submit"
                  disabled={busy}
                  className="w-full rounded-xl bg-sky-500 py-2.5 text-sm font-bold text-slate-950 hover:bg-sky-400"
                >
                  Guardar producto en la nube
                </button>
              </form>

              <div className="rounded-2xl border border-slate-800 bg-slate-900 p-6">
                <h3 className="text-base font-bold text-white">
                  Últimas ventas sincronizadas
                </h3>
                <div className="mt-3 max-h-64 space-y-2 overflow-y-auto">
                  {sales.length === 0 ? (
                    <p className="text-xs text-slate-400">
                      Aún no hay ventas registradas en este negocio.
                    </p>
                  ) : (
                    sales.map((s) => (
                      <div
                        key={s.id}
                        className="flex items-center justify-between rounded-xl border border-slate-800 bg-slate-950 px-3.5 py-2.5 text-xs"
                      >
                        <div>
                          <span className="font-semibold text-white">
                            ${Number(s.total_usd).toFixed(2)}
                          </span>{' '}
                          <span className="text-slate-400">· {s.payment_method}</span>
                        </div>
                        <span className="rounded bg-slate-800 px-2 py-0.5 uppercase text-sky-300">
                          {s.device_label}
                        </span>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
