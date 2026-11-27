'use client';

import React, { useMemo, useState } from 'react';
import {
  FileSpreadsheet,
  Printer,
  Eye,
  X,
  Download,
  Scale,
  ReceiptText,
  Landmark,
  FileCheck2,
} from 'lucide-react';
import { ProductItem, SaleRecord, Transaction } from '../types/genesis';

interface SeniatDocumentsPanelProps {
  sales?: SaleRecord[];
  products?: ProductItem[];
  transactions?: Transaction[];
  rateToUsd?: number;
  currencySymbol?: string;
  businessName?: string;
  businessTaxId?: string;
  isDark?: boolean;
  state?: any;
  activeRate?: any;
  darkMode?: boolean;
}

type SeniatDocType =
  | 'libro_ventas_iva'
  | 'libro_compras_iva'
  | 'resumen_retenciones_iva'
  | 'resumen_islr_ingresos_egresos';

interface VentaFiscalRow {
  id: string;
  date: string;
  reference: string;
  customer: string;
  paymentType: string;
  baseUsd: number;
  ivaUsd: number;
  totalUsd: number;
  baseBs: number;
  ivaBs: number;
  totalBs: number;
}

interface CompraFiscalRow {
  id: string;
  date: string;
  reference: string;
  supplier: string;
  category: string;
  baseUsd: number;
  ivaUsd: number;
  totalUsd: number;
  baseBs: number;
  ivaBs: number;
  totalBs: number;
}

const IVA_RATE = 0.16;

