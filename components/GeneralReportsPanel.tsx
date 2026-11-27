'use client';

import React, { useMemo, useState } from 'react';
import {
  FileText,
  Printer,
  Eye,
  X,
  BarChart3,
  TrendingUp,
  TrendingDown,
} from 'lucide-react';
import { GeneralExpenseItem, ProductItem, SaleRecord, Transaction } from '../types/genesis';

interface GeneralReportsPanelProps {
  sales: SaleRecord[];
  products: ProductItem[];
  transactions: Transaction[];
  generalExpenses?: GeneralExpenseItem[];
  rateToUsd: number;
  currencySymbol: string;
  businessName?: string;
  businessTaxId?: string;
  isDark?: boolean;
}

interface DetailedMovementRow {
  id: string;
  date: string;
  operationType: 'Venta' | 'Compra';
  reference: string;
  sku: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  subtotal: number;
  paymentOrCategory: string;
}

const PIE_SLICE_COLORS = [
  '#0d2b45',
  '#7a1c4b',
  '#1d4ed8',
  '#0f766e',
  '#fb7185',
  '#d97706',
];

const MONTHS_ES = [
  'Enero',
  'Febrero',
  'Marzo',
  'Abril',
  'Mayo',
  'Junio',
  'Julio',
  'Agosto',
  'Septiembre',
  'Octubre',
  'Noviembre',
  'Diciembre',
];

function formatLongDateEs(isoDate: string): string {
  if (!isoDate) return '';
  const parts = isoDate.split('-');
  if (parts.length !== 3) return isoDate;
  const year = parts[0];
  const monthIdx = Math.max(0, Math.min(11, parseInt(parts[1], 10) - 1));
  const day = parseInt(parts[2], 10);
  return `${day} de ${MONTHS_ES[monthIdx]} de ${year}`;
}

function getMonthNameEs(isoDate: string): string {
  if (!isoDate) return 'del Período';
  const parts = isoDate.split('-');
  if (parts.length < 2) return 'del Período';
  const monthIdx = Math.max(0, Math.min(11, parseInt(parts[1], 10) - 1));
  return MONTHS_ES[monthIdx];
}

