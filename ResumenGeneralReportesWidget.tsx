import React, { useMemo, useState } from 'react';
import { generateXlsxBytes } from './lib/excelWorkbook';

function uint8ToBase64(bytes: Uint8Array): string {
  let bin = '';
  for (let i = 0; i < bytes.length; i++) {
    bin += String.fromCharCode(bytes[i]);
  }
  return typeof btoa !== 'undefined' ? btoa(bin) : Buffer.from(bytes).toString('base64');
}

function base64ToUint8(b64: string): Uint8Array {
  const bin = typeof atob !== 'undefined' ? atob(b64) : Buffer.from(b64, 'base64').toString('binary');
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) {
    out[i] = bin.charCodeAt(i);
  }
  return out;
}

function triggerXlsxDownload(bytes: Uint8Array, fileName: string) {
  const blob = new Blob([new Uint8Array(bytes)], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export interface MovimientoFinanciero {
  fecha: string; // YYYY-MM-DD
  tipo: 'ingreso' | 'egreso';
  producto?: string;
  cantidad?: number;
  metodoPago?: string;
  monto: number;
  egresoAsociado?: number;
}

interface Props {
  movimientos: MovimientoFinanciero[];
  hoyIso?: string;
  storageKey?: string;
}

export const ResumenGeneralReportesWidget: React.FC<Props> = ({
  movimientos,
  hoyIso = '2026-11-21',
  storageKey = 'app_resumen_general_excels_v4',
}) => {
  const [tipoReporte, setTipoReporte] = useState<'simple' | 'detallado'>('detallado');
  const [fechaDesde, setFechaDesde] = useState<string>('2026-11-01');
  const [fechaHasta, setFechaHasta] = useState<string>(hoyIso);
  const [formatoHoja, setFormatoHoja] = useState<'letter portrait' | 'legal portrait'>('letter portrait');
  const [versionLista, setVersionLista] = useState<number>(0);

  const aplicarDias = (diasAtras: number) => {
    const base = new Date(`${hoyIso}T00:00:00`);
    base.setDate(base.getDate() - diasAtras);
    setFechaDesde(base.toISOString().slice(0, 10));
    setFechaHasta(hoyIso);
  };

  const datos = useMemo(() => {
    const dIni = fechaDesde ? new Date(`${fechaDesde}T00:00:00`) : null;
    const dFin = fechaHasta ? new Date(`${fechaHasta}T23:59:59`) : null;

    const filtrados = movimientos.filter((m) => {
      const f = new Date(`${m.fecha}T12:00:00`);
      if (dIni && f < dIni) return false;
      if (dFin && f > dFin) return false;
      return true;
    });

    const ingresos = filtrados.filter((m) => m.tipo === 'ingreso').reduce((a, b) => a + b.monto, 0);
    const gastos = filtrados.filter((m) => m.tipo === 'egreso').reduce((a, b) => a + b.monto, 0);
    const ventas = filtrados.filter((m) => m.tipo === 'ingreso');
    const totalUnidades = ventas.reduce((a, b) => a + Number(b.cantidad || 0), 0);

    return {
      filtrados,
      ventas,
      ingresos,
      gastos,
      neto: ingresos - gastos,
      totalUnidades,
      totalPagos: ventas.length,
    };
  }, [movimientos, fechaDesde, fechaHasta]);

  const guardarExcelEnApp = () => {
    const bytes = generateXlsxBytes([
      {
        name: 'Reporte Simple',
        headers: [
          'Tipo_Reporte',
          'Hoja',
          'Fecha_Desde',
          'Fecha_Hasta',
          'Ingresos',
          'Egresos',
          'Balance_Neto',
          'Unidades_Vendidas',
          'Pagos_Realizados',
        ],
        rows: [
          [
            tipoReporte,
            formatoHoja === 'legal portrait' ? 'Oficio (Legal)' : 'Carta (Letter)',
            fechaDesde,
            fechaHasta,
            datos.ingresos,
            datos.gastos,
            datos.neto,
            datos.totalUnidades,
            datos.totalPagos,
          ],
        ],
      },
      {
        name: 'Detallado Productos',
        headers: [
          'Fecha',
          'Producto_Vendido',
          'Cantidad_Producto',
          'Pago_Realizado',
          'Ingreso',
          'Egreso_Asociado',
        ],
        rows: datos.ventas.length
          ? datos.ventas.map((v) => [
              v.fecha,
              v.producto || 'General',
              v.cantidad || 1,
              v.metodoPago || 'No especificado',
              v.monto,
              v.egresoAsociado || 0,
            ])
          : [['Sin ventas en el rango seleccionado', '', '', '', '', '']],
      },
    ]);

    const nombreArchivo = `resumen_${tipoReporte}_${fechaDesde}_a_${fechaHasta}.xlsx`;
    const base64 = uint8ToBase64(bytes);

    const actual = JSON.parse(localStorage.getItem(storageKey) || '[]');
    actual.unshift({
      id: `xls_${Date.now()}`,
      nombreArchivo,
      tipoReporte,
      rango: `${fechaDesde} -> ${fechaHasta}`,
      guardadoEn: new Date().toLocaleString(),
      base64,
    });
    localStorage.setItem(storageKey, JSON.stringify(actual.slice(0, 40)));
    setVersionLista((v) => v + 1);
    triggerXlsxDownload(bytes, nombreArchivo);
  };

  const guardados = useMemo(() => {
    void versionLista;
    return JSON.parse(localStorage.getItem(storageKey) || '[]') as Array<{
      id: string;
      nombreArchivo: string;
      tipoReporte: string;
      rango: string;
      guardadoEn: string;
      base64: string;
    }>;
  }, [storageKey, versionLista]);

  const descargarGuardado = (item: { nombreArchivo: string; base64: string }) => {
    const bytes = base64ToUint8(item.base64);
    triggerXlsxDownload(bytes, item.nombreArchivo);
  };

  return (
    <section className="mt-4 rounded-xl border border-slate-800 bg-slate-900 p-4 text-slate-100">
      <style>{`@media print { @page { size: ${formatoHoja}; margin: 12mm; } }`}</style>

      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label className="block text-xs text-slate-400">Reporte</label>
            <select
              value={tipoReporte}
              onChange={(e) => setTipoReporte(e.target.value as 'simple' | 'detallado')}
              className="mt-1 rounded-lg border border-slate-700 bg-slate-800 px-3 py-1.5 text-sm"
            >
              <option value="simple">Simple (Ingresos y Egresos)</option>
              <option value="detallado">Detallado (Productos y Pagos)</option>
            </select>
          </div>

          <div>
            <label className="block text-xs text-slate-400">Desde</label>
            <input
              type="date"
              value={fechaDesde}
              onChange={(e) => setFechaDesde(e.target.value)}
              className="mt-1 rounded-lg border border-slate-700 bg-slate-800 px-3 py-1.5 text-sm"
            />
          </div>

          <div>
            <label className="block text-xs text-slate-400">Hasta</label>
            <input
              type="date"
              value={fechaHasta}
              onChange={(e) => setFechaHasta(e.target.value)}
              className="mt-1 rounded-lg border border-slate-700 bg-slate-800 px-3 py-1.5 text-sm"
            />
          </div>

          <div>
            <label className="block text-xs text-slate-400">Hoja</label>
            <select
              value={formatoHoja}
              onChange={(e) => setFormatoHoja(e.target.value as 'letter portrait' | 'legal portrait')}
              className="mt-1 rounded-lg border border-slate-700 bg-slate-800 px-3 py-1.5 text-sm"
            >
              <option value="letter portrait">Carta (Letter)</option>
              <option value="legal portrait">Oficio (Legal)</option>
            </select>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => aplicarDias(0)} className="rounded-lg bg-slate-800 px-2.5 py-1.5 text-xs hover:bg-slate-700">1 Día</button>
          <button type="button" onClick={() => aplicarDias(6)} className="rounded-lg bg-slate-800 px-2.5 py-1.5 text-xs hover:bg-slate-700">7 Días</button>
          <button type="button" onClick={() => aplicarDias(29)} className="rounded-lg bg-slate-800 px-2.5 py-1.5 text-xs hover:bg-slate-700">Mensual</button>
          <button type="button" onClick={() => aplicarDias(89)} className="rounded-lg bg-slate-800 px-2.5 py-1.5 text-xs hover:bg-slate-700">Trimestral</button>
          <button type="button" onClick={() => aplicarDias(179)} className="rounded-lg bg-slate-800 px-2.5 py-1.5 text-xs hover:bg-slate-700">6 Meses</button>
          <button type="button" onClick={() => aplicarDias(364)} className="rounded-lg bg-slate-800 px-2.5 py-1.5 text-xs hover:bg-slate-700">12 Meses</button>
          <button type="button" onClick={guardarExcelEnApp} className="rounded-lg bg-emerald-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-600">
            Guardar Excel en App
          </button>
        </div>
      </div>

      {tipoReporte === 'simple' ? (
        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div className="rounded-lg bg-slate-800/70 p-3">
            <div className="text-xs text-slate-400">Ingresos</div>
            <div className="text-lg font-bold text-emerald-400">+${datos.ingresos.toFixed(2)}</div>
          </div>
          <div className="rounded-lg bg-slate-800/70 p-3">
            <div className="text-xs text-slate-400">Egresos</div>
            <div className="text-lg font-bold text-rose-400">-${datos.gastos.toFixed(2)}</div>
          </div>
          <div className="rounded-lg bg-slate-800/70 p-3">
            <div className="text-xs text-slate-400">Balance Neto</div>
            <div className="text-lg font-bold text-indigo-300">${datos.neto.toFixed(2)}</div>
          </div>
        </div>
      ) : (
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-800 text-xs uppercase text-slate-400">
              <tr>
                <th className="px-3 py-2">Fecha</th>
                <th className="px-3 py-2">Producto Vendido</th>
                <th className="px-3 py-2 text-right">Cantidad</th>
                <th className="px-3 py-2">Pago Realizado</th>
                <th className="px-3 py-2 text-right">Ingreso ($)</th>
                <th className="px-3 py-2 text-right">Egreso ($)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {datos.ventas.map((v, idx) => (
                <tr key={idx}>
                  <td className="px-3 py-2">{v.fecha}</td>
                  <td className="px-3 py-2 font-medium">{v.producto || 'General'}</td>
                  <td className="px-3 py-2 text-right">{v.cantidad || 1}</td>
                  <td className="px-3 py-2">{v.metodoPago || 'No especificado'}</td>
                  <td className="px-3 py-2 text-right text-emerald-400">+${v.monto.toFixed(2)}</td>
                  <td className="px-3 py-2 text-right text-rose-400">-${(v.egresoAsociado || 0).toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {guardados.length > 0 && (
        <div className="mt-4 border-t border-slate-800 pt-3">
          <div className="mb-2 text-xs font-semibold uppercase text-slate-400">
            Excels guardados en la aplicación (solicítalos cuando desees)
          </div>
          <div className="space-y-2">
            {guardados.map((g) => (
              <div key={g.id} className="flex items-center justify-between rounded-lg bg-slate-800/60 px-3 py-2 text-xs">
                <span>
                  <strong>{g.nombreArchivo}</strong> — {g.rango} ({g.guardadoEn})
                </span>
                <button
                  type="button"
                  onClick={() => descargarGuardado(g)}
                  className="rounded bg-indigo-600 px-2.5 py-1 font-semibold text-white hover:bg-indigo-500"
                >
                  Solicitar Excel
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  );
};
