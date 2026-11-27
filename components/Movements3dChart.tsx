'use client';

import React, { useEffect, useRef, useState } from 'react';
import { Box, RotateCcw } from 'lucide-react';
import { GeneralExpenseItem, SaleRecord, Transaction } from '../types/genesis';

export interface Movements3dChartProps {
  sales?: SaleRecord[];
  transactions: Transaction[];
  generalExpenses?: GeneralExpenseItem[];
  boardDate?: string;
  mode?: 'cashflow' | 'categories' | string;
  isDark?: boolean;
  darkMode?: boolean;
}

interface BarDatum3D {
  label: string;
  value: number;
  topColor: string;
  leftColor: string;
  rightColor: string;
}

export default function Movements3dChart({
  sales = [],
  transactions,
  generalExpenses = [],
  boardDate,
  mode = 'cashflow',
  isDark,
  darkMode,
}: Movements3dChartProps) {
  const effectiveDark = isDark ?? darkMode ?? true;
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [yaw, setYaw] = useState<number>(0.52);
  const [pitch, setPitch] = useState<number>(0.42);
  const [scope, setScope] = useState<'all' | 'day'>('all');
  const dragRef = useRef<{ active: boolean; x: number; y: number }>({
    active: false,
    x: 0,
    y: 0,
  });

  const bars = React.useMemo<BarDatum3D[]>(() => {
    const matchDay = (d?: string) =>
      scope === 'day' && boardDate ? String(d || '').slice(0, 10) === boardDate : true;

    const salesTotal = (sales || [])
      .filter((s) => matchDay(s.date))
      .reduce((acc, s) => acc + Math.abs(Number(s.total || 0)), 0);

    const txIncome = (transactions || [])
      .filter((t) => matchDay(t.date) && Number(t.amount || 0) > 0)
      .reduce((acc, t) => acc + Math.abs(Number(t.amount || 0)), 0);

    const txExpense = (transactions || [])
      .filter((t) => matchDay(t.date) && Number(t.amount || 0) < 0)
      .reduce((acc, t) => acc + Math.abs(Number(t.amount || 0)), 0);

    const generalExpenseTotal = (generalExpenses || [])
      .filter((g) => matchDay(g.date))
      .reduce((acc, g) => acc + Math.abs(Number(g.amount || 0)), 0);

    if (mode === 'categories') {
      const byCategory: Record<string, number> = {};
      (transactions || [])
        .filter((t) => matchDay(t.date))
        .forEach((t) => {
          const txObj = t as unknown as { category?: string; merchant?: string };
          const cat = String(txObj.category || txObj.merchant || 'General').trim() || 'General';
          byCategory[cat] = Number(((byCategory[cat] || 0) + Math.abs(Number(t.amount || 0))).toFixed(2));
        });

      const palette = [
        { top: '#38bdf8', left: '#0284c7', right: '#0369a1' },
        { top: '#4ade80', left: '#16a34a', right: '#15803d' },
        { top: '#f87171', left: '#dc2626', right: '#b91c1c' },
        { top: '#facc15', left: '#eab308', right: '#ca8a04' },
      ];

      const topCats = Object.entries(byCategory)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 4);

      if (topCats.length > 0) {
        return topCats.map(([label, value], idx) => {
          const colors = palette[idx % palette.length];
          return {
            label,
            value,
            topColor: colors.top,
            leftColor: colors.left,
            rightColor: colors.right,
          };
        });
      }
    }

    const totalIngresos = salesTotal + txIncome;
    const totalGastos = txExpense + generalExpenseTotal;
    const saldoNeto = Math.max(0, Number((totalIngresos - totalGastos).toFixed(2)));

    return [
      {
        label: 'Ventas',
        value: Number(salesTotal.toFixed(2)),
        topColor: '#38bdf8',
        leftColor: '#0284c7',
        rightColor: '#0369a1',
      },
      {
        label: 'Ingresos',
        value: Number(totalIngresos.toFixed(2)),
        topColor: '#4ade80',
        leftColor: '#16a34a',
        rightColor: '#15803d',
      },
      {
        label: 'Gastos',
        value: Number(totalGastos.toFixed(2)),
        topColor: '#f87171',
        leftColor: '#dc2626',
        rightColor: '#b91c1c',
      },
      {
        label: 'Saldo Neto',
        value: saldoNeto,
        topColor: '#facc15',
        leftColor: '#eab308',
        rightColor: '#ca8a04',
      },
    ];
  }, [sales, transactions, generalExpenses, boardDate, scope, mode]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1;
    const width = canvas.clientWidth || 720;
    const height = canvas.clientHeight || 250;
    canvas.width = Math.floor(width * dpr);
    canvas.height = Math.floor(height * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    ctx.clearRect(0, 0, width, height);

    const maxVal = Math.max(100, ...bars.map((b) => b.value));
    const maxBarHeight = Math.min(120, height * 0.42);
    const barSize = Math.min(44, Math.max(26, width / 16));
    const spacing = Math.min(130, Math.max(88, (width - 140) / Math.max(1, bars.length)));

    const cosY = Math.cos(yaw);
    const sinY = Math.sin(yaw);
    const pitchScale = Math.max(0.22, Math.min(0.75, pitch));

    const project = (x: number, y: number, z: number) => {
      const rx = x * cosY - z * sinY;
      const rz = x * sinY + z * cosY;
      const centerX = width * 0.5;
      const baseY = height * 0.72;
      return {
        px: centerX + rx,
        py: baseY - y + rz * pitchScale * 0.55,
      };
    };

    const gridSpanX = spacing * (bars.length * 0.55 + 0.6);
    const gridSpanZ = 56;
    ctx.strokeStyle = effectiveDark ? 'rgba(148, 163, 184, 0.16)' : 'rgba(79, 70, 229, 0.14)';
    ctx.lineWidth = 1;

    for (let i = -3; i <= 3; i++) {
      const gx = (i / 3) * gridSpanX;
      const p1 = project(gx, 0, -gridSpanZ);
      const p2 = project(gx, 0, gridSpanZ);
      ctx.beginPath();
      ctx.moveTo(p1.px, p1.py);
      ctx.lineTo(p2.px, p2.py);
      ctx.stroke();
    }
    for (let j = -2; j <= 2; j++) {
      const gz = (j / 2) * gridSpanZ;
      const p1 = project(-gridSpanX, 0, gz);
      const p2 = project(gridSpanX, 0, gz);
      ctx.beginPath();
      ctx.moveTo(p1.px, p1.py);
      ctx.lineTo(p2.px, p2.py);
      ctx.stroke();
    }

    const startX = -((bars.length - 1) * spacing) / 2;

    bars.forEach((bar, idx) => {
      const cx = startX + idx * spacing;
      const cz = 0;
      const h = Math.max(6, (bar.value / maxVal) * maxBarHeight);
      const half = barSize / 2;

      const b0 = project(cx - half, 0, cz - half);
      const b1 = project(cx + half, 0, cz - half);
      const b2 = project(cx + half, 0, cz + half);
      const b3 = project(cx - half, 0, cz + half);

      const t0 = project(cx - half, h, cz - half);
      const t1 = project(cx + half, h, cz - half);
      const t2 = project(cx + half, h, cz + half);
      const t3 = project(cx - half, h, cz + half);

      ctx.fillStyle = bar.leftColor;
      ctx.beginPath();
      ctx.moveTo(b3.px, b3.py);
      ctx.lineTo(b2.px, b2.py);
      ctx.lineTo(t2.px, t2.py);
      ctx.lineTo(t3.px, t3.py);
      ctx.closePath();
      ctx.fill();

      ctx.fillStyle = bar.rightColor;
      ctx.beginPath();
      ctx.moveTo(b2.px, b2.py);
      ctx.lineTo(b1.px, b1.py);
      ctx.lineTo(t1.px, t1.py);
      ctx.lineTo(t2.px, t2.py);
      ctx.closePath();
      ctx.fill();

      ctx.fillStyle = bar.topColor;
      ctx.beginPath();
      ctx.moveTo(t0.px, t0.py);
      ctx.lineTo(t1.px, t1.py);
      ctx.lineTo(t2.px, t2.py);
      ctx.lineTo(t3.px, t3.py);
      ctx.closePath();
      ctx.fill();

      ctx.strokeStyle = effectiveDark ? 'rgba(15, 23, 42, 0.55)' : 'rgba(15, 23, 42, 0.25)';
      ctx.lineWidth = 1;
      ctx.stroke();

      const topCenter = project(cx, h + 14, cz);
      ctx.save();
      ctx.fillStyle = effectiveDark ? '#ffffff' : '#0f172a';
      ctx.font = 'bold 12px sans-serif';
      ctx.textAlign = 'center';
      if (effectiveDark) {
        ctx.shadowColor = 'rgba(0, 0, 0, 0.85)';
        ctx.shadowBlur = 4;
      }
      ctx.fillText(
        '$' + bar.value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
        topCenter.px,
        topCenter.py
      );

      const baseCenter = project(cx, 0, cz + half + 20);
      ctx.fillStyle = effectiveDark ? '#ffffff' : '#334155';
      ctx.font = 'bold 12px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(bar.label, baseCenter.px, baseCenter.py);
      ctx.restore();
    });
  }, [bars, yaw, pitch, effectiveDark]);

  return (
    <div
      className={
        'rounded-xl border p-5 transition ' +
        (effectiveDark
          ? 'bg-[#14171D] border-gray-800 text-white'
          : 'bg-[#F7F9FE] border-indigo-200/70 text-slate-900 shadow-xs')
      }
    >
      <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
        <div className="flex items-center gap-2">
          <Box className="w-4 h-4 text-indigo-400" />
          <div>
            <h3
              className={
                'text-xs font-semibold uppercase tracking-wider ' +
                (effectiveDark ? 'text-white' : 'text-slate-700')
              }
            >
              Gráfica 3D de Movimientos
            </h3>
            <p className={'text-[11px] ' + (effectiveDark ? 'text-gray-200' : 'text-slate-600')}>
              Arrastra sobre la gráfica para rotar el ángulo 3D
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setScope((prev) => (prev === 'all' ? 'day' : 'all'))}
            className={
              'px-2.5 py-1 rounded-lg text-xs font-semibold border transition cursor-pointer ' +
              (scope === 'day'
                ? 'bg-indigo-600 text-white border-indigo-600'
                : effectiveDark
                ? 'bg-[#0F1115] border-gray-700 text-white hover:bg-gray-800'
                : 'bg-white border-gray-300 text-slate-700 hover:bg-gray-100')
            }
          >
            {scope === 'day' ? 'Día (' + (boardDate || 'Hoy') + ')' : 'Todos los movimientos'}
          </button>

          <button
            type="button"
            onClick={() => {
              setYaw(0.52);
              setPitch(0.42);
            }}
            className={
              'inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium border transition cursor-pointer ' +
              (effectiveDark
                ? 'bg-[#0F1115] border-gray-700 text-white hover:bg-gray-800'
                : 'bg-white border-gray-300 text-slate-700 hover:bg-gray-100')
            }
            title="Restablecer ángulo 3D"
          >
            <RotateCcw className="w-3 h-3" /> Ángulo
          </button>
        </div>
      </div>

      <div className="w-full h-[250px] rounded-xl overflow-hidden border border-gray-800/40 dark:border-gray-800 bg-[#0d1016]/40">
        <canvas
          ref={canvasRef}
          onPointerDown={(e) => {
            dragRef.current = { active: true, x: e.clientX, y: e.clientY };
            (e.currentTarget as HTMLCanvasElement).setPointerCapture(e.pointerId);
          }}
          onPointerMove={(e) => {
            if (!dragRef.current.active) return;
            const dx = e.clientX - dragRef.current.x;
            const dy = e.clientY - dragRef.current.y;
            dragRef.current = { active: true, x: e.clientX, y: e.clientY };
            setYaw((prev) => prev + dx * 0.012);
            setPitch((prev) => Math.max(0.22, Math.min(0.75, prev + dy * 0.008)));
          }}
          onPointerUp={(e) => {
            dragRef.current.active = false;
            if ((e.currentTarget as HTMLCanvasElement).hasPointerCapture(e.pointerId)) {
              (e.currentTarget as HTMLCanvasElement).releasePointerCapture(e.pointerId);
            }
          }}
          className="w-full h-full block cursor-grab active:cursor-grabbing"
        />
      </div>
    </div>
  );
}