export default function GeneralReportsPanel({
  sales,
  products,
  transactions,
  generalExpenses = [],
  rateToUsd = 46.5,
  currencySymbol = 'Bs.',
  businessName = 'Génesis Comercial',
  businessTaxId = 'J-40123456-7',
  isDark = true,
}: GeneralReportsPanelProps) {
  const todayStr = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const monthStartStr = useMemo(() => `${todayStr.slice(0, 8)}01`, [todayStr]);

  const [reportMode, setReportMode] = useState<'simple' | 'detallado'>('simple');
  const [simpleSubject, setSimpleSubject] = useState<'ventas' | 'compras' | 'gastos'>('ventas');
  const [dateFrom, setDateFrom] = useState<string>(monthStartStr);
  const [dateTo, setDateTo] = useState<string>(todayStr);
  const [isPreviewOpen, setIsPreviewOpen] = useState<boolean>(false);

  const applyPresetRange = (daysBack: number | 'all' | 'month') => {
    if (daysBack === 'all') {
      setDateFrom('2000-01-01');
      setDateTo('2099-12-31');
      return;
    }
    if (daysBack === 'month') {
      setDateFrom(monthStartStr);
      setDateTo(todayStr);
      return;
    }
    const base = new Date(`${todayStr}T12:00:00`);
    base.setDate(base.getDate() - daysBack);
    setDateFrom(base.toISOString().slice(0, 10));
    setDateTo(todayStr);
  };

  const filteredSales = useMemo(() => {
    return sales.filter((s) => {
      if (dateFrom && s.date < dateFrom) return false;
      if (dateTo && s.date > dateTo) return false;
      return true;
    });
  }, [sales, dateFrom, dateTo]);

  const filteredPurchaseTxs = useMemo(() => {
    return transactions.filter((t) => {
      if (t.amount >= 0) return false;
      if (dateFrom && t.date < dateFrom) return false;
      if (dateTo && t.date > dateTo) return false;
      return true;
    });
  }, [transactions, dateFrom, dateTo]);

  const filteredExpenses = useMemo(() => {
    return (generalExpenses || []).filter((g) => {
      const gDay = String(g.date || '').slice(0, 10);
      if (dateFrom && gDay < dateFrom) return false;
      if (dateTo && gDay > dateTo) return false;
      return true;
    });
  }, [generalExpenses, dateFrom, dateTo]);

  const detailedRows = useMemo<DetailedMovementRow[]>(() => {
    const rows: DetailedMovementRow[] = [];

    filteredSales.forEach((sale) => {
      if (sale.items && sale.items.length > 0) {
        sale.items.forEach((item, idx) => {
          const lineTotal = Number((item.unitPrice * item.quantity).toFixed(2));
          rows.push({
            id: `${sale.id}-item-${idx}`,
            date: sale.date,
            operationType: 'Venta',
            reference: sale.reference || sale.id,
            sku: item.sku || 'N/A',
            productName: item.name,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            subtotal: lineTotal,
            paymentOrCategory: sale.paymentType || 'Contado',
          });
        });
      } else {
        rows.push({
          id: `${sale.id}-gen`,
          date: sale.date,
          operationType: 'Venta',
          reference: sale.reference || sale.id,
          sku: 'GEN-VTA',
          productName: sale.customerOrNote || 'Venta General',
          quantity: 1,
          unitPrice: sale.total,
          subtotal: sale.total,
          paymentOrCategory: sale.paymentType || 'Contado',
        });
      }
    });

    filteredPurchaseTxs.forEach((tx) => {
      const absAmount = Math.abs(tx.amount);
      const merchantLower = (tx.merchant || '').toLowerCase();
      const matchedProduct = products.find(
        (p) =>
          merchantLower.includes((p.name || '').toLowerCase()) ||
          merchantLower.includes((p.sku || '').toLowerCase())
      );
      const unitCost = matchedProduct ? matchedProduct.costPrice : absAmount;
      const qty =
        matchedProduct && matchedProduct.costPrice > 0
          ? Math.max(1, Math.round(absAmount / matchedProduct.costPrice))
          : 1;

      rows.push({
        id: `buy-${tx.id}`,
        date: tx.date,
        operationType: 'Compra',
        reference: tx.id.toUpperCase(),
        sku: matchedProduct?.sku || 'CMP-GEN',
        productName: matchedProduct?.name || tx.merchant || 'Compra General',
        quantity: qty,
        unitPrice: Number(unitCost.toFixed(2)),
        subtotal: Number(absAmount.toFixed(2)),
        paymentOrCategory: 'Compra / Egreso',
      });
    });

    return rows.sort((a, b) => b.date.localeCompare(a.date));
  }, [filteredSales, filteredPurchaseTxs, products]);

  const inventoryStats = useMemo(() => {
    const totalUnits = products.reduce((acc, p) => acc + (p.stock || 0), 0);
    const totalValue = products.reduce(
      (acc, p) => acc + (p.stock || 0) * (p.costPrice || p.price || 0),
      0
    );
    return { totalUnits, totalValue };
  }, [products]);

  const simpleSummary = useMemo(() => {
    const monthLabel = getMonthNameEs(dateTo || dateFrom);

    if (simpleSubject === 'ventas') {
      const totalUsd = filteredSales.reduce((acc, s) => acc + s.total, 0);
      const unitsSold = filteredSales.reduce((acc, s) => {
        if (s.items && s.items.length > 0) {
          return acc + s.items.reduce((sum, it) => sum + (it.quantity || 0), 0);
        }
        return acc + 1;
      }, 0);

      const byMethod: Record<string, { amount: number; count: number }> = {};
      const byDate: Record<string, number> = {};
      const byProductSold: Record<string, { qty: number; amount: number }> = {};

      filteredSales.forEach((s) => {
        const method = s.paymentType || 'Efectivo';
        if (!byMethod[method]) byMethod[method] = { amount: 0, count: 0 };
        byMethod[method].amount += s.total;
        byMethod[method].count += 1;
        byDate[s.date] = (byDate[s.date] || 0) + s.total;

        if (s.items && s.items.length > 0) {
          s.items.forEach((it) => {
            const pName = it.name || 'Producto';
            if (!byProductSold[pName]) byProductSold[pName] = { qty: 0, amount: 0 };
            byProductSold[pName].qty += it.quantity || 1;
            byProductSold[pName].amount += (it.unitPrice || 0) * (it.quantity || 1);
          });
        } else {
          const pName = s.customerOrNote || 'Venta General';
          if (!byProductSold[pName]) byProductSold[pName] = { qty: 0, amount: 0 };
          byProductSold[pName].qty += 1;
          byProductSold[pName].amount += s.total;
        }
      });

      const topItems = Object.entries(byProductSold)
        .map(([label, v]) => ({ label, qty: v.qty, amount: v.amount }))
        .sort((a, b) => b.amount - a.amount)
        .slice(0, 5);

      const primaryMethod = Object.entries(byMethod).sort((a, b) => b[1].amount - a[1].amount)[0];
      const accountTitle = primaryMethod
        ? `Ingresos en Cuentas (${primaryMethod[0]})`
        : 'Ingresos en Cuentas (Efectivo)';
      const accountLabel = primaryMethod ? primaryMethod[0] : 'Efectivo';
      const accountAmount = primaryMethod ? primaryMethod[1].amount : totalUsd;

      return {
        kpi1Title: 'Ingresos en Ventas',
        kpi1Value: `$ ${totalUsd.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
        kpi2Title: 'Productos Vendidos',
        kpi2Value: `${unitsSold.toLocaleString('es-VE')} Prod.`,
        kpi3Title: 'Inventario Actual',
        kpi3Units: `${inventoryStats.totalUnits.toLocaleString('es-VE')} Prod.`,
        kpi3Amount: `$ ${inventoryStats.totalValue.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
        behaviorBanner: `Comportamiento diario de las ventas durante el mes de ${monthLabel}`,
        tableBanner: 'Productos más vendidos',
        col1: 'Nro',
        col2: 'Descripción del Producto',
        col3: 'Cant.',
        col4: 'Ingresos Generales',
        accountTitle,
        accountLabel,
        accountAmount,
        dailySeries: Object.entries(byDate).sort((a, b) => a[0].localeCompare(b[0])),
        topItems,
      };
    } else if (simpleSubject === 'compras') {
      const totalUsd = filteredPurchaseTxs.reduce((acc, t) => acc + Math.abs(t.amount), 0);
      const byConcept: Record<string, { amount: number; count: number }> = {};
      const byDate: Record<string, number> = {};

      filteredPurchaseTxs.forEach((t) => {
        const key = t.merchant || 'Compra';
        const val = Math.abs(t.amount);
        if (!byConcept[key]) byConcept[key] = { amount: 0, count: 0 };
        byConcept[key].amount += val;
        byConcept[key].count += 1;
        byDate[t.date] = (byDate[t.date] || 0) + val;
      });

      const topItems = Object.entries(byConcept)
        .map(([label, v]) => ({ label, qty: v.count, amount: v.amount }))
        .sort((a, b) => b.amount - a.amount)
        .slice(0, 5);

      return {
        kpi1Title: 'Total Compras',
        kpi1Value: `$ ${totalUsd.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
        kpi2Title: 'Operaciones Compra',
        kpi2Value: `${filteredPurchaseTxs.length} Reg.`,
        kpi3Title: 'Inventario Actual',
        kpi3Units: `${inventoryStats.totalUnits.toLocaleString('es-VE')} Prod.`,
        kpi3Amount: `$ ${inventoryStats.totalValue.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
        behaviorBanner: `Comportamiento diario de las compras durante el mes de ${monthLabel}`,
        tableBanner: 'Productos / Conceptos comprados',
        col1: 'Nro',
        col2: 'Descripción del Producto',
        col3: 'Cant.',
        col4: 'Total Compras',
        accountTitle: 'Salidas por Compras (Efectivo)',
        accountLabel: 'Efectivo',
        accountAmount: totalUsd,
        dailySeries: Object.entries(byDate).sort((a, b) => a[0].localeCompare(b[0])),
        topItems,
      };
    } else {
      const totalUsd = filteredExpenses.reduce((acc, g) => acc + Math.abs(Number(g.amount || 0)), 0);
      const byReason: Record<string, { amount: number; count: number }> = {};
      const byDate: Record<string, number> = {};
      const byMethod: Record<string, number> = {};

      filteredExpenses.forEach((g) => {
        const invoiceTag = g.invoiceNumber && g.invoiceNumber !== 'S/N' ? ` [Fact. ${g.invoiceNumber}]` : '';
        const detailTag = g.notes ? ` · ${g.notes}` : '';
        const label = `${g.reason || 'Gasto general'}${invoiceTag}${detailTag}`;
        const val = Math.abs(Number(g.amount || 0));
        if (!byReason[label]) byReason[label] = { amount: 0, count: 0 };
        byReason[label].amount += val;
        byReason[label].count += 1;
        const gDay = String(g.date || '').slice(0, 10);
        if (gDay) byDate[gDay] = (byDate[gDay] || 0) + val;
        const mKey = g.paymentMethod || 'Efectivo';
        byMethod[mKey] = (byMethod[mKey] || 0) + val;
      });

      const topItems = Object.entries(byReason)
        .map(([label, v]) => ({ label, qty: v.count, amount: v.amount }))
        .sort((a, b) => b.amount - a.amount)
        .slice(0, 5);

      const primaryMethod = Object.entries(byMethod).sort((a, b) => b[1] - a[1])[0];

      return {
        kpi1Title: 'Total Gastos Generales',
        kpi1Value: `$ ${totalUsd.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
        kpi2Title: 'Gastos Registrados',
        kpi2Value: `${filteredExpenses.length} Reg.`,
        kpi3Title: 'Inventario Actual',
        kpi3Units: `${inventoryStats.totalUnits.toLocaleString('es-VE')} Prod.`,
        kpi3Amount: `$ ${inventoryStats.totalValue.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
        behaviorBanner: `Comportamiento diario de los gastos durante el mes de ${monthLabel}`,
        tableBanner: 'Gastos registrados (Motivo, N° Factura y Detalles)',
        col1: 'Nro',
        col2: 'Motivo / Factura / Detalles',
        col3: 'Cant.',
        col4: 'Monto Gasto',
        accountTitle: primaryMethod ? `Gastos por Medio (${primaryMethod[0]})` : 'Gastos por Medio (Efectivo)',
        accountLabel: primaryMethod ? primaryMethod[0] : 'Efectivo',
        accountAmount: primaryMethod ? primaryMethod[1] : totalUsd,
        dailySeries: Object.entries(byDate).sort((a, b) => a[0].localeCompare(b[0])),
        topItems,
      };
    }
  }, [simpleSubject, filteredSales, filteredPurchaseTxs, filteredExpenses, inventoryStats, dateFrom, dateTo]);

  const detailedSummary = useMemo(() => {
    const salesRows = detailedRows.filter((r) => r.operationType === 'Venta');
    const purchaseRows = detailedRows.filter((r) => r.operationType === 'Compra');
    const totalVentasUsd = salesRows.reduce((acc, r) => acc + r.subtotal, 0);
    const totalComprasUsd = purchaseRows.reduce((acc, r) => acc + r.subtotal, 0);
    const unitsSold = salesRows.reduce((acc, r) => acc + r.quantity, 0);
    const unitsBought = purchaseRows.reduce((acc, r) => acc + r.quantity, 0);

    const byProduct: Record<
      string,
      { sku: string; ventas: number; compras: number; uVenta: number; uCompra: number }
    > = {};
    const byDateMov: Record<string, number> = {};

    detailedRows.forEach((r) => {
      if (!byProduct[r.productName]) {
        byProduct[r.productName] = {
          sku: r.sku,
          ventas: 0,
          compras: 0,
          uVenta: 0,
          uCompra: 0,
        };
      }
      if (r.operationType === 'Venta') {
        byProduct[r.productName].ventas += r.subtotal;
        byProduct[r.productName].uVenta += r.quantity;
      } else {
        byProduct[r.productName].compras += r.subtotal;
        byProduct[r.productName].uCompra += r.quantity;
      }
      byDateMov[r.date] = (byDateMov[r.date] || 0) + r.subtotal;
    });

    const productStats = Object.entries(byProduct)
      .map(([name, val]) => ({
        name,
        ...val,
        balance: val.ventas - val.compras,
        totalMov: val.ventas + val.compras,
      }))
      .sort((a, b) => b.totalMov - a.totalMov);

    return {
      totalVentasUsd,
      totalComprasUsd,
      netBalanceUsd: totalVentasUsd - totalComprasUsd,
      unitsSold,
      unitsBought,
      productStats,
      dailySeries: Object.entries(byDateMov).sort((a, b) => a[0].localeCompare(b[0])),
    };
  }, [detailedRows]);

  const handlePrintLetter = () => {
    window.print();
  };

  const renderBehaviorLineChart = (series: [string, number][]) => {
    const svgW = 680;
    const svgH = 165;
    const padL = 56;
    const padR = 14;
    const padT = 12;
    const padB = 24;
    const plotW = svgW - padL - padR;
    const plotH = svgH - padT - padB;

    const cleanSeries: [string, number][] =
      series.length > 0 ? series : [[dateFrom || 'Hoy', 0]];

    const rawMax = Math.max(...cleanSeries.map(([, v]) => v));
    const maxVal = rawMax > 0 ? rawMax * 1.15 : 100;

    const coords = cleanSeries.map(([label, val], idx) => {
      const x =
        cleanSeries.length === 1
          ? padL + plotW / 2
          : padL + (idx / (cleanSeries.length - 1)) * plotW;
      const y = padT + plotH - (Math.max(0, val) / maxVal) * plotH;
      return { x, y, label, val };
    });

    const linePath = coords
      .map((pt, i) => `${i === 0 ? 'M' : 'L'} ${pt.x.toFixed(1)} ${pt.y.toFixed(1)}`)
      .join(' ');

    const areaPath =
      coords.length > 0
        ? `${linePath} L ${coords[coords.length - 1].x.toFixed(1)} ${(padT + plotH).toFixed(
            1
          )} L ${coords[0].x.toFixed(1)} ${(padT + plotH).toFixed(1)} Z`
        : '';

    const yTicks = [1, 0.75, 0.5, 0.25, 0].map((ratio) => ({
      val: Math.round(maxVal * ratio),
      y: padT + plotH * (1 - ratio),
    }));

    return (
      <svg viewBox={`0 0 ${svgW} ${svgH}`} className="w-full h-auto block">
        <defs>
          <linearGradient id="exactBerryArea" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#8b3a62" stopOpacity="0.34" />
            <stop offset="100%" stopColor="#8b3a62" stopOpacity="0.02" />
          </linearGradient>
        </defs>

        {yTicks.map((t, i) => (
          <g key={i}>
            <line
              x1={padL}
              y1={t.y}
              x2={svgW - padR}
              y2={t.y}
              stroke="#cbd5e1"
              strokeWidth="0.8"
            />
            <text
              x={padL - 6}
              y={t.y + 3}
              textAnchor="end"
              fontSize="9"
              fill="#64748b"
            >
              {t.val}
            </text>
          </g>
        ))}

        <line
          x1={padL}
          y1={padT}
          x2={padL}
          y2={padT + plotH}
          stroke="#94a3b8"
          strokeWidth="1.2"
        />

        {areaPath && <path d={areaPath} fill="url(#exactBerryArea)" />}
        {coords.length > 1 && (
          <path
            d={linePath}
            fill="none"
            stroke="#8b3a62"
            strokeWidth="2.2"
            strokeLinejoin="round"
          />
        )}

        {coords.map((pt, i) => (
          <g key={i}>
            <circle cx={pt.x} cy={pt.y} r="2.8" fill="#8b3a62" />
            <text
              x={pt.x}
              y={padT + plotH + 14}
              textAnchor="middle"
              fontSize="8.5"
              fill="#475569"
            >
              {pt.label.slice(8) || pt.label.slice(5)}
            </text>
          </g>
        ))}
      </svg>
    );
  };

  const renderPieChart = (items: { label: string; qty: number; amount: number }[]) => {
    const valid = items.filter((it) => it.amount > 0);
    const total = valid.reduce((acc, it) => acc + it.amount, 0);

    if (valid.length === 0 || total <= 0) {
      return (
        <div className="h-36 flex items-center justify-center text-[11px] ex-muted">
          Sin datos para gráfica circular.
        </div>
      );
    }

    const cx = 115;
    const cy = 82;
    const r = 56;
    let currentAngle = -Math.PI / 2;

    const slices = valid.map((it, idx) => {
      const sliceAngle = (it.amount / total) * Math.PI * 2;
      const startAngle = currentAngle;
      const endAngle = currentAngle + sliceAngle;
      currentAngle = endAngle;

      const x1 = cx + r * Math.cos(startAngle);
      const y1 = cy + r * Math.sin(startAngle);
      const x2 = cx + r * Math.cos(endAngle);
      const y2 = cy + r * Math.sin(endAngle);
      const largeArc = sliceAngle > Math.PI ? 1 : 0;

      const midAngle = (startAngle + endAngle) / 2;
      const lx = cx + (r + 18) * Math.cos(midAngle);
      const ly = cy + (r + 14) * Math.sin(midAngle);

      const pathData = `M ${cx} ${cy} L ${x1.toFixed(2)} ${y1.toFixed(
        2
      )} A ${r} ${r} 0 ${largeArc} 1 ${x2.toFixed(2)} ${y2.toFixed(2)} Z`;

      return {
        pathData,
        color: PIE_SLICE_COLORS[idx % PIE_SLICE_COLORS.length],
        qty: it.qty,
        lx,
        ly,
      };
    });

    return (
      <div className="flex flex-col items-center">
        <svg viewBox="0 0 230 162" className="w-full max-w-[230px] h-auto">
          {slices.map((s, i) => (
            <g key={i}>
              <path
                d={s.pathData}
                fill={s.color}
                stroke="#ffffff"
                strokeWidth="2"
              />
              <text
                x={s.lx}
                y={s.ly}
                textAnchor="middle"
                fontSize="8.5"
                fontWeight="700"
                fill="#1e293b"
              >
                {s.qty}
              </text>
            </g>
          ))}
        </svg>
      </div>
    );
  };

  const renderAccountBar = (label: string, amount: number) => {
    const formattedAmount = `$ ${amount.toLocaleString('es-VE', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
    const topTick = Math.max(100, Math.ceil(amount * 1.25));

    return (
      <div className="pt-1">
        <div className="flex items-end gap-2 h-28 px-2">
          <div className="flex flex-col justify-between h-full text-[9px] ex-muted tabular-nums pr-1">
            <span>{topTick}</span>
            <span>{Math.round(topTick * 0.66)}</span>
            <span>{Math.round(topTick * 0.33)}</span>
            <span>0</span>
          </div>
          <div className="flex-1 h-full border-l border-b border-slate-300 flex items-end justify-center pt-3">
            <div
              className="w-24 sm:w-28 rounded-t-xs"
              style={{
                height: amount > 0 ? '85%' : '4%',
                backgroundColor: '#f48fb1',
              }}
            />
          </div>
        </div>
        <div className="text-center mt-1.5">
          <div className="text-[11px] font-semibold ex-kpi-label">{label}</div>
          <div className="text-[11px] font-bold ex-kpi-val tabular-nums">{formattedAmount}</div>
        </div>
      </div>
    );
  };

  return (
    <div>
      <style>{`
        @media print {
          @page {
            size: letter portrait;
            margin: 10mm;
          }
          body * {
            visibility: hidden !important;
          }
          #genesis-letter-print-area,
          #genesis-letter-print-area * {
            visibility: visible !important;
          }
          #genesis-letter-print-area {
            position: fixed !important;
            left: 0 !important;
            top: 0 !important;
            width: 100% !important;
            max-width: 100% !important;
            background-color: #ffffff !important;
            color: #1e293b !important;
            padding: 6mm !important;
            margin: 0 !important;
          }
          .no-print {
            display: none !important;
          }
        }
      `}</style>

      <div
        className={`rounded-2xl border p-4 flex flex-wrap items-center justify-between gap-3 text-xs no-print ${
          isDark ? 'bg-[#121726] border-indigo-500/30 text-gray-200' : 'bg-indigo-50/70 border-indigo-200 text-slate-800'
        }`}
      >
        <div className="space-y-0.5">
          <div className="font-bold text-sm text-indigo-400">
            Resumen Contable del Período ({formatLongDateEs(dateFrom)} — {formatLongDateEs(dateTo)})
          </div>
          <div className="text-[11px] text-gray-400">
            Tasa de referencia activa: 1 USD = {rateToUsd.toFixed(2)} {currencySymbol} · {businessName} ({businessTaxId})
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => {
              const rows = [
                ['Tipo', 'Fecha', 'Referencia', 'Detalle', 'Monto USD', `Monto (${currencySymbol})`],
                ...filteredSales.map((s) => {
                  const saleAmt = Number(s.total || 0);
                  const customerLabel =
                    s.customerDetails?.fullName ||
                    s.customerOrNote ||
                    s.paymentType ||
                    'Cliente General';
                  return [
                    'Venta',
                    s.date || '',
                    s.reference || s.id,
                    customerLabel,
                    saleAmt.toFixed(2),
                    (saleAmt * rateToUsd).toFixed(2),
                  ];
                }),
                ...filteredExpenses.map((e) => {
                  const expAmt = Math.abs(Number(e.amount || 0));
                  const expLabel =
                    e.reason ||
                    e.supplierOrBeneficiary ||
                    e.notes ||
                    'Gasto operativo';
                  return [
                    'Gasto',
                    e.date || '',
                    e.invoiceNumber || e.id,
                    expLabel,
                    expAmt.toFixed(2),
                    (expAmt * rateToUsd).toFixed(2),
                  ];
                }),
              ];
              const csvContent = rows
                .map((r) => r.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(';'))
                .join('\n');
              const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
              const url = URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url;
              a.download = `reporte-contable-${dateFrom || 'periodo'}-a-${dateTo || 'hoy'}.csv`;
              a.click();
              URL.revokeObjectURL(url);
            }}
            className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-semibold cursor-pointer"
          >
            Exportar CSV Contable
          </button>
        </div>
      </div>

      <div
        className={`md:col-span-2 rounded-xl border p-5 transition ${
          isDark
            ? 'bg-[#14171D] border-gray-800 text-gray-100'
            : 'bg-[#F7F9FE] border-indigo-200/70 text-slate-900 shadow-xs'
        }`}
      >
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-rose-500/15 text-rose-400">
              <BarChart3 className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-400">
                Centro de Reportes — Resumen General
              </h3>
              <p className="text-xs text-gray-500">
                Reportes simples y detallados producto a producto con gráficas y formato Tamaño Carta
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setIsPreviewOpen(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-rose-600 hover:bg-rose-500 text-white transition cursor-pointer"
            >
              <Eye className="w-3.5 h-3.5" />
              Vista Previa del Reporte (Carta)
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 mb-4">
          <div>
            <label className="block text-[11px] font-semibold uppercase text-gray-400 mb-1">
              Tipo de Reporte
            </label>
            <select
              value={reportMode}
              onChange={(e) => setReportMode(e.target.value as 'simple' | 'detallado')}
              className={`w-full rounded-lg border px-2.5 py-2 text-xs font-medium outline-none ${
                isDark
                  ? 'bg-[#1C212B] border-gray-700 text-white'
                  : 'bg-white border-gray-300 text-slate-900'
              }`}
            >
              <option value="simple">Reporte Simple</option>
              <option value="detallado">Reporte Detallado</option>
            </select>
          </div>

          {reportMode === 'simple' ? (
            <div>
              <label className="block text-[11px] font-semibold uppercase text-gray-400 mb-1">
                Operación Simple
              </label>
              <select
                value={simpleSubject}
                onChange={(e) =>
                  setSimpleSubject(e.target.value as 'ventas' | 'compras' | 'gastos')
                }
                className={`w-full rounded-lg border px-2.5 py-2 text-xs font-medium outline-none ${
                  isDark
                    ? 'bg-[#1C212B] border-gray-700 text-white'
                    : 'bg-white border-gray-300 text-slate-900'
                }`}
              >
                <option value="ventas">Ventas</option>
                <option value="compras">Compras</option>
                <option value="gastos">Gastos</option>
              </select>
            </div>
          ) : (
            <div>
              <label className="block text-[11px] font-semibold uppercase text-gray-400 mb-1">
                Alcance Detallado
              </label>
              <div
                className={`w-full rounded-lg border px-2.5 py-2 text-xs font-medium ${
                  isDark
                    ? 'bg-[#1C212B]/60 border-gray-800 text-rose-300'
                    : 'bg-rose-50 border-rose-200 text-rose-700'
                }`}
              >
                Compras + Ventas por Producto
              </div>
            </div>
          )}

          <div>
            <label className="block text-[11px] font-semibold uppercase text-gray-400 mb-1">
              Fecha Desde
            </label>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className={`w-full rounded-lg border px-2.5 py-1.5 text-xs outline-none ${
                isDark
                  ? 'bg-[#1C212B] border-gray-700 text-white'
                  : 'bg-white border-gray-300 text-slate-900'
              }`}
            />
          </div>

          <div>
            <label className="block text-[11px] font-semibold uppercase text-gray-400 mb-1">
              Fecha Hasta
            </label>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className={`w-full rounded-lg border px-2.5 py-1.5 text-xs outline-none ${
                isDark
                  ? 'bg-[#1C212B] border-gray-700 text-white'
                  : 'bg-white border-gray-300 text-slate-900'
              }`}
            />
          </div>

          <div>
            <label className="block text-[11px] font-semibold uppercase text-gray-400 mb-1">
              Rango Rápido
            </label>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => applyPresetRange(0)}
                className={`flex-1 py-1.5 px-2 rounded-lg text-[11px] font-medium border cursor-pointer ${
                  isDark
                    ? 'bg-[#1C212B] border-gray-700 hover:bg-gray-800'
                    : 'bg-white border-gray-300 hover:bg-gray-100'
                }`}
              >
                Hoy
              </button>
              <button
                type="button"
                onClick={() => applyPresetRange(7)}
                className={`flex-1 py-1.5 px-2 rounded-lg text-[11px] font-medium border cursor-pointer ${
                  isDark
                    ? 'bg-[#1C212B] border-gray-700 hover:bg-gray-800'
                    : 'bg-white border-gray-300 hover:bg-gray-100'
                }`}
              >
                7d
              </button>
              <button
                type="button"
                onClick={() => applyPresetRange('month')}
                className={`flex-1 py-1.5 px-2 rounded-lg text-[11px] font-medium border cursor-pointer ${
                  isDark
                    ? 'bg-[#1C212B] border-gray-700 hover:bg-gray-800'
                    : 'bg-white border-gray-300 hover:bg-gray-100'
                }`}
              >
                Mes
              </button>
              <button
                type="button"
                onClick={() => applyPresetRange('all')}
                className={`flex-1 py-1.5 px-2 rounded-lg text-[11px] font-medium border cursor-pointer ${
                  isDark
                    ? 'bg-[#1C212B] border-gray-700 hover:bg-gray-800'
                    : 'bg-white border-gray-300 hover:bg-gray-100'
                }`}
              >
                Todo
              </button>
            </div>
          </div>
        </div>

        {reportMode === 'simple' ? (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div
              className={`rounded-lg border p-3.5 ${
                isDark ? 'bg-[#0F1115] border-gray-800' : 'bg-white border-gray-200'
              }`}
            >
              <div className="flex items-center justify-between text-xs text-gray-400 mb-1">
                <span>{simpleSummary.kpi1Title}</span>
                {simpleSubject === 'ventas' ? (
                  <TrendingUp className="w-4 h-4 text-emerald-400" />
                ) : (
                  <TrendingDown className="w-4 h-4 text-rose-400" />
                )}
              </div>
              <div className="text-xl font-bold tabular-nums text-emerald-400">
                {simpleSummary.kpi1Value}
              </div>
              <div className="text-[11px] text-gray-500 mt-0.5 tabular-nums">
                {simpleSummary.kpi2Title}: {simpleSummary.kpi2Value}
              </div>
            </div>

            <div
              className={`lg:col-span-2 rounded-lg border p-3.5 ${
                isDark ? 'bg-[#0F1115] border-gray-800' : 'bg-white border-gray-200'
              }`}
            >
              <div className="text-[11px] font-semibold uppercase text-gray-400 mb-2">
                {simpleSummary.behaviorBanner}
              </div>
              <div className="flex items-end gap-2 h-24 pt-2">
                {simpleSummary.dailySeries.length === 0 ? (
                  <p className="text-xs text-gray-500 py-4">
                    Sin movimientos registrados en este rango de fechas.
                  </p>
                ) : (
                  simpleSummary.dailySeries.map(([day, val], i) => {
                    const maxV = Math.max(1, ...simpleSummary.dailySeries.map(([, v]) => v));
                    const pct = Math.max(8, Math.round((val / maxV) * 100));
                    return (
                      <div key={day} className="flex-1 flex flex-col items-center gap-1 min-w-0">
                        <span className="text-[10px] font-semibold tabular-nums text-gray-300 truncate">
                          ${val.toFixed(0)}
                        </span>
                        <div className="w-full h-14 flex items-end justify-center">
                          <div
                            className="w-full max-w-[30px] rounded-t"
                            style={{
                              height: `${pct}%`,
                              backgroundColor: PIE_SLICE_COLORS[i % PIE_SLICE_COLORS.length],
                            }}
                          />
                        </div>
                        <span className="text-[10px] text-gray-500 tabular-nums">
                          {day.slice(5)}
                        </span>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div
              className={`rounded-lg border p-3.5 space-y-2 ${
                isDark ? 'bg-[#0F1115] border-gray-800' : 'bg-white border-gray-200'
              }`}
            >
              <div className="flex justify-between text-xs">
                <span className="text-gray-400">Ventas Productos:</span>
                <span className="font-bold text-emerald-400 tabular-nums">
                  +${detailedSummary.totalVentasUsd.toFixed(2)} ({detailedSummary.unitsSold} uds)
                </span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-gray-400">Compras Productos:</span>
                <span className="font-bold text-rose-400 tabular-nums">
                  -${detailedSummary.totalComprasUsd.toFixed(2)} ({detailedSummary.unitsBought} uds)
                </span>
              </div>
              <div className="pt-2 border-t border-gray-800 flex justify-between text-xs">
                <span className="font-semibold">Balance Neto:</span>
                <span className="font-bold text-sky-400 tabular-nums">
                  ${detailedSummary.netBalanceUsd.toFixed(2)}
                </span>
              </div>
            </div>

            <div
              className={`lg:col-span-2 rounded-lg border p-3.5 ${
                isDark ? 'bg-[#0F1115] border-gray-800' : 'bg-white border-gray-200'
              }`}
            >
              <div className="text-[11px] font-semibold uppercase text-gray-400 mb-2">
                Productos con Mayor Movimiento (Compras y Ventas)
              </div>
              <div className="space-y-1.5">
                {detailedSummary.productStats.slice(0, 4).map((p) => (
                  <div key={p.name} className="flex justify-between text-xs">
                    <span className="truncate max-w-[55%]">{p.name}</span>
                    <span className="tabular-nums text-gray-300">
                      V: ${p.ventas.toFixed(2)} · C: ${p.compras.toFixed(2)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {isPreviewOpen && (
        <div
          data-report-exact="true"
          className="ex-backdrop fixed inset-0 z-50 flex items-center justify-center p-4 overflow-y-auto"
        >
          <div
            data-report-exact="true"
            className="ex-modal-shell rounded-2xl max-w-4xl w-full max-h-[92vh] flex flex-col shadow-2xl"
          >
            <div
              data-report-exact="true"
              className="ex-toolbar no-print flex flex-wrap items-center justify-between gap-2 px-5 py-3 rounded-t-2xl"
            >
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-rose-700" />
                <span className="text-sm font-bold">
                  Vista Previa del Reporte — Hoja Tamaño Carta (8.5&quot; × 11&quot;)
                </span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handlePrintLetter}
                  className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white cursor-pointer"
                >
                  <Printer className="w-3.5 h-3.5" />
                  Imprimir / Guardar PDF (Carta)
                </button>
                <button
                  type="button"
                  onClick={() => setIsPreviewOpen(false)}
                  className="p-1.5 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-slate-200 cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div
              data-report-exact="true"
              className="ex-stage p-5 overflow-y-auto flex justify-center"
            >
              <div
                id="genesis-letter-print-area"
                data-report-exact="true"
                className="ex-sheet w-[215.9mm] min-h-[279.4mm] p-[12mm] rounded-xl text-xs space-y-4"
              >
                <div className="flex justify-between items-start">
                  <div>
                    <div className="text-xs font-bold uppercase ex-kpi-label">{businessName}</div>
                    <div className="text-[10px] ex-muted">
                      RIF: {businessTaxId} · {dateFrom} al {dateTo}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="ex-title-berry text-base font-extrabold uppercase tracking-wide">
                      REPORTE DEL MES
                    </div>
                    <div className="text-[11px] font-medium ex-muted">
                      {formatLongDateEs(dateTo || todayStr)}
                    </div>
                  </div>
                </div>

                {reportMode === 'simple' ? (
                  <>
                    <div className="grid grid-cols-3 gap-3.5">
                      <div className="ex-kpi-card px-4 py-3 text-center">
                        <div className="ex-kpi-label text-[11px] font-semibold flex items-center justify-center gap-1.5">
                          <span>{simpleSummary.kpi1Title}</span>
                          <span className="text-[10px] ex-muted">💵</span>
                        </div>
                        <div className="ex-kpi-val text-base font-extrabold tabular-nums mt-1">
                          {simpleSummary.kpi1Value}
                        </div>
                      </div>

                      <div className="ex-kpi-card px-4 py-3 text-center">
                        <div className="ex-kpi-label text-[11px] font-semibold">
                          {simpleSummary.kpi2Title}
                        </div>
                        <div className="ex-kpi-val text-base font-extrabold tabular-nums mt-1">
                          {simpleSummary.kpi2Value}
                        </div>
                      </div>

                      <div className="ex-kpi-card px-4 py-3 flex items-center justify-between gap-2">
                        <div className="flex-1 text-left">
                          <div className="ex-kpi-label text-[11px] font-semibold">
                            {simpleSummary.kpi3Title}
                          </div>
                          <div className="ex-kpi-val text-xs font-extrabold tabular-nums mt-1">
                            {simpleSummary.kpi3Units}
                          </div>
                          <div className="ex-kpi-val text-xs font-extrabold tabular-nums">
                            {simpleSummary.kpi3Amount}
                          </div>
                        </div>
                        <div className="flex flex-col gap-1 text-[10px] ex-muted">
                          <span>📦</span>
                          <span>💲</span>
                        </div>
                      </div>
                    </div>

                    <div>
                      <div className="ex-pill-banner py-1.5 px-4 text-center text-[11.5px] font-bold mb-2">
                        {simpleSummary.behaviorBanner}
                      </div>
                      <div className="ex-card-box p-2.5">
                        {renderBehaviorLineChart(simpleSummary.dailySeries)}
                      </div>
                    </div>

                    <div>
                      <div className="ex-pill-banner py-1.5 px-4 text-center text-[11.5px] font-bold mb-2">
                        {simpleSummary.tableBanner}
                      </div>
                      <div className="overflow-hidden rounded-lg border border-slate-300">
                        <table className="ex-table text-[10.5px]">
                          <thead>
                            <tr>
                              <th className="py-1.5 px-2 text-center w-12">{simpleSummary.col1}</th>
                              <th className="py-1.5 px-2.5 text-left">{simpleSummary.col2}</th>
                              <th className="py-1.5 px-2 text-right w-16">{simpleSummary.col3}</th>
                              <th className="py-1.5 px-2.5 text-right w-32">{simpleSummary.col4}</th>
                            </tr>
                          </thead>
                          <tbody>
                            {simpleSummary.topItems.length === 0 ? (
                              <tr>
                                <td colSpan={4} className="py-3 px-2 text-center ex-muted">
                                  No hay registros en este período.
                                </td>
                              </tr>
                            ) : (
                              simpleSummary.topItems.map((row, idx) => (
                                <tr key={row.label}>
                                  <td className="py-1.5 px-2 text-center font-semibold tabular-nums">
                                    {idx + 1}
                                  </td>
                                  <td className="py-1.5 px-2.5 font-semibold uppercase">
                                    {row.label}
                                  </td>
                                  <td className="py-1.5 px-2 text-right font-semibold tabular-nums">
                                    {row.qty}
                                  </td>
                                  <td className="py-1.5 px-2.5 text-right font-bold tabular-nums">
                                    $ {row.amount.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                  </td>
                                </tr>
                              ))
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                      <div className="ex-card-box p-3">
                        <div className="flex justify-end text-[10px] ex-muted mb-1">📦</div>
                        {renderPieChart(simpleSummary.topItems)}
                      </div>

                      <div className="ex-card-box p-3">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-[11px] font-bold ex-kpi-label">
                            {simpleSummary.accountTitle}
                          </span>
                          <span className="text-[10px] ex-muted">💲</span>
                        </div>
                        {renderAccountBar(simpleSummary.accountLabel, simpleSummary.accountAmount)}
                      </div>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="grid grid-cols-3 gap-3.5">
                      <div className="ex-kpi-card px-4 py-3 text-center">
                        <div className="ex-kpi-label text-[11px] font-semibold">
                          Total Ventas Productos
                        </div>
                        <div className="ex-kpi-val text-base font-extrabold tabular-nums mt-1 text-emerald-700">
                          $ {detailedSummary.totalVentasUsd.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </div>
                      </div>

                      <div className="ex-kpi-card px-4 py-3 text-center">
                        <div className="ex-kpi-label text-[11px] font-semibold">
                          Total Compras Productos
                        </div>
                        <div className="ex-kpi-val text-base font-extrabold tabular-nums mt-1 text-rose-700">
                          $ {detailedSummary.totalComprasUsd.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </div>
                      </div>

                      <div className="ex-kpi-card px-4 py-3 text-center">
                        <div className="ex-kpi-label text-[11px] font-semibold">
                          Balance Neto / Unidades
                        </div>
                        <div className="ex-kpi-val text-sm font-extrabold tabular-nums mt-1">
                          $ {detailedSummary.netBalanceUsd.toFixed(2)}
                        </div>
                        <div className="text-[10.5px] ex-muted tabular-nums">
                          V: {detailedSummary.unitsSold} uds · C: {detailedSummary.unitsBought} uds
                        </div>
                      </div>
                    </div>

                    <div>
                      <div className="ex-pill-banner py-1.5 px-4 text-center text-[11.5px] font-bold mb-2">
                        Comportamiento diario de movimientos ({dateFrom} al {dateTo})
                      </div>
                      <div className="ex-card-box p-2.5">
                        {renderBehaviorLineChart(detailedSummary.dailySeries)}
                      </div>
                    </div>

                    <div>
                      <div className="ex-pill-banner py-1.5 px-4 text-center text-[11.5px] font-bold mb-2">
                        Detalle producto a producto (Compras y Ventas)
                      </div>
                      <div className="overflow-hidden rounded-lg border border-slate-300">
                        <table className="ex-table text-[10px]">
                          <thead>
                            <tr>
                              <th className="py-1.5 px-1.5 text-left">Fecha</th>
                              <th className="py-1.5 px-1.5 text-left">Tipo</th>
                              <th className="py-1.5 px-1.5 text-left">SKU</th>
                              <th className="py-1.5 px-1.5 text-left">Producto</th>
                              <th className="py-1.5 px-1.5 text-right">Cant.</th>
                              <th className="py-1.5 px-1.5 text-right">P. Unit</th>
                              <th className="py-1.5 px-1.5 text-right">Subtotal</th>
                            </tr>
                          </thead>
                          <tbody>
                            {detailedRows.map((row) => (
                              <tr key={row.id}>
                                <td className="py-1.5 px-1.5 tabular-nums">{row.date}</td>
                                <td className="py-1.5 px-1.5 font-bold">{row.operationType}</td>
                                <td className="py-1.5 px-1.5 font-mono">{row.sku}</td>
                                <td className="py-1.5 px-1.5">{row.productName}</td>
                                <td className="py-1.5 px-1.5 text-right tabular-nums">
                                  {row.quantity}
                                </td>
                                <td className="py-1.5 px-1.5 text-right tabular-nums">
                                  ${row.unitPrice.toFixed(2)}
                                </td>
                                <td className="py-1.5 px-1.5 text-right font-bold tabular-nums">
                                  ${row.subtotal.toFixed(2)}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
