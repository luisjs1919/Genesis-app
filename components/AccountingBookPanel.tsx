'use client';

import React, { useMemo, useState } from 'react';
import { BookOpen, Eye, Printer, Save, Lock } from 'lucide-react';
import { GeneralExpenseItem, SaleRecord, Transaction } from '../types/genesis';
import { generateXlsxBytes } from '../lib/excelWorkbook';

interface AccountingBookPanelProps {
  sales?: SaleRecord[];
  transactions?: Transaction[];
  generalExpenses?: GeneralExpenseItem[];
  rateToUsd?: number;
  currencySymbol?: string;
  businessName?: string;
  businessTaxId?: string;
  isDark?: boolean;
  state?: any;
  activeRate?: any;
  darkMode?: boolean;
}

interface LedgerEntry {
  id: string;
  date: string;
  reference: string;
  concept: string;
  source: 'Venta' | 'Movimiento' | 'Gasto General';
  debitUsd: number;
  creditUsd: number;
  balanceUsd: number;
}

function toSafeString(val: unknown, fallback = ''): string {
  if (typeof val === 'string') return val;
  if (typeof val === 'number' || typeof val === 'boolean') return String(val);
  return fallback;
}

export default function AccountingBookPanel({
  sales: salesProp,
  transactions: transactionsProp,
  generalExpenses: generalExpensesProp,
  rateToUsd: rateToUsdProp,
  currencySymbol: currencySymbolProp,
  businessName: businessNameProp,
  businessTaxId: businessTaxIdProp,
  isDark: isDarkProp,
  state,
  activeRate,
  darkMode,
}: AccountingBookPanelProps) {
  const sales: SaleRecord[] = salesProp ?? state?.sales ?? [];
  const transactions: Transaction[] = transactionsProp ?? state?.transactions ?? [];
  const generalExpenses: GeneralExpenseItem[] = generalExpensesProp ?? state?.generalExpenses ?? [];

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
  const [isPreviewMode, setIsPreviewMode] = useState(false);

  const ledgerRows = useMemo<LedgerEntry[]>(() => {
    const raw: Omit<LedgerEntry, 'balanceUsd'>[] = [];

    (sales || []).forEach((s) => {
      const amt = Math.abs(Number(s.total || 0));
      const refStr = toSafeString(s.reference).trim() || toSafeString(s.id).trim() || 'S/R';
      const custStr = toSafeString(s.customerOrNote).trim() || 'Cliente';
      const payStr = toSafeString(s.paymentType).trim() || 'Contado';
      raw.push({
        id: `sale-${toSafeString(s.id)}`,
        date: toSafeString(s.date).slice(0, 10),
        reference: refStr,
        concept: `Venta — ${custStr} (${payStr})`,
        source: 'Venta',
        debitUsd: amt,
        creditUsd: 0,
      });
    });

    (transactions || []).forEach((t) => {
      const val = Number(t.amount || 0);
      const isIncome = val >= 0;
      const txId = toSafeString(t.id).trim() || 'MOV';
      raw.push({
        id: `tx-${txId}`,
        date: toSafeString(t.date).slice(0, 10),
        reference: txId,
        concept: toSafeString(t.merchant).trim() || 'Movimiento contable',
        source: 'Movimiento',
        debitUsd: isIncome ? Math.abs(val) : 0,
        creditUsd: !isIncome ? Math.abs(val) : 0,
      });
    });

    (generalExpenses || []).forEach((g) => {
      const amt = Math.abs(Number(g.amount || 0));
      const rawInv = toSafeString(g.invoiceNumber).trim();
      const gId = toSafeString(g.id).trim() || 'GASTO';
      const inv = rawInv && rawInv !== 'S/N' ? ` · Fact. ${rawInv}` : '';
      const reasonStr = toSafeString(g.reason).trim() || 'Gasto general';
      raw.push({
        id: `exp-${gId}`,
        date: toSafeString(g.date).slice(0, 10),
        reference: rawInv || gId,
        concept: `Gasto: ${reasonStr}${inv}`,
        source: 'Gasto General',
        debitUsd: 0,
        creditUsd: amt,
      });
    });

    raw.sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id));

    let running = 0;
    return raw.map((item) => {
      running = Number((running + item.debitUsd - item.creditUsd).toFixed(2));
      return {
        ...item,
        balanceUsd: running,
      };
    });
  }, [sales, transactions, generalExpenses]);

  const totals = useMemo(() => {
    const debit = ledgerRows.reduce((acc, r) => acc + r.debitUsd, 0);
    const credit = ledgerRows.reduce((acc, r) => acc + r.creditUsd, 0);
    const net = Number((debit - credit).toFixed(2));
    return { debit, credit, net };
  }, [ledgerRows]);

  const handleSaveBook = () => {
    const bytes = generateXlsxBytes([
      {
        name: 'Libro Contabilidad',
        headers: [
          'Fecha',
          'Referencia',
          'Origen',
          'Concepto',
          'Debe ($)',
          'Haber ($)',
          'Saldo ($)',
          `Saldo (${currencySymbol})`,
        ],
        rows: ledgerRows.map((r) => [
          r.date,
          r.reference,
          r.source,
          r.concept,
          r.debitUsd,
          r.creditUsd,
          r.balanceUsd,
          Number((r.balanceUsd * (rateToUsd || 1)).toFixed(2)),
        ]),
      },
    ]);
    const blob = new Blob([new Uint8Array(bytes)], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `libro_contabilidad_${new Date().toISOString().slice(0, 10)}.xlsx`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handlePrintBook = () => {
    window.print();
  };

  const fmtUsd = (n: number) =>
    `$ ${Number(n || 0).toLocaleString('es-VE', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;

  return (
    <div className="space-y-4 select-none">
      <div
        className={`rounded-2xl border p-4 flex flex-wrap items-center justify-between gap-3 ${
          isDark
            ? 'bg-[#14171D] border-gray-800 text-gray-100'
            : 'bg-white border-indigo-200/80 text-slate-900'
        }`}
      >
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-indigo-600/15 text-indigo-400 flex items-center justify-center">
            <BookOpen className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base font-bold">Libro de Contabilidad</h3>
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-amber-500/15 text-amber-400 border border-amber-500/30">
                <Lock className="w-3 h-3" /> Solo lectura
              </span>
            </div>
            <p className="text-xs text-gray-500">
              {businessName} ({businessTaxId}) · Registro inmodificable de operaciones contables
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setIsPreviewMode((prev) => !prev)}
            className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold border transition cursor-pointer ${
              isPreviewMode
                ? 'bg-indigo-600 text-white border-indigo-600'
                : isDark
                ? 'bg-[#0F1115] border-gray-700 text-gray-200 hover:bg-gray-800'
                : 'bg-slate-50 border-gray-300 text-slate-800 hover:bg-gray-100'
            }`}
          >
            <Eye className="w-3.5 h-3.5" />
            {isPreviewMode ? 'Salir de Vista Previa' : 'Vista Previa'}
          </button>

          <button
            type="button"
            onClick={handleSaveBook}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white transition cursor-pointer"
          >
            <Save className="w-3.5 h-3.5" />
            Guardar
          </button>

          <button
            type="button"
            onClick={handlePrintBook}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 text-white transition cursor-pointer"
          >
            <Printer className="w-3.5 h-3.5" />
            Imprimir
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div
          className={`rounded-xl border p-4 ${
            isDark ? 'bg-[#14171D] border-gray-800' : 'bg-white border-indigo-200/70'
          }`}
        >
          <p className="text-xs text-gray-500">Total Debe (Entradas)</p>
          <p className="text-lg font-bold text-emerald-500 tabular-nums mt-1">
            {fmtUsd(totals.debit)}
          </p>
        </div>
        <div
          className={`rounded-xl border p-4 ${
            isDark ? 'bg-[#14171D] border-gray-800' : 'bg-white border-indigo-200/70'
          }`}
        >
          <p className="text-xs text-gray-500">Total Haber (Salidas)</p>
          <p className="text-lg font-bold text-rose-500 tabular-nums mt-1">
            {fmtUsd(totals.credit)}
          </p>
        </div>
        <div
          className={`rounded-xl border p-4 ${
            isDark ? 'bg-[#14171D] border-gray-800' : 'bg-white border-indigo-200/70'
          }`}
        >
          <p className="text-xs text-gray-500">Saldo Neto Contable</p>
          <p className="text-lg font-bold tabular-nums mt-1">{fmtUsd(totals.net)}</p>
        </div>
      </div>

      <div
        className={`rounded-2xl border overflow-hidden ${
          isPreviewMode ? 'max-w-5xl mx-auto shadow-xl' : ''
        } ${isDark ? 'bg-[#14171D] border-gray-800' : 'bg-white border-indigo-200/80'}`}
      >
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr
                className={`border-b ${
                  isDark
                    ? 'bg-[#0F1115] border-gray-800 text-gray-400'
                    : 'bg-slate-50 border-gray-200 text-slate-600'
                }`}
              >
                <th className="py-3 px-3 font-semibold">Fecha</th>
                <th className="py-3 px-3 font-semibold">Referencia</th>
                <th className="py-3 px-3 font-semibold">Origen</th>
                <th className="py-3 px-3 font-semibold">Concepto</th>
                <th className="py-3 px-3 font-semibold text-right">Debe</th>
                <th className="py-3 px-3 font-semibold text-right">Haber</th>
                <th className="py-3 px-3 font-semibold text-right">Saldo</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200/60 dark:divide-gray-800/80">
              {ledgerRows.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 px-4 text-center text-gray-500">
                    No hay asientos contables registrados todavía.
                  </td>
                </tr>
              ) : (
                ledgerRows.map((row) => (
                  <tr key={row.id} className="hover:bg-indigo-500/5">
                    <td className="py-2.5 px-3 tabular-nums whitespace-nowrap">{row.date}</td>
                    <td className="py-2.5 px-3 font-mono text-[11px] whitespace-nowrap">
                      {row.reference}
                    </td>
                    <td className="py-2.5 px-3 whitespace-nowrap">{row.source}</td>
                    <td className="py-2.5 px-3">{row.concept}</td>
                    <td className="py-2.5 px-3 text-right tabular-nums text-emerald-500 font-medium whitespace-nowrap">
                      {row.debitUsd > 0 ? fmtUsd(row.debitUsd) : '—'}
                    </td>
                    <td className="py-2.5 px-3 text-right tabular-nums text-rose-500 font-medium whitespace-nowrap">
                      {row.creditUsd > 0 ? fmtUsd(row.creditUsd) : '—'}
                    </td>
                    <td className="py-2.5 px-3 text-right tabular-nums font-semibold whitespace-nowrap">
                      {fmtUsd(row.balanceUsd)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