function fmtUsd(val: number): string {
  return `$ ${val.toLocaleString('es-VE', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function fmtBs(val: number, symbol: string): string {
  return `${symbol} ${val.toLocaleString('es-VE', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export default function SeniatDocumentsPanel({
  sales: salesProp,
  products: productsProp,
  transactions: transactionsProp,
  rateToUsd: rateToUsdProp,
  currencySymbol: currencySymbolProp,
  businessName: businessNameProp,
  businessTaxId: businessTaxIdProp,
  isDark: isDarkProp,
  state,
  activeRate,
  darkMode,
}: SeniatDocumentsPanelProps) {
  const sales: SaleRecord[] = salesProp ?? state?.sales ?? [];
  const products: ProductItem[] = productsProp ?? state?.products ?? [];
  const transactions: Transaction[] = transactionsProp ?? state?.transactions ?? [];

  const resolvedRateCurrency = useMemo(() => {
    if (activeRate && typeof activeRate === 'object') return activeRate;
    const list = state?.currencies || [];
    const activeCode = state?.activeRateCurrencyCode;
    return (
      list.find((c: { code?: string }) => c.code === activeCode) ||
      list.find((c: { isBase?: boolean }) => !c.isBase) ||
      list[0]
    );
  }, [activeRate, state]);

  const rateToUsd =
    typeof rateToUsdProp === 'number'
      ? rateToUsdProp
      : typeof activeRate === 'number'
      ? activeRate
      : Number(resolvedRateCurrency?.rateToUsd ?? 46.5);

  const currencySymbol =
    currencySymbolProp ??
    (typeof resolvedRateCurrency?.symbol === 'string' && resolvedRateCurrency.symbol
      ? resolvedRateCurrency.symbol
      : 'Bs.');

  const businessName =
    businessNameProp ?? state?.invoiceTemplate?.businessName ?? 'Génesis Comercial';
  const businessTaxId =
    businessTaxIdProp ?? state?.invoiceTemplate?.taxId ?? 'J-40123456-7';
  const isDark =
    typeof isDarkProp === 'boolean'
      ? isDarkProp
      : typeof darkMode === 'boolean'
      ? darkMode
      : typeof state?.darkMode === 'boolean'
      ? state.darkMode
      : true;
  const todayStr = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const monthStartStr = useMemo(() => `${todayStr.slice(0, 8)}01`, [todayStr]);

  const [docType, setDocType] = useState<SeniatDocType>('libro_ventas_iva');
  const [dateFrom, setDateFrom] = useState<string>(monthStartStr);
  const [dateTo, setDateTo] = useState<string>(todayStr);
  const [retentionRate, setRetentionRate] = useState<number>(75);
  const [isPreviewOpen, setIsPreviewOpen] = useState<boolean>(false);

  const safeRate = rateToUsd > 0 ? rateToUsd : 46.5;

  const ventasFiscales = useMemo<VentaFiscalRow[]>(() => {
    return sales
      .filter((s) => {
        if (dateFrom && s.date < dateFrom) return false;
        if (dateTo && s.date > dateTo) return false;
        return true;
      })
      .map((s) => {
        const totalUsd = Number((s.total || 0).toFixed(2));
        // Si los items especifican hasIva, calculamos base e IVA exactos; si no, estimamos base + 16% IVA o base imponible
        let baseUsd = 0;
        let ivaUsd = 0;
        if (s.items && s.items.length > 0) {
          s.items.forEach((it) => {
            const lineTotal = (it.unitPrice || 0) * (it.quantity || 1);
            const matchedProd = products.find(
              (p) => p.id === it.productId || p.sku === it.sku || p.name === it.name
            );
            const hasIva = matchedProd ? matchedProd.hasIva !== false : true;
            if (hasIva) {
              const lineBase = lineTotal / (1 + IVA_RATE);
              baseUsd += lineBase;
              ivaUsd += lineTotal - lineBase;
            } else {
              baseUsd += lineTotal;
            }
          });
          baseUsd = Number(baseUsd.toFixed(2));
          ivaUsd = Number(ivaUsd.toFixed(2));
        } else {
          baseUsd = Number((totalUsd / (1 + IVA_RATE)).toFixed(2));
          ivaUsd = Number((totalUsd - baseUsd).toFixed(2));
        }

        return {
          id: s.id,
          date: s.date,
          reference: s.reference || s.id.toUpperCase(),
          customer: s.customerOrNote || 'Cliente Mostrador',
          paymentType: s.paymentType || 'Contado',
          baseUsd,
          ivaUsd,
          totalUsd,
          baseBs: Number((baseUsd * safeRate).toFixed(2)),
          ivaBs: Number((ivaUsd * safeRate).toFixed(2)),
          totalBs: Number((totalUsd * safeRate).toFixed(2)),
        };
      })
      .sort((a, b) => b.date.localeCompare(a.date));
  }, [sales, products, dateFrom, dateTo, safeRate]);

  const comprasFiscales = useMemo<CompraFiscalRow[]>(() => {
    return transactions
      .filter((t) => {
        if (t.amount >= 0) return false;
        if (dateFrom && t.date < dateFrom) return false;
        if (dateTo && t.date > dateTo) return false;
        return true;
      })
      .map((t) => {
        const totalUsd = Number(Math.abs(t.amount || 0).toFixed(2));
        const matchedProd = products.find(
          (p) =>
            t.merchant.toLowerCase().includes(p.name.toLowerCase()) ||
            t.merchant.toLowerCase().includes(p.sku.toLowerCase())
        );
        const hasIva = matchedProd ? matchedProd.hasIva !== false : true;
        const baseUsd = hasIva
          ? Number((totalUsd / (1 + IVA_RATE)).toFixed(2))
          : totalUsd;
        const ivaUsd = hasIva ? Number((totalUsd - baseUsd).toFixed(2)) : 0;

        return {
          id: t.id,
          date: t.date,
          reference: t.id.toUpperCase(),
          supplier: t.merchant || 'Proveedor / Comercio',
          category: t.categoryId || 'Egreso',
          baseUsd,
          ivaUsd,
          totalUsd,
          baseBs: Number((baseUsd * safeRate).toFixed(2)),
          ivaBs: Number((ivaUsd * safeRate).toFixed(2)),
          totalBs: Number((totalUsd * safeRate).toFixed(2)),
        };
      })
      .sort((a, b) => b.date.localeCompare(a.date));
  }, [transactions, products, dateFrom, dateTo, safeRate]);

  const totals = useMemo(() => {
    const vBaseUsd = ventasFiscales.reduce((a, r) => a + r.baseUsd, 0);
    const vIvaUsd = ventasFiscales.reduce((a, r) => a + r.ivaUsd, 0);
    const vTotalUsd = ventasFiscales.reduce((a, r) => a + r.totalUsd, 0);

    const cBaseUsd = comprasFiscales.reduce((a, r) => a + r.baseUsd, 0);
    const cIvaUsd = comprasFiscales.reduce((a, r) => a + r.ivaUsd, 0);
    const cTotalUsd = comprasFiscales.reduce((a, r) => a + r.totalUsd, 0);

    const retencionIvaUsd = Number(((cIvaUsd * retentionRate) / 100).toFixed(2));
    const ivaPorPagarUsd = Number((vIvaUsd - cIvaUsd).toFixed(2));
    const utilidadBrutaUsd = Number((vBaseUsd - cBaseUsd).toFixed(2));

    return {
      vBaseUsd,
      vIvaUsd,
      vTotalUsd,
      vBaseBs: vBaseUsd * safeRate,
      vIvaBs: vIvaUsd * safeRate,
      vTotalBs: vTotalUsd * safeRate,
      cBaseUsd,
      cIvaUsd,
      cTotalUsd,
      cBaseBs: cBaseUsd * safeRate,
      cIvaBs: cIvaUsd * safeRate,
      cTotalBs: cTotalUsd * safeRate,
      retencionIvaUsd,
      retencionIvaBs: retencionIvaUsd * safeRate,
      ivaPorPagarUsd,
      ivaPorPagarBs: ivaPorPagarUsd * safeRate,
      utilidadBrutaUsd,
      utilidadBrutaBs: utilidadBrutaUsd * safeRate,
    };
  }, [ventasFiscales, comprasFiscales, retentionRate, safeRate]);

  const docMeta: Record<
    SeniatDocType,
    { title: string; subtitle: string; code: string }
  > = {
    libro_ventas_iva: {
      title: 'LIBRO DE VENTAS FISCAL (IVA 16%)',
      subtitle: 'Relación cronológica de operaciones de venta para declaración de IVA',
      code: 'SENIAT-LV-IVA',
    },
    libro_compras_iva: {
      title: 'LIBRO DE COMPRAS FISCAL (IVA 16%)',
      subtitle: 'Relación de compras y egresos registrados con crédito fiscal estimado',
      code: 'SENIAT-LC-IVA',
    },
    resumen_retenciones_iva: {
      title: 'RESUMEN DE RETENCIONES DE IVA',
      subtitle: `Cálculo de retención (${retentionRate}%) sobre débito/crédito fiscal del período`,
      code: 'SENIAT-RET-IVA',
    },
    resumen_islr_ingresos_egresos: {
      title: 'RESUMEN DE INGRESOS, EGRESOS Y UTILIDAD (ISLR)',
      subtitle: 'Consolidado de bases imponibles, egresos operativos y resultado neto',
      code: 'SENIAT-ISLR-RES',
    },
  };

  const handleExportCsv = () => {
    const headers = [
      'Documento',
      'RIF',
      'Razon Social',
      'Desde',
      'Hasta',
      'Tasa Cambio',
      'Ventas Base USD',
      'Ventas IVA USD',
      'Ventas Total USD',
      'Compras Base USD',
      'Compras IVA USD',
      'Compras Total USD',
      `Retencion IVA (${retentionRate}%) USD`,
      'IVA Neto USD',
      'Utilidad Bruta USD',
    ];
    const row = [
      docMeta[docType].code,
      businessTaxId,
      businessName,
      dateFrom,
      dateTo,
      safeRate.toFixed(2),
      totals.vBaseUsd.toFixed(2),
      totals.vIvaUsd.toFixed(2),
      totals.vTotalUsd.toFixed(2),
      totals.cBaseUsd.toFixed(2),
      totals.cIvaUsd.toFixed(2),
      totals.cTotalUsd.toFixed(2),
      totals.retencionIvaUsd.toFixed(2),
      totals.ivaPorPagarUsd.toFixed(2),
      totals.utilidadBrutaUsd.toFixed(2),
    ];
    const csvContent = `${headers.join(',')}\n${row.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(',')}`;
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${docMeta[docType].code.toLowerCase()}-${dateFrom}-a-${dateTo}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      <div
        className={`rounded-xl border p-6 ${
          isDark
            ? 'bg-[#14171D] border-gray-800 text-gray-100'
            : 'bg-[#F7F9FE] border-indigo-200/70 text-slate-900 shadow-xs'
        }`}
      >
        <div className="flex flex-wrap items-center justify-between gap-4 mb-5">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-amber-500/15 text-amber-400">
              <Scale className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold tracking-tight">
                Documentos SENIAT — Preparación para Declaraciones
              </h2>
              <p className="text-xs text-gray-500">
                Genera soportes fiscales a partir de tus ventas, compras y movimientos registrados ({businessName} · RIF: {businessTaxId})
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handleExportCsv}
              className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold border transition cursor-pointer ${
                isDark
                  ? 'bg-[#1C212B] border-gray-700 hover:bg-gray-800 text-gray-200'
                  : 'bg-white border-gray-300 hover:bg-gray-100 text-slate-800'
              }`}
            >
              <Download className="w-3.5 h-3.5" />
              Exportar CSV Fiscal
            </button>
            <button
              type="button"
              onClick={() => setIsPreviewOpen(true)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold bg-amber-500 hover:bg-amber-400 text-slate-950 transition cursor-pointer"
            >
              <Eye className="w-3.5 h-3.5" />
              Generar / Vista Previa (Carta)
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5 mb-5">
          <div>
            <label className="block text-[11px] font-semibold uppercase text-gray-400 mb-1">
              Tipo de Documento SENIAT
            </label>
            <select
              value={docType}
              onChange={(e) => setDocType(e.target.value as SeniatDocType)}
              className={`w-full rounded-lg border px-3 py-2 text-xs font-medium outline-none ${
                isDark
                  ? 'bg-[#1C212B] border-gray-700 text-white'
                  : 'bg-white border-gray-300 text-slate-900'
              }`}
            >
              <option value="libro_ventas_iva">Libro de Ventas (IVA 16%)</option>
              <option value="libro_compras_iva">Libro de Compras (IVA 16%)</option>
              <option value="resumen_retenciones_iva">Resumen de Retenciones IVA</option>
              <option value="resumen_islr_ingresos_egresos">Resumen Ingresos / Egresos (ISLR)</option>
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-semibold uppercase text-gray-400 mb-1">
              Fecha Desde
            </label>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className={`w-full rounded-lg border px-3 py-1.5 text-xs outline-none ${
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
              className={`w-full rounded-lg border px-3 py-1.5 text-xs outline-none ${
                isDark
                  ? 'bg-[#1C212B] border-gray-700 text-white'
                  : 'bg-white border-gray-300 text-slate-900'
              }`}
            />
          </div>

          <div>
            <label className="block text-[11px] font-semibold uppercase text-gray-400 mb-1">
              % Retención IVA Referencial
            </label>
            <select
              value={retentionRate}
              onChange={(e) => setRetentionRate(Number(e.target.value))}
              className={`w-full rounded-lg border px-3 py-2 text-xs font-medium outline-none ${
                isDark
                  ? 'bg-[#1C212B] border-gray-700 text-white'
                  : 'bg-white border-gray-300 text-slate-900'
              }`}
            >
              <option value={75}>75% Retención IVA</option>
              <option value={100}>100% Retención IVA</option>
              <option value={0}>0% (Sin retención)</option>
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-5">
          <div
            className={`rounded-xl border p-4 ${
              isDark ? 'bg-[#0F1115] border-gray-800' : 'bg-white border-gray-200'
            }`}
          >
            <div className="flex items-center justify-between text-xs text-gray-400 mb-1">
              <span>Débito Fiscal (Ventas IVA)</span>
              <ReceiptText className="w-4 h-4 text-emerald-400" />
            </div>
            <div className="text-lg font-bold tabular-nums text-emerald-400">
              {fmtUsd(totals.vIvaUsd)}
            </div>
            <div className="text-[11px] text-gray-500 tabular-nums mt-0.5">
              {fmtBs(totals.vIvaBs, currencySymbol)} · Base: {fmtUsd(totals.vBaseUsd)}
            </div>
          </div>

          <div
            className={`rounded-xl border p-4 ${
              isDark ? 'bg-[#0F1115] border-gray-800' : 'bg-white border-gray-200'
            }`}
          >
            <div className="flex items-center justify-between text-xs text-gray-400 mb-1">
              <span>Crédito Fiscal (Compras IVA)</span>
              <FileSpreadsheet className="w-4 h-4 text-rose-400" />
            </div>
            <div className="text-lg font-bold tabular-nums text-rose-400">
              {fmtUsd(totals.cIvaUsd)}
            </div>
            <div className="text-[11px] text-gray-500 tabular-nums mt-0.5">
              {fmtBs(totals.cIvaBs, currencySymbol)} · Base: {fmtUsd(totals.cBaseUsd)}
            </div>
          </div>

          <div
            className={`rounded-xl border p-4 ${
              isDark ? 'bg-[#0F1115] border-gray-800' : 'bg-white border-gray-200'
            }`}
          >
            <div className="flex items-center justify-between text-xs text-gray-400 mb-1">
              <span>Retención IVA ({retentionRate}%)</span>
              <Landmark className="w-4 h-4 text-amber-400" />
            </div>
            <div className="text-lg font-bold tabular-nums text-amber-400">
              {fmtUsd(totals.retencionIvaUsd)}
            </div>
            <div className="text-[11px] text-gray-500 tabular-nums mt-0.5">
              {fmtBs(totals.retencionIvaBs, currencySymbol)}
            </div>
          </div>

          <div
            className={`rounded-xl border p-4 ${
              isDark ? 'bg-[#0F1115] border-gray-800' : 'bg-white border-gray-200'
            }`}
          >
            <div className="flex items-center justify-between text-xs text-gray-400 mb-1">
              <span>IVA Neto Estimado</span>
              <FileCheck2 className="w-4 h-4 text-sky-400" />
            </div>
            <div className="text-lg font-bold tabular-nums text-sky-400">
              {fmtUsd(totals.ivaPorPagarUsd)}
            </div>
            <div className="text-[11px] text-gray-500 tabular-nums mt-0.5">
              {fmtBs(totals.ivaPorPagarBs, currencySymbol)} · Tasa: {safeRate.toFixed(2)}
            </div>
          </div>
        </div>

        <div
          className={`rounded-xl border overflow-x-auto ${
            isDark ? 'bg-[#0F1115] border-gray-800' : 'bg-white border-gray-200'
          }`}
        >
          {docType === 'libro_ventas_iva' && (
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr className={isDark ? 'bg-[#181C24] text-gray-300' : 'bg-slate-100 text-slate-700'}>
                  <th className="p-2.5 text-left border-b border-gray-800">Fecha</th>
                  <th className="p-2.5 text-left border-b border-gray-800">Nro. Doc / Ref</th>
                  <th className="p-2.5 text-left border-b border-gray-800">Cliente / Nota</th>
                  <th className="p-2.5 text-right border-b border-gray-800">Base Imponible</th>
                  <th className="p-2.5 text-right border-b border-gray-800">IVA (16%)</th>
                  <th className="p-2.5 text-right border-b border-gray-800">Total Venta</th>
                </tr>
              </thead>
              <tbody>
                {ventasFiscales.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="p-5 text-center text-gray-500">
                      No hay ventas registradas en el rango seleccionado.
                    </td>
                  </tr>
                ) : (
                  ventasFiscales.map((r) => (
                    <tr key={r.id} className="border-b border-gray-800/50">
                      <td className="p-2.5 tabular-nums">{r.date}</td>
                      <td className="p-2.5 font-mono">{r.reference}</td>
                      <td className="p-2.5">{r.customer}</td>
                      <td className="p-2.5 text-right tabular-nums">{fmtUsd(r.baseUsd)}</td>
                      <td className="p-2.5 text-right tabular-nums text-emerald-400">
                        {fmtUsd(r.ivaUsd)}
                      </td>
                      <td className="p-2.5 text-right font-bold tabular-nums">
                        {fmtUsd(r.totalUsd)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          )}

          {docType === 'libro_compras_iva' && (
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr className={isDark ? 'bg-[#181C24] text-gray-300' : 'bg-slate-100 text-slate-700'}>
                  <th className="p-2.5 text-left border-b border-gray-800">Fecha</th>
                  <th className="p-2.5 text-left border-b border-gray-800">Nro. Ref</th>
                  <th className="p-2.5 text-left border-b border-gray-800">Proveedor / Concepto</th>
                  <th className="p-2.5 text-right border-b border-gray-800">Base Imponible</th>
                  <th className="p-2.5 text-right border-b border-gray-800">IVA (16%)</th>
                  <th className="p-2.5 text-right border-b border-gray-800">Total Compra</th>
                </tr>
              </thead>
              <tbody>
                {comprasFiscales.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="p-5 text-center text-gray-500">
                      No hay compras/egresos registrados en el rango seleccionado.
                    </td>
                  </tr>
                ) : (
                  comprasFiscales.map((r) => (
                    <tr key={r.id} className="border-b border-gray-800/50">
                      <td className="p-2.5 tabular-nums">{r.date}</td>
                      <td className="p-2.5 font-mono">{r.reference}</td>
                      <td className="p-2.5">{r.supplier}</td>
                      <td className="p-2.5 text-right tabular-nums">{fmtUsd(r.baseUsd)}</td>
                      <td className="p-2.5 text-right tabular-nums text-rose-400">
                        {fmtUsd(r.ivaUsd)}
                      </td>
                      <td className="p-2.5 text-right font-bold tabular-nums">
                        {fmtUsd(r.totalUsd)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          )}

          {(docType === 'resumen_retenciones_iva' ||
            docType === 'resumen_islr_ingresos_egresos') && (
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr className={isDark ? 'bg-[#181C24] text-gray-300' : 'bg-slate-100 text-slate-700'}>
                  <th className="p-2.5 text-left border-b border-gray-800">Concepto Fiscal</th>
                  <th className="p-2.5 text-right border-b border-gray-800">Monto USD</th>
                  <th className="p-2.5 text-right border-b border-gray-800">Monto ({currencySymbol})</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b border-gray-800/50">
                  <td className="p-2.5">Ventas Gravables / Base Imponible</td>
                  <td className="p-2.5 text-right tabular-nums">{fmtUsd(totals.vBaseUsd)}</td>
                  <td className="p-2.5 text-right tabular-nums">
                    {fmtBs(totals.vBaseBs, currencySymbol)}
                  </td>
                </tr>
                <tr className="border-b border-gray-800/50">
                  <td className="p-2.5">Débito Fiscal IVA (16%)</td>
                  <td className="p-2.5 text-right tabular-nums text-emerald-400">
                    {fmtUsd(totals.vIvaUsd)}
                  </td>
                  <td className="p-2.5 text-right tabular-nums">
                    {fmtBs(totals.vIvaBs, currencySymbol)}
                  </td>
                </tr>
                <tr className="border-b border-gray-800/50">
                  <td className="p-2.5">Compras / Egresos Base Imponible</td>
                  <td className="p-2.5 text-right tabular-nums">{fmtUsd(totals.cBaseUsd)}</td>
                  <td className="p-2.5 text-right tabular-nums">
                    {fmtBs(totals.cBaseBs, currencySymbol)}
                  </td>
                </tr>
                <tr className="border-b border-gray-800/50">
                  <td className="p-2.5">Crédito Fiscal IVA (16%)</td>
                  <td className="p-2.5 text-right tabular-nums text-rose-400">
                    {fmtUsd(totals.cIvaUsd)}
                  </td>
                  <td className="p-2.5 text-right tabular-nums">
                    {fmtBs(totals.cIvaBs, currencySymbol)}
                  </td>
                </tr>
                <tr className="border-b border-gray-800/50">
                  <td className="p-2.5 font-semibold">
                    Retención IVA Calculada ({retentionRate}%)
                  </td>
                  <td className="p-2.5 text-right font-bold tabular-nums text-amber-400">
                    {fmtUsd(totals.retencionIvaUsd)}
                  </td>
                  <td className="p-2.5 text-right font-bold tabular-nums">
                    {fmtBs(totals.retencionIvaBs, currencySymbol)}
                  </td>
                </tr>
                <tr>
                  <td className="p-2.5 font-bold">
                    Utilidad / Margen Bruto Estimado (ISLR)
                  </td>
                  <td className="p-2.5 text-right font-bold tabular-nums text-sky-400">
                    {fmtUsd(totals.utilidadBrutaUsd)}
                  </td>
                  <td className="p-2.5 text-right font-bold tabular-nums">
                    {fmtBs(totals.utilidadBrutaBs, currencySymbol)}
                  </td>
                </tr>
              </tbody>
            </table>
          )}
        </div>
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
                <Scale className="w-4 h-4 text-rose-700" />
                <span className="text-sm font-bold">
                  {docMeta[docType].title} — Tamaño Carta
                </span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white cursor-pointer"
                >
                  <Printer className="w-3.5 h-3.5" />
                  Imprimir / Guardar PDF
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
                data-report-exact="true"
                className="ex-sheet w-[215.9mm] min-h-[279.4mm] p-[12mm] rounded-xl text-xs space-y-4"
              >
                <div className="flex justify-between items-start border-b border-slate-300 pb-3">
                  <div>
                    <div className="text-xs font-extrabold uppercase ex-kpi-label">
                      {businessName}
                    </div>
                    <div className="text-[10.5px] ex-muted">
                      RIF: {businessTaxId} · Tasa Ref.: {safeRate.toFixed(2)} {currencySymbol}/USD
                    </div>
                    <div className="text-[10.5px] ex-muted">
                      Período Fiscal: {dateFrom} al {dateTo}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="ex-title-berry text-sm font-extrabold uppercase">
                      {docMeta[docType].title}
                    </div>
                    <div className="text-[10.5px] ex-muted">{docMeta[docType].subtitle}</div>
                    <div className="text-[10px] font-mono ex-muted">
                      Código: {docMeta[docType].code}
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div className="ex-kpi-card p-3 text-center">
                    <div className="ex-kpi-label text-[10.5px] font-semibold">
                      Total Ventas Gravables
                    </div>
                    <div className="ex-kpi-val text-sm font-extrabold tabular-nums mt-1">
                      {fmtUsd(totals.vBaseUsd)}
                    </div>
                    <div className="text-[10px] ex-muted tabular-nums">
                      IVA: {fmtUsd(totals.vIvaUsd)}
                    </div>
                  </div>
                  <div className="ex-kpi-card p-3 text-center">
                    <div className="ex-kpi-label text-[10.5px] font-semibold">
                      Total Compras / Egresos
                    </div>
                    <div className="ex-kpi-val text-sm font-extrabold tabular-nums mt-1">
                      {fmtUsd(totals.cBaseUsd)}
                    </div>
                    <div className="text-[10px] ex-muted tabular-nums">
                      IVA: {fmtUsd(totals.cIvaUsd)}
                    </div>
                  </div>
                  <div className="ex-kpi-card p-3 text-center">
                    <div className="ex-kpi-label text-[10.5px] font-semibold">
                      Retención IVA ({retentionRate}%)
                    </div>
                    <div className="ex-kpi-val text-sm font-extrabold tabular-nums mt-1">
                      {fmtUsd(totals.retencionIvaUsd)}
                    </div>
                    <div className="text-[10px] ex-muted tabular-nums">
                      {fmtBs(totals.retencionIvaBs, currencySymbol)}
                    </div>
                  </div>
                </div>

                <div className="ex-pill-banner py-1.5 px-3 text-center text-[11px] font-bold">
                  Detalle de Registros del Sistema ({dateFrom} al {dateTo})
                </div>

                <div className="overflow-hidden rounded-lg border border-slate-300">
                  <table className="ex-table text-[10px]">
                    <thead>
                      <tr>
                        <th className="py-1.5 px-2 text-left">Fecha</th>
                        <th className="py-1.5 px-2 text-left">Referencia</th>
                        <th className="py-1.5 px-2 text-left">Contraparte / Concepto</th>
                        <th className="py-1.5 px-2 text-right">Base USD</th>
                        <th className="py-1.5 px-2 text-right">IVA 16% USD</th>
                        <th className="py-1.5 px-2 text-right">Total USD</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(docType === 'libro_compras_iva' ? comprasFiscales : ventasFiscales).map(
                        (item) => (
                          <tr key={item.id}>
                            <td className="py-1.5 px-2 tabular-nums">{item.date}</td>
                            <td className="py-1.5 px-2 font-mono">{item.reference}</td>
                            <td className="py-1.5 px-2">
                              {'customer' in item ? item.customer : item.supplier}
                            </td>
                            <td className="py-1.5 px-2 text-right tabular-nums">
                              {fmtUsd(item.baseUsd)}
                            </td>
                            <td className="py-1.5 px-2 text-right tabular-nums">
                              {fmtUsd(item.ivaUsd)}
                            </td>
                            <td className="py-1.5 px-2 text-right font-bold tabular-nums">
                              {fmtUsd(item.totalUsd)}
                            </td>
                          </tr>
                        )
                      )}
                    </tbody>
                  </table>
                </div>

                <div className="text-[10px] ex-muted pt-2">
                  Documento referencial generado automáticamente por el sistema Génesis para apoyo en declaraciones ante el SENIAT. Verifique las facturas originales y retenciones emitidas/recibidas antes de declarar.
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
