'use client';

import { TplTaxIdField } from "@/lib/TplTaxIdField";
import React, { useState, useEffect, useMemo, useRef } from 'react';
import PosSalesWindow from './PosSalesWindow';
import GeneralReportsPanel from './GeneralReportsPanel';
import AccountingBookPanel from './AccountingBookPanel';
import Movements3dChart from './Movements3dChart';
import type { ExcelSheetData } from '@/lib/excelWorkbook';
import SeniatDocumentsPanel from './SeniatDocumentsPanel';
import {
  LayoutDashboard, Plus, Sparkles, Download, RotateCcw,
  Moon, Sun, Trash2, Columns, Search, X, Wallet,
  ChevronDown, ChevronRight, ShoppingBag, Package, Layers, Truck,
  ClipboardCheck, Users, Coins, CreditCard, Barcode, Minus,
  CheckCircle2, Receipt, ArrowLeftRight, Pencil, FileText, Printer, Scale, Eye, BarChart3
} from 'lucide-react';
import {
  GenesisState, Transaction, DashboardBlock, BlockType,
  OperationsSubSection, ProductItem, SaleInvoiceItem, SaleRecord,
  PaymentAccountCategory, CashKindOption, OperatorRoleType, OperatorPermissionKey, OperatorAccountItem,
  AuditEntry, CreditNoteRecord, ReceivableAccountItem, PayableAccountItem,
  SupplierItem, GeneralExpenseItem
} from '../types/genesis';

function getLocalTodayStr(): string {
  const now = new Date();
  const offsetMs = now.getTimezoneOffset() * 60000;
  return new Date(now.getTime() - offsetMs).toISOString().slice(0, 10);
}

const STORAGE_KEY = 'genesis_app_v13_state';

const OPERATIONS_MENU: {
  id: OperationsSubSection;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}[] = [
  { id: 'ventas', label: 'Ventas', icon: ShoppingBag },
  { id: 'productos', label: 'Productos', icon: Package },
  { id: 'categoria_de_productos', label: 'Categoría de Productos', icon: Layers },
  { id: 'cuentas_por_cobrar', label: 'Cuentas por cobrar', icon: Wallet },
  { id: 'cuentas_por_pagar', label: 'Cuentas por pagar', icon: Receipt },
  { id: 'auditoria_general', label: 'Auditoría General', icon: ClipboardCheck },
  { id: 'proveedores', label: 'Proveedores', icon: Truck },
  { id: 'clientes_afiliados', label: 'Clientes afiliados', icon: Users },
  { id: 'cierre_de_caja', label: 'Cierre de caja', icon: ClipboardCheck },
  { id: 'cuentas_de_operadores', label: 'Cuentas de operadores', icon: Users },
  { id: 'monedas', label: 'Monedas', icon: Coins },
  { id: 'tasa_de_cambio', label: 'Tasa de cambio', icon: ArrowLeftRight },
  { id: 'tipo_de_pago', label: 'Tipo de pago', icon: CreditCard },
  { id: 'factura', label: 'Factura', icon: FileText },
  { id: 'gastos_generales', label: 'Gastos generales', icon: Receipt },
];

const PRODUCT_ACCENT_PALETTE = [
  '#4F46E5', '#0EA5E9', '#10B981', '#F59E0B', '#8B5CF6', '#EC4899', '#14B8A6'
];

function buildReferenceVisualByName(productName: string, category?: string, accentColor?: string): string {
  const words = (productName || '')
    .trim()
    .split(/\s+/)
    .map((w) => w.replace(/[^a-zA-Z0-9áéíóúÁÉÍÓÚñÑ]/g, ''))
    .filter(Boolean);
  let initials = 'PR';
  if (words.length >= 2) {
    initials = `${words[0][0] || ''}${words[1][0] || ''}`.toUpperCase();
  } else if (words.length === 1 && words[0].length >= 2) {
    initials = words[0].slice(0, 2).toUpperCase();
  } else if (words.length === 1 && words[0].length === 1) {
    initials = words[0].toUpperCase();
  }

  const palette = ['#2563EB', '#059669', '#D97706', '#7C3AED', '#DB2777', '#0891B2', '#DC2626'];
  let hash = 0;
  const seedStr = `${productName}|${category || ''}`;
  for (let i = 0; i < seedStr.length; i++) {
    hash = (hash * 31 + seedStr.charCodeAt(i)) >>> 0;
  }
  const bg =
    accentColor && /^#[0-9a-fA-F]{3,8}$/.test(accentColor.trim())
      ? accentColor.trim()
      : palette[hash % palette.length];

  const keyword = (words.find((w) => w.length >= 4) || words[0] || category || 'ITEM')
    .slice(0, 8)
    .toUpperCase();

  if (typeof document !== 'undefined') {
    try {
      const canvas = document.createElement('canvas');
      canvas.width = 128;
      canvas.height = 128;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.fillStyle = bg;
        ctx.beginPath();
        if (typeof ctx.roundRect === 'function') {
          ctx.roundRect(0, 0, 128, 128, 22);
        } else {
          ctx.rect(0, 0, 128, 128);
        }
        ctx.fill();

        // Top pill tag with product keyword
        ctx.fillStyle = 'rgba(15, 23, 42, 0.28)';
        ctx.beginPath();
        if (typeof ctx.roundRect === 'function') {
          ctx.roundRect(14, 14, 100, 22, 11);
        } else {
          ctx.rect(14, 14, 100, 22);
        }
        ctx.fill();

        ctx.fillStyle = '#FFFFFF';
        ctx.font = 'bold 10px system-ui, -apple-system, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(keyword, 64, 25);

        // Main initials
        ctx.font = 'bold 40px system-ui, -apple-system, sans-serif';
        ctx.fillText(initials, 64, 69);

        // Bottom subtle bar
        ctx.fillStyle = 'rgba(255, 255, 255, 0.22)';
        ctx.fillRect(24, 102, 80, 5);

        return canvas.toDataURL('image/png');
      }
    } catch {}
  }

  return makeThumbDataUri(initials, bg);
}

async function fetchProductPhotoFromInternet(
  productName: string,
  category?: string,
  accentColor?: string
): Promise<{ url: string; foundOnline: boolean }> {
  const cleanQuery = (productName || '').trim();
  const fallbackImg = buildReferenceVisualByName(cleanQuery || 'Producto', category, accentColor);
  if (!cleanQuery || typeof fetch === 'undefined') {
    return { url: fallbackImg, foundOnline: false };
  }

  const candidateUrls: string[] = [];

  // 1. Priorizar fuentes / catálogos con presencia en Venezuela (OpenFoodFacts VE + términos Venezuela)
  try {
    const veOffUrl = `https://ve.openfoodfacts.org/cgi/search.pl?search_terms=${encodeURIComponent(
      cleanQuery
    )}&search_simple=1&action=process&json=1&page_size=6`;
    const veOffResp = await fetch(veOffUrl);
    if (veOffResp.ok) {
      const veOffData = await veOffResp.json();
      const products = Array.isArray(veOffData?.products) ? veOffData.products : [];
      for (const item of products) {
        const img =
          item?.image_front_small_url ||
          item?.image_front_url ||
          item?.image_url ||
          item?.image_small_url;
        if (typeof img === 'string' && img.startsWith('http')) {
          candidateUrls.push(img);
        }
      }
    }
  } catch {}

  try {
    const veSearchUrl = `https://world.openfoodfacts.org/cgi/search.pl?search_terms=${encodeURIComponent(
      `${cleanQuery} Venezuela`
    )}&search_simple=1&action=process&json=1&page_size=5`;
    const veSearchResp = await fetch(veSearchUrl);
    if (veSearchResp.ok) {
      const veSearchData = await veSearchResp.json();
      const products = Array.isArray(veSearchData?.products) ? veSearchData.products : [];
      for (const item of products) {
        const img =
          item?.image_front_small_url ||
          item?.image_front_url ||
          item?.image_url ||
          item?.image_small_url;
        if (typeof img === 'string' && img.startsWith('http')) {
          candidateUrls.push(img);
        }
      }
    }
  } catch {}

  try {
    const wikiVeUrl = `https://commons.wikimedia.org/w/api.php?action=query&generator=search&gsrnamespace=6&gsrsearch=${encodeURIComponent(
      `${cleanQuery} Venezuela`
    )}&gsrlimit=5&prop=imageinfo&iiprop=url&iiurlwidth=240&format=json&origin=*`;
    const wikiVeResp = await fetch(wikiVeUrl);
    if (wikiVeResp.ok) {
      const wikiVeData = await wikiVeResp.json();
      const pages = wikiVeData?.query?.pages ? Object.values(wikiVeData.query.pages) : [];
      for (const pg of pages as Array<{ imageinfo?: Array<{ thumburl?: string; url?: string }> }>) {
        const info = pg?.imageinfo?.[0];
        const u = info?.thumburl || info?.url;
        if (typeof u === 'string' && u.startsWith('http')) {
          candidateUrls.push(u);
        }
      }
    }
  } catch {}

  // 2. Respaldo general si no hubo coincidencia directa en fuentes VE
  try {
    const offUrl = `https://world.openfoodfacts.org/cgi/search.pl?search_terms=${encodeURIComponent(
      cleanQuery
    )}&search_simple=1&action=process&json=1&page_size=4`;
    const offResp = await fetch(offUrl);
    if (offResp.ok) {
      const offData = await offResp.json();
      const products = Array.isArray(offData?.products) ? offData.products : [];
      for (const item of products) {
        const img =
          item?.image_front_small_url ||
          item?.image_front_url ||
          item?.image_url ||
          item?.image_small_url;
        if (typeof img === 'string' && img.startsWith('http')) {
          candidateUrls.push(img);
        }
      }
    }
  } catch {}

  for (const cand of candidateUrls) {
    const ok = await new Promise<boolean>((resolve) => {
      try {
        const testImg = new Image();
        const timer = setTimeout(() => resolve(false), 3500);
        testImg.onload = () => {
          clearTimeout(timer);
          resolve(testImg.naturalWidth > 16 && testImg.naturalHeight > 16);
        };
        testImg.onerror = () => {
          clearTimeout(timer);
          resolve(false);
        };
        testImg.src = cand;
      } catch {
        resolve(false);
      }
    });
    if (ok) {
      return { url: cand, foundOnline: true };
    }
  }

  return { url: fallbackImg, foundOnline: false };
}



async function fetchOfficialBcvRates(): Promise<{
  vesRate: number | null;
  eurRate: number | null;
  source: string;
}> {
  if (typeof fetch === 'undefined') return { vesRate: null, eurRate: null, source: '' };
  let vesRate: number | null = null;
  let eurRate: number | null = null;
  let source = '';

  const vesEndpoints = [
    {
      url: 'https://ve.dolarapi.com/v1/dolares/oficial',
      extract: (d: any) => Number(d?.promedio ?? d?.rate ?? d?.valor),
      label: 'BCV Oficial (ve.dolarapi.com)',
    },
    {
      url: 'https://pydolarve.org/api/v1/dollar?page=bcv',
      extract: (d: any) =>
        Number(
          d?.monitors?.usd?.price ??
            d?.monitors?.bcv?.price ??
            d?.price ??
            d?.promedio
        ),
      label: 'BCV Oficial (pydolarve.org)',
    },
    {
      url: 'https://open.er-api.com/v6/latest/USD',
      extract: (d: any) => Number(d?.rates?.VES),
      label: 'Referencia USD/VES',
    },
  ];

  for (const ep of vesEndpoints) {
    try {
      const resp = await fetch(ep.url);
      if (!resp.ok) continue;
      const data = await resp.json();
      const val = ep.extract(data);
      if (typeof val === 'number' && Number.isFinite(val) && val > 5 && val < 500000) {
        vesRate = Number(val.toFixed(4));
        source = ep.label;
        break;
      }
    } catch {}
  }

  const eurEndpoints = [
    {
      url: 'https://ve.dolarapi.com/v1/euros/oficial',
      extractUsdToEur: (d: any, usdBs: number | null) => {
        const eurBs = Number(d?.promedio ?? d?.rate ?? d?.valor);
        if (Number.isFinite(eurBs) && eurBs > 5 && usdBs && usdBs > 0) {
          return Number((eurBs / usdBs).toFixed(4));
        }
        return NaN;
      },
    },
    {
      url: 'https://open.er-api.com/v6/latest/USD',
      extractUsdToEur: (d: any) => Number(d?.rates?.EUR),
    },
  ];

  for (const ep of eurEndpoints) {
    try {
      const resp = await fetch(ep.url);
      if (!resp.ok) continue;
      const data = await resp.json();
      const val = ep.extractUsdToEur(data, vesRate);
      if (typeof val === 'number' && Number.isFinite(val) && val > 0.1 && val < 10) {
        eurRate = val;
        break;
      }
    } catch {}
  }

  return { vesRate, eurRate, source };
}

function makeThumbDataUri(label: string, bg: string, fg = '#ffffff') {
  const clean = label.trim().replace(/[^a-zA-Z0-9áéíóúÁÉÍÓÚñÑ]/g, '');
  const safeLabel = (clean.slice(0, 2) || 'PR').toUpperCase();
  const safeBg = /^#[0-9a-fA-F]{3,8}$/.test(bg) ? bg : '#4F46E5';
  const safeFg = /^#[0-9a-fA-F]{3,8}$/.test(fg) ? fg : '#FFFFFF';
  if (typeof document !== 'undefined') {
    try {
      const canvas = document.createElement('canvas');
      canvas.width = 128;
      canvas.height = 128;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.fillStyle = safeBg;
        ctx.beginPath();
        if (typeof ctx.roundRect === 'function') {
          ctx.roundRect(0, 0, 128, 128, 24);
        } else {
          ctx.rect(0, 0, 128, 128);
        }
        ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,0.16)';
        ctx.beginPath();
        ctx.arc(102, 26, 18, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = safeFg;
        ctx.font = 'bold 42px system-ui, -apple-system, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(safeLabel, 64, 68);
        return canvas.toDataURL('image/png');
      }
    } catch {}
  }
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="96" height="96" viewBox="0 0 96 96"><rect width="96" height="96" rx="18" fill="${safeBg}"/><text x="48" y="56" font-family="sans-serif" font-size="28" font-weight="700" fill="${safeFg}" text-anchor="middle">${safeLabel}</text></svg>`;
  try {
    return `data:image/svg+xml;base64,${typeof btoa === 'function' ? btoa(unescape(encodeURIComponent(svg))) : Buffer.from(svg, 'utf8').toString('base64')}`;
  } catch {
    return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
  }
}

const IVA_RATE = 0.16;

function calcProfitMarginPercent(costPrice: number, salePrice: number): number {
  if (costPrice <= 0) return salePrice > 0 ? 100 : 0;
  return ((salePrice - costPrice) / costPrice) * 100;
}

function getEffectiveUnitTotal(unitPrice: number, hasIva?: boolean): number {
  return hasIva ? unitPrice * (1 + IVA_RATE) : unitPrice;
}

const PAYMENT_ACCOUNT_CATEGORIES: PaymentAccountCategory[] = [
  'Cuenta Principal',
  'Billetera Digital',
  'Efectivo',
];

function resolveAccountIdForCategory(
  accounts: { id: string; name: string; type: string }[],
  category?: PaymentAccountCategory,
  fallbackId = 'acc-1'
): string {
  if (!accounts || accounts.length === 0) return fallbackId;
  if (category === 'Cuenta Principal') {
    return (
      accounts.find((a) => a.id === 'acc-1') ||
      accounts.find((a) => a.type === 'checking' || a.name.toLowerCase().includes('principal')) ||
      accounts[0]
    ).id;
  }
  if (category === 'Billetera Digital') {
    return (
      accounts.find((a) => a.id === 'acc-2') ||
      accounts.find((a) => a.type === 'wallet' || a.name.toLowerCase().includes('billetera')) ||
      accounts[0]
    ).id;
  }
  if (category === 'Efectivo') {
    return (
      accounts.find((a) => a.id === 'acc-3') ||
      accounts.find((a) => a.type === 'cash' || a.name.toLowerCase().includes('efectivo')) ||
      accounts[0]
    ).id;
  }
  return accounts.find((a) => a.id === fallbackId)?.id || accounts[0].id;
}

function isCashPaymentMethod(methodName: string, category?: PaymentAccountCategory): boolean {
  return category === 'Efectivo' || /efectivo/i.test(methodName || '');
}

const ALL_OPERATOR_PERMISSIONS: { key: OperatorPermissionKey; label: string; group: 'general' | 'operations' }[] = [
  { key: 'dashboard', label: 'Tablero / Espacios', group: 'general' },
  { key: 'ventas', label: 'Ventas', group: 'operations' },
  { key: 'productos', label: 'Productos', group: 'operations' },
  { key: 'categoria_de_productos', label: 'Categoría de Productos', group: 'operations' },
  { key: 'cuentas_por_cobrar', label: 'Cuentas por cobrar', group: 'operations' },
  { key: 'cuentas_por_pagar', label: 'Cuentas por pagar', group: 'operations' },
  { key: 'auditoria_general', label: 'Auditoría General', group: 'operations' },
  { key: 'proveedores', label: 'Proveedores', group: 'operations' },
  { key: 'clientes_afiliados', label: 'Clientes afiliados', group: 'operations' },
  { key: 'cierre_de_caja', label: 'Cierre de caja', group: 'operations' },
  { key: 'cuentas_de_operadores', label: 'Cuentas de operadores', group: 'operations' },
  { key: 'monedas', label: 'Monedas', group: 'operations' },
  { key: 'tasa_de_cambio', label: 'Tasa de cambio', group: 'operations' },
  { key: 'tipo_de_pago', label: 'Tipo de pago', group: 'operations' },
  { key: 'factura', label: 'Factura', group: 'operations' },
  { key: 'gastos_generales', label: 'Gastos generales', group: 'operations' },
];

const ROLE_DEFAULT_PERMISSIONS: Record<OperatorRoleType, OperatorPermissionKey[]> = {
  Administrador: ALL_OPERATOR_PERMISSIONS.map((p) => p.key),
  Gerente: [
    'dashboard',
    'ventas',
    'productos',
    'proveedores',
    'clientes_afiliados',
    'cierre_de_caja',
    'monedas',
    'tasa_de_cambio',
    'tipo_de_pago',
    'factura',
  ],
  Operador: ['ventas'],
};

function normalizeOperatorRole(role?: string): OperatorRoleType {
  if (role === 'Administrador' || role === 'Admin') return 'Administrador';
  if (role === 'Gerente' || role === 'Manager') return 'Gerente';
  return 'Operador';
}

function getEffectiveOperatorPermissions(op?: OperatorAccountItem): OperatorPermissionKey[] {
  if (!op) return ALL_OPERATOR_PERMISSIONS.map((p) => p.key);
  const role = normalizeOperatorRole(op.role);
  if (role === 'Administrador') return ALL_OPERATOR_PERMISSIONS.map((p) => p.key);
  if (Array.isArray(op.permissions)) {
    return op.permissions;
  }
  return ROLE_DEFAULT_PERMISSIONS[role] || ['ventas'];
}

const fileToCompressedDataUri = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const size = 160;
        const canvas = document.createElement('canvas');
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(String(reader.result || ''));
          return;
        }
        const scale = Math.max(size / img.width, size / img.height);
        const w = img.width * scale;
        const h = img.height * scale;
        const dx = (size - w) / 2;
        const dy = (size - h) / 2;
        ctx.drawImage(img, dx, dy, w, h);
        resolve(canvas.toDataURL('image/jpeg', 0.82));
      };
      img.onerror = reject;
      img.src = String(reader.result || '');
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });

const DEFAULT_STATE: GenesisState = {
  darkMode: false,
  activePageId: 'page-1',
  operationsSection: 'productos',
  activeRateCurrencyCode: 'VES',
  accounts: [
    { id: 'acc-1', name: 'Cuenta Principal', type: 'checking', initialBalance: 0 },
    { id: 'acc-2', name: 'Billetera Digital', type: 'wallet', initialBalance: 0 },
    { id: 'acc-3', name: 'Efectivo', type: 'cash', initialBalance: 0 },
  ],
  categories: [
    { id: 'cat-income', name: 'Ingresos', color: '#10B981' },
    { id: 'cat-food', name: 'Alimentación', color: '#F59E0B' },
    { id: 'cat-transport', name: 'Transporte', color: '#3B82F6' },
    { id: 'cat-services', name: 'Servicios & Software', color: '#8B5CF6' },
    { id: 'cat-leisure', name: 'Ocio', color: '#EC4899' },
  ],
  transactions: [],
  rules: [
    { id: 'rule-1', keyword: 'uber', categoryId: 'cat-transport' },
    { id: 'rule-2', keyword: 'supermercado', categoryId: 'cat-food' },
  ],
  pages: [
    {
      id: 'page-1',
      title: 'Resumen General',
      blocks: [
        { id: 'b-1', type: 'kpi_balance', title: 'Patrimonio Neto', span: 1 },
        { id: 'b-2', type: 'kpi_income', title: 'Ingresos del Día', span: 1 },
        { id: 'b-3', type: 'kpi_expense', title: 'Gastos del Día', span: 1 },
        { id: 'b-4', type: 'chart_categories', title: 'Distribución de Gastos', span: 1 },
        { id: 'b-5', type: 'table_transactions', title: 'Movimientos Recientes', span: 2 },
      ],
    },
    {
      id: 'page-2',
      title: 'Control Operativo',
      blocks: [
        { id: 'b-6', type: 'kpi_expense', title: 'Gasto Operativo', span: 1 },
        { id: 'b-7', type: 'table_transactions', title: 'Registro Detallado', span: 2 },
      ],
    },
  ],
  sales: [],
  generalExpenses: [],
  products: [
    {
      id: 'p-1',
      sku: 'PRD-001',
      barcode: '7591001000018',
      name: 'Desengrasante Industrial 20L',
      category: 'Químicos',
      costPrice: 30.00,
      price: 45.00,
      hasIva: true,
      stock: 18,
      accentColor: '#4F46E5',
      imageUrl: makeThumbDataUri('DG', '#4F46E5'),
    },
    {
      id: 'p-2',
      sku: 'PRD-002',
      barcode: '7591001000025',
      name: 'Cera Automotriz Premium',
      category: 'Detalle',
      costPrice: 12.00,
      price: 18.50,
      hasIva: true,
      stock: 34,
      accentColor: '#0EA5E9',
      imageUrl: makeThumbDataUri('CR', '#0EA5E9'),
    },
    {
      id: 'p-3',
      sku: 'PRD-003',
      barcode: '7591001000032',
      name: 'Limpiador de Bobinas',
      category: 'Mantenimiento',
      costPrice: 15.00,
      price: 24.00,
      hasIva: false,
      stock: 12,
      accentColor: '#10B981',
      imageUrl: makeThumbDataUri('LB', '#10B981'),
    },
    {
      id: 'p-4',
      sku: 'PRD-004',
      barcode: '7591001000049',
      name: 'Shampoo Neutro Concentrado',
      category: 'Detalle',
      costPrice: 7.50,
      price: 12.00,
      hasIva: true,
      stock: 28,
      accentColor: '#F59E0B',
      imageUrl: makeThumbDataUri('SH', '#F59E0B'),
    },
    {
      id: 'p-5',
      sku: 'PRD-005',
      barcode: '7591001000056',
      name: 'Desincrustante Metálico 5L',
      category: 'Químicos',
      costPrice: 14.00,
      price: 21.75,
      hasIva: false,
      stock: 15,
      accentColor: '#8B5CF6',
      imageUrl: makeThumbDataUri('DM', '#8B5CF6'),
    },
    {
      id: 'p-6',
      sku: 'PRD-006',
      barcode: '7591001000063',
      name: 'Aromatizante Industrial',
      category: 'Mantenimiento',
      costPrice: 5.50,
      price: 9.50,
      hasIva: false,
      stock: 40,
      accentColor: '#EC4899',
      imageUrl: makeThumbDataUri('AR', '#EC4899'),
    },
  ],
  suppliers: [],
  cashClosings: [],
  currentOperatorId: 'op-1',
  adminDiscountPin: 'admin1',
  productCategories: ['Químicos', 'Detalle', 'Mantenimiento', 'General'],
  auditLog: [],
  creditNotes: [],
  receivables: [
    {
      id: 'rec-seed-1',
      createdAt: getLocalTodayStr(),
      dueDate: getLocalTodayStr(),
      customerName: 'Talleres El Sol C.A.',
      customerTaxOrId: 'J-41298765-2',
      reference: 'FAC-1004',
      channelOrAccount: 'Cashea',
      currency: 'USD',
      totalAmount: 90.00,
      paidAmount: 30.00,
      balanceDue: 60.00,
      status: 'Parcial',
      notes: 'Cuota inicial abonada; próxima cuota por vencer.',
      payments: [
        {
          id: 'pay-rec-1',
          date: getLocalTodayStr(),
          amount: 30.00,
          paymentMethod: 'Cashea',
          accountId: 'acc-2',
          note: 'Inicial Cashea',
          earlyPayment: false,
        },
      ],
    },
  ],
  payables: [
    {
      id: 'pay-seed-1',
      createdAt: getLocalTodayStr(),
      dueDate: getLocalTodayStr(),
      supplierName: 'Químicos Industriales Andes',
      reference: 'COMP-204',
      channelOrAccount: 'Cuenta Principal',
      currency: 'USD',
      totalAmount: 180.00,
      paidAmount: 0,
      balanceDue: 180.00,
      status: 'Pendiente',
      notes: 'Factura proveedor por reposición de inventario.',
      payments: [],
    },
  ],
  operatorAccounts: [
    {
      id: 'op-1',
      operatorName: 'administrador',
      role: 'Administrador',
      assignedAccount: 'Cuenta Principal',
      active: true,
      permissions: ROLE_DEFAULT_PERMISSIONS.Administrador,
    },
    {
      id: 'op-2',
      operatorName: 'Gerente de Tienda',
      role: 'Gerente',
      assignedAccount: 'Cuenta Principal',
      active: true,
      permissions: ROLE_DEFAULT_PERMISSIONS.Gerente,
    },
    {
      id: 'op-3',
      operatorName: 'Operador de Ventas',
      role: 'Operador',
      assignedAccount: 'Efectivo',
      active: true,
      permissions: ['ventas'],
    },
  ],
  currencies: [
    { id: 'cur-1', code: 'USD', name: 'Dólar Estadounidense', symbol: '$', rateToUsd: 1.0, isBase: true },
    { id: 'cur-2', code: 'VES', name: 'Bolívar Venezolano', symbol: 'Bs.', rateToUsd: 46.50 },
    { id: 'cur-3', code: 'EUR', name: 'Euro', symbol: '€', rateToUsd: 0.92 },
  ],
  paymentMethods: [
    { id: 'pm-1', name: 'Efectivo', channel: 'Caja física', feePercent: 0, active: true, accountCategory: 'Efectivo' },
    { id: 'pm-2', name: 'Transferencia / Pago Móvil', channel: 'Banca en línea', feePercent: 0, active: true, accountCategory: 'Cuenta Principal' },
    { id: 'pm-3', name: 'Zelle / Billetera Digital', channel: 'Digital', feePercent: 1.5, active: true, accountCategory: 'Billetera Digital' },
    { id: 'pm-4', name: 'Tarjeta de Débito / Crédito', channel: 'Punto de venta', feePercent: 2.5, active: true, accountCategory: 'Cuenta Principal' },
    { id: 'pm-5', name: 'Cashea', channel: 'Cuotas / Financiamiento', feePercent: 0, active: true, accountCategory: 'Billetera Digital' },
  ],
  affiliatedCustomers: [
    {
      id: 'aff-1',
      fullName: 'Carlos Mendoza',
      taxOrId: 'V-18452319',
      address: 'Av. Fuerzas Armadas, Edif. Centro, Piso 2',
      phone: '+58 414-2398810',
      createdAt: '2026-11-15',
    },
    {
      id: 'aff-2',
      fullName: 'Talleres El Sol C.A.',
      taxOrId: 'J-41298765-2',
      address: 'Zona Industrial San Vicente, Galpón 7',
      phone: '+58 424-3910045',
      createdAt: '2026-11-18',
    },
  ],
  invoiceTemplate: {
    businessName: 'Génesis Comercial',
    taxId: 'J-40123456-7',
    phone: '+58 412-0000000',
    email: 'ventas@genesis.local',
    address: 'Av. Principal, Local 4, Sector Centro',
    headerNote: 'COMPROBANTE FISCAL / FACTURA DE VENTA',
    footerNote: 'Gracias por su compra. Conserve esta factura para cualquier reclamo o garantía.',
    bankAccountInfo: 'Banco Mercantil 0105 · Cta. Cte. 0105-0024-11-1234567890 · Pago Móvil 0412-0000000 (J-40123456-7)',
    socialMediaInfo: 'Instagram / TikTok: @genesis.comercial · WhatsApp: +58 412-0000000',
    paymentTermsInfo: 'Pago de contado o crédito según acuerdo · Cambios y reclamos dentro de las primeras 48 horas.',
    showTaxId: true,
    showAddress: true,
    showContact: true,
    showExtraFooterOnCarta: true,
    paperWidth: '80mm',
  },
};

export default function GenesisDashboard() {
  const [state, setState] = useState<GenesisState>(DEFAULT_STATE);
  const [loaded, setLoaded] = useState(false);
  const [isOptionsMenuOpen, setIsOptionsMenuOpen] = useState(true);
  const [activeViewMode, setActiveViewMode] = useState<'dashboard' | 'operations'>('dashboard');
  const [selectedAccountId, setSelectedAccountId] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [opsSearchQuery, setOpsSearchQuery] = useState('');
  const [isAddTxOpen, setIsAddTxOpen] = useState(false);
  const [isCopilotOpen, setIsCopilotOpen] = useState(false);
  const [isAddBlockOpen, setIsAddBlockOpen] = useState(false);
  const [isSalesWindowModalOpen, setIsSalesWindowModalOpen] = useState(false);
  const [isSeniatSpaceActive, setIsSeniatSpaceActive] = useState(false);
  const [isCasheaSpaceActive, setIsCasheaSpaceActive] = useState(false);
  const [isAccountingBookActive, setIsAccountingBookActive] = useState(false);
  const [isReportsSpaceActive, setIsReportsSpaceActive] = useState(false);
  const [paidCasheaInstallments, setPaidCasheaInstallments] = useState<Record<string, number[]>>({});

  // Estado Crear Producto en pestaña Productos
  const [isAddProductOpen, setIsAddProductOpen] = useState(false);
  const [prodName, setProdName] = useState('');
  const [prodBarcode, setProdBarcode] = useState('');
  const [prodCategory, setProdCategory] = useState('General');
  const [newProductCategoryName, setNewProductCategoryName] = useState('');
  const [categoryFeedback, setCategoryFeedback] = useState<string | null>(null);
  const [prodCostPrice, setProdCostPrice] = useState('');
  const [prodSalePrice, setProdSalePrice] = useState('');
  const [prodHasIva, setProdHasIva] = useState(true);
  const [prodStock, setProdStock] = useState('10');
  const [prodImageUrl, setProdImageUrl] = useState('');
  const [prodFeedback, setProdFeedback] = useState<string | null>(null);

  // Estado Modificar Producto
  const [editingProductId, setEditingProductId] = useState<string | null>(null);
  const [editProdName, setEditProdName] = useState('');
  const [editProdBarcode, setEditProdBarcode] = useState('');
  const [editProdCategory, setEditProdCategory] = useState('General');
  const [editProdCostPrice, setEditProdCostPrice] = useState('');
  const [editProdSalePrice, setEditProdSalePrice] = useState('');
  const [editProdHasIva, setEditProdHasIva] = useState(true);
  const [editProdStock, setEditProdStock] = useState('0');
  const [editProdImageUrl, setEditProdImageUrl] = useState('');

  // Estado Tipo de pago personalizado
  const [newPmName, setNewPmName] = useState('');
  const [newPmChannel, setNewPmChannel] = useState('Personalizado');
  const [newPmCategory, setNewPmCategory] = useState<PaymentAccountCategory>('Cuenta Principal');
  const [newPmFee, setNewPmFee] = useState('0');
  const [pmFeedback, setPmFeedback] = useState<string | null>(null);
  const [invoiceCashType, setInvoiceCashType] = useState<CashKindOption>('Efectivo Divisa');
  const [editingPmId, setEditingPmId] = useState<string | null>(null);
  const [editPmName, setEditPmName] = useState('');
  const [editPmCategory, setEditPmCategory] = useState<PaymentAccountCategory>('Cuenta Principal');
  const [editPmChannel, setEditPmChannel] = useState('Personalizado');
  const [editPmFee, setEditPmFee] = useState('0');
  const [editPmActive, setEditPmActive] = useState(true);

  // Estado Operadores, Roles y Permisos al entrar
  const [newOpName, setNewOpName] = useState('');
  const [newOpRole, setNewOpRole] = useState<OperatorRoleType>('Operador');
  const [newOpAccount, setNewOpAccount] = useState('Efectivo');
  const [newOpPin, setNewOpPin] = useState('');
  const [newOpPermissions, setNewOpPermissions] = useState<OperatorPermissionKey[]>(['ventas']);
  const [opFeedback, setOpFeedback] = useState<string | null>(null);
  const [editingOpId, setEditingOpId] = useState<string | null>(null);

  // Estado Proveedores (Agregar, Modificar y Borrar)
  const [newSupplierName, setNewSupplierName] = useState('');
  const [newSupplierContact, setNewSupplierContact] = useState('');
  const [newSupplierCategory, setNewSupplierCategory] = useState('');
  const [newSupplierBalance, setNewSupplierBalance] = useState('0');
  const [supplierFeedback, setSupplierFeedback] = useState<string | null>(null);
  const [editingSupplierId, setEditingSupplierId] = useState<string | null>(null);

  // Estado Gastos generales (Agregar gastos, motivo, N° factura y otros detalles)
  const [newExpenseDate, setNewExpenseDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [newExpenseReason, setNewExpenseReason] = useState('');
  const [newExpenseInvoice, setNewExpenseInvoice] = useState('');
  const [newExpenseAmount, setNewExpenseAmount] = useState('');
  const [newExpenseBeneficiary, setNewExpenseBeneficiary] = useState('');
  const [newExpenseMethod, setNewExpenseMethod] = useState('Efectivo Divisa');
  const [newExpenseAccountId, setNewExpenseAccountId] = useState('acc-1');
  const [newExpenseDetails, setNewExpenseDetails] = useState('');
  const [expenseFeedback, setExpenseFeedback] = useState<string | null>(null);
  const [boardDate, setBoardDate] = useState<string>(() => getLocalTodayStr());
  const [boardPeriod, setBoardPeriod] = useState<'day' | '7d' | 'month' | 'year'>('day');
  const [selectedPaymentMethodFilter, setSelectedPaymentMethodFilter] = useState<string>('all');
  const [editSupplierName, setEditSupplierName] = useState('');
  const [editSupplierContact, setEditSupplierContact] = useState('');
  const [editSupplierCategory, setEditSupplierCategory] = useState('');
  const [editSupplierBalance, setEditSupplierBalance] = useState('0');
  const [editOpName, setEditOpName] = useState('');
  const [editOpRole, setEditOpRole] = useState<OperatorRoleType>('Operador');
  const [editOpAccount, setEditOpAccount] = useState('Cuenta Principal');
  const [editOpPin, setEditOpPin] = useState('');
  const [editOpActive, setEditOpActive] = useState(true);
  const [editOpPermissions, setEditOpPermissions] = useState<OperatorPermissionKey[]>(['ventas']);
  const [isSwitchOperatorOpen, setIsSwitchOperatorOpen] = useState(false);
  const [isStartupLoginOpen, setIsStartupLoginOpen] = useState(false);
  const [startupOpId, setStartupOpId] = useState<string>('op-1');
  const [startupPasswordInput, setStartupPasswordInput] = useState<string>('');
  const startupPinInputRef = useRef<HTMLInputElement | null>(null);
  const [startupLoginError, setStartupLoginError] = useState<string | null>(null);
  useEffect(() => {
    if (!isStartupLoginOpen) return;
    const focusInput = () => {
      try {
        window.focus();
        startupPinInputRef.current?.focus();
      } catch {}
    };
    const t1 = window.setTimeout(focusInput, 30);
    const t2 = window.setTimeout(focusInput, 150);
    const t3 = window.setTimeout(focusInput, 350);
    return () => {
      window.clearTimeout(t1);
      window.clearTimeout(t2);
      window.clearTimeout(t3);
    };
  }, [isStartupLoginOpen, startupOpId]);
  useEffect(() => {
    if (!isStartupLoginOpen) return;
    const t1 = window.setTimeout(() => startupPinInputRef.current?.focus(), 40);
    const t2 = window.setTimeout(() => startupPinInputRef.current?.focus(), 160);
    return () => {
      window.clearTimeout(t1);
      window.clearTimeout(t2);
    };
  }, [isStartupLoginOpen, startupOpId]);
  const [loginSelectedOpId, setLoginSelectedOpId] = useState<string>('');
  const [loginPinInput, setLoginPinInput] = useState<string>('');
  const [loginError, setLoginError] = useState<string | null>(null);
  const [adminPinDraft, setAdminPinDraft] = useState<string>('');
  const [adminPinMsg, setAdminPinMsg] = useState<string | null>(null);
  const [discountPercentDraft, setDiscountPercentDraft] = useState<string>('');
  const [discountAuthPinInput, setDiscountAuthPinInput] = useState<string>('');
  const [appliedDiscountPct, setAppliedDiscountPct] = useState<number>(0);
  const [discountError, setDiscountError] = useState<string | null>(null);
  const [discountSuccessMsg, setDiscountSuccessMsg] = useState<string | null>(null);
  const [isCreditSale, setIsCreditSale] = useState<boolean>(false);
  const [creditInitialPaidDraft, setCreditInitialPaidDraft] = useState<string>('0');

  // Estado Tasa de Cambio
  const [rateDrafts, setRateDrafts] = useState<Record<string, string>>({});
  const [rateSavedMsg, setRateSavedMsg] = useState<string | null>(null);

  // Estado POS / Cobro en pestaña Ventas
  const [posScanInput, setPosScanInput] = useState('');
  const [posScanFeedback, setPosScanFeedback] = useState<string | null>(null);
  const [posLowStockAlert, setPosLowStockAlert] = useState<boolean>(false);
  const [posNextMultiplier, setPosNextMultiplier] = useState<number>(1);
  const [editingQtyProductId, setEditingQtyProductId] = useState<string | null>(null);
  const [editingQtyDraft, setEditingQtyDraft] = useState<string>('');
  const [selectedPosCategory, setSelectedPosCategory] = useState<string>('Todas');
  const [invoiceItems, setInvoiceItems] = useState<SaleInvoiceItem[]>([]);
  const [invoiceNote, setInvoiceNote] = useState('Cliente General');
  const [customInvoiceMode, setCustomInvoiceMode] = useState(false);
  const [custFullName, setCustFullName] = useState('');
  const [custTaxOrId, setCustTaxOrId] = useState('');
  const [custAddress, setCustAddress] = useState('');
  const [custPhone, setCustPhone] = useState('');
  const [matchedCustomerId, setMatchedCustomerId] = useState<string | null>(null);
  const [newAffName, setNewAffName] = useState('');
  const [newAffId, setNewAffId] = useState('');
  const [newAffAddress, setNewAffAddress] = useState('');
  const [newAffPhone, setNewAffPhone] = useState('');
  const [affFeedback, setAffFeedback] = useState<string | null>(null);
  const [invoicePaymentType, setInvoicePaymentType] = useState('Efectivo');
  const [invoiceCurrency, setInvoiceCurrency] = useState('USD');
  const [invoiceAccountId, setInvoiceAccountId] = useState('acc-1');
  const [lastSaleBanner, setLastSaleBanner] = useState<string | null>(null);
  const [isInvoicePreviewModalOpen, setIsInvoicePreviewModalOpen] = useState(false);
  const posInputRef = useRef<HTMLInputElement | null>(null);

  const [txMerchant, setTxMerchant] = useState('');
  const [txAmount, setTxAmount] = useState('');
  const [txType, setTxType] = useState<'expense' | 'income'>('expense');
  const [txCategory, setTxCategory] = useState('cat-food');
  const [txAccount, setTxAccount] = useState('acc-1');
  const [txDate, setTxDate] = useState('2026-11-20');

  const [copilotInput, setCopilotInput] = useState('');
  const [copilotMessages, setCopilotMessages] = useState<{ role: 'user' | 'ai'; text: string }[]>([
    { role: 'ai', text: 'Hola, soy Génesis IA. Puedo ayudarte con dudas de ventas, gastos, reportes, libro de contabilidad, Excel, tasas o crear reglas (ej. "regla uber -> Transporte").' },
  ]);

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        const mergedProducts: ProductItem[] = (parsed.products ?? DEFAULT_STATE.products).map(
          (p: ProductItem, idx: number) => {
            const fallback = DEFAULT_STATE.products[idx % DEFAULT_STATE.products.length];
            const accent = p.accentColor || fallback.accentColor;
            const saleVal = typeof p.price === 'number' ? p.price : fallback.price;
            const costVal =
              typeof p.costPrice === 'number'
                ? p.costPrice
                : Number((saleVal * 0.65).toFixed(2));
            return {
              ...fallback,
              ...p,
              costPrice: costVal,
              price: saleVal,
              hasIva: typeof p.hasIva === 'boolean' ? p.hasIva : (fallback.hasIva ?? true),
              barcode: p.barcode || fallback.barcode,
              accentColor: accent,
              imageUrl: p.imageUrl || makeThumbDataUri(p.name, accent),
            };
          }
        );
        const loadedCurrencies = parsed.currencies ?? DEFAULT_STATE.currencies;
        const drafts: Record<string, string> = {};
        loadedCurrencies.forEach((c: { id: string; rateToUsd: number }) => {
          drafts[c.id] = String(c.rateToUsd);
        });
        setRateDrafts(drafts);

        setState({
          ...DEFAULT_STATE,
          ...parsed,
          products: mergedProducts,
          sales: parsed.sales ?? DEFAULT_STATE.sales,
          suppliers: parsed.suppliers ?? DEFAULT_STATE.suppliers,
          generalExpenses: parsed.generalExpenses ?? DEFAULT_STATE.generalExpenses,
          cashClosings: parsed.cashClosings ?? DEFAULT_STATE.cashClosings,
          currentOperatorId: parsed.currentOperatorId ?? DEFAULT_STATE.currentOperatorId,
          adminDiscountPin: parsed.adminDiscountPin ?? DEFAULT_STATE.adminDiscountPin,
          operatorAccounts: (parsed.operatorAccounts ?? DEFAULT_STATE.operatorAccounts).map(
            (op: OperatorAccountItem) => {
              const normRole = normalizeOperatorRole(op.role);
              return {
                ...op,
                role: normRole,
                permissions:
                  normRole === 'Administrador'
                    ? ROLE_DEFAULT_PERMISSIONS.Administrador
                    : Array.isArray(op.permissions)
                    ? op.permissions
                    : ROLE_DEFAULT_PERMISSIONS[normRole],
              };
            }
          ),
          currencies: loadedCurrencies,
          paymentMethods: (() => {
            const baseList = (parsed.paymentMethods ?? DEFAULT_STATE.paymentMethods).map(
              (pm: { id: string; name: string; channel: string; feePercent: number; active: boolean; accountCategory?: PaymentAccountCategory }) => ({
                ...pm,
                accountCategory:
                  pm.accountCategory ||
                  (/efectivo/i.test(pm.name)
                    ? 'Efectivo'
                    : /billetera|zelle|binance|digital|cashea/i.test(pm.name + ' ' + pm.channel)
                    ? 'Billetera Digital'
                    : 'Cuenta Principal'),
              })
            );
            if (!baseList.some((p: { name: string }) => /cashea/i.test(p.name))) {
              baseList.push({
                id: 'pm-5',
                name: 'Cashea',
                channel: 'Cuotas / Financiamiento',
                feePercent: 0,
                active: true,
                accountCategory: 'Billetera Digital',
              });
            }
            return baseList;
          })(),
          affiliatedCustomers: parsed.affiliatedCustomers ?? DEFAULT_STATE.affiliatedCustomers,
          invoiceTemplate: {
            ...DEFAULT_STATE.invoiceTemplate,
            ...(parsed.invoiceTemplate ?? {}),
          },
          operationsSection: parsed.operationsSection ?? DEFAULT_STATE.operationsSection,
          activeRateCurrencyCode:
            parsed.activeRateCurrencyCode ?? DEFAULT_STATE.activeRateCurrencyCode,
          productCategories:
            Array.isArray(parsed.productCategories) && parsed.productCategories.length > 0
              ? parsed.productCategories
              : DEFAULT_STATE.productCategories,
          auditLog: Array.isArray(parsed.auditLog) ? parsed.auditLog : [],
          creditNotes: Array.isArray(parsed.creditNotes) ? parsed.creditNotes : [],
          receivables: Array.isArray(parsed.receivables) ? parsed.receivables : DEFAULT_STATE.receivables,
          payables: Array.isArray(parsed.payables) ? parsed.payables : DEFAULT_STATE.payables,
        });
      } catch (e) {
        console.error('Error cargando estado de Génesis', e);
      }
    } else {
      const drafts: Record<string, string> = {};
      DEFAULT_STATE.currencies.forEach((c) => {
        drafts[c.id] = String(c.rateToUsd);
      });
      setRateDrafts(drafts);
    }
    setState((prev) => {
      const baseAdminPin =
        prev.adminDiscountPin && prev.adminDiscountPin.trim()
          ? prev.adminDiscountPin.trim()
          : 'admin1';
      let normalizedOps = (prev.operatorAccounts || []).map((op) => {
        if (op.id === 'op-1' || normalizeOperatorRole(op.role) === 'Administrador') {
          return {
            ...op,
            operatorName: 'administrador',
            role: 'Administrador' as OperatorRoleType,
            active: true,
            permissions: ROLE_DEFAULT_PERMISSIONS.Administrador,
            pin: 'admin1',
          };
        }
        return { ...op, pin: undefined };
      });
      const hasAdmin = normalizedOps.some(
        (op) => normalizeOperatorRole(op.role) === 'Administrador'
      );
      if (!hasAdmin) {
        const adminAccount: OperatorAccountItem = {
          id: 'op-admin-base',
          operatorName: 'administrador',
          role: 'Administrador',
          assignedAccount: 'Cuenta Principal',
          active: true,
          permissions: ROLE_DEFAULT_PERMISSIONS.Administrador,
          pin: 'admin1',
        };
        normalizedOps = [adminAccount, ...normalizedOps];
      }
      return {
        ...prev,
        adminDiscountPin: 'admin1',
        operatorAccounts: normalizedOps,
      };
    });
    setStartupOpId('op-1');
    setStartupPasswordInput('');
    setStartupLoginError(null);
    setIsStartupLoginOpen(true);
    setLoaded(true);
  }, []);

  useEffect(() => {
    if (loaded) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    }
  }, [state, loaded]);

  useEffect(() => {
    if (!loaded) return;
    const sheets: ExcelSheetData[] = [
      {
        name: 'Movimientos',
        headers: ['ID', 'Fecha', 'Comercio / Concepto', 'Categoría', 'Cuenta', 'Monto'],
        rows: (state.transactions || []).map((t) => [
          t.id,
          t.date,
          t.merchant,
          state.categories.find((c) => c.id === t.categoryId)?.name || t.categoryId,
          state.accounts.find((a) => a.id === t.accountId)?.name || t.accountId,
          t.amount,
        ]),
      },
      {
        name: 'Ventas',
        headers: ['ID', 'Fecha', 'Referencia', 'Cliente / Nota', 'Tipo de Pago', 'Moneda', 'Total'],
        rows: (state.sales || []).map((s) => [
          s.id,
          s.date,
          s.reference,
          s.customerOrNote,
          s.paymentType,
          s.currency,
          s.total,
        ]),
      },
      {
        name: 'Gastos Generales',
        headers: ['ID', 'Fecha', 'Motivo', 'N° Factura', 'Beneficiario', 'Forma de Pago', 'Detalles', 'Monto'],
        rows: (state.generalExpenses || []).map((g) => [
          g.id,
          g.date,
          g.reason,
          g.invoiceNumber,
          g.supplierOrBeneficiary || '',
          g.paymentMethod || '',
          g.notes || '',
          g.amount,
        ]),
      },
      {
        name: 'Proveedores',
        headers: ['ID', 'Proveedor', 'Contacto', 'Rubro', 'Saldo por pagar'],
        rows: (state.suppliers || []).map((sup) => [
          sup.id,
          sup.name,
          sup.contact,
          sup.category,
          sup.balanceDue,
        ]),
      },
      {
        name: 'Productos',
        headers: ['ID', 'SKU', 'Código Barras', 'Nombre', 'Categoría', 'Costo', 'Precio', 'IVA', 'Stock'],
        rows: (state.products || []).map((p) => [
          p.id,
          p.sku || '',
          p.barcode || '',
          p.name,
          p.category,
          p.costPrice ?? 0,
          p.price,
          p.hasIva ? 'Sí' : 'No',
          p.stock ?? 0,
        ]),
      },
      {
        name: 'Clientes Afiliados',
        headers: ['ID', 'Nombre', 'RIF / Cédula', 'Teléfono', 'Dirección', 'Fecha'],
        rows: (state.affiliatedCustomers || []).map((c) => [
          c.id,
          c.fullName,
          c.taxOrId,
          c.phone,
          c.address,
          c.createdAt,
        ]),
      },
      {
        name: 'Cierres de Caja',
        headers: ['ID', 'Fecha', 'Operador', 'Apertura', 'Esperado', 'Contado', 'Estado'],
        rows: (state.cashClosings || []).map((cc) => [
          cc.id,
          cc.date,
          cc.operator,
          cc.openingCash,
          cc.expectedCash,
          cc.countedCash,
          cc.status,
        ]),
      },
    ];

    const timer = window.setTimeout(() => {
      fetch('/api/excel-book', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sheets }),
      }).catch(() => {});
    }, 250);

    return () => window.clearTimeout(timer);
  }, [loaded, state]);


  useEffect(() => {
    if (activeViewMode === 'operations' && state.operationsSection === 'ventas') {
      const timer = setTimeout(() => {
        posInputRef.current?.focus();
      }, 60);
      return () => clearTimeout(timer);
    }
  }, [activeViewMode, state.operationsSection]);

  const addProductToInvoice = (product: ProductItem, overrideQty?: number) => {
    const qtyToAdd = Math.max(1, overrideQty ?? posNextMultiplier);
    const isLowStock = product.stock < 5;
    let resultingQty = qtyToAdd;

    setInvoiceItems((prev) => {
      const existingIdx = prev.findIndex((i) => i.productId === product.id);
      if (existingIdx >= 0) {
        const updated = [...prev];
        resultingQty = updated[existingIdx].quantity + qtyToAdd;
        updated[existingIdx] = {
          ...updated[existingIdx],
          quantity: resultingQty,
        };
        return updated;
      }
      return [
        ...prev,
        {
          productId: product.id,
          sku: product.sku,
          barcode: product.barcode,
          name: product.name,
          unitPrice: product.price,
          quantity: qtyToAdd,
          hasIva: Boolean(product.hasIva),
        },
      ];
    });

    if (overrideQty === undefined && posNextMultiplier > 1) {
      setPosNextMultiplier(1);
    }

    setPosLowStockAlert(isLowStock);
    setPosScanFeedback(
      isLowStock
        ? `Agregado x${qtyToAdd}: ${product.name} (Total x${resultingQty} · +$${(product.price * qtyToAdd).toFixed(2)}) — Stock bajo: ${product.stock} uds. (< 5)`
        : `Agregado x${qtyToAdd}: ${product.name} (Total x${resultingQty} · +$${(product.price * qtyToAdd).toFixed(2)})`
    );
    setLastSaleBanner(null);
  };

  useEffect(() => {
    let scanBuffer = '';
    let lastKeyTime = 0;

    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setIsCopilotOpen((prev) => !prev);
        return;
      }

      if (isStartupLoginOpen) {
        return;
      }
      if (activeViewMode !== 'operations' || state.operationsSection !== 'ventas') {
        return;
      }

      const target = e.target as HTMLElement | null;
      const isInputFocused =
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.tagName === 'SELECT' ||
          target.isContentEditable);

      if (isInputFocused) {
        return;
      }

      if (e.ctrlKey || e.metaKey || e.altKey) {
        return;
      }

      const now = Date.now();
      if (now - lastKeyTime > 120) {
        scanBuffer = '';
      }
      lastKeyTime = now;

      if (e.key === 'Enter') {
        const code = scanBuffer.trim();
        scanBuffer = '';
        if (code.length >= 3) {
          e.preventDefault();
          const lower = code.toLowerCase();
          const exact =
            state.products.find((p) => p.barcode.toLowerCase() === lower) ||
            state.products.find((p) => p.sku.toLowerCase() === lower);
          if (exact) {
            addProductToInvoice(exact);
          } else {
            setPosScanInput(code);
            setPosLowStockAlert(false);
            setPosScanFeedback(`Código escaneado: "${code}". Presiona Cargar para buscar.`);
          }
          posInputRef.current?.focus();
        }
        return;
      }

      if (e.key.length === 1) {
        scanBuffer += e.key;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isStartupLoginOpen, activeViewMode, state.operationsSection, state.products, addProductToInvoice]);

  const filteredTransactions = useMemo(() => {
    const targetDay = boardDate || getLocalTodayStr();
    const refDateObj = new Date(`${targetDay}T23:59:59`);
    const sevenDaysAgoObj = new Date(refDateObj.getTime() - 6 * 24 * 60 * 60 * 1000);
    const sevenDaysAgoStr = sevenDaysAgoObj.toISOString().slice(0, 10);
    const targetMonthPrefix = targetDay.slice(0, 7);
    const targetYearPrefix = targetDay.slice(0, 4);

    return state.transactions.filter((tx) => {
      const txDay = String(tx.date || '').slice(0, 10);
      const matchesPeriod =
        activeViewMode !== 'dashboard' ||
        (boardPeriod === 'day'
          ? txDay === targetDay
          : boardPeriod === '7d'
          ? Boolean(txDay && txDay >= sevenDaysAgoStr && txDay <= targetDay)
          : boardPeriod === 'month'
          ? txDay.startsWith(targetMonthPrefix)
          : txDay.startsWith(targetYearPrefix));
      const matchesAccount = selectedAccountId === 'all' || tx.accountId === selectedAccountId;
      const pmFilterLower = selectedPaymentMethodFilter.trim().toLowerCase();
      const matchesPm =
        selectedPaymentMethodFilter === 'all' ||
        tx.merchant.toLowerCase().includes(pmFilterLower) ||
        (state.paymentMethods || []).some(
          (pm) =>
            pm.name.toLowerCase() === pmFilterLower &&
            resolveAccountIdForCategory(state.accounts, pm.accountCategory, 'acc-1') === tx.accountId
        );
      const matchesSearch = tx.merchant.toLowerCase().includes(searchQuery.toLowerCase());
      return matchesPeriod && matchesAccount && matchesPm && matchesSearch;
    });
  }, [state.transactions, state.paymentMethods, state.accounts, activeViewMode, boardDate, boardPeriod, selectedAccountId, selectedPaymentMethodFilter, searchQuery]);

  const metrics = useMemo(() => {
    const initialSum = state.accounts
      .filter((a) => selectedAccountId === 'all' || a.id === selectedAccountId)
      .reduce((acc, a) => acc + a.initialBalance, 0);

    const txNet = filteredTransactions.reduce((acc, t) => acc + t.amount, 0);
    const income = filteredTransactions.filter((t) => t.amount > 0).reduce((acc, t) => acc + t.amount, 0);
    const expense = filteredTransactions.filter((t) => t.amount < 0).reduce((acc, t) => acc + Math.abs(t.amount), 0);

    return {
      balance: initialSum + txNet,
      income,
      expense,
    };
  }, [state.accounts, filteredTransactions, selectedAccountId]);

  const activeRateCurrency = useMemo(() => {
    return (
      state.currencies.find((c) => c.code === state.activeRateCurrencyCode) ||
      state.currencies.find((c) => !c.isBase) ||
      state.currencies[0]
    );
  }, [state.currencies, state.activeRateCurrencyCode]);

  const availableProductCategories = useMemo(() => {
    const configuredCats =
      Array.isArray(state.productCategories) && state.productCategories.length > 0
        ? state.productCategories
        : ['Químicos', 'Detalle', 'Mantenimiento', 'General'];
    const fromProducts = state.products.map((p) => p.category).filter(Boolean);
    return Array.from(new Set([...configuredCats, ...fromProducts]));
  }, [state.productCategories, state.products]);

  const posCategories = useMemo(() => {
    return ['Todas', ...availableProductCategories];
  }, [availableProductCategories]);

  const filteredPosProducts = useMemo(() => {
    const term = posScanInput.trim().toLowerCase();
    return state.products.filter((prod) => {
      const matchesCat = selectedPosCategory === 'Todas' || prod.category === selectedPosCategory;
      const matchesTerm =
        !term ||
        prod.name.toLowerCase().includes(term) ||
        prod.barcode.toLowerCase().includes(term) ||
        prod.sku.toLowerCase().includes(term);
      return matchesCat && matchesTerm;
    });
  }, [state.products, selectedPosCategory, posScanInput]);

  const invoiceBaseTotal = useMemo(() => {
    return invoiceItems.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0);
  }, [invoiceItems]);

  const invoiceIvaTotal = useMemo(() => {
    return invoiceItems.reduce(
      (sum, item) => sum + (item.hasIva ? item.unitPrice * item.quantity * IVA_RATE : 0),
      0
    );
  }, [invoiceItems]);

  const invoiceSubtotal = useMemo(() => {
    return invoiceBaseTotal + invoiceIvaTotal;
  }, [invoiceBaseTotal, invoiceIvaTotal]);

  const activePage = state.pages.find((p) => p.id === state.activePageId) || state.pages[0];
  const activeOpItem = OPERATIONS_MENU.find((o) => o.id === state.operationsSection) || OPERATIONS_MENU[0];

  const handleSelectOperationsSection = (section: OperationsSubSection) => {
    setIsCasheaSpaceActive(false);
    setIsSeniatSpaceActive(false);
    if (!hasPermission(section)) {
      return;
    }
    if (section === 'ventas') {
      setIsSalesWindowModalOpen(true);
      return;
    }
    setOpsSearchQuery('');
    setPosScanFeedback(null);
    setPosLowStockAlert(false);
    setProdFeedback(null);
    setRateSavedMsg(null);
    setState((prev) => ({ ...prev, operationsSection: section }));
    setActiveViewMode('operations');
  };

  // Cálculo en vivo de % de ganancia y precio ajustado a la tasa en el formulario de crear producto
  const draftCostNum = parseFloat(prodCostPrice);
  const draftSaleNum = parseFloat(prodSalePrice);
  const hasValidDraftPrices =
    !isNaN(draftCostNum) && draftCostNum >= 0 && !isNaN(draftSaleNum) && draftSaleNum > 0;
  const draftProfitPct = hasValidDraftPrices
    ? calcProfitMarginPercent(draftCostNum, draftSaleNum)
    : null;
  const draftProfitUnit = hasValidDraftPrices ? draftSaleNum - draftCostNum : null;
  const draftAdjustedSale =
    !isNaN(draftSaleNum) && draftSaleNum > 0
      ? draftSaleNum * (activeRateCurrency?.rateToUsd ?? 1)
      : null;

  const handleAddProductCategory = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = newProductCategoryName.trim();
    if (!clean) return;
    const exists = availableProductCategories.some(
      (c) => c.toLowerCase() === clean.toLowerCase()
    );
    if (exists) {
      setCategoryFeedback('Esa categoría ya existe.');
      return;
    }
    const nextCats = [...availableProductCategories, clean];
    setState((prev) => ({
      ...prev,
      productCategories: nextCats,
    }));
    setProdCategory(clean);
    setNewProductCategoryName('');
    setCategoryFeedback(`Categoría "${clean}" agregada.`);
  };

  const handleDeleteProductCategory = (catName: string) => {
    const inUse = state.products.some(
      (p) => p.category.toLowerCase() === catName.toLowerCase()
    );
    if (inUse) {
      setCategoryFeedback(`No puedes eliminar "${catName}" porque tiene productos asignados.`);
      return;
    }
    const nextCats = availableProductCategories.filter((c) => c !== catName);
    const finalCats = nextCats.length > 0 ? nextCats : ['General'];
    setState((prev) => ({
      ...prev,
      productCategories: finalCats,
    }));
    if (prodCategory === catName) {
      setProdCategory(finalCats[0]);
    }
    if (editProdCategory === catName) {
      setEditProdCategory(finalCats[0]);
    }
    setCategoryFeedback(`Categoría "${catName}" eliminada.`);
  };

  const [auditDateFilter, setAuditDateFilter] = useState('');
  const [auditModuleFilter, setAuditModuleFilter] = useState('Todas');
  const [recCustomerName, setRecCustomerName] = useState('');
  const [recReference, setRecReference] = useState('');
  const [recChannel, setRecChannel] = useState('Cashea');
  const [recAmount, setRecAmount] = useState('');
  const [recDueDate, setRecDueDate] = useState(getLocalTodayStr());
  const [recNotes, setRecNotes] = useState('');
  const [recPaymentAmount, setRecPaymentAmount] = useState<Record<string, string>>({});
  const [recPaymentMethod, setRecPaymentMethod] = useState<Record<string, string>>({});
  const [recEarlyFlag, setRecEarlyFlag] = useState<Record<string, boolean>>({});
  const [paySupplierName, setPaySupplierName] = useState('');
  const [payReference, setPayReference] = useState('');
  const [payChannel, setPayChannel] = useState('Cuenta Principal');
  const [payAmount, setPayAmount] = useState('');
  const [payDueDate, setPayDueDate] = useState(getLocalTodayStr());
  const [payNotes, setPayNotes] = useState('');
  const [payPaymentAmount, setPayPaymentAmount] = useState<Record<string, string>>({});
  const [payPaymentMethod, setPayPaymentMethod] = useState<Record<string, string>>({});
  const [payEarlyFlag, setPayEarlyFlag] = useState<Record<string, boolean>>({});
  const [scanBusy, setScanBusy] = useState(false);
  const [scanMessage, setScanMessage] = useState<string | null>(null);
  const [scanSupplierName, setScanSupplierName] = useState('');
  const [scanDraftItems, setScanDraftItems] = useState<{ name: string; quantity: number; costPrice: number; salePrice: number; category: string }[]>([]);

  const createAuditEntry = (
    moduleName: string,
    actionType: string,
    summaryText: string,
    reference?: string,
    beforeValue?: string,
    afterValue?: string
  ): AuditEntry => {
    const activeOp = state.operatorAccounts.find((o) => o.id === state.currentOperatorId);
    const now = new Date();
    const seq = (state.auditLog?.length || 0) + 1;
    return {
      id: `aud-${Date.now()}-${seq}`,
      correlative: `AUD-${String(seq).padStart(6, '0')}`,
      timestamp: now.toLocaleString('es-VE'),
      dateOnly: getLocalTodayStr(),
      operatorName: activeOp?.operatorName || 'administrador',
      operatorRole: activeOp?.role || 'Administrador',
      module: moduleName,
      actionType,
      reference,
      summary: summaryText,
      beforeValue,
      afterValue,
      immutable: true,
    };
  };

  const handleInvoiceImageScan = async (file: File | undefined) => {
    if (!file) return;
    setScanBusy(true);
    setScanMessage('Escaneando factura y detectando proveedor y productos...');
    try {
      let extractedText = '';
      try {
        const Tesseract = await import('tesseract.js');
        const res = await Tesseract.recognize(file, 'spa+eng');
        extractedText = String(res?.data?.text || '');
      } catch {
        extractedText = '';
      }
      const lines = extractedText
        .split(/\r?\n/)
        .map((l) => l.trim())
        .filter((l) => l.length > 2);
      const supplierGuess =
        lines.find((l) => /c\.a\.|s\.a\.|distribuidora|comercial|proveedor|quimicos|inversiones/i.test(l)) ||
        lines[0] ||
        file.name.replace(/\.[^.]+$/, '');
      const parsedItems: { name: string; quantity: number; costPrice: number; salePrice: number; category: string }[] = [];
      lines.forEach((line) => {
        const priceMatch = line.match(/(\d+[.,]\d{2})/);
        if (priceMatch && !/total|iva|subtotal|rif|fecha|factura/i.test(line)) {
          const costNum = Math.max(0.5, parseFloat(priceMatch[1].replace(',', '.')) || 10);
          const cleanProdName = line.replace(priceMatch[0], '').replace(/[^a-zA-Z0-9áéíóúÁÉÍÓÚñÑ\s-]/g, ' ').trim().slice(0, 48);
          if (cleanProdName.length >= 3) {
            parsedItems.push({
              name: cleanProdName,
              quantity: 1,
              costPrice: Number(costNum.toFixed(2)),
              salePrice: Number((costNum * 1.35).toFixed(2)),
              category: availableProductCategories[0] || 'General',
            });
          }
        }
      });
      if (parsedItems.length === 0) {
        parsedItems.push({
          name: `Producto Factura (${file.name.replace(/\.[^.]+$/, '').slice(0, 24)})`,
          quantity: 1,
          costPrice: 10.0,
          salePrice: 14.0,
          category: availableProductCategories[0] || 'General',
        });
      }
      setScanSupplierName(supplierGuess.slice(0, 60));
      setScanDraftItems(parsedItems.slice(0, 12));
      setScanMessage(`Factura escaneada: ${parsedItems.length} ítem(s) detectado(s). Revisa y confirma para cargar al inventario y libro contable.`);
    } finally {
      setScanBusy(false);
    }
  };

  const handleConfirmScannedInvoice = () => {
    if (scanDraftItems.length === 0) return;
    const supName = scanSupplierName.trim() || 'Proveedor General';
    const totalCost = scanDraftItems.reduce((acc, it) => acc + it.costPrice * it.quantity, 0);
    const createdProducts: ProductItem[] = scanDraftItems.map((it, idx) => {
      const nIdx = state.products.length + idx + 1;
      const accent = PRODUCT_ACCENT_PALETTE[nIdx % PRODUCT_ACCENT_PALETTE.length];
      return {
        id: `p-ocr-${Date.now()}-${idx}`,
        sku: `PRD-${String(nIdx).padStart(3, '0')}`,
        barcode: `7591001${String(200000 + nIdx * 11)}`,
        name: it.name,
        category: it.category || 'General',
        costPrice: Number(it.costPrice.toFixed(2)),
        price: Number(it.salePrice.toFixed(2)),
        hasIva: true,
        stock: Math.max(1, Math.round(it.quantity)),
        accentColor: accent,
        imageUrl: makeThumbDataUri(it.name, accent),
      };
    });
    const existingSup = state.suppliers.find((s) => s.name.toLowerCase() === supName.toLowerCase());
    const nextSuppliers = existingSup
      ? state.suppliers.map((s) =>
          s.id === existingSup.id
            ? { ...s, balanceDue: Number((s.balanceDue + totalCost).toFixed(2)) }
            : s
        )
      : [
          {
            id: `sup-ocr-${Date.now()}`,
            name: supName,
            contact: 'Cargado desde escaneo de factura',
            category: scanDraftItems[0]?.category || 'General',
            balanceDue: Number(totalCost.toFixed(2)),
          },
          ...state.suppliers,
        ];
    const accountingTx: Transaction = {
      id: `tx-ocr-${Date.now()}`,
      date: getLocalTodayStr(),
      merchant: `Compra Factura OCR — ${supName}`,
      amount: -Number(totalCost.toFixed(2)),
      categoryId: 'cat-services',
      accountId: state.accounts[0]?.id || 'acc-1',
    };
    const auditRec = createAuditEntry(
      'Productos / Escaneo Factura',
      'CARGA_FACTURA_OCR',
      `Cargados ${createdProducts.length} producto(s) y proveedor "${supName}" por $${totalCost.toFixed(2)}.`,
      supName,
      undefined,
      `$${totalCost.toFixed(2)}`
    );
    setState((prev) => ({
      ...prev,
      products: [...createdProducts, ...prev.products],
      suppliers: nextSuppliers,
      transactions: [accountingTx, ...prev.transactions],
      auditLog: [auditRec, ...(prev.auditLog || [])],
    }));
    setScanDraftItems([]);
    setScanSupplierName('');
    setScanMessage(`Cargados ${createdProducts.length} producto(s) y proveedor "${supName}" con asiento en el Libro de Contabilidad.`);
  };

  const handleCreateReceivable = (e: React.FormEvent) => {
    e.preventDefault();
    const amt = parseFloat(recAmount);
    if (!recCustomerName.trim() || isNaN(amt) || amt <= 0) return;
    const dueStr = recDueDate || getLocalTodayStr();
    const isOverdue = dueStr < getLocalTodayStr();
    const item: ReceivableAccountItem = {
      id: `rec-${Date.now()}`,
      createdAt: getLocalTodayStr(),
      dueDate: dueStr,
      customerName: recCustomerName.trim(),
      reference: recReference.trim() || `CXC-${Date.now().toString().slice(-5)}`,
      channelOrAccount: recChannel || 'Cashea',
      currency: state.activeRateCurrencyCode || 'USD',
      totalAmount: Number(amt.toFixed(2)),
      paidAmount: 0,
      balanceDue: Number(amt.toFixed(2)),
      status: isOverdue ? 'Vencida' : 'Pendiente',
      notes: recNotes.trim(),
      payments: [],
    };
    const auditRec = createAuditEntry(
      'Cuentas por cobrar',
      'CREAR_CUENTA_COBRAR',
      `Cuenta por cobrar registrada para "${item.customerName}" (${item.channelOrAccount}) por $${item.totalAmount.toFixed(2)}, vence ${item.dueDate}.`,
      item.reference,
      undefined,
      `$${item.totalAmount.toFixed(2)}`
    );
    setState((prev) => ({
      ...prev,
      receivables: [item, ...(prev.receivables || [])],
      auditLog: [auditRec, ...(prev.auditLog || [])],
    }));
    setRecCustomerName('');
    setRecReference('');
    setRecAmount('');
    setRecNotes('');
  };

  const handlePayReceivable = (recId: string, fullEarly?: boolean) => {
    const target = (state.receivables || []).find((r) => r.id === recId);
    if (!target || target.balanceDue <= 0) return;
    const rawVal = fullEarly
      ? target.balanceDue
      : parseFloat(recPaymentAmount[recId] || String(target.balanceDue));
    if (isNaN(rawVal) || rawVal <= 0) return;
    const payVal = Number(Math.min(target.balanceDue, rawVal).toFixed(2));
    const nextBalance = Number(Math.max(0, target.balanceDue - payVal).toFixed(2));
    const nextPaid = Number((target.paidAmount + payVal).toFixed(2));
    const isEarly = Boolean(fullEarly || recEarlyFlag[recId] || getLocalTodayStr() < target.dueDate);
    const methodName = recPaymentMethod[recId] || target.channelOrAccount || 'Cuenta Principal';
    const nextStatus: ReceivableAccountItem['status'] =
      nextBalance <= 0.009
        ? 'Pagada'
        : target.dueDate < getLocalTodayStr()
        ? 'Vencida'
        : 'Parcial';
    const tx: Transaction = {
      id: `tx-rec-${Date.now()}`,
      date: getLocalTodayStr(),
      merchant: `${isEarly ? 'Cobro anticipado' : 'Abono CxC'} — ${target.customerName} (${target.reference})`,
      amount: payVal,
      categoryId: 'cat-income',
      accountId: state.accounts[0]?.id || 'acc-1',
    };
    const auditRec = createAuditEntry(
      'Cuentas por cobrar',
      isEarly ? 'COBRO_ANTICIPADO_CXC' : 'ABONO_CXC',
      `${isEarly ? 'Cobro anticipado' : 'Abono'} de $${payVal.toFixed(2)} en cuenta de "${target.customerName}" (${target.channelOrAccount}). Saldo restante: $${nextBalance.toFixed(2)}.`,
      target.reference,
      `$${target.balanceDue.toFixed(2)}`,
      `$${nextBalance.toFixed(2)}`
    );
    setState((prev) => ({
      ...prev,
      receivables: (prev.receivables || []).map((r) =>
        r.id === recId
          ? {
              ...r,
              paidAmount: nextPaid,
              balanceDue: nextBalance,
              status: nextStatus,
              payments: [
                ...r.payments,
                {
                  id: `pay-r-${Date.now()}`,
                  date: getLocalTodayStr(),
                  amount: payVal,
                  paymentMethod: methodName,
                  accountId: state.accounts[0]?.id || 'acc-1',
                  earlyPayment: isEarly,
                },
              ],
            }
          : r
      ),
      transactions: [tx, ...prev.transactions],
      auditLog: [auditRec, ...(prev.auditLog || [])],
    }));
    setRecPaymentAmount((prev) => ({ ...prev, [recId]: '' }));
  };

  const handleCreatePayable = (e: React.FormEvent) => {
    e.preventDefault();
    const amt = parseFloat(payAmount);
    if (!paySupplierName.trim() || isNaN(amt) || amt <= 0) return;
    const dueStr = payDueDate || getLocalTodayStr();
    const item: PayableAccountItem = {
      id: `pay-${Date.now()}`,
      createdAt: getLocalTodayStr(),
      dueDate: dueStr,
      supplierName: paySupplierName.trim(),
      reference: payReference.trim() || `CXP-${Date.now().toString().slice(-5)}`,
      channelOrAccount: payChannel || 'Cuenta Principal',
      currency: state.activeRateCurrencyCode || 'USD',
      totalAmount: Number(amt.toFixed(2)),
      paidAmount: 0,
      balanceDue: Number(amt.toFixed(2)),
      status: dueStr < getLocalTodayStr() ? 'Vencida' : 'Pendiente',
      notes: payNotes.trim(),
      payments: [],
    };
    const auditRec = createAuditEntry(
      'Cuentas por pagar',
      'CREAR_CUENTA_PAGAR',
      `Cuenta por pagar registrada para "${item.supplierName}" por $${item.totalAmount.toFixed(2)}, vence ${item.dueDate}.`,
      item.reference,
      undefined,
      `$${item.totalAmount.toFixed(2)}`
    );
    setState((prev) => ({
      ...prev,
      payables: [item, ...(prev.payables || [])],
      auditLog: [auditRec, ...(prev.auditLog || [])],
    }));
    setPaySupplierName('');
    setPayReference('');
    setPayAmount('');
    setPayNotes('');
  };

  const handlePayPayable = (payId: string, fullEarly?: boolean) => {
    const target = (state.payables || []).find((p) => p.id === payId);
    if (!target || target.balanceDue <= 0) return;
    const rawVal = fullEarly
      ? target.balanceDue
      : parseFloat(payPaymentAmount[payId] || String(target.balanceDue));
    if (isNaN(rawVal) || rawVal <= 0) return;
    const payVal = Number(Math.min(target.balanceDue, rawVal).toFixed(2));
    const nextBalance = Number(Math.max(0, target.balanceDue - payVal).toFixed(2));
    const nextPaid = Number((target.paidAmount + payVal).toFixed(2));
    const isEarly = Boolean(fullEarly || payEarlyFlag[payId] || getLocalTodayStr() < target.dueDate);
    const methodName = payPaymentMethod[payId] || target.channelOrAccount || 'Cuenta Principal';
    const nextStatus: PayableAccountItem['status'] =
      nextBalance <= 0.009
        ? 'Pagada'
        : target.dueDate < getLocalTodayStr()
        ? 'Vencida'
        : 'Parcial';
    const tx: Transaction = {
      id: `tx-pay-${Date.now()}`,
      date: getLocalTodayStr(),
      merchant: `${isEarly ? 'Pago anticipado' : 'Abono CxP'} — ${target.supplierName} (${target.reference})`,
      amount: -payVal,
      categoryId: 'cat-services',
      accountId: state.accounts[0]?.id || 'acc-1',
    };
    const auditRec = createAuditEntry(
      'Cuentas por pagar',
      isEarly ? 'PAGO_ANTICIPADO_CXP' : 'ABONO_CXP',
      `${isEarly ? 'Pago anticipado' : 'Abono'} de $${payVal.toFixed(2)} a proveedor "${target.supplierName}". Saldo restante: $${nextBalance.toFixed(2)}.`,
      target.reference,
      `$${target.balanceDue.toFixed(2)}`,
      `$${nextBalance.toFixed(2)}`
    );
    setState((prev) => ({
      ...prev,
      payables: (prev.payables || []).map((p) =>
        p.id === payId
          ? {
              ...p,
              paidAmount: nextPaid,
              balanceDue: nextBalance,
              status: nextStatus,
              payments: [
                ...p.payments,
                {
                  id: `pay-p-${Date.now()}`,
                  date: getLocalTodayStr(),
                  amount: payVal,
                  paymentMethod: methodName,
                  accountId: state.accounts[0]?.id || 'acc-1',
                  earlyPayment: isEarly,
                },
              ],
            }
          : p
      ),
      transactions: [tx, ...prev.transactions],
      auditLog: [auditRec, ...(prev.auditLog || [])],
    }));
    setPayPaymentAmount((prev) => ({ ...prev, [payId]: '' }));
  };

  const dueSoonReminders = useMemo(() => {
    const todayStr = getLocalTodayStr();
    const todayDate = new Date(`${todayStr}T00:00:00`).getTime();
    const alerts: { id: string; kind: 'Cobro' | 'Pago'; title: string; ref: string; channel: string; dueDate: string; balance: number; overdue: boolean }[] = [];
    (state.receivables || []).forEach((r) => {
      if (r.balanceDue > 0 && r.dueDate) {
        const d = new Date(`${r.dueDate}T00:00:00`).getTime();
        const diffDays = Math.round((d - todayDate) / (1000 * 60 * 60 * 24));
        if (diffDays <= 5) {
          alerts.push({
            id: r.id,
            kind: 'Cobro',
            title: r.customerName,
            ref: r.reference,
            channel: r.channelOrAccount,
            dueDate: r.dueDate,
            balance: r.balanceDue,
            overdue: diffDays < 0,
          });
        }
      }
    });
    (state.payables || []).forEach((p) => {
      if (p.balanceDue > 0 && p.dueDate) {
        const d = new Date(`${p.dueDate}T00:00:00`).getTime();
        const diffDays = Math.round((d - todayDate) / (1000 * 60 * 60 * 24));
        if (diffDays <= 5) {
          alerts.push({
            id: p.id,
            kind: 'Pago',
            title: p.supplierName,
            ref: p.reference,
            channel: p.channelOrAccount,
            dueDate: p.dueDate,
            balance: p.balanceDue,
            overdue: diffDays < 0,
          });
        }
      }
    });
    return alerts;
  }, [state.receivables, state.payables]);

  const handleExportAuditCsv = () => {
    const rows = (state.auditLog || []).filter((entry) => {
      const matchDate = !auditDateFilter || entry.dateOnly === auditDateFilter;
      const matchMod = auditModuleFilter === 'Todas' || entry.module === auditModuleFilter;
      return matchDate && matchMod;
    });
    const header = ['Correlativo', 'Fecha/Hora', 'Fecha', 'Operador', 'Rol', 'Modulo', 'Accion', 'Referencia', 'Detalle', 'Antes', 'Despues'];
    const csvLines = [
      header.join(','),
      ...rows.map((r) =>
        [
          r.correlative,
          r.timestamp,
          r.dateOnly,
          r.operatorName,
          r.operatorRole,
          r.module,
          r.actionType,
          r.reference || '',
          r.summary,
          r.beforeValue || '',
          r.afterValue || '',
        ]
          .map((v) => `"${String(v ?? '').replace(/"/g, '""')}"`)
          .join(',')
      ),
    ];
    const blob = new Blob([csvLines.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `auditoria_genesis_${getLocalTodayStr()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleCreateProduct = (e: React.FormEvent) => {
    e.preventDefault();
    const costVal = parseFloat(prodCostPrice);
    const saleVal = parseFloat(prodSalePrice);
    const stockVal = parseInt(prodStock, 10);

    if (!prodName.trim() || isNaN(costVal) || costVal < 0 || isNaN(saleVal) || saleVal <= 0) {
      return;
    }

    const nextIndex = state.products.length + 1;
    const generatedSku = `PRD-${String(nextIndex).padStart(3, '0')}`;
    const cleanBarcode =
      prodBarcode.trim() || `7591001${String(100000 + nextIndex * 7)}`;
    const accent = PRODUCT_ACCENT_PALETTE[nextIndex % PRODUCT_ACCENT_PALETTE.length];

    const newProduct: ProductItem = {
      id: `p-${Date.now()}`,
      sku: generatedSku,
      barcode: cleanBarcode,
      name: prodName.trim(),
      category: prodCategory.trim() || 'General',
      costPrice: Number(costVal.toFixed(2)),
      price: Number(saleVal.toFixed(2)),
      hasIva: prodHasIva,
      stock: isNaN(stockVal) || stockVal < 0 ? 0 : stockVal,
      accentColor: accent,
      imageUrl: prodImageUrl.trim() || makeThumbDataUri(prodName.trim(), accent),
    };

    setState((prev) => ({
      ...prev,
      products: [newProduct, ...prev.products],
    }));

    const marginStr = calcProfitMarginPercent(newProduct.costPrice, newProduct.price).toFixed(1);
    const ivaLabel = newProduct.hasIva ? 'Con IVA (16%)' : 'Sin IVA (Exento)';
    setProdFeedback(
      `Producto "${newProduct.name}" creado · ${ivaLabel} (${marginStr}% de ganancia).`
    );
    setProdName('');
    setProdBarcode('');
    setProdCostPrice('');
    setProdSalePrice('');
    setProdHasIva(true);
    setProdStock('10');
    setProdImageUrl('');
    setIsAddProductOpen(false);
  };

  const handleDeleteProduct = (productId: string) => {
    const target = state.products.find((p) => p.id === productId);
    setState((prev) => ({
      ...prev,
      products: prev.products.filter((p) => p.id !== productId),
    }));
    setInvoiceItems((prev) => prev.filter((item) => item.productId !== productId));
    if (target) {
      setProdFeedback(`Producto "${target.name}" borrado.`);
    }
  };

  const handleOpenEditProduct = (product: ProductItem) => {
    setProdFeedback(null);
    setEditingProductId(product.id);
    setEditProdName(product.name);
    setEditProdBarcode(product.barcode);
    setEditProdCategory(product.category);
    setEditProdCostPrice(String(product.costPrice));
    setEditProdSalePrice(String(product.price));
    setEditProdHasIva(Boolean(product.hasIva));
    setEditProdStock(String(product.stock));
    setEditProdImageUrl(product.imageUrl || '');
  };

  const handleSaveEditedProduct = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingProductId) return;

    const costVal = parseFloat(editProdCostPrice);
    const saleVal = parseFloat(editProdSalePrice);
    const stockVal = parseInt(editProdStock, 10);

    if (!editProdName.trim() || isNaN(costVal) || costVal < 0 || isNaN(saleVal) || saleVal <= 0) {
      return;
    }

    const cleanName = editProdName.trim();
    const cleanBarcode = editProdBarcode.trim() || '7591001000000';
    const cleanCategory = editProdCategory.trim() || 'General';
    const cleanStock = isNaN(stockVal) || stockVal < 0 ? 0 : stockVal;
    const roundedCost = Number(costVal.toFixed(2));
    const roundedSale = Number(saleVal.toFixed(2));

    let updatedThumb = '';
    setState((prev) => ({
      ...prev,
      products: prev.products.map((p) => {
        if (p.id !== editingProductId) return p;
        const accent = p.accentColor || '#4F46E5';
        const customImg = editProdImageUrl.trim();
        const isOldGeneratedThumb =
          !p.imageUrl ||
          p.imageUrl.startsWith('data:image/svg+xml') ||
          p.imageUrl === makeThumbDataUri(p.name, accent);
        updatedThumb = customImg
          ? customImg
          : isOldGeneratedThumb
          ? makeThumbDataUri(cleanName, accent)
          : p.imageUrl;
        return {
          ...p,
          name: cleanName,
          barcode: cleanBarcode,
          category: cleanCategory,
          costPrice: roundedCost,
          price: roundedSale,
          hasIva: editProdHasIva,
          stock: cleanStock,
          imageUrl: updatedThumb,
        };
      }),
    }));

    setInvoiceItems((prev) =>
      prev.map((item) =>
        item.productId === editingProductId
          ? {
              ...item,
              name: cleanName,
              barcode: cleanBarcode,
              unitPrice: roundedSale,
              hasIva: editProdHasIva,
            }
          : item
      )
    );

    const marginStr = calcProfitMarginPercent(roundedCost, roundedSale).toFixed(1);
    const ivaLabel = editProdHasIva ? 'Con IVA (16%)' : 'Sin IVA (Exento)';
    setProdFeedback(`Producto "${cleanName}" actualizado · ${ivaLabel} (${marginStr}% de ganancia).`);
    setEditingProductId(null);
  };

  const handleUpdateCurrencyRate = (currencyId: string, newRateStr: string) => {
    setRateDrafts((prev) => ({ ...prev, [currencyId]: newRateStr }));
    const parsed = parseFloat(newRateStr);
    if (!isNaN(parsed) && parsed > 0) {
      const targetCur = state.currencies.find((c) => c.id === currencyId);
      if (targetCur && !targetCur.isBase) {
        try {
          const rawLocked = localStorage.getItem('genesis_custom_rates_locked');
          const locked = rawLocked ? JSON.parse(rawLocked) : {};
          locked[targetCur.code] = true;
          localStorage.setItem('genesis_custom_rates_locked', JSON.stringify(locked));
        } catch {}
      }
      setState((prev) => ({
        ...prev,
        currencies: prev.currencies.map((c) =>
          c.id === currencyId ? { ...c, rateToUsd: parsed } : c
        ),
      }));
      setRateSavedMsg('Tasa personalizada guardada. Los precios en Productos y Ventas reflejan tu tasa elegida.');
    }
  };

  const handleSelectActiveRateCurrency = (code: string) => {
    setState((prev) => ({ ...prev, activeRateCurrencyCode: code }));
    setRateSavedMsg(`Moneda de conversión activa: ${code}`);
  };

  const syncBcvRateNow = async (manual = false) => {
    const todayKey = getLocalTodayStr();
    const lastSyncKey = 'genesis_bcv_last_sync_date';
    let customRatesLocked: Record<string, boolean> = {};
    try {
      const rawCustom = localStorage.getItem('genesis_custom_rates_locked');
      if (rawCustom) customRatesLocked = JSON.parse(rawCustom);
    } catch {}

    if (!manual) {
      try {
        const lastDate = localStorage.getItem(lastSyncKey);
        if (lastDate === todayKey) return;
      } catch {}
    }
    const { vesRate, eurRate, source } = await fetchOfficialBcvRates();
    if ((vesRate && vesRate > 0) || (eurRate && eurRate > 0)) {
      const targetCurrencies = state.currencies.filter(
        (c) =>
          (c.code === 'VES' && vesRate && vesRate > 0 && (!customRatesLocked.VES || manual)) ||
          (c.code === 'EUR' && eurRate && eurRate > 0 && (!customRatesLocked.EUR || manual))
      );

      setState((prev) => ({
        ...prev,
        currencies: prev.currencies.map((c) => {
          if (c.code === 'VES' && vesRate && vesRate > 0 && (!customRatesLocked.VES || manual)) {
            return { ...c, rateToUsd: vesRate };
          }
          if (c.code === 'EUR' && eurRate && eurRate > 0 && (!customRatesLocked.EUR || manual)) {
            return { ...c, rateToUsd: eurRate };
          }
          return c;
        }),
      }));

      setRateDrafts((prev) => {
        const next: Record<string, string> = { ...prev };
        if (vesRate && vesRate > 0 && (!customRatesLocked.VES || manual)) next.VES = String(vesRate);
        if (eurRate && eurRate > 0 && (!customRatesLocked.EUR || manual)) next.EUR = String(eurRate);
        targetCurrencies.forEach((tc) => {
          if (tc.code === 'VES' && vesRate) next[tc.id] = String(vesRate);
          if (tc.code === 'EUR' && eurRate) next[tc.id] = String(eurRate);
        });
        return next;
      });

      if (manual) {
        try {
          const nextLocked = { ...customRatesLocked };
          if (vesRate) delete nextLocked.VES;
          if (eurRate) delete nextLocked.EUR;
          localStorage.setItem('genesis_custom_rates_locked', JSON.stringify(nextLocked));
        } catch {}
      }

      try {
        localStorage.setItem(lastSyncKey, todayKey);
      } catch {}
      const parts: string[] = [];
      if (vesRate) parts.push(`VES: Bs. ${vesRate.toFixed(2)}`);
      if (eurRate) parts.push(`EUR: ${eurRate.toFixed(4)} / USD`);
      setRateSavedMsg(`Tasas actualizadas (${todayKey}) — ${parts.join(' · ')} (${source || 'BCV'})`);
    } else if (manual) {
      setRateSavedMsg('No se pudo consultar la tasa BCV en este momento; se mantiene la tasa elegida.');
    }
  };

  useEffect(() => {
    const hasVes = state.currencies.some((c) => c.code === 'VES');
    if (state.activeRateCurrencyCode === 'VES' || hasVes) {
      syncBcvRateNow(false);
    }
  }, [state.activeRateCurrencyCode, state.currencies.length]);



  const handleSetInvoiceItemQty = (productId: string, newQty: number) => {
    const cleanQty = Math.floor(newQty);
    if (isNaN(cleanQty) || cleanQty <= 0) {
      setInvoiceItems((prev) => prev.filter((item) => item.productId !== productId));
      setEditingQtyProductId(null);
      return;
    }
    setInvoiceItems((prev) =>
      prev.map((item) =>
        item.productId === productId ? { ...item, quantity: cleanQty } : item
      )
    );
    setEditingQtyProductId(null);
  };

  const handleScanOrSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const raw = posScanInput.trim();
    if (!raw) return;

    let parsedQty = posNextMultiplier;
    let codeOrName = raw;
    const multMatch = raw.match(/^(\d+)\s*[*xX]\s*(.+)$/);
    if (multMatch) {
      const mQty = parseInt(multMatch[1], 10);
      if (!isNaN(mQty) && mQty > 0) {
        parsedQty = mQty;
        codeOrName = multMatch[2].trim();
      }
    }

    const lower = codeOrName.toLowerCase();

    const exactBarcode = state.products.find((p) => p.barcode.toLowerCase() === lower);
    if (exactBarcode) {
      addProductToInvoice(exactBarcode, parsedQty);
      setPosScanInput('');
      posInputRef.current?.focus();
      return;
    }

    const exactSku = state.products.find((p) => p.sku.toLowerCase() === lower);
    if (exactSku) {
      addProductToInvoice(exactSku, parsedQty);
      setPosScanInput('');
      posInputRef.current?.focus();
      return;
    }

    const matches = state.products.filter(
      (p) =>
        p.name.toLowerCase().includes(lower) ||
        p.barcode.toLowerCase().includes(lower) ||
        p.sku.toLowerCase().includes(lower)
    );

    if (matches.length === 1) {
      addProductToInvoice(matches[0], parsedQty);
      setPosScanInput('');
      posInputRef.current?.focus();
    } else if (matches.length > 1) {
      setPosLowStockAlert(false);
      setPosScanFeedback(`Se encontraron ${matches.length} productos. Toca el deseado en la cuadrícula.`);
    } else {
      setPosLowStockAlert(false);
      setPosScanFeedback(`No se encontró ningún producto con "${raw}".`);
    }
  };

  const handleAdjustInvoiceQty = (productId: string, delta: number) => {
    setInvoiceItems((prev) =>
      prev
        .map((item) =>
          item.productId === productId ? { ...item, quantity: item.quantity + delta } : item
        )
        .filter((item) => item.quantity > 0)
    );
  };

  const handleRemoveInvoiceItem = (productId: string) => {
    setInvoiceItems((prev) => prev.filter((item) => item.productId !== productId));
  };

  const handleToggleInvoiceItemIva = (productId: string) => {
    setInvoiceItems((prev) =>
      prev.map((item) =>
        item.productId === productId ? { ...item, hasIva: !item.hasIva } : item
      )
    );
  };

  const handleToggleProductIva = (productId: string) => {
    let updatedName = '';
    let nextIva = false;
    setState((prev) => ({
      ...prev,
      products: prev.products.map((p) => {
        if (p.id !== productId) return p;
        updatedName = p.name;
        nextIva = !p.hasIva;
        return { ...p, hasIva: nextIva };
      }),
    }));
    setInvoiceItems((prev) =>
      prev.map((item) =>
        item.productId === productId ? { ...item, hasIva: nextIva } : item
      )
    );
    if (updatedName) {
      setProdFeedback(
        `"${updatedName}" ahora está marcado como ${nextIva ? 'Con IVA (16%)' : 'Sin IVA (Exento)'}.`
      );
    }
  };

  const handleClearInvoice = () => {
    setInvoiceItems([]);
    setPosScanFeedback(null);
    setPosLowStockAlert(false);
  };

  const applyAffiliatedCustomer = (cust: {
    id: string;
    fullName: string;
    taxOrId: string;
    address: string;
    phone: string;
  }) => {
    setCustomInvoiceMode(true);
    setMatchedCustomerId(cust.id);
    setCustFullName(cust.fullName);
    setCustTaxOrId(cust.taxOrId);
    setCustAddress(cust.address);
    setCustPhone(cust.phone);
    setInvoiceNote(cust.fullName);
  };

  const handleCustomLookupChange = (field: 'name' | 'id' | 'phone' | 'address', val: string) => {
    if (field === 'name') setCustFullName(val);
    if (field === 'id') setCustTaxOrId(val);
    if (field === 'phone') setCustPhone(val);
    if (field === 'address') setCustAddress(val);

    const qStr = val.trim().toLowerCase();
    if (!qStr) {
      setMatchedCustomerId(null);
      return;
    }
    const found = (state.affiliatedCustomers || []).find(
      (c) =>
        c.fullName.toLowerCase().includes(qStr) ||
        c.taxOrId.toLowerCase().includes(qStr) ||
        c.phone.toLowerCase().includes(qStr)
    );
    if (found) {
      setMatchedCustomerId(found.id);
      if (field !== 'name') setCustFullName(found.fullName);
      if (field !== 'id') setCustTaxOrId(found.taxOrId);
      if (field !== 'phone') setCustPhone(found.phone);
      if (field !== 'address') setCustAddress(found.address);
      setInvoiceNote(found.fullName);
    } else {
      setMatchedCustomerId(null);
      if (field === 'name') {
        setInvoiceNote(val || 'Cliente General');
      }
    }
  };

  const handleAddAffiliatedCustomer = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanName = newAffName.trim();
    const cleanId = newAffId.trim();
    const cleanPhone = newAffPhone.trim();
    const cleanAddr = newAffAddress.trim();
    if (!cleanName && !cleanId && !cleanPhone) return;

    const displayName = cleanName || `Cliente ${cleanId || cleanPhone}`;
    setState((prev) => ({
      ...prev,
      affiliatedCustomers: [
        {
          id: `aff-${Date.now()}`,
          fullName: displayName,
          taxOrId: cleanId,
          address: cleanAddr,
          phone: cleanPhone,
          createdAt: new Date().toISOString().slice(0, 10),
        },
        ...(prev.affiliatedCustomers || []),
      ],
    }));
    setNewAffName('');
    setNewAffId('');
    setNewAffAddress('');
    setNewAffPhone('');
    setAffFeedback(`Cliente afiliado "${displayName}" guardado.`);
  };

  const handleAddSupplier = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanName = newSupplierName.trim();
    const cleanContact = newSupplierContact.trim();
    const cleanCategory = newSupplierCategory.trim() || 'General';
    const parsedBalance = parseFloat(newSupplierBalance);
    const cleanBalance = Number.isFinite(parsedBalance) ? Math.max(0, parsedBalance) : 0;
    if (!cleanName) return;

    setState((prev) => ({
      ...prev,
      suppliers: [
        ...(prev.suppliers || []),
        {
          id: `sup-${Date.now()}`,
          name: cleanName,
          contact: cleanContact || '-',
          category: cleanCategory,
          balanceDue: cleanBalance,
        },
      ],
    }));

    setNewSupplierName('');
    setNewSupplierContact('');
    setNewSupplierCategory('');
    setNewSupplierBalance('0');
    setSupplierFeedback(`Proveedor "${cleanName}" agregado.`);
  };

  const handleStartEditSupplier = (sup: SupplierItem) => {
    setEditingSupplierId(sup.id);
    setEditSupplierName(sup.name);
    setEditSupplierContact(sup.contact === '-' ? '' : sup.contact);
    setEditSupplierCategory(sup.category);
    setEditSupplierBalance(String(sup.balanceDue ?? 0));
    setSupplierFeedback(null);
  };

  const handleCancelEditSupplier = () => {
    setEditingSupplierId(null);
    setEditSupplierName('');
    setEditSupplierContact('');
    setEditSupplierCategory('');
    setEditSupplierBalance('0');
  };

  const handleSaveEditSupplier = (supplierId: string) => {
    const cleanName = editSupplierName.trim();
    if (!cleanName) return;
    const cleanContact = editSupplierContact.trim() || '-';
    const cleanCategory = editSupplierCategory.trim() || 'General';
    const parsedBalance = parseFloat(editSupplierBalance);
    const cleanBalance = Number.isFinite(parsedBalance) ? Math.max(0, parsedBalance) : 0;

    setState((prev) => ({
      ...prev,
      suppliers: (prev.suppliers || []).map((sup) =>
        sup.id === supplierId
          ? {
              ...sup,
              name: cleanName,
              contact: cleanContact,
              category: cleanCategory,
              balanceDue: cleanBalance,
            }
          : sup
      ),
    }));

    setEditingSupplierId(null);
    setSupplierFeedback(`Proveedor "${cleanName}" actualizado.`);
  };

  const handleDeleteSupplier = (supplierId: string) => {
    const target = (state.suppliers || []).find((sup) => sup.id === supplierId);
    setState((prev) => ({
      ...prev,
      suppliers: (prev.suppliers || []).filter((sup) => sup.id !== supplierId),
    }));
    if (editingSupplierId === supplierId) {
      setEditingSupplierId(null);
    }
    if (target) {
      setSupplierFeedback(`Proveedor "${target.name}" eliminado.`);
    }
  };

  const handleAddGeneralExpense = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanReason = newExpenseReason.trim();
    const cleanInvoice = newExpenseInvoice.trim();
    const parsedAmount = parseFloat(newExpenseAmount);
    const cleanAmount = Number.isFinite(parsedAmount) ? Math.abs(parsedAmount) : 0;
    if (!cleanReason || cleanAmount <= 0) return;

    const cleanDate = newExpenseDate.trim() || new Date().toISOString().slice(0, 10);
    const cleanBeneficiary = newExpenseBeneficiary.trim();
    const cleanMethod = newExpenseMethod.trim() || 'Efectivo';
    const cleanDetails = newExpenseDetails.trim();
    const targetAccountId = newExpenseAccountId || 'acc-1';
    const expenseId = `gexp-${Date.now()}`;

    const expenseItem: GeneralExpenseItem = {
      id: expenseId,
      date: cleanDate,
      reason: cleanReason,
      invoiceNumber: cleanInvoice || 'S/N',
      amount: cleanAmount,
      supplierOrBeneficiary: cleanBeneficiary || undefined,
      paymentMethod: cleanMethod,
      accountId: targetAccountId,
      notes: cleanDetails || undefined,
    };

    const expenseTx: Transaction = {
      id: `tx-gexp-${expenseId}`,
      date: cleanDate,
      merchant: `Gasto: ${cleanReason}${cleanInvoice ? ` · Fact. ${cleanInvoice}` : ''}${cleanBeneficiary ? ` (${cleanBeneficiary})` : ''}`,
      amount: -cleanAmount,
      categoryId: 'cat-services',
      accountId: targetAccountId,
    };

    setState((prev) => ({
      ...prev,
      generalExpenses: [expenseItem, ...(prev.generalExpenses || [])],
      transactions: [expenseTx, ...prev.transactions],
    }));

    setNewExpenseReason('');
    setNewExpenseInvoice('');
    setNewExpenseAmount('');
    setNewExpenseBeneficiary('');
    setNewExpenseDetails('');
    setExpenseFeedback(
      `Gasto "${cleanReason}" por $${cleanAmount.toFixed(2)} (Fact. ${cleanInvoice || 'S/N'}) registrado y descontado en Egresos.`
    );
  };

  const handleDeleteGeneralExpense = (expenseId: string) => {
    const target = (state.generalExpenses || []).find((g) => g.id === expenseId);
    setState((prev) => ({
      ...prev,
      generalExpenses: (prev.generalExpenses || []).filter((g) => g.id !== expenseId),
      transactions: prev.transactions.filter((t) => t.id !== `tx-gexp-${expenseId}`),
    }));
    if (target) {
      setExpenseFeedback(`Gasto "${target.reason}" eliminado.`);
    }
  };

  const handleDeleteAffiliatedCustomer = (id: string) => {
    const target = (state.affiliatedCustomers || []).find((c) => c.id === id);
    setState((prev) => ({
      ...prev,
      affiliatedCustomers: (prev.affiliatedCustomers || []).filter((c) => c.id !== id),
    }));
    if (matchedCustomerId === id) {
      setMatchedCustomerId(null);
    }
    if (target) {
      setAffFeedback(`Cliente afiliado "${target.fullName}" eliminado.`);
    }
  };

  const invoiceDiscountAmount = useMemo(() => {
    if (appliedDiscountPct <= 0 || invoiceSubtotal <= 0) return 0;
    return Number(((invoiceSubtotal * appliedDiscountPct) / 100).toFixed(2));
  }, [appliedDiscountPct, invoiceSubtotal]);

  const invoiceFinalTotal = useMemo(() => {
    return Math.max(0, Number((invoiceSubtotal - invoiceDiscountAmount).toFixed(2)));
  }, [invoiceSubtotal, invoiceDiscountAmount]);

  const handleCompleteSale = (e: React.FormEvent) => {
    e.preventDefault();
    if (invoiceItems.length === 0 || invoiceSubtotal <= 0) return;

    const totalUnits = invoiceItems.reduce((s, i) => s + i.quantity, 0);
    const refNumber = `VTA-${Math.floor(1050 + Math.random() * 8900)}`;

    const cleanName = custFullName.trim();
    const cleanId = custTaxOrId.trim();
    const cleanAddr = custAddress.trim();
    const cleanPhone = custPhone.trim();

    let updatedAffiliates = state.affiliatedCustomers || [];
    if (customInvoiceMode && (cleanName || cleanId || cleanPhone)) {
      const displayName = cleanName || `Cliente ${cleanId || cleanPhone}`;
      const existingIdx = updatedAffiliates.findIndex(
        (c) =>
          (cleanId && c.taxOrId.toLowerCase() === cleanId.toLowerCase()) ||
          (cleanPhone && c.phone.toLowerCase() === cleanPhone.toLowerCase()) ||
          c.fullName.toLowerCase() === displayName.toLowerCase()
      );
      if (existingIdx >= 0) {
        updatedAffiliates = updatedAffiliates.map((c, idx) =>
          idx === existingIdx
            ? {
                ...c,
                fullName: displayName,
                taxOrId: cleanId || c.taxOrId,
                address: cleanAddr || c.address,
                phone: cleanPhone || c.phone,
              }
            : c
        );
      } else {
        updatedAffiliates = [
          {
            id: `aff-${Date.now()}`,
            fullName: displayName,
            taxOrId: cleanId,
            address: cleanAddr,
            phone: cleanPhone,
            createdAt: new Date().toISOString().slice(0, 10),
          },
          ...updatedAffiliates,
        ];
      }
    }

    const noteText = customInvoiceMode
      ? cleanName ||
        (cleanId ? `Cliente (${cleanId})` : '') ||
        (invoiceItems.length === 1
          ? `${invoiceItems[0].name} (x${invoiceItems[0].quantity})`
          : `Factura POS (${totalUnits} artículos)`)
      : 'Cliente General';

    const selectedPmObj = state.paymentMethods.find((pm) => pm.name === invoicePaymentType);
    const cashActive = isCashPaymentMethod(invoicePaymentType, selectedPmObj?.accountCategory);
    const resolvedAccountId = resolveAccountIdForCategory(
      state.accounts,
      selectedPmObj?.accountCategory || (cashActive ? 'Efectivo' : 'Cuenta Principal'),
      invoiceAccountId
    );
    const effectivePaymentLabel = cashActive
      ? `${invoicePaymentType} (${invoiceCashType})`
      : invoicePaymentType;

    const finalChargeTotal = invoiceFinalTotal;
    const parsedInitialPaid = isCreditSale
      ? Math.min(finalChargeTotal, Math.max(0, parseFloat(creditInitialPaidDraft) || 0))
      : finalChargeTotal;
    const pendingCreditBalance = isCreditSale
      ? Math.max(0, Number((finalChargeTotal - parsedInitialPaid).toFixed(2)))
      : 0;
    const creditLabel = isCreditSale
      ? pendingCreditBalance > 0
        ? `Crédito / Fiado (${effectivePaymentLabel})`
        : `Crédito Pagado (${effectivePaymentLabel})`
      : effectivePaymentLabel;

    const newSale: SaleRecord = {
      id: `s-${Date.now()}`,
      date: new Date().toISOString().slice(0, 10),
      reference: refNumber,
      customerOrNote: noteText,
      paymentType: creditLabel,
      cashType: cashActive ? invoiceCashType : undefined,
      currency: invoiceCurrency,
      total: finalChargeTotal,
      isCredit: isCreditSale,
      creditStatus: isCreditSale ? (pendingCreditBalance > 0 ? 'Pendiente' : 'Pagado') : 'Pagado',
      amountPaid: Number(parsedInitialPaid.toFixed(2)),
      balanceDue: pendingCreditBalance,
      discountPercent: appliedDiscountPct > 0 ? appliedDiscountPct : undefined,
      discountAmount: invoiceDiscountAmount > 0 ? invoiceDiscountAmount : undefined,
      items: invoiceItems,
      customerDetails: customInvoiceMode
        ? {
            isCustom: true,
            fullName: cleanName || noteText,
            taxOrId: cleanId,
            address: cleanAddr,
            phone: cleanPhone,
          }
        : {
            isCustom: false,
            fullName: 'Cliente General',
          },
    };

    const newTx: Transaction = {
      id: `tx-sale-${Date.now()}`,
      date: newSale.date,
      merchant: isCreditSale
        ? `Factura Crédito/Fiado ${refNumber} — ${noteText} (Total $${finalChargeTotal.toFixed(2)}, Abono $${parsedInitialPaid.toFixed(2)}, Pendiente $${pendingCreditBalance.toFixed(2)})`
        : `Venta ${refNumber} — ${noteText} [${effectivePaymentLabel}]${appliedDiscountPct > 0 ? ` (Desc. ${appliedDiscountPct}%)` : ''}`,
      amount: Math.abs(parsedInitialPaid),
      categoryId: 'cat-income',
      accountId: resolvedAccountId,
    };

    setState((prev) => ({
      ...prev,
      affiliatedCustomers: updatedAffiliates,
      sales: [newSale, ...prev.sales],
      transactions: [newTx, ...prev.transactions],
      products: prev.products.map((prod) => {
        const soldItem = invoiceItems.find((i) => i.productId === prod.id);
        if (!soldItem) return prod;
        return {
          ...prod,
          stock: Math.max(0, prod.stock - soldItem.quantity),
        };
      }),
    }));

    setInvoiceItems([]);
    setInvoiceNote('Cliente General');
    setCustomInvoiceMode(false);
    setCustFullName('');
    setCustTaxOrId('');
    setCustAddress('');
    setCustPhone('');
    setMatchedCustomerId(null);
    setPosScanFeedback(null);
    setPosLowStockAlert(false);
    setAppliedDiscountPct(0);
    setDiscountPercentDraft('');
    setDiscountAuthPinInput('');
    setDiscountError(null);
    setDiscountSuccessMsg(null);
    setIsCreditSale(false);
    setCreditInitialPaidDraft('0');
    setLastSaleBanner(
      isCreditSale
        ? `Factura a crédito/fiado (${refNumber}) emitida por $${finalChargeTotal.toFixed(2)} (Pendiente: $${pendingCreditBalance.toFixed(2)}) · Inventario descontado.`
        : `Cobro registrado (${refNumber}) por $${finalChargeTotal.toFixed(2)}${
            appliedDiscountPct > 0 ? ` (Descuento ${appliedDiscountPct}%: -$${invoiceDiscountAmount.toFixed(2)})` : ''
          } · Inventario descontado.`
    );
    posInputRef.current?.focus();
  };

  const handleAddTransaction = (e: React.FormEvent) => {
    e.preventDefault();
    const numeric = parseFloat(txAmount);
    if (!txMerchant.trim() || isNaN(numeric) || numeric <= 0) return;

    let finalCategory = txCategory;
    const matchedRule = state.rules.find((r) =>
      txMerchant.toLowerCase().includes(r.keyword.toLowerCase())
    );
    if (matchedRule) {
      finalCategory = matchedRule.categoryId;
    }

    const newTx: Transaction = {
      id: `tx-${Date.now()}`,
      date: txDate,
      merchant: txMerchant.trim(),
      amount: txType === 'expense' ? -Math.abs(numeric) : Math.abs(numeric),
      categoryId: txType === 'income' ? 'cat-income' : finalCategory,
      accountId: txAccount,
    };

    setState((prev) => ({
      ...prev,
      transactions: [newTx, ...prev.transactions],
    }));

    setTxMerchant('');
    setTxAmount('');
    setIsAddTxOpen(false);
  };

  const handleCategoryChange = (txId: string, newCategoryId: string) => {
    setState((prev) => ({
      ...prev,
      transactions: prev.transactions.map((t) =>
        t.id === txId ? { ...t, categoryId: newCategoryId } : t
      ),
    }));
  };

  const handleAddBlock = (type: BlockType, title: string, span: 1 | 2) => {
    const newBlock: DashboardBlock = {
      id: `b-${Date.now()}`,
      type,
      title,
      span,
    };
    setState((prev) => ({
      ...prev,
      pages: prev.pages.map((p) =>
        p.id === activePage.id ? { ...p, blocks: [...p.blocks, newBlock] } : p
      ),
    }));
    setIsAddBlockOpen(false);
  };

  const handleRemoveBlock = (blockId: string) => {
    setState((prev) => ({
      ...prev,
      pages: prev.pages.map((p) =>
        p.id === activePage.id ? { ...p, blocks: p.blocks.filter((b) => b.id !== blockId) } : p
      ),
    }));
  };

  const handleToggleSpan = (blockId: string) => {
    setState((prev) => ({
      ...prev,
      pages: prev.pages.map((p) =>
        p.id === activePage.id
          ? {
              ...p,
              blocks: p.blocks.map((b) =>
                b.id === blockId ? { ...b, span: b.span === 1 ? 2 : 1 } : b
              ),
            }
          : p
      ),
    }));
  };

  const currentOperator = useMemo(() => {
    const list = state.operatorAccounts || DEFAULT_STATE.operatorAccounts;
    return (
      list.find((o) => o.id === state.currentOperatorId && o.active) ||
      list.find((o) => o.id === state.currentOperatorId) ||
      list.find((o) => o.active) ||
      list[0]
    );
  }, [state.operatorAccounts, state.currentOperatorId]);

  const currentRole = normalizeOperatorRole(currentOperator?.role);
  const currentPermissions = useMemo(
    () => getEffectiveOperatorPermissions(currentOperator),
    [currentOperator]
  );
  const canManageOperators = currentRole === 'Administrador';

  const hasPermission = (perm: OperatorPermissionKey): boolean => {
    if (currentRole === 'Administrador') return true;
    return currentPermissions.includes(perm);
  };

  const activeRateValue = activeRateCurrency?.rateToUsd ?? 1;
  const activeRateSymbol = activeRateCurrency?.symbol ?? '';

  const handleCopilotSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!copilotInput.trim()) return;
    const query = copilotInput.trim();
    const userMsg = { role: 'user' as const, text: query };

    let reply = '';
    const lower = query.toLowerCase();

    const totalSalesCount = (state.sales || []).length;
    const totalSalesUsd = (state.sales || []).reduce((acc, s) => acc + Number(s.total || 0), 0);
    const totalExpensesCount = (state.generalExpenses || []).length;
    const totalExpensesUsd = (state.generalExpenses || []).reduce((acc, g) => acc + Number(g.amount || 0), 0);
    const activePmNames = (state.paymentMethods || []).filter((p) => p.active).map((p) => p.name).join(', ') || 'Ninguno';
    const currentOpName = currentOperator?.operatorName || 'Administrador';
    const currentOpRole = currentRole;

    if (lower.startsWith('regla ')) {
      const parts = query.replace(/^regla\s+/i, '').split('->');
      if (parts.length === 2) {
        const kw = parts[0].trim();
        const catName = parts[1].trim().toLowerCase();
        const foundCat = state.categories.find((c) => c.name.toLowerCase().includes(catName));
        if (foundCat) {
          setState((prev) => ({
            ...prev,
            rules: [...prev.rules, { id: `rule-${Date.now()}`, keyword: kw, categoryId: foundCat.id }],
            transactions: prev.transactions.map((t) =>
              t.merchant.toLowerCase().includes(kw.toLowerCase()) ? { ...t, categoryId: foundCat.id } : t
            ),
          }));
          reply = `Regla creada: todo movimiento con "${kw}" se asignará a ${foundCat.name}.`;
        } else {
          reply = `No encontré la categoría "${parts[1].trim()}". Usa una existente como Alimentación, Transporte u Ocio.`;
        }
      } else {
        reply = 'Formato esperado: regla palabra -> categoría (ej. regla farmacia -> Alimentación).';
      }
    } else if (lower.includes('venta') || lower.includes('factur') || lower.includes('pos') || lower.includes('cobro')) {
      reply = `Ventas y facturación: tienes ${totalSalesCount} venta(s) registradas por $${totalSalesUsd.toFixed(2)}. En el menú lateral > Panel de Opciones > Ventas puedes facturar, aplicar descuentos con PIN o manejar crédito/Cashea. Métodos activos: ${activePmNames}.`;
    } else if (lower.includes('gasto') || lower.includes('gastado') || lower.includes('egreso')) {
      reply = `Gastos y movimientos: en el tablero actual tienes gastos por $${metrics.expense.toFixed(2)} e ingresos por $${metrics.income.toFixed(2)}. En Gastos Generales llevas ${totalExpensesCount} registro(s) ($${totalExpensesUsd.toFixed(2)}). También puedes consultar el desglose en Centro de Reportes > Gastos.`;
    } else if (lower.includes('saldo') || lower.includes('balance') || lower.includes('tasa') || lower.includes('cambio')) {
      reply = `Balance y tasa: tu balance neto actual es de $${metrics.balance.toFixed(2)} y la tasa activa es ${activeRateValue.toFixed(2)} ${activeRateSymbol || 'Bs.'}/USD. Puedes actualizar tasas en Panel de Opciones > Tasa de Cambio.`;
    } else if (lower.includes('excel') || lower.includes('libro') || lower.includes('contabilidad') || lower.includes('reporte')) {
      reply = `Contabilidad, Excel y Reportes: los registros se sincronizan en data/genesis_libro_general.xlsx (y con el enlace "Libro Excel (.xlsx)"). En ESPACIOS tienes "Libro de Contabilidad" (solo lectura, con Vista Previa, Guardar e Imprimir) y "Centro de Reportes" (Reporte Simple y Reporte Detallado para Ventas, Compras y Gastos).`;
    } else if (lower.includes('restaur') || lower.includes('0512') || lower.includes('operador') || lower.includes('permiso') || lower.includes('ayuda') || lower.includes('como') || lower.includes('cómo')) {
      reply = `Guía para operador (${currentOpName} · ${currentOpRole}): usa ESPACIOS para Resumen General, Control Operativo, Documentos SENIAT, Cashea, Libro de Contabilidad y Centro de Reportes. En Panel de Opciones gestionas Ventas, Productos, Proveedores, Clientes, Gastos Generales, Cierres de Caja y Tasa de Cambio. La restauración del sistema requiere la llave maestra del creador.`;
    } else {
      reply = `Hola ${currentOpName} (${currentOpRole}): analicé ${filteredTransactions.length} movimiento(s) del día, ${totalSalesCount} venta(s) ($${totalSalesUsd.toFixed(2)}) y balance de $${metrics.balance.toFixed(2)}. Pregúntame sobre ventas, gastos, tasas, reportes, libro de contabilidad, Excel o escribe "regla palabra -> categoría".`;
    }

    setCopilotMessages((prev) => [...prev, userMsg, { role: 'ai', text: reply }]);
    setCopilotInput('');
  };

  const handleExportJson = () => {
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `genesis-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
  };

  const MASTER_RESTORE_KEY = '0512';
  const [isMasterRestoreModalOpen, setIsMasterRestoreModalOpen] = useState(false);
  const [masterRestoreKeyInput, setMasterRestoreKeyInput] = useState('');
  const [masterRestoreError, setMasterRestoreError] = useState<string | null>(null);

  const handleConfirmMasterRestore = (e: React.FormEvent) => {
    e.preventDefault();
    if (masterRestoreKeyInput.trim() !== MASTER_RESTORE_KEY) {
      setMasterRestoreError('Llave maestra incorrecta.');
      return;
    }
    const wipedState: GenesisState = {
      ...DEFAULT_STATE,
      accounts: DEFAULT_STATE.accounts.map((a) => ({ ...a, initialBalance: 0 })),
      transactions: [],
      sales: [],
      products: [],
      suppliers: [],
      generalExpenses: [],
      cashClosings: [],
      affiliatedCustomers: [],
      auditLog: [],
      creditNotes: [],
      receivables: [],
      payables: [],
      invoiceTemplate: {
        ...DEFAULT_STATE.invoiceTemplate,
        businessName: '',
        taxId: '',
        address: '',
        phone: '',
        email: '',
        footerNote: '',
      },
      currentOperatorId: 'op-1',
    };
    try {
      const keysToRemove: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && k.startsWith('genesis_')) keysToRemove.push(k);
      }
      keysToRemove.forEach((k) => localStorage.removeItem(k));
      const serialized = JSON.stringify(wipedState);
      localStorage.setItem(STORAGE_KEY, serialized);
      localStorage.setItem('genesis_app_v12_state', serialized);
      window.dispatchEvent(new StorageEvent('storage', { key: STORAGE_KEY }));
    } catch {}
    setState(wipedState);
    const drafts: Record<string, string> = {};
    wipedState.currencies.forEach((c) => {
      drafts[c.id] = String(c.rateToUsd);
    });
    setRateDrafts(drafts);
    setInvoiceItems([]);
    setActiveViewMode('dashboard');
    setMasterRestoreKeyInput('');
    setMasterRestoreError(null);
    setIsMasterRestoreModalOpen(false);
    setStartupOpId('op-1');
    setStartupPasswordInput('');
    setStartupLoginError(null);
    setIsStartupLoginOpen(true);
    window.setTimeout(() => {
      void syncBcvRateNow(true);
    }, 150);
  };

  const handleTogglePaymentMethod = (id: string) => {
    setState((prev) => ({
      ...prev,
      paymentMethods: prev.paymentMethods.map((pm) =>
        pm.id === id ? { ...pm, active: !pm.active } : pm
      ),
    }));
  };

  const handleAddPaymentMethod = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanName = newPmName.trim();
    if (!cleanName) return;

    const feeNum = parseFloat(newPmFee);
    const cleanFee = isNaN(feeNum) || feeNum < 0 ? 0 : Number(feeNum.toFixed(2));
    const cleanChannel = newPmChannel.trim() || 'Personalizado';

    const newItem = {
      id: `pm-${Date.now()}`,
      name: cleanName,
      channel: cleanChannel,
      feePercent: cleanFee,
      active: true,
      accountCategory: newPmCategory,
    };

    setState((prev) => {
      const updatedMethods = [...prev.paymentMethods, newItem];
      return {
        ...prev,
        paymentMethods: updatedMethods,
      };
    });

    setInvoicePaymentType(cleanName);
    setNewPmName('');
    setNewPmChannel('Personalizado');
    setNewPmCategory('Cuenta Principal');
    setNewPmFee('0');
    setPmFeedback(`Método de pago "${cleanName}" vinculado a ${newPmCategory}.`);
  };

  const handleChangePaymentMethodCategory = (id: string, category: PaymentAccountCategory) => {
    setState((prev) => ({
      ...prev,
      paymentMethods: prev.paymentMethods.map((pm) =>
        pm.id === id ? { ...pm, accountCategory: category } : pm
      ),
    }));
  };

  const handleDeletePaymentMethod = (id: string) => {
    const target = state.paymentMethods.find((pm) => pm.id === id);
    setState((prev) => {
      const remaining = prev.paymentMethods.filter((pm) => pm.id !== id);
      if (invoicePaymentType === target?.name) {
        const nextActive = remaining.find((m) => m.active) || remaining[0];
        setInvoicePaymentType(nextActive ? nextActive.name : '');
      }
      return {
        ...prev,
        paymentMethods: remaining,
      };
    });
    if (target) {
      setPmFeedback(`Método de pago "${target.name}" eliminado.`);
    }
  };

  const handleOpenEditPaymentMethod = (pm: {
    id: string;
    name: string;
    channel: string;
    feePercent: number;
    active: boolean;
    accountCategory?: PaymentAccountCategory;
  }) => {
    setPmFeedback(null);
    setEditingPmId(pm.id);
    setEditPmName(pm.name);
    setEditPmCategory(pm.accountCategory || 'Cuenta Principal');
    setEditPmChannel(pm.channel || 'Personalizado');
    setEditPmFee(String(pm.feePercent ?? 0));
    setEditPmActive(Boolean(pm.active));
  };

  const handleSaveEditedPaymentMethod = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingPmId) return;

    const cleanName = editPmName.trim();
    if (!cleanName) return;

    const feeNum = parseFloat(editPmFee);
    const cleanFee = isNaN(feeNum) || feeNum < 0 ? 0 : Number(feeNum.toFixed(2));
    const cleanChannel = editPmChannel.trim() || 'Personalizado';
    const previousPm = state.paymentMethods.find((p) => p.id === editingPmId);

    setState((prev) => {
      const exists = prev.paymentMethods.some((pm) => pm.id === editingPmId);
      const updated = exists
        ? prev.paymentMethods.map((pm) =>
            pm.id === editingPmId
              ? {
                  ...pm,
                  name: cleanName,
                  accountCategory: editPmCategory,
                  channel: cleanChannel,
                  feePercent: cleanFee,
                  active: editPmActive,
                }
              : pm
          )
        : [
            ...prev.paymentMethods,
            {
              id: editingPmId,
              name: cleanName,
              accountCategory: editPmCategory,
              channel: cleanChannel,
              feePercent: cleanFee,
              active: editPmActive,
            },
          ];
      return {
        ...prev,
        paymentMethods: updated,
      };
    });

    if (previousPm && invoicePaymentType === previousPm.name) {
      setInvoicePaymentType(editPmActive ? cleanName : '');
    }

    setPmFeedback(`Método de pago "${cleanName}" actualizado (${editPmCategory}).`);
    setEditingPmId(null);
  };

  const handleToggleOperatorStatus = (id: string) => {
    setState((prev) => ({
      ...prev,
      operatorAccounts: prev.operatorAccounts.map((op) =>
        op.id === id ? { ...op, active: !op.active } : op
      ),
    }));
  };


  useEffect(() => {
    if (!loaded) return;
    if (activeViewMode === 'dashboard' && !hasPermission('dashboard')) {
      const firstAllowedOp = ALL_OPERATOR_PERMISSIONS.find(
        (p) => p.group === 'operations' && hasPermission(p.key)
      );
      if (firstAllowedOp) {
        setState((prev) => ({ ...prev, operationsSection: firstAllowedOp.key as OperationsSubSection }));
        setActiveViewMode('operations');
      }
    } else if (activeViewMode === 'operations' && !hasPermission(state.operationsSection)) {
      if (hasPermission('ventas')) {
        setState((prev) => ({ ...prev, operationsSection: 'ventas' }));
        setIsSalesWindowModalOpen(true);
      } else if (hasPermission('dashboard')) {
        setActiveViewMode('dashboard');
      } else {
        const firstAllowedOp = ALL_OPERATOR_PERMISSIONS.find(
          (p) => p.group === 'operations' && hasPermission(p.key)
        );
        if (firstAllowedOp) {
          setState((prev) => ({ ...prev, operationsSection: firstAllowedOp.key as OperationsSubSection }));
        }
      }
    }
  }, [loaded, activeViewMode, state.operationsSection, state.currentOperatorId, state.operatorAccounts]);

  const handleCreateOperator = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canManageOperators) {
      setOpFeedback('Solo el rol Administrador puede crear operadores y asignar permisos.');
      return;
    }
    const cleanName = newOpName.trim();
    if (!cleanName) return;

    const permsToSave: OperatorPermissionKey[] =
      newOpRole === 'Administrador'
        ? ROLE_DEFAULT_PERMISSIONS.Administrador
        : newOpPermissions.length > 0
        ? Array.from(new Set(newOpPermissions))
        : ['ventas'];

    const currentCommerce = (state.invoiceTemplate?.businessName || '').trim() || undefined;
    const newOp: OperatorAccountItem = {
      id: `op-${Date.now()}`,
      operatorName: cleanName,
      role: newOpRole,
      assignedAccount: newOpAccount || 'Cuenta Principal',
      active: true,
      permissions: permsToSave,
      pin: newOpPin.trim() || undefined,
      commerceName: currentCommerce,
    };

    setState((prev) => ({
      ...prev,
      operatorAccounts: [...prev.operatorAccounts, newOp],
    }));

    setNewOpName('');
    setNewOpPin('');
    setNewOpRole('Operador');
    setNewOpPermissions(['ventas']);
    setOpFeedback(
      `Operador "${cleanName}" (${newOpRole}) creado con ${
        newOpRole === 'Administrador' ? 'todos los permisos' : `${permsToSave.length} permiso(s) asignado(s)`
      }.`
    );
  };

  const handleOpenEditOperator = (op: OperatorAccountItem) => {
    if (!canManageOperators) return;
    setOpFeedback(null);
    const normRole = normalizeOperatorRole(op.role);
    setEditingOpId(op.id);
    setEditOpName(op.operatorName);
    setEditOpRole(normRole);
    setEditOpAccount(op.assignedAccount || 'Cuenta Principal');
    setEditOpPin(op.pin || '');
    setEditOpActive(Boolean(op.active));
    setEditOpPermissions(
      normRole === 'Administrador'
        ? ROLE_DEFAULT_PERMISSIONS.Administrador
        : getEffectiveOperatorPermissions(op)
    );
  };

  const handleSaveEditedOperator = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canManageOperators || !editingOpId) return;
    const cleanName = editOpName.trim();
    if (!cleanName) return;

    const permsToSave: OperatorPermissionKey[] =
      editOpRole === 'Administrador'
        ? ROLE_DEFAULT_PERMISSIONS.Administrador
        : editOpPermissions.length > 0
        ? Array.from(new Set(editOpPermissions))
        : ['ventas'];

    setState((prev) => ({
      ...prev,
      operatorAccounts: prev.operatorAccounts.map((op) =>
        op.id === editingOpId
          ? {
              ...op,
              operatorName: cleanName,
              role: editOpRole,
              assignedAccount: editOpAccount || 'Cuenta Principal',
              active: editOpActive,
              permissions: permsToSave,
              pin: editOpPin.trim() || undefined,
            }
          : op
      ),
    }));

    setOpFeedback(`Operador "${cleanName}" actualizado (${editOpRole}).`);
    setEditingOpId(null);
  };

  const handleDeleteOperator = (id: string) => {
    if (!canManageOperators) return;
    if (state.operatorAccounts.length <= 1) {
      setOpFeedback('Debe existir al menos una cuenta de operador en el sistema.');
      return;
    }
    const target = state.operatorAccounts.find((o) => o.id === id);
    setState((prev) => {
      const remaining = prev.operatorAccounts.filter((o) => o.id !== id);
      const nextCurrent =
        prev.currentOperatorId === id
          ? (remaining.find((o) => o.active) || remaining[0])?.id
          : prev.currentOperatorId;
      return {
        ...prev,
        operatorAccounts: remaining,
        currentOperatorId: nextCurrent,
      };
    });
    if (target) {
      setOpFeedback(`Operador "${target.operatorName}" eliminado.`);
    }
  };

  const handleSwitchOperatorSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const targetOp = state.operatorAccounts.find((o) => o.id === loginSelectedOpId);
    if (!targetOp) return;
    if (!targetOp.active) {
      setLoginError('Esta cuenta de operador está inactiva. Un Administrador debe activarla.');
      return;
    }
    if (targetOp.pin && targetOp.pin.trim() !== loginPinInput.trim()) {
      setLoginError('PIN incorrecto para este operador.');
      return;
    }

    const perms = getEffectiveOperatorPermissions(targetOp);
    const activeCommerceName = (targetOp.commerceName || state.invoiceTemplate?.businessName || '').trim() || undefined;
    setState((prev) => {
      const nextOps = prev.operatorAccounts.map((op) =>
        op.id === targetOp.id && !op.commerceName && activeCommerceName
          ? { ...op, commerceName: activeCommerceName }
          : op
      );
      const next: GenesisState = {
        ...prev,
        operatorAccounts: nextOps,
        currentOperatorId: targetOp.id,
        invoiceTemplate: activeCommerceName
          ? {
              ...(prev.invoiceTemplate || DEFAULT_STATE.invoiceTemplate),
              businessName: activeCommerceName,
            }
          : prev.invoiceTemplate,
      };
      if (normalizeOperatorRole(targetOp.role) !== 'Administrador') {
        if (!perms.includes('dashboard') && perms.includes(prev.operationsSection)) {
          setActiveViewMode('operations');
          if (prev.operationsSection === 'ventas') {
            setIsSalesWindowModalOpen(true);
          }
        } else if (!perms.includes('dashboard')) {
          const firstOp = ALL_OPERATOR_PERMISSIONS.find(
            (p) => p.group === 'operations' && perms.includes(p.key)
          );
          if (firstOp) {
            next.operationsSection = firstOp.key as OperationsSubSection;
            setActiveViewMode('operations');
            if (firstOp.key === 'ventas') {
              setIsSalesWindowModalOpen(true);
            }
          }
        }
      }
      return next;
    });

    setIsSwitchOperatorOpen(false);
    setLoginPinInput('');
    setLoginError(null);
  };

  const getAuthorizedAdminDiscountPins = (): string[] => {
    const pins: string[] = [];
    if (state.adminDiscountPin && state.adminDiscountPin.trim()) {
      pins.push(state.adminDiscountPin.trim());
    }
    (state.operatorAccounts || []).forEach((op) => {
      if (normalizeOperatorRole(op.role) === 'Administrador' && op.pin && op.pin.trim()) {
        pins.push(op.pin.trim());
      }
    });
    return Array.from(new Set(pins));
  };

  const handleSaveAdminDiscountPin = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canManageOperators) return;
    const cleanPin = adminPinDraft.trim();
    if (!cleanPin) {
      setAdminPinMsg('Ingresa una clave de administrador válida.');
      return;
    }
    setState((prev) => ({
      ...prev,
      adminDiscountPin: cleanPin,
      operatorAccounts: prev.operatorAccounts.map((op) =>
        op.id === 'op-1' || normalizeOperatorRole(op.role) === 'Administrador'
          ? { ...op, pin: cleanPin }
          : op
      ),
    }));
    setAdminPinMsg('Clave de administrador para descuentos guardada correctamente.');
  };

  const handleApplyInvoiceDiscount = (e: React.FormEvent) => {
    e.preventDefault();
    setDiscountError(null);
    setDiscountSuccessMsg(null);
    const pct = parseFloat(discountPercentDraft);
    if (isNaN(pct) || pct <= 0 || pct > 100) {
      setDiscountError('Ingresa un porcentaje válido mayor a 0 y hasta 100%.');
      return;
    }
    const validPins = getAuthorizedAdminDiscountPins();
    if (validPins.length === 0) {
      setDiscountError('Primero configura una clave de administrador en Cuentas de operadores.');
      return;
    }
    if (!validPins.includes(discountAuthPinInput.trim())) {
      setDiscountError('Clave de administrador incorrecta. No se aplicó el descuento.');
      return;
    }
    setAppliedDiscountPct(Number(pct.toFixed(2)));
    setDiscountAuthPinInput('');
    setDiscountSuccessMsg(`Descuento de ${Number(pct.toFixed(2))}% autorizado y aplicado.`);
  };

  const handleClearInvoiceDiscount = () => {
    setAppliedDiscountPct(0);
    setDiscountPercentDraft('');
    setDiscountAuthPinInput('');
    setDiscountError(null);
    setDiscountSuccessMsg(null);
  };


  const handleSettleCreditSale = (saleId: string) => {
    setState((prev) => {
      const target = prev.sales.find((s) => s.id === saleId);
      if (!target || !target.isCredit || target.creditStatus === 'Pagado') return prev;
      const pending = target.balanceDue ?? Math.max(0, target.total - (target.amountPaid ?? 0));
      if (pending <= 0) return prev;
      const settleTx: Transaction = {
        id: `tx-abono-${Date.now()}`,
        date: new Date().toISOString().slice(0, 10),
        merchant: `Abono / Pago Crédito ${target.reference} — ${target.customerOrNote}`,
        amount: Math.abs(pending),
        categoryId: 'cat-income',
        accountId: 'acc-1',
      };
      return {
        ...prev,
        transactions: [settleTx, ...prev.transactions],
        sales: prev.sales.map((s) =>
          s.id === saleId
            ? {
                ...s,
                creditStatus: 'Pagado',
                amountPaid: s.total,
                balanceDue: 0,
              }
            : s
        ),
      };
    });
  };

  const handlePayCasheaInstallment = (
    saleId: string,
    installmentNumber: number,
    amountToPay: number,
    dueDate: string
  ) => {
    const cleanAmount = Math.max(0, Number(amountToPay.toFixed(2)));
    if (cleanAmount <= 0) return;

    setState((prev) => {
      const target = prev.sales.find((s) => s.id === saleId);
      if (!target) return prev;
      const currentPending =
        target.creditStatus === 'Pagado'
          ? 0
          : target.balanceDue ?? Math.max(0, (target.total || 0) - (target.amountPaid ?? 0));
      const actualPaid = Math.min(currentPending > 0 ? currentPending : cleanAmount, cleanAmount);
      if (actualPaid <= 0) return prev;

      const nextBalance = Math.max(0, Number((currentPending - actualPaid).toFixed(2)));
      const nextAmountPaid = Number(((target.amountPaid ?? 0) + actualPaid).toFixed(2));
      const nextStatus: 'Pendiente' | 'Pagado' = nextBalance <= 0.009 ? 'Pagado' : 'Pendiente';

      const incomeTx: Transaction = {
        id: `tx-cashea-cuota-${saleId}-c${installmentNumber}-${Date.now()}`,
        date: new Date().toISOString().slice(0, 10),
        merchant: `Cuota ${installmentNumber} Cashea (${dueDate}) · Factura ${target.reference} — ${target.customerDetails?.fullName || target.customerOrNote}`,
        amount: Math.abs(actualPaid),
        categoryId: 'cat-income',
        accountId: 'acc-1',
      };

      return {
        ...prev,
        transactions: [incomeTx, ...prev.transactions],
        sales: prev.sales.map((s) =>
          s.id === saleId
            ? {
                ...s,
                isCredit: true,
                creditStatus: nextStatus,
                amountPaid: nextAmountPaid,
                balanceDue: nextBalance,
              }
            : s
        ),
      };
    });

    setPaidCasheaInstallments((prev) => {
      const existing = prev[saleId] || [];
      if (existing.includes(installmentNumber)) return prev;
      return {
        ...prev,
        [saleId]: [...existing, installmentNumber],
      };
    });
  };

  if (!loaded) return null;

  const isDark = state.darkMode;
  const q = opsSearchQuery.trim().toLowerCase();

  return (
    <div className={`min-h-screen flex ${isDark ? 'bg-[#0F1115] text-gray-100' : 'bg-[#EEF2FA] text-slate-900'} font-sans`}>
      <aside className={`w-64 h-screen sticky top-0 max-h-screen overflow-hidden border-r flex flex-col justify-between p-4 shrink-0 ${isDark ? 'border-gray-800 bg-[#14171D]' : 'border-indigo-200/70 bg-gradient-to-b from-[#E6ECFA] via-[#EDF2FC] to-[#E3EBF9]'}`}>
        <div className="flex-1 min-h-0 overflow-y-auto sidebar-scroll pr-1.5">
          <div className="flex items-center gap-2.5 px-2 py-2 mb-6">
            <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center text-white font-bold text-lg shadow-sm">
              G
            </div>
            <div>
              <h1 className="font-bold text-base tracking-tight leading-none">Génesis</h1>
              <span className="text-[11px] text-gray-500">Sistema Financiero</span>
            </div>
          </div>

          {hasPermission('dashboard') && (
            <div className="mb-5">
              <p className="px-2 text-[11px] font-semibold uppercase tracking-wider text-gray-400 mb-2">
                Espacios
              </p>
              <div className="space-y-1">
                {state.pages.map((page) => {
                  const isSelected = activeViewMode === 'dashboard' && activePage.id === page.id;
                  return (
                    <button
                      key={page.id}
                      onClick={() => {
                        setIsSeniatSpaceActive(false);
                        setIsCasheaSpaceActive(false);
                        setIsAccountingBookActive(false);
                        setIsReportsSpaceActive(false);
                        setState((prev) => ({ ...prev, activePageId: page.id }));
                        setActiveViewMode('dashboard');
                      }}
                      className={`w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-sm font-medium transition ${
                        isSelected
                          ? isDark
                            ? 'bg-gray-800 text-white'
                            : 'bg-white text-gray-900 shadow-xs border border-gray-200'
                          : 'text-gray-500 hover:text-gray-900 dark:hover:text-gray-200'
                      }`}
                    >
                      <LayoutDashboard className="w-4 h-4 text-indigo-500" />
                      {page.title}
                    </button>
                  );
                })}
                <button
                  type="button"
                  onClick={() => {
                    setIsSeniatSpaceActive(true);
                    setIsCasheaSpaceActive(false);
                    setIsAccountingBookActive(false);
                    setIsReportsSpaceActive(false);
                    setActiveViewMode('dashboard');
                  }}
                  className={`w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-sm font-medium transition cursor-pointer ${
                    activeViewMode === 'dashboard' && isSeniatSpaceActive
                      ? isDark
                        ? 'bg-gray-800 text-white'
                        : 'bg-white text-gray-900 shadow-xs border border-gray-200'
                      : 'text-gray-500 hover:text-gray-900 dark:hover:text-gray-200'
                  }`}
                >
                  <Scale className="w-4 h-4 text-amber-400" />
                  Documentos SENIAT
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setIsCasheaSpaceActive(true);
                    setIsSeniatSpaceActive(false);
                    setIsAccountingBookActive(false);
                    setIsReportsSpaceActive(false);
                    setActiveViewMode('dashboard');
                  }}
                  className={`w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-sm font-medium transition cursor-pointer ${
                    activeViewMode === 'dashboard' && isCasheaSpaceActive
                      ? isDark
                        ? 'bg-gray-800 text-white'
                        : 'bg-white text-gray-900 shadow-xs border border-gray-200'
                      : 'text-gray-500 hover:text-gray-900 dark:hover:text-gray-200'
                  }`}
                >
                  <CreditCard className="w-4 h-4 text-emerald-400" />
                  Cashea
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setIsAccountingBookActive(true);
                    setIsSeniatSpaceActive(false);
                    setIsCasheaSpaceActive(false);
                    setIsReportsSpaceActive(false);
                    setActiveViewMode('dashboard');
                  }}
                  className={`w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-sm font-medium transition cursor-pointer ${
                    activeViewMode === 'dashboard' && isAccountingBookActive
                      ? isDark
                        ? 'bg-gray-800 text-white'
                        : 'bg-white text-gray-900 shadow-xs border border-gray-200'
                      : 'text-gray-500 hover:text-gray-900 dark:hover:text-gray-200'
                  }`}
                >
                  <Wallet className="w-4 h-4 text-indigo-400" />
                  Libro de Contabilidad
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setIsReportsSpaceActive(true);
                    setIsAccountingBookActive(false);
                    setIsSeniatSpaceActive(false);
                    setIsCasheaSpaceActive(false);
                    setActiveViewMode('dashboard');
                  }}
                  className={`w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-sm font-medium transition cursor-pointer ${
                    activeViewMode === 'dashboard' && isReportsSpaceActive
                      ? isDark
                        ? 'bg-gray-800 text-white'
                        : 'bg-white text-gray-900 shadow-xs border border-gray-200'
                      : 'text-gray-500 hover:text-gray-900 dark:hover:text-gray-200'
                  }`}
                >
                  <BarChart3 className="w-4 h-4 text-sky-400" />
                  Centro de Reportes
                </button>
              </div>
            </div>
          )}

          <div className="mb-5">
            <button
              type="button"
              onClick={() => setIsOptionsMenuOpen((prev) => !prev)}
              className="w-full flex items-center justify-between px-2 py-1 text-[11px] font-semibold uppercase tracking-wider text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition"
              aria-expanded={isOptionsMenuOpen}
            >
              <span>Panel de Opciones</span>
              {isOptionsMenuOpen ? (
                <ChevronDown className="w-3.5 h-3.5" />
              ) : (
                <ChevronRight className="w-3.5 h-3.5" />
              )}
            </button>

            {isOptionsMenuOpen && (
              <div className="mt-1.5 space-y-0.5">
                {OPERATIONS_MENU.filter((item) => hasPermission(item.id)).map((item) => {
                  const Icon = item.icon;
                  const isActiveOp =
                    activeViewMode === 'operations' && state.operationsSection === item.id;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => handleSelectOperationsSection(item.id)}
                      className={`w-full flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-lg text-xs font-medium transition ${
                        isActiveOp
                          ? 'bg-indigo-600/12 text-indigo-500 font-semibold border border-indigo-500/30'
                          : 'text-gray-500 hover:bg-gray-200/40 dark:hover:bg-gray-800/40 hover:text-gray-900 dark:hover:text-gray-200'
                      }`}
                    >
                      <span className="flex items-center gap-2 truncate">
                        <Icon className="w-3.5 h-3.5 shrink-0 text-indigo-500/80" />
                        <span className="truncate">{item.label}</span>
                      </span>
                      {item.id === 'tasa_de_cambio' && activeRateCurrency && (
                        <span className="text-[10px] font-semibold tabular-nums px-1.5 py-0.5 rounded bg-indigo-500/10 text-indigo-500 shrink-0">
                          {activeRateCurrency.rateToUsd.toFixed(2)}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          <div>
            <p className="px-2 text-[11px] font-semibold uppercase tracking-wider text-gray-400 mb-2">
              Métodos de pago
            </p>
            <div className="space-y-1">
              <button
                type="button"
                onClick={() => {
                  setSelectedAccountId('all');
                  setSelectedPaymentMethodFilter('all');
                  setActiveViewMode('dashboard');
                }}
                className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs font-medium cursor-pointer ${
                  selectedPaymentMethodFilter === 'all' && selectedAccountId === 'all' && activeViewMode === 'dashboard'
                    ? 'bg-indigo-600/10 text-indigo-500'
                    : 'text-gray-500'
                }`}
              >
                <span className="flex items-center gap-1.5"><Wallet className="w-3.5 h-3.5" /> Todos los métodos</span>
              </button>
              {(state.paymentMethods || [])
                .filter((pm) => pm.active)
                .map((pm) => {
                  const pmLower = pm.name.toLowerCase();
                  const linkedAccId = resolveAccountIdForCategory(state.accounts, pm.accountCategory, 'acc-1');
                  const salesSum = (state.sales || [])
                    .filter((s) => String(s.paymentType || '').toLowerCase().includes(pmLower))
                    .reduce((sum, s) => sum + Number(s.total || 0), 0);
                  const txDirectSum = (state.transactions || [])
                    .filter((t) => t.merchant.toLowerCase().includes(pmLower))
                    .reduce((sum, t) => sum + Number(t.amount || 0), 0);
                  const accFallbackSum =
                    salesSum === 0 && txDirectSum === 0
                      ? (state.transactions || [])
                          .filter((t) => t.accountId === linkedAccId)
                          .reduce((sum, t) => sum + Number(t.amount || 0), 0)
                      : 0;
                  const total = salesSum > 0 || txDirectSum !== 0 ? salesSum + txDirectSum : accFallbackSum;
                  const isSelectedPm = selectedPaymentMethodFilter === pm.name && activeViewMode === 'dashboard';
                  return (
                    <button
                      key={pm.id}
                      type="button"
                      onClick={() => {
                        setSelectedAccountId('all');
                        setSelectedPaymentMethodFilter(pm.name);
                        setActiveViewMode('dashboard');
                      }}
                      className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs transition cursor-pointer ${
                        isSelectedPm
                          ? 'bg-indigo-600/10 text-indigo-500 font-semibold'
                          : 'text-gray-500 hover:bg-gray-200/40 dark:hover:bg-gray-800/40'
                      }`}
                    >
                      <span className="truncate">{pm.name}</span>
                      <span className="tabular-nums font-medium">${total.toFixed(0)}</span>
                    </button>
                  );
                })}
            </div>
          </div>
        </div>

        <div className="pt-4 border-t border-gray-200 dark:border-gray-800 space-y-1.5">
          <button
            onClick={handleExportJson}
            className="w-full flex items-center gap-2 px-2.5 py-1.5 text-xs text-gray-500 hover:text-gray-900 dark:hover:text-white rounded-md"
          >
            <Download className="w-3.5 h-3.5" /> Exportar respaldo
          </button>
          <a
            href="/api/excel-book"
            download="genesis_libro_general.xlsx"
            className="w-full flex items-center gap-2 px-2.5 py-1.5 text-xs text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/10 rounded-md font-medium"
          >
            <Download className="w-3.5 h-3.5" /> Libro Excel (.xlsx)
          </a>
          <button
            type="button"
            onClick={() => {
              setMasterRestoreKeyInput('');
              setMasterRestoreError(null);
              setIsMasterRestoreModalOpen(true);
            }}
            className="w-full flex items-center gap-2 px-2.5 py-1.5 text-xs text-gray-500 hover:text-amber-500 rounded-md cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" /> Restaurar Genesis app
          </button>

        </div>
      </aside>

      <main className="flex-1 flex flex-col min-w-0">
        <header className={`h-16 border-b px-6 flex items-center justify-between sticky top-0 z-10 backdrop-blur-md ${isDark ? 'border-gray-800 bg-[#0F1115]/90' : 'border-indigo-200/70 bg-[#EBF0FC]/90'}`}>
          <div className="flex items-center gap-3">
            <h2 className="text-lg font-semibold tracking-tight">
              {activeViewMode === 'dashboard'
                ? isReportsSpaceActive
                  ? 'Centro de Reportes'
                  : isAccountingBookActive
                  ? 'Libro de Contabilidad'
                  : isCasheaSpaceActive
                  ? 'Cashea — Control de Ventas y Cuotas'
                  : isSeniatSpaceActive
                  ? 'Documentos SENIAT'
                  : activePage.title
                : state.operationsSection === 'ventas'
                ? 'Ventas — Cobro y Facturación'
                : activeOpItem.label}
            </h2>
            <button
              type="button"
              onClick={() => {
                setLoginSelectedOpId(currentOperator?.id || state.operatorAccounts[0]?.id || '');
                setLoginPinInput('');
                setLoginError(null);
                setIsSwitchOperatorOpen(true);
              }}
              className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full bg-indigo-600/12 text-indigo-600 dark:text-indigo-300 border border-indigo-500/30 font-semibold hover:bg-indigo-600 hover:text-white transition cursor-pointer"
              title="Cambiar operador o iniciar sesión con permisos"
            >
              <span>{currentOperator?.operatorName || 'Administrador'}</span>
              <span className="text-[10px] opacity-80">({currentRole})</span>
            </button>
            {activeRateCurrency && !activeRateCurrency.isBase && (
              <button
                type="button"
                onClick={() => handleSelectOperationsSection('tasa_de_cambio')}
                className="hidden sm:inline-flex items-center gap-1.5 text-xs px-2.5 py-0.5 rounded-full bg-indigo-500/10 text-indigo-500 font-medium hover:bg-indigo-500/20 transition"
                title="Configurar tasa de cambio"
              >
                Tasa {activeRateCurrency.code}: {activeRateCurrency.symbol} {activeRateCurrency.rateToUsd.toFixed(2)} / USD
              </button>
            )}
          </div>

          <div className="flex items-center gap-2.5">
            {activeViewMode === 'operations' && (
              <button
                onClick={() => setActiveViewMode('dashboard')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition ${
                  isDark ? 'border-gray-700 hover:bg-gray-800' : 'border-gray-200 hover:bg-gray-50'
                }`}
              >
                Volver al Tablero
              </button>
            )}

            <button
              onClick={() => setIsCopilotOpen(true)}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium border transition ${
                isDark ? 'border-gray-700 bg-gray-800/60 hover:bg-gray-800' : 'border-gray-200 bg-gray-50 hover:bg-gray-100'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5 text-indigo-500" />
              Génesis IA
              <kbd className="text-[10px] opacity-60 ml-1">⌘K</kbd>
            </button>

            {activeViewMode === 'dashboard' && (
              <button
                onClick={() => setIsAddBlockOpen(true)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition ${
                  isDark ? 'border-gray-700 hover:bg-gray-800' : 'border-gray-200 hover:bg-gray-50'
                }`}
              >
                <Plus className="w-3.5 h-3.5" /> Bloque
              </button>
            )}

            <button
              onClick={() => setIsAddTxOpen(true)}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-medium bg-indigo-600 text-white hover:bg-indigo-700 transition shadow-xs"
            >
              <Plus className="w-3.5 h-3.5" /> Movimiento
            </button>

            <button
              onClick={() => setState((prev) => ({ ...prev, darkMode: !prev.darkMode }))}
              className="p-2 rounded-lg text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800"
              title="Cambiar tema"
            >
              {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>
          </div>
        </header>

        {activeViewMode === 'dashboard' && isCasheaSpaceActive ? (
          <div className="p-6 max-w-7xl w-full mx-auto space-y-6">
            {(() => {
              const todayIso = new Date().toISOString().slice(0, 10);
              const casheaSales = (state.sales || []).filter((s) => /cashea/i.test(s.paymentType || ''));
              const totalCasheaVentasMonto = casheaSales.reduce((acc, s) => acc + (s.total || 0), 0);
              const totalCasheaPorCobrar = casheaSales.reduce((acc, s) => {
                if (s.creditStatus === 'Pagado') return acc;
                const pending = s.balanceDue ?? Math.max(0, (s.total || 0) - (s.amountPaid ?? 0));
                return acc + pending;
              }, 0);
              const totalCasheaAbonado = casheaSales.reduce((acc, s) => {
                if (s.creditStatus === 'Pagado') return acc + (s.total || 0);
                return acc + (s.amountPaid ?? 0);
              }, 0);
              const totalIngresosRegistrados = (state.transactions || [])
                .filter((t) => t.categoryId === 'cat-income')
                .reduce((acc, t) => acc + Math.abs(t.amount || 0), 0);

              const parseInstallmentCount = (paymentType: string): number => {
                const m = paymentType.match(/(\d+)\s*cuota/i);
                const n = m ? parseInt(m[1], 10) : 3;
                return n === 1 || n === 2 || n === 3 ? n : 3;
              };

              const addDaysIso = (isoDate: string, days: number): string => {
                const parts = (isoDate || '').split('-').map((n) => parseInt(n, 10));
                if (parts.length === 3 && !parts.some(isNaN)) {
                  const dt = new Date(Date.UTC(parts[0], parts[1] - 1, parts[2] + days));
                  return dt.toISOString().slice(0, 10);
                }
                return isoDate || '-';
              };

              const dueAlerts = casheaSales.flatMap((sale) => {
                const isFullyPaid = sale.creditStatus === 'Pagado';
                const pending = isFullyPaid
                  ? 0
                  : sale.balanceDue ?? Math.max(0, (sale.total || 0) - (sale.amountPaid ?? 0));
                if (pending <= 0) return [];
                const cuotasCount = parseInstallmentCount(sale.paymentType || '');
                const paidNums = paidCasheaInstallments[sale.id] || [];
                const unpaidNumbers = Array.from({ length: cuotasCount }, (_, idx) => idx + 1).filter(
                  (num) => !paidNums.includes(num)
                );
                const denom = unpaidNumbers.length > 0 ? unpaidNumbers.length : cuotasCount;
                const cuotaMonto = Number((pending / denom).toFixed(2));
                return unpaidNumbers
                  .map((num) => {
                    const dueDate = addDaysIso(sale.date, num * 14);
                    const isOverdue = dueDate < todayIso;
                    const isToday = dueDate === todayIso;
                    return {
                      saleId: sale.id,
                      reference: sale.reference,
                      customer: sale.customerDetails?.fullName || sale.customerOrNote,
                      installmentNumber: num,
                      dueDate,
                      amount: cuotaMonto,
                      isOverdue,
                      isToday,
                    };
                  })
                  .filter((item) => item.isOverdue || item.isToday);
              });

              return (
                <>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    <div className={`rounded-2xl border p-4 ${isDark ? 'bg-[#151821] border-gray-800' : 'bg-white border-indigo-200/80 shadow-xs'}`}>
                      <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">Resumen Ventas Cashea</p>
                      <p className="text-2xl font-black mt-1 tabular-nums text-indigo-500">${totalCasheaVentasMonto.toFixed(2)}</p>
                      <p className="text-[11px] text-gray-500 mt-1">Total facturado con plan Cashea</p>
                    </div>
                    <div className={`rounded-2xl border p-4 ${isDark ? 'bg-[#151821] border-gray-800' : 'bg-white border-indigo-200/80 shadow-xs'}`}>
                      <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">Monto por Cobrar</p>
                      <p className="text-2xl font-black mt-1 tabular-nums text-amber-500">${totalCasheaPorCobrar.toFixed(2)}</p>
                      <p className="text-[11px] text-gray-500 mt-1">Saldo pendiente en cuotas Cashea</p>
                    </div>
                    <div className={`rounded-2xl border p-4 ${isDark ? 'bg-[#151821] border-gray-800' : 'bg-white border-indigo-200/80 shadow-xs'}`}>
                      <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">Ventas Hechas por Cashea</p>
                      <p className="text-2xl font-black mt-1 tabular-nums text-emerald-500">{casheaSales.length}</p>
                      <p className="text-[11px] text-gray-500 mt-1">Facturas emitidas con Cashea</p>
                    </div>
                    <div className={`rounded-2xl border p-4 ${isDark ? 'bg-[#151821] border-gray-800' : 'bg-white border-indigo-200/80 shadow-xs'}`}>
                      <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">Total Ingresos (con Cuotas)</p>
                      <p className="text-2xl font-black mt-1 tabular-nums text-cyan-500">${totalIngresosRegistrados.toFixed(2)}</p>
                      <p className="text-[11px] text-gray-500 mt-1">Abonado Cashea: ${totalCasheaAbonado.toFixed(2)}</p>
                    </div>
                  </div>

                  <div className={`rounded-2xl border p-4 space-y-3 ${isDark ? 'bg-[#151821] border-amber-500/35' : 'bg-amber-50/60 border-amber-300'}`}>
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <h3 className="text-sm font-bold text-amber-600 dark:text-amber-400">
                          Notificaciones de Cuotas Cashea por Fecha ({dueAlerts.length})
                        </h3>
                        <p className="text-xs text-gray-500">
                          Cuotas vencidas o con fecha de cobro hoy ({todayIso}). Al marcarlas como pagas se suman automáticamente a Ingresos.
                        </p>
                      </div>
                    </div>
                    {dueAlerts.length > 0 ? (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                        {dueAlerts.map((al) => (
                          <div
                            key={`${al.saleId}-alert-${al.installmentNumber}`}
                            className={`flex items-center justify-between gap-3 p-3 rounded-xl border text-xs ${
                              isDark ? 'bg-[#0F1115] border-gray-800' : 'bg-white border-amber-200'
                            }`}
                          >
                            <div>
                              <div className="font-bold">
                                {al.reference} · Cuota {al.installmentNumber} ({al.isToday ? 'Vence Hoy' : 'Vencida'})
                              </div>
                              <div className="text-[11px] text-gray-500">
                                {al.customer} · Fecha: <strong>{al.dueDate}</strong> · Monto: <strong>${al.amount.toFixed(2)}</strong>
                              </div>
                            </div>
                            <button
                              type="button"
                              onClick={() => handlePayCasheaInstallment(al.saleId, al.installmentNumber, al.amount, al.dueDate)}
                              className="px-3 py-1.5 rounded-lg text-[11px] font-bold bg-emerald-600 hover:bg-emerald-700 text-white shrink-0 cursor-pointer"
                            >
                              Marcar Paga (+Ingresos)
                            </button>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-gray-500">
                        No hay cuotas Cashea vencidas ni programadas para hoy ({todayIso}).
                      </p>
                    )}
                  </div>

                  <div className={`rounded-2xl border p-5 space-y-4 ${isDark ? 'bg-[#151821] border-gray-800' : 'bg-white border-indigo-200/80 shadow-xs'}`}>
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <h3 className="text-base font-bold">Fechas de Cuotas por Factura Cobrada / Emitida</h3>
                        <p className="text-xs text-gray-500">
                          Selecciona cada cuota como paga para descontar el saldo por cobrar y sumarlo directamente a Ingresos.
                        </p>
                      </div>
                      <span className="text-xs font-bold px-3 py-1 rounded-full bg-indigo-500/10 text-indigo-500 border border-indigo-500/25">
                        {casheaSales.length} {casheaSales.length === 1 ? 'factura' : 'facturas'}
                      </span>
                    </div>

                    <div className="overflow-x-auto">
                      <table className="w-full text-left border-collapse text-xs">
                        <thead>
                          <tr className={`border-b text-[11px] uppercase ${isDark ? 'border-gray-800 text-gray-400' : 'border-gray-200 text-gray-500'}`}>
                            <th className="py-2.5 pr-3">Factura</th>
                            <th className="py-2.5 px-3">Cliente</th>
                            <th className="py-2.5 px-3">Fecha Emisión</th>
                            <th className="py-2.5 px-3 text-right">Total</th>
                            <th className="py-2.5 px-3 text-right">Por Cobrar</th>
                            <th className="py-2.5 px-3">Cuotas (Selecciona como Paga)</th>
                            <th className="py-2.5 pl-3 text-right">Estado / Acción</th>
                          </tr>
                        </thead>
                        <tbody className={`divide-y ${isDark ? 'divide-gray-800/70' : 'divide-gray-100'}`}>
                          {casheaSales.map((sale) => {
                            const cuotasCount = parseInstallmentCount(sale.paymentType || '');
                            const isFullyPaid = sale.creditStatus === 'Pagado';
                            const pending = isFullyPaid
                              ? 0
                              : sale.balanceDue ?? Math.max(0, (sale.total || 0) - (sale.amountPaid ?? 0));
                            const paidNums = paidCasheaInstallments[sale.id] || [];
                            const unpaidNumbers = Array.from({ length: cuotasCount }, (_, idx) => idx + 1).filter(
                              (num) => !paidNums.includes(num)
                            );
                            const denom = unpaidNumbers.length > 0 ? unpaidNumbers.length : cuotasCount;
                            const cuotaMonto = pending > 0 ? Number((pending / denom).toFixed(2)) : 0;
                            const fechasCuotas = Array.from({ length: cuotasCount }, (_, idx) => {
                              const num = idx + 1;
                              const isPaidInstallment = isFullyPaid || paidNums.includes(num);
                              const dueDate = addDaysIso(sale.date, num * 14);
                              const isDueNow = !isPaidInstallment && dueDate <= todayIso;
                              return {
                                numero: num,
                                fecha: dueDate,
                                monto: isPaidInstallment ? 0 : cuotaMonto,
                                isPaid: isPaidInstallment,
                                isDueNow,
                              };
                            });
                            return (
                              <tr key={sale.id} className="align-top">
                                <td className="py-3 pr-3 font-bold tabular-nums">{sale.reference}</td>
                                <td className="py-3 px-3">
                                  <div className="font-semibold">{sale.customerDetails?.fullName || sale.customerOrNote}</div>
                                  <div className="text-[11px] text-gray-500">{sale.paymentType}</div>
                                </td>
                                <td className="py-3 px-3 tabular-nums text-gray-500">{sale.date}</td>
                                <td className="py-3 px-3 text-right font-bold tabular-nums">${(sale.total || 0).toFixed(2)}</td>
                                <td className="py-3 px-3 text-right font-extrabold tabular-nums text-amber-500">
                                  ${pending.toFixed(2)}
                                </td>
                                <td className="py-3 px-3">
                                  <div className="flex flex-col gap-1.5">
                                    {fechasCuotas.map((fq) => (
                                      <div
                                        key={fq.numero}
                                        className={`flex flex-wrap items-center justify-between gap-2 px-2.5 py-1.5 rounded-lg border text-[11px] tabular-nums ${
                                          fq.isPaid
                                            ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-500'
                                            : fq.isDueNow
                                            ? 'bg-amber-500/10 border-amber-500/40 text-amber-500'
                                            : isDark
                                            ? 'bg-gray-900 border-gray-700 text-gray-200'
                                            : 'bg-indigo-50/70 border-indigo-200 text-slate-800'
                                        }`}
                                      >
                                        <span>
                                          <strong>Cuota {fq.numero}:</strong> {fq.fecha}
                                          {!fq.isPaid && pending > 0 && (
                                            <strong className="ml-1">(${fq.monto.toFixed(2)})</strong>
                                          )}
                                          {fq.isDueNow && (
                                            <span className="ml-1.5 text-[10px] font-extrabold uppercase">· Aviso por fecha</span>
                                          )}
                                        </span>
                                        {fq.isPaid ? (
                                          <span className="text-[10px] font-extrabold uppercase">✓ Paga</span>
                                        ) : (
                                          <button
                                            type="button"
                                            onClick={() =>
                                              handlePayCasheaInstallment(sale.id, fq.numero, fq.monto, fq.fecha)
                                            }
                                            className="px-2 py-0.5 rounded bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] font-bold cursor-pointer"
                                          >
                                            Marcar Paga
                                          </button>
                                        )}
                                      </div>
                                    ))}
                                  </div>
                                </td>
                                <td className="py-3 pl-3 text-right">
                                  {pending > 0 && sale.creditStatus !== 'Pagado' ? (
                                    <button
                                      type="button"
                                      onClick={() => handleSettleCreditSale(sale.id)}
                                      className="px-2.5 py-1 rounded-lg text-[11px] font-bold bg-indigo-600 hover:bg-indigo-700 text-white cursor-pointer"
                                    >
                                      Cobrar Saldo Total
                                    </button>
                                  ) : (
                                    <span className="inline-block px-2.5 py-1 rounded-lg text-[11px] font-bold bg-emerald-500/15 text-emerald-500 border border-emerald-500/30">
                                      Cobrada / Pagada
                                    </span>
                                  )}
                                </td>
                              </tr>
                            );
                          })}
                          {casheaSales.length === 0 && (
                            <tr>
                              <td colSpan={7} className="py-8 text-center text-gray-400">
                                Aún no hay ventas registradas con el método de pago Cashea.
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </>
              );
            })()}
          </div>
        ) : activeViewMode === 'dashboard' && isReportsSpaceActive ? (
          <div className="p-6 max-w-7xl w-full mx-auto">
            <GeneralReportsPanel
              sales={state.sales}
              products={state.products}
              transactions={state.transactions}
              generalExpenses={state.generalExpenses}
              rateToUsd={activeRateValue}
              currencySymbol={activeRateSymbol || 'Bs.'}
              businessName={state.invoiceTemplate?.businessName}
              businessTaxId={state.invoiceTemplate?.taxId}
              isDark={isDark}
            />
          </div>
        ) : activeViewMode === 'dashboard' && isAccountingBookActive ? (
          <div className="p-6 max-w-7xl w-full mx-auto space-y-6">
            <AccountingBookPanel
              sales={state.sales}
              transactions={state.transactions}
              generalExpenses={state.generalExpenses}
              rateToUsd={activeRateValue}
              currencySymbol={activeRateSymbol || 'Bs.'}
              businessName={state.invoiceTemplate?.businessName}
              businessTaxId={state.invoiceTemplate?.taxId}
              isDark={isDark}
            />
            <div id="panel-resumen-libro-contable">
              <GeneralReportsPanel
                sales={state.sales}
                products={state.products}
                transactions={state.transactions}
                generalExpenses={state.generalExpenses}
                rateToUsd={activeRateValue}
                currencySymbol={activeRateSymbol || 'Bs.'}
                businessName={state.invoiceTemplate?.businessName}
                businessTaxId={state.invoiceTemplate?.taxId}
                isDark={isDark}
              />
            </div>
          </div>
        ) : activeViewMode === 'dashboard' && isSeniatSpaceActive ? (
          <div className="p-6 max-w-7xl w-full mx-auto">
            <SeniatDocumentsPanel
              sales={state.sales}
              products={state.products}
              transactions={state.transactions}
              rateToUsd={activeRateValue}
              currencySymbol={activeRateSymbol || 'Bs.'}
              businessName={state.invoiceTemplate?.businessName}
              businessTaxId={state.invoiceTemplate?.taxId}
              isDark={isDark}
            />
          </div>
        ) : activeViewMode === 'dashboard' ? (
          <div className="p-6 max-w-7xl w-full mx-auto space-y-5">
            <div
              className={`rounded-xl border px-4 py-3 flex flex-wrap items-center justify-between gap-3 text-xs ${
                isDark ? 'bg-[#14171D] border-gray-800 text-gray-200' : 'bg-white/90 border-indigo-200/80 text-slate-800'
              }`}
            >
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => setBoardPeriod('day')}
                  className={`px-3 py-1.5 rounded-lg font-bold border transition cursor-pointer ${
                    boardPeriod === 'day'
                      ? 'bg-indigo-600 text-white border-indigo-600'
                      : isDark
                      ? 'bg-gray-900/60 border-gray-700 text-gray-300 hover:bg-gray-800'
                      : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  Registro del día ({boardDate})
                </button>
                <button
                  type="button"
                  onClick={() => setBoardPeriod('7d')}
                  className={`px-3 py-1.5 rounded-lg font-bold border transition cursor-pointer ${
                    boardPeriod === '7d'
                      ? 'bg-indigo-600 text-white border-indigo-600'
                      : isDark
                      ? 'bg-gray-900/60 border-gray-700 text-gray-300 hover:bg-gray-800'
                      : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  Registro de 7 días
                </button>
                <button
                  type="button"
                  onClick={() => setBoardPeriod('month')}
                  className={`px-3 py-1.5 rounded-lg font-bold border transition cursor-pointer ${
                    boardPeriod === 'month'
                      ? 'bg-indigo-600 text-white border-indigo-600'
                      : isDark
                      ? 'bg-gray-900/60 border-gray-700 text-gray-300 hover:bg-gray-800'
                      : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  Registro de mes
                </button>
                <button
                  type="button"
                  onClick={() => setBoardPeriod('year')}
                  className={`px-3 py-1.5 rounded-lg font-bold border transition cursor-pointer ${
                    boardPeriod === 'year'
                      ? 'bg-indigo-600 text-white border-indigo-600'
                      : isDark
                      ? 'bg-gray-900/60 border-gray-700 text-gray-300 hover:bg-gray-800'
                      : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  Registro del año
                </button>
              </div>

              <div className="flex items-center gap-2">
                {boardDate !== getLocalTodayStr() && (
                  <button
                    type="button"
                    onClick={() => setBoardDate(getLocalTodayStr())}
                    className="px-2.5 py-1.5 rounded-lg font-semibold border border-gray-300 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-800 cursor-pointer"
                  >
                    Volver a hoy
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => {
                    const resumenPage = state.pages.find((p) => p.id === 'page-1' || /resumen/i.test(p.title));
                    if (resumenPage) {
                      setIsSeniatSpaceActive(false);
                      setIsCasheaSpaceActive(false);
                      setState((prev) => ({ ...prev, activePageId: resumenPage.id }));
                      setActiveViewMode('dashboard');
                      const el = document.getElementById('panel-resumen-busqueda-dias');
                      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
                    }
                  }}
                  className="px-3 py-1.5 rounded-lg font-semibold bg-indigo-600/15 hover:bg-indigo-600/25 text-indigo-500 border border-indigo-500/30 transition cursor-pointer"
                >
                  Buscar otros días en Resumen
                </button>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {activePage.blocks.map((block) => (
              <div
                key={block.id}
                className={`${block.span === 2 ? 'md:col-span-2' : 'col-span-1'} rounded-xl border p-5 transition ${
                  isDark ? 'bg-[#14171D] border-gray-800' : 'bg-[#F7F9FE] border-indigo-200/70 shadow-xs'
                }`}
              >
                <div className="flex items-center justify-between mb-4">
                  <span className="text-xs font-semibold uppercase tracking-wider text-gray-500">
                    {block.title}
                  </span>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => handleToggleSpan(block.id)}
                      className="p-1 text-gray-400 hover:text-indigo-500 rounded"
                      title="Cambiar ancho"
                    >
                      <Columns className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => handleRemoveBlock(block.id)}
                      className="p-1 text-gray-400 hover:text-red-500 rounded"
                      title="Eliminar bloque"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {block.type === 'kpi_balance' && (
                  <div>
                    <div
                      data-kpi-kind="balance"
                      className="kpi-balance-yellow text-3xl font-bold tabular-nums tracking-tight"
                      style={{ color: '#facc15' }}
                    >
                      ${metrics.balance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </div>
                    <p className="text-xs text-gray-500 mt-1">Saldo consolidado disponible</p>
                  </div>
                )}

                {block.type === 'kpi_income' && (
                  <div>
                    <div
                      data-kpi-kind="income"
                      className="kpi-income-green text-3xl font-bold tabular-nums"
                      style={{ color: '#22c55e' }}
                    >
                      +${metrics.income.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </div>
                    <p className="text-xs text-gray-500 mt-1">Total entradas registradas</p>
                  </div>
                )}

                {block.type === 'kpi_expense' && (
                  <div>
                    <div
                      data-kpi-kind="expense"
                      className="kpi-expense-red text-3xl font-bold tabular-nums"
                      style={{ color: '#ef4444' }}
                    >
                      -${metrics.expense.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </div>
                    <p className="text-xs text-gray-500 mt-1">Total salidas registradas</p>
                  </div>
                )}

                {block.type === 'chart_categories' && (
                  <div className="space-y-3">
                    {state.categories
                      .filter((c) => c.id !== 'cat-income')
                      .map((cat) => {
                        const sum = filteredTransactions
                          .filter((t) => t.categoryId === cat.id && t.amount < 0)
                          .reduce((acc, t) => acc + Math.abs(t.amount), 0);
                        const pct = metrics.expense > 0 ? Math.round((sum / metrics.expense) * 100) : 0;
                        return (
                          <div key={cat.id}>
                            <div className="flex justify-between text-xs mb-1">
                              <span className="font-medium">{cat.name}</span>
                              <span className="tabular-nums text-gray-500">${sum.toFixed(2)} ({pct}%)</span>
                            </div>
                            <div className="w-full h-2 rounded-full bg-gray-200 dark:bg-gray-800 overflow-hidden">
                              <div
                                className="h-full rounded-full transition-all duration-300"
                                style={{ width: `${pct}%`, backgroundColor: cat.color }}
                              />
                            </div>
                          </div>
                        );
                      })}
                  </div>
                )}

                {block.type === 'table_transactions' && (
                  <div>
                    <div className="flex items-center gap-2 mb-3">
                      <div className="relative flex-1 max-w-xs">
                        <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-gray-400" />
                        <input
                          type="text"
                          placeholder="Filtrar comercio..."
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                          className={`w-full pl-8 pr-3 py-1.5 text-xs rounded-lg border outline-none ${
                            isDark ? 'bg-gray-900 border-gray-700' : 'bg-white border-gray-200'
                          }`}
                        />
                      </div>
                    </div>

                    <div className="overflow-x-auto">
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className="border-b border-gray-200 dark:border-gray-800 text-[11px] uppercase text-gray-400">
                            <th className="py-2 font-medium">Fecha</th>
                            <th className="py-2 font-medium">Comercio / Concepto</th>
                            <th className="py-2 font-medium">Categoría</th>
                            <th className="py-2 font-medium text-right">Monto</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 dark:divide-gray-800/60 text-sm">
                          {filteredTransactions.map((tx) => (
                            <tr key={tx.id} className="hover:bg-black/[0.02] dark:hover:bg-white/[0.02]">
                              <td className="py-2.5 text-xs text-gray-500 tabular-nums">{tx.date}</td>
                              <td className="py-2.5 font-medium text-xs">{tx.merchant}</td>
                              <td className="py-2.5">
                                <select
                                  value={tx.categoryId}
                                  onChange={(e) => handleCategoryChange(tx.id, e.target.value)}
                                  className={`text-xs rounded-md px-2 py-1 border outline-none ${
                                    isDark ? 'bg-gray-900 border-gray-700' : 'bg-white border-gray-200'
                                  }`}
                                >
                                  {state.categories.map((c) => (
                                    <option key={c.id} value={c.id}>{c.name}</option>
                                  ))}
                                </select>
                              </td>
                              <td className={`py-2.5 text-right font-semibold text-xs tabular-nums ${tx.amount >= 0 ? 'text-emerald-500' : ''}`}>
                                {tx.amount >= 0 ? `+$${tx.amount.toFixed(2)}` : `-$${Math.abs(tx.amount).toFixed(2)}`}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            ))}

            </div>

            <Movements3dChart
              sales={state.sales}
              transactions={state.transactions}
              generalExpenses={state.generalExpenses}
              boardDate={boardDate}
              isDark={isDark}
            />
          </div>
                ) : state.operationsSection === 'ventas' ? (
          <div className="p-4 sm:p-6 max-w-7xl w-full mx-auto">
            <PosSalesWindow
              onCloseModal={() => {
                setIsSalesWindowModalOpen(false);
                if (hasPermission('dashboard')) {
                  setActiveViewMode('dashboard');
                }
              }}
            />
          </div>
        ) : (
          <div className="p-6 max-w-7xl w-full mx-auto space-y-5">
            <div className={`rounded-xl border p-5 ${isDark ? 'bg-[#14171D] border-gray-800' : 'bg-[#F7F9FE] border-indigo-200/70 shadow-xs'}`}>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
                <div>
                  <span className="text-xs font-semibold uppercase tracking-wider text-indigo-500">
                    Panel de Opciones
                  </span>
                  <h3 className="text-base font-semibold mt-0.5">{activeOpItem.label}</h3>
                </div>

                <div className="flex flex-wrap items-center gap-2.5">
                  {state.operationsSection === 'productos' && (
                    <>
                      <div className="flex items-center gap-1.5 text-xs">
                        <button
                          type="button"
                          onClick={() => syncBcvRateNow(true)}
                          className="px-2 py-1 rounded-md border border-sky-500/40 text-sky-400 hover:bg-sky-500/10 text-[11px] font-semibold cursor-pointer"
                          title="Actualizar tasa VES desde BCV"
                        >
                          BCV Auto
                        </button>
                        <span className="text-gray-400">Tasa activa:</span>
                        <select
                          value={state.activeRateCurrencyCode}
                          onChange={(e) => handleSelectActiveRateCurrency(e.target.value)}
                          className={`px-2.5 py-1.5 rounded-lg border text-xs font-medium outline-none ${
                            isDark ? 'bg-gray-900 border-gray-700' : 'bg-white border-gray-200'
                          }`}
                        >
                          {state.currencies.map((c) => (
                            <option key={c.id} value={c.code}>
                              {c.code} ({c.rateToUsd.toFixed(2)})
                            </option>
                          ))}
                        </select>
                      </div>

                      <button
                        type="button"
                        onClick={() => {
                          setProdFeedback(null);
                          if (!availableProductCategories.includes(prodCategory) && availableProductCategories.length > 0) {
                            setProdCategory(availableProductCategories[0]);
                          }
                          setIsAddProductOpen(true);
                        }}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-indigo-600 text-white hover:bg-indigo-700 transition shadow-2xs"
                      >
                        <Plus className="w-3.5 h-3.5" /> Crear Producto
                      </button>

                      <label className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-emerald-600 text-white hover:bg-emerald-700 transition shadow-2xs cursor-pointer">
                        <span>{scanBusy ? 'Escaneando...' : 'Escanear Factura IA'}</span>
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={(e) => {
                            const f = e.target.files?.[0];
                            e.currentTarget.value = '';
                            handleInvoiceImageScan(f);
                          }}
                        />
                      </label>
                    </>
                  )}

                  <div className="relative w-full sm:w-60">
                    <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-gray-400" />
                    <input
                      type="text"
                      placeholder={`Buscar en ${activeOpItem.label.toLowerCase()}...`}
                      value={opsSearchQuery}
                      onChange={(e) => setOpsSearchQuery(e.target.value)}
                      className={`w-full pl-8 pr-3 py-1.5 text-xs rounded-lg border outline-none ${
                        isDark ? 'bg-gray-900 border-gray-700' : 'bg-white border-gray-200'
                      }`}
                    />
                  </div>
                </div>
              </div>

              {state.operationsSection === 'productos' && (
                <div className="space-y-3">
                  {prodFeedback && (
                    <div className="flex items-center justify-between rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3.5 py-2 text-xs text-emerald-500 font-medium">
                      <span>{prodFeedback}</span>
                      <button type="button" onClick={() => setProdFeedback(null)}>
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}

                  {(scanMessage || scanDraftItems.length > 0) && (
                    <div className={`rounded-xl border p-3.5 text-xs space-y-3 ${isDark ? 'bg-[#121622] border-indigo-500/40' : 'bg-indigo-50/60 border-indigo-200'}`}>
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="font-bold text-indigo-400">
                          {scanMessage || 'Carga automática desde foto de factura'}
                        </div>
                        <div className="flex items-center gap-2">
                          <label className="px-2.5 py-1 rounded-lg border border-indigo-500/40 font-semibold hover:bg-indigo-500/10 cursor-pointer">
                            Cambiar foto de factura
                            <input
                              type="file"
                              accept="image/*"
                              className="hidden"
                              onChange={(e) => {
                                const f = e.target.files?.[0];
                                e.currentTarget.value = '';
                                handleInvoiceImageScan(f);
                              }}
                            />
                          </label>
                          {scanDraftItems.length > 0 && (
                            <button
                              type="button"
                              onClick={handleConfirmScannedInvoice}
                              className="px-3 py-1 rounded-lg bg-emerald-600 text-white font-semibold hover:bg-emerald-700 cursor-pointer"
                            >
                              Cargar proveedor y productos
                            </button>
                          )}
                        </div>
                      </div>

                      {scanDraftItems.length > 0 && (
                        <div className="space-y-2.5">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-semibold text-[11px]">Proveedor detectado:</span>
                            <input
                              type="text"
                              value={scanSupplierName}
                              onChange={(e) => setScanSupplierName(e.target.value)}
                              className={`px-2.5 py-1 rounded border text-xs font-medium min-w-[220px] ${isDark ? 'bg-gray-950 border-gray-700' : 'bg-white border-gray-300'}`}
                            />
                          </div>

                          <div className="overflow-x-auto">
                            <table className="w-full text-left border-collapse text-[11px]">
                              <thead>
                                <tr className="border-b border-gray-700/60 text-gray-400 uppercase">
                                  <th className="py-1.5 pr-2">Producto</th>
                                  <th className="py-1.5 px-2 w-20 text-right">Cant.</th>
                                  <th className="py-1.5 px-2 w-24 text-right">Costo ($)</th>
                                  <th className="py-1.5 px-2 w-24 text-right">Venta ($)</th>
                                  <th className="py-1.5 pl-2 w-10 text-right"></th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-gray-800/40">
                                {scanDraftItems.map((it, idx) => (
                                  <tr key={idx}>
                                    <td className="py-1.5 pr-2">
                                      <input
                                        type="text"
                                        value={it.name}
                                        onChange={(e) => {
                                          const val = e.target.value;
                                          setScanDraftItems((prev) =>
                                            prev.map((row, rIdx) => (rIdx === idx ? { ...row, name: val } : row))
                                          );
                                        }}
                                        className={`w-full px-2 py-1 rounded border text-xs ${isDark ? 'bg-gray-950 border-gray-700' : 'bg-white border-gray-300'}`}
                                      />
                                    </td>
                                    <td className="py-1.5 px-2">
                                      <input
                                        type="number"
                                        min="1"
                                        value={it.quantity}
                                        onChange={(e) => {
                                          const qVal = Math.max(1, parseInt(e.target.value || '1', 10) || 1);
                                          setScanDraftItems((prev) =>
                                            prev.map((row, rIdx) => (rIdx === idx ? { ...row, quantity: qVal } : row))
                                          );
                                        }}
                                        className={`w-full px-2 py-1 rounded border text-xs text-right tabular-nums ${isDark ? 'bg-gray-950 border-gray-700' : 'bg-white border-gray-300'}`}
                                      />
                                    </td>
                                    <td className="py-1.5 px-2">
                                      <input
                                        type="number"
                                        step="0.01"
                                        min="0.01"
                                        value={it.costPrice}
                                        onChange={(e) => {
                                          const cVal = Math.max(0.01, parseFloat(e.target.value || '0') || 0.01);
                                          setScanDraftItems((prev) =>
                                            prev.map((row, rIdx) => (rIdx === idx ? { ...row, costPrice: cVal } : row))
                                          );
                                        }}
                                        className={`w-full px-2 py-1 rounded border text-xs text-right tabular-nums ${isDark ? 'bg-gray-950 border-gray-700' : 'bg-white border-gray-300'}`}
                                      />
                                    </td>
                                    <td className="py-1.5 px-2">
                                      <input
                                        type="number"
                                        step="0.01"
                                        min="0.01"
                                        value={it.salePrice}
                                        onChange={(e) => {
                                          const sVal = Math.max(0.01, parseFloat(e.target.value || '0') || 0.01);
                                          setScanDraftItems((prev) =>
                                            prev.map((row, rIdx) => (rIdx === idx ? { ...row, salePrice: sVal } : row))
                                          );
                                        }}
                                        className={`w-full px-2 py-1 rounded border text-xs text-right tabular-nums ${isDark ? 'bg-gray-950 border-gray-700' : 'bg-white border-gray-300'}`}
                                      />
                                    </td>
                                    <td className="py-1.5 pl-2 text-right">
                                      <button
                                        type="button"
                                        onClick={() => setScanDraftItems((prev) => prev.filter((_, rIdx) => rIdx !== idx))}
                                        className="text-rose-500 hover:underline cursor-pointer"
                                        title="Quitar ítem"
                                      >
                                        <X className="w-3.5 h-3.5" />
                                      </button>
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="border-b border-gray-200 dark:border-gray-800 text-[11px] uppercase text-gray-400">
                          <th className="py-2 font-medium">Foto</th>
                          <th className="py-2 font-medium">Producto</th>
                          <th className="py-2 font-medium">Código de barra</th>
                          <th className="py-2 font-medium text-right">Precio (Costo)</th>
                          <th className="py-2 font-medium text-right">Precio Venta (USD)</th>
                          <th className="py-2 font-medium text-right">
                            Ajustado ({activeRateCurrency?.code ?? 'VES'} @ {activeRateValue.toFixed(2)})
                          </th>
                          <th className="py-2 font-medium text-center">IVA</th>
                          <th className="py-2 font-medium text-right">% Ganancia</th>
                          <th className="py-2 font-medium text-right">Stock</th>
                          <th className="py-2 font-medium text-right">Acciones</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100 dark:divide-gray-800/60 text-xs">
                        {state.products
                          .filter(
                            (p) =>
                              !q ||
                              p.sku.toLowerCase().includes(q) ||
                              p.barcode.toLowerCase().includes(q) ||
                              p.name.toLowerCase().includes(q) ||
                              p.category.toLowerCase().includes(q)
                          )
                          .map((prod) => {
                            const marginPct = calcProfitMarginPercent(prod.costPrice, prod.price);
                            const adjustedSalePrice = prod.price * activeRateValue;
                            return (
                              <tr key={prod.id} className="hover:bg-black/[0.02] dark:hover:bg-white/[0.02]">
                                <td className="py-2">
                                  <img
                                    src={prod.imageUrl}
                                    alt={prod.name}
                                    className="w-8 h-8 rounded-md object-cover border border-black/10 dark:border-white/10"
                                  />
                                </td>
                                <td className="py-2.5">
                                  <div className="font-medium">{prod.name}</div>
                                  <div className="text-[10px] text-gray-400">{prod.category} · {prod.sku}</div>
                                </td>
                                <td className="py-2.5 text-gray-500 tabular-nums">{prod.barcode}</td>
                                <td className="py-2.5 text-right text-gray-500 tabular-nums">
                                  ${prod.costPrice.toFixed(2)}
                                </td>
                                <td className="py-2.5 text-right font-semibold tabular-nums">
                                  ${prod.price.toFixed(2)}
                                </td>
                                <td className="py-2.5 text-right font-semibold text-indigo-500 tabular-nums">
                                  {activeRateSymbol} {adjustedSalePrice.toFixed(2)}
                                </td>
                                <td className="py-2.5 text-center">
                                  <button
                                    type="button"
                                    onClick={() => handleToggleProductIva(prod.id)}
                                    className={`px-2 py-0.5 rounded-md text-[10px] font-bold border transition cursor-pointer ${
                                      prod.hasIva
                                        ? 'bg-amber-500/15 text-amber-600 dark:text-amber-300 border-amber-500/30'
                                        : 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-300 border-emerald-500/30'
                                    }`}
                                    title="Cambiar si este producto tiene IVA o no tiene IVA"
                                  >
                                    {prod.hasIva ? 'Con IVA' : 'Sin IVA'}
                                  </button>
                                </td>
                                <td className="py-2.5 text-right tabular-nums">
                                  <span
                                    className={`px-2 py-0.5 rounded-full text-[11px] font-semibold ${
                                      marginPct >= 25
                                        ? 'bg-emerald-500/10 text-emerald-500'
                                        : marginPct > 0
                                        ? 'bg-amber-500/10 text-amber-500'
                                        : 'bg-rose-500/10 text-rose-500'
                                    }`}
                                  >
                                    {marginPct.toFixed(1)}%
                                  </span>
                                </td>
                                <td className="py-2.5 text-right tabular-nums">
                                  <span
                                    className={`px-2 py-0.5 rounded-md text-[11px] font-bold ${
                                      prod.stock < 5
                                        ? 'bg-rose-500/12 text-rose-600 dark:text-rose-400'
                                        : 'bg-sky-500/10 text-sky-700 dark:text-sky-300'
                                    }`}
                                  >
                                    {prod.stock} uds.
                                  </span>
                                </td>
                                <td className="py-2.5 text-right whitespace-nowrap">
                                  <div className="inline-flex items-center justify-end gap-1.5">
                                      <button
                                        type="button"
                                        onClick={async () => {
                                          setProdFeedback(`Buscando foto referencial (prioridad Venezuela) para "${prod.name}"...`);
                                          const result = await fetchProductPhotoFromInternet(prod.name, prod.category, prod.accentColor);
                                          setState((prev) => ({
                                            ...prev,
                                            products: prev.products.map((item) =>
                                              item.id === prod.id ? { ...item, imageUrl: result.url } : item
                                            ),
                                          }));
                                          if (editingProductId === prod.id) {
                                            setEditProdImageUrl(result.url);
                                          }
                                          setProdFeedback(
                                            result.foundOnline
                                              ? `Foto referencial encontrada y asignada a "${prod.name}".`
                                              : `Sin foto externa en fuentes consultadas; se asignó vista referencial para "${prod.name}".`
                                          );
                                        }}
                                        className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-medium bg-sky-500/10 text-sky-500 border border-sky-500/30 hover:bg-sky-600 hover:text-white transition cursor-pointer"
                                        title="Asignar foto referencial según nombre"
                                      >
                                        <span>Foto IA</span>
                                      </button>
                                    <button
                                      type="button"
                                      onClick={() => handleOpenEditProduct(prod)}
                                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-medium bg-indigo-500/10 text-indigo-500 border border-indigo-500/30 hover:bg-indigo-600 hover:text-white transition"
                                      title="Modificar producto"
                                    >
                                      <Pencil className="w-3 h-3" />
                                      <span>Editar</span>
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => handleDeleteProduct(prod.id)}
                                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-medium bg-rose-500/10 text-rose-500 border border-rose-500/30 hover:bg-rose-500 hover:text-white transition"
                                      title="Borrar producto"
                                    >
                                      <Trash2 className="w-3 h-3" />
                                      <span>Borrar</span>
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            );
                          })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {state.operationsSection === 'tasa_de_cambio' && (
                <div className="space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-gray-200 dark:border-gray-800">
                    <p className="text-xs text-gray-500">
                      Configura la tasa de cambio respecto al <strong>USD</strong> y elige qué moneda se usa para ajustar automáticamente los precios de venta en <strong>Productos</strong> y <strong>Ventas</strong>.
                    </p>
                  </div>

                  {rateSavedMsg && (
                    <div className="flex items-center justify-between rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3.5 py-2 text-xs text-emerald-500 font-medium">
                      <span>{rateSavedMsg}</span>
                      <button type="button" onClick={() => setRateSavedMsg(null)}>
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {state.currencies.map((cur) => {
                      const isSelectedRate = state.activeRateCurrencyCode === cur.code;
                      return (
                        <div
                          key={cur.id}
                          className={`rounded-xl border p-4 space-y-3 transition ${
                            isSelectedRate
                              ? 'border-indigo-500/60 bg-indigo-600/[0.05]'
                              : isDark
                              ? 'bg-gray-900/50 border-gray-800'
                              : 'bg-white border-gray-200'
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <div>
                              <span className="text-xs font-bold">{cur.code}</span>
                              <p className="text-[11px] text-gray-500">{cur.name}</p>
                            </div>
                            <span className="text-sm font-bold text-indigo-500">{cur.symbol}</span>
                          </div>

                          <div>
                            <label className="block text-[11px] text-gray-500 mb-1">
                              Tasa por 1.00 USD
                            </label>
                            <input
                              type="number"
                              step="0.01"
                              min="0.0001"
                              disabled={cur.isBase}
                              value={rateDrafts[cur.id] ?? String(cur.rateToUsd)}
                              onChange={(e) => handleUpdateCurrencyRate(cur.id, e.target.value)}
                              className={`w-full px-3 py-1.5 rounded-lg border text-xs font-semibold tabular-nums outline-none ${
                                isDark ? 'bg-gray-900 border-gray-700' : 'bg-white border-gray-300'
                              } disabled:opacity-60`}
                            />
                          </div>

                          <button
                            type="button"
                            onClick={() => handleSelectActiveRateCurrency(cur.code)}
                            className={`w-full py-1.5 rounded-lg text-xs font-medium border transition ${
                              isSelectedRate
                                ? 'bg-indigo-600 text-white border-indigo-600'
                                : isDark
                                ? 'border-gray-700 text-gray-300 hover:bg-gray-800'
                                : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                            }`}
                          >
                            {isSelectedRate ? 'Tasa activa en catálogo' : 'Usar para ajustar precios'}
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {state.operationsSection === 'clientes_afiliados' && (
                <div className="space-y-4 text-xs">
                  <form
                    onSubmit={handleAddAffiliatedCustomer}
                    className={`rounded-xl border p-4 grid grid-cols-1 sm:grid-cols-12 gap-3 items-end ${
                      isDark ? 'bg-gray-900/50 border-gray-800' : 'bg-white border-indigo-200/70'
                    }`}
                  >
                    <div className="sm:col-span-3">
                      <label className="block text-[11px] text-gray-500 mb-1">Nombre completo</label>
                      <input
                        type="text"
                        required
                        placeholder="Ej. María González"
                        value={newAffName}
                        onChange={(e) => setNewAffName(e.target.value)}
                        className={`w-full px-3 py-2 rounded-lg border outline-none ${
                          isDark ? 'bg-gray-950 border-gray-700' : 'bg-[#F8FAFF] border-gray-300'
                        }`}
                      />
                    </div>

                    <div className="sm:col-span-2">
                      <label className="block text-[11px] text-gray-500 mb-1">Cédula o RIF</label>
                      <input
                        type="text"
                        required
                        placeholder="V-00000000 / J-..."
                        value={newAffId}
                        onChange={(e) => setNewAffId(e.target.value)}
                        className={`w-full px-3 py-2 rounded-lg border tabular-nums outline-none ${
                          isDark ? 'bg-gray-950 border-gray-700' : 'bg-[#F8FAFF] border-gray-300'
                        }`}
                      />
                    </div>

                    <div className="sm:col-span-2">
                      <label className="block text-[11px] text-gray-500 mb-1">Teléfono</label>
                      <input
                        type="text"
                        placeholder="+58 412-0000000"
                        value={newAffPhone}
                        onChange={(e) => setNewAffPhone(e.target.value)}
                        className={`w-full px-3 py-2 rounded-lg border tabular-nums outline-none ${
                          isDark ? 'bg-gray-950 border-gray-700' : 'bg-[#F8FAFF] border-gray-300'
                        }`}
                      />
                    </div>

                    <div className="sm:col-span-3">
                      <label className="block text-[11px] text-gray-500 mb-1">Dirección</label>
                      <input
                        type="text"
                        placeholder="Av. / Sector / Local"
                        value={newAffAddress}
                        onChange={(e) => setNewAffAddress(e.target.value)}
                        className={`w-full px-3 py-2 rounded-lg border outline-none ${
                          isDark ? 'bg-gray-950 border-gray-700' : 'bg-[#F8FAFF] border-gray-300'
                        }`}
                      />
                    </div>

                    <div className="sm:col-span-2">
                      <button
                        type="submit"
                        className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-semibold transition cursor-pointer"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Guardar</span>
                      </button>
                    </div>
                  </form>

                  {affFeedback && (
                    <div className="flex items-center justify-between rounded-lg border border-indigo-500/30 bg-indigo-500/10 px-3.5 py-2 text-xs text-indigo-600 dark:text-indigo-300 font-medium">
                      <span>{affFeedback}</span>
                      <button type="button" onClick={() => setAffFeedback(null)}>
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}

                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="border-b border-gray-200 dark:border-gray-800 text-[11px] uppercase text-gray-400">
                          <th className="py-2 font-medium">Nombre completo</th>
                          <th className="py-2 font-medium">Cédula / RIF</th>
                          <th className="py-2 font-medium">Teléfono</th>
                          <th className="py-2 font-medium">Dirección</th>
                          <th className="py-2 font-medium text-right">Acciones</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100 dark:divide-gray-800/60 text-xs">
                        {(state.affiliatedCustomers || [])
                          .filter(
                            (c) =>
                              !q ||
                              c.fullName.toLowerCase().includes(q) ||
                              c.taxOrId.toLowerCase().includes(q) ||
                              c.phone.toLowerCase().includes(q) ||
                              c.address.toLowerCase().includes(q)
                          )
                          .map((cust) => (
                            <tr key={cust.id} className="hover:bg-black/[0.02] dark:hover:bg-white/[0.02]">
                              <td className="py-2.5 font-semibold">{cust.fullName}</td>
                              <td className="py-2.5 text-gray-500 tabular-nums">{cust.taxOrId || '—'}</td>
                              <td className="py-2.5 text-gray-500 tabular-nums">{cust.phone || '—'}</td>
                              <td className="py-2.5 text-gray-500">{cust.address || '—'}</td>
                              <td className="py-2.5 text-right whitespace-nowrap">
                                <button
                                  type="button"
                                  onClick={() => handleDeleteAffiliatedCustomer(cust.id)}
                                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-medium bg-rose-500/10 text-rose-500 border border-rose-500/30 hover:bg-rose-500 hover:text-white transition cursor-pointer"
                                >
                                  <Trash2 className="w-3 h-3" />
                                  <span>Borrar</span>
                                </button>
                              </td>
                            </tr>
                          ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

                            {state.operationsSection === 'proveedores' && (
                <div className="space-y-4">
                  <form
                    onSubmit={handleAddSupplier}
                    className={`rounded-xl border p-3.5 grid grid-cols-1 sm:grid-cols-12 gap-2.5 items-end text-xs ${
                      isDark ? 'bg-[#0F1115]/70 border-gray-800' : 'bg-slate-50/90 border-indigo-200/80'
                    }`}
                  >
                    <div className="sm:col-span-3">
                      <label className="block text-[11px] font-semibold text-gray-500 mb-1">
                        Proveedor / Empresa
                      </label>
                      <input
                        type="text"
                        value={newSupplierName}
                        onChange={(e) => setNewSupplierName(e.target.value)}
                        placeholder="Ej. Distribuidora Andes"
                        required
                        className={`w-full px-3 py-2 rounded-lg border outline-none ${
                          isDark ? 'bg-[#151821] border-gray-700 text-gray-100' : 'bg-white border-gray-300 text-slate-900'
                        }`}
                      />
                    </div>
                    <div className="sm:col-span-3">
                      <label className="block text-[11px] font-semibold text-gray-500 mb-1">
                        Contacto (correo / teléfono)
                      </label>
                      <input
                        type="text"
                        value={newSupplierContact}
                        onChange={(e) => setNewSupplierContact(e.target.value)}
                        placeholder="ventas@proveedor.com"
                        className={`w-full px-3 py-2 rounded-lg border outline-none ${
                          isDark ? 'bg-[#151821] border-gray-700 text-gray-100' : 'bg-white border-gray-300 text-slate-900'
                        }`}
                      />
                    </div>
                    <div className="sm:col-span-2">
                      <label className="block text-[11px] font-semibold text-gray-500 mb-1">
                        Rubro
                      </label>
                      <input
                        type="text"
                        value={newSupplierCategory}
                        onChange={(e) => setNewSupplierCategory(e.target.value)}
                        placeholder="Materia Prima"
                        className={`w-full px-3 py-2 rounded-lg border outline-none ${
                          isDark ? 'bg-[#151821] border-gray-700 text-gray-100' : 'bg-white border-gray-300 text-slate-900'
                        }`}
                      />
                    </div>
                    <div className="sm:col-span-2">
                      <label className="block text-[11px] font-semibold text-gray-500 mb-1">
                        Saldo por pagar ($)
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={newSupplierBalance}
                        onChange={(e) => setNewSupplierBalance(e.target.value)}
                        className={`w-full px-3 py-2 rounded-lg border tabular-nums outline-none ${
                          isDark ? 'bg-[#151821] border-gray-700 text-gray-100' : 'bg-white border-gray-300 text-slate-900'
                        }`}
                      />
                    </div>
                    <div className="sm:col-span-2">
                      <button
                        type="submit"
                        className="w-full py-2 px-3 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-semibold transition cursor-pointer"
                      >
                        + Agregar
                      </button>
                    </div>
                  </form>

                  {supplierFeedback && (
                    <div className="px-3 py-2 rounded-lg text-xs font-medium bg-emerald-500/10 text-emerald-500 border border-emerald-500/25">
                      {supplierFeedback}
                    </div>
                  )}

                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="border-b border-gray-200 dark:border-gray-800 text-[11px] uppercase text-gray-400">
                          <th className="py-2 font-medium">Proveedor</th>
                          <th className="py-2 font-medium">Contacto</th>
                          <th className="py-2 font-medium">Rubro</th>
                          <th className="py-2 font-medium text-right">Saldo por pagar</th>
                          <th className="py-2 font-medium text-right">Acciones</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100 dark:divide-gray-800/60 text-xs">
                        {(state.suppliers || [])
                          .filter(
                            (sup) =>
                              !q ||
                              sup.name.toLowerCase().includes(q) ||
                              sup.contact.toLowerCase().includes(q) ||
                              sup.category.toLowerCase().includes(q)
                          )
                          .map((sup) => {
                            const isEditing = editingSupplierId === sup.id;
                            return (
                              <tr key={sup.id}>
                                <td className="py-2.5 font-medium pr-2">
                                  {isEditing ? (
                                    <input
                                      type="text"
                                      value={editSupplierName}
                                      onChange={(e) => setEditSupplierName(e.target.value)}
                                      className={`w-full px-2 py-1 rounded border text-xs outline-none ${
                                        isDark ? 'bg-[#151821] border-gray-700 text-gray-100' : 'bg-white border-gray-300 text-slate-900'
                                      }`}
                                    />
                                  ) : (
                                    sup.name
                                  )}
                                </td>
                                <td className="py-2.5 text-gray-500 px-2">
                                  {isEditing ? (
                                    <input
                                      type="text"
                                      value={editSupplierContact}
                                      onChange={(e) => setEditSupplierContact(e.target.value)}
                                      className={`w-full px-2 py-1 rounded border text-xs outline-none ${
                                        isDark ? 'bg-[#151821] border-gray-700 text-gray-100' : 'bg-white border-gray-300 text-slate-900'
                                      }`}
                                    />
                                  ) : (
                                    sup.contact
                                  )}
                                </td>
                                <td className="py-2.5 text-gray-500 px-2">
                                  {isEditing ? (
                                    <input
                                      type="text"
                                      value={editSupplierCategory}
                                      onChange={(e) => setEditSupplierCategory(e.target.value)}
                                      className={`w-full px-2 py-1 rounded border text-xs outline-none ${
                                        isDark ? 'bg-[#151821] border-gray-700 text-gray-100' : 'bg-white border-gray-300 text-slate-900'
                                      }`}
                                    />
                                  ) : (
                                    sup.category
                                  )}
                                </td>
                                <td className="py-2.5 text-right font-semibold text-rose-500 tabular-nums px-2">
                                  {isEditing ? (
                                    <input
                                      type="number"
                                      step="0.01"
                                      min="0"
                                      value={editSupplierBalance}
                                      onChange={(e) => setEditSupplierBalance(e.target.value)}
                                      className={`w-24 ml-auto px-2 py-1 rounded border text-xs text-right tabular-nums outline-none ${
                                        isDark ? 'bg-[#151821] border-gray-700 text-gray-100' : 'bg-white border-gray-300 text-slate-900'
                                      }`}
                                    />
                                  ) : (
                                    `$${(sup.balanceDue ?? 0).toFixed(2)}`
                                  )}
                                </td>
                                <td className="py-2.5 text-right pl-2 whitespace-nowrap">
                                  {isEditing ? (
                                    <div className="inline-flex items-center gap-1.5">
                                      <button
                                        type="button"
                                        onClick={() => handleSaveEditSupplier(sup.id)}
                                        className="px-2.5 py-1 rounded-md text-[11px] font-semibold bg-emerald-600 hover:bg-emerald-700 text-white cursor-pointer"
                                      >
                                        Guardar
                                      </button>
                                      <button
                                        type="button"
                                        onClick={handleCancelEditSupplier}
                                        className={`px-2 py-1 rounded-md text-[11px] font-medium border cursor-pointer ${
                                          isDark ? 'border-gray-700 text-gray-300 hover:bg-gray-800' : 'border-gray-300 text-gray-700 hover:bg-gray-100'
                                        }`}
                                      >
                                        Cancelar
                                      </button>
                                    </div>
                                  ) : (
                                    <div className="inline-flex items-center gap-1.5">
                                      <button
                                        type="button"
                                        onClick={() => handleStartEditSupplier(sup)}
                                        className={`px-2.5 py-1 rounded-md text-[11px] font-semibold border transition cursor-pointer ${
                                          isDark ? 'border-gray-700 text-indigo-400 hover:bg-gray-800' : 'border-indigo-200 text-indigo-600 hover:bg-indigo-50'
                                        }`}
                                      >
                                        Modificar
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => handleDeleteSupplier(sup.id)}
                                        className="px-2.5 py-1 rounded-md text-[11px] font-semibold border border-rose-500/30 text-rose-500 hover:bg-rose-500/10 transition cursor-pointer"
                                      >
                                        Borrar
                                      </button>
                                    </div>
                                  )}
                                </td>
                              </tr>
                            );
                          })}
                        {(state.suppliers || []).length === 0 && (
                          <tr>
                            <td colSpan={5} className="py-6 text-center text-gray-400">
                              No hay proveedores registrados. Usa el formulario de arriba para agregar uno.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {state.operationsSection === 'gastos_generales' && (
                <div className="space-y-4">
                  <form
                    onSubmit={handleAddGeneralExpense}
                    className={`rounded-xl border p-4 space-y-3 text-xs ${
                      isDark ? 'bg-[#0F1115]/70 border-gray-800' : 'bg-slate-50/90 border-indigo-200/80'
                    }`}
                  >
                    <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
                      <div className="sm:col-span-4">
                        <label className="block text-[11px] font-semibold text-gray-500 mb-1">
                          Motivo del gasto *
                        </label>
                        <input
                          type="text"
                          value={newExpenseReason}
                          onChange={(e) => setNewExpenseReason(e.target.value)}
                          placeholder="Ej. Alquiler local, Servicio eléctrico, Internet..."
                          required
                          className={`w-full px-3 py-2 rounded-lg border outline-none ${
                            isDark ? 'bg-[#151821] border-gray-700 text-gray-100' : 'bg-white border-gray-300 text-slate-900'
                          }`}
                        />
                      </div>
                      <div className="sm:col-span-2">
                        <label className="block text-[11px] font-semibold text-gray-500 mb-1">
                          N° de factura
                        </label>
                        <input
                          type="text"
                          value={newExpenseInvoice}
                          onChange={(e) => setNewExpenseInvoice(e.target.value)}
                          placeholder="Ej. FAC-00142"
                          className={`w-full px-3 py-2 rounded-lg border outline-none ${
                            isDark ? 'bg-[#151821] border-gray-700 text-gray-100' : 'bg-white border-gray-300 text-slate-900'
                          }`}
                        />
                      </div>
                      <div className="sm:col-span-2">
                        <label className="block text-[11px] font-semibold text-gray-500 mb-1">
                          Monto ($) *
                        </label>
                        <input
                          type="number"
                          step="0.01"
                          min="0.01"
                          value={newExpenseAmount}
                          onChange={(e) => setNewExpenseAmount(e.target.value)}
                          placeholder="0.00"
                          required
                          className={`w-full px-3 py-2 rounded-lg border tabular-nums outline-none ${
                            isDark ? 'bg-[#151821] border-gray-700 text-gray-100' : 'bg-white border-gray-300 text-slate-900'
                          }`}
                        />
                      </div>
                      <div className="sm:col-span-2">
                        <label className="block text-[11px] font-semibold text-gray-500 mb-1">
                          Fecha
                        </label>
                        <input
                          type="date"
                          value={newExpenseDate}
                          onChange={(e) => setNewExpenseDate(e.target.value)}
                          className={`w-full px-3 py-2 rounded-lg border tabular-nums outline-none ${
                            isDark ? 'bg-[#151821] border-gray-700 text-gray-100' : 'bg-white border-gray-300 text-slate-900'
                          }`}
                        />
                      </div>
                      <div className="sm:col-span-2">
                        <label className="block text-[11px] font-semibold text-gray-500 mb-1">
                          Cuenta
                        </label>
                        <select
                          value={newExpenseAccountId}
                          onChange={(e) => setNewExpenseAccountId(e.target.value)}
                          className={`w-full px-3 py-2 rounded-lg border outline-none ${
                            isDark ? 'bg-[#151821] border-gray-700 text-gray-100' : 'bg-white border-gray-300 text-slate-900'
                          }`}
                        >
                          {(state.accounts || []).map((acc) => (
                            <option key={acc.id} value={acc.id}>
                              {acc.name}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-end">
                      <div className="sm:col-span-3">
                        <label className="block text-[11px] font-semibold text-gray-500 mb-1">
                          Beneficiario / Emisor
                        </label>
                        <input
                          type="text"
                          value={newExpenseBeneficiary}
                          onChange={(e) => setNewExpenseBeneficiary(e.target.value)}
                          placeholder="Ej. Corpoelec / Proveedor"
                          className={`w-full px-3 py-2 rounded-lg border outline-none ${
                            isDark ? 'bg-[#151821] border-gray-700 text-gray-100' : 'bg-white border-gray-300 text-slate-900'
                          }`}
                        />
                      </div>
                      <div className="sm:col-span-3">
                        <label className="block text-[11px] font-semibold text-gray-500 mb-1">
                          Forma de pago
                        </label>
                        <input
                          type="text"
                          value={newExpenseMethod}
                          onChange={(e) => setNewExpenseMethod(e.target.value)}
                          placeholder="Efectivo Divisa / Pago Móvil"
                          className={`w-full px-3 py-2 rounded-lg border outline-none ${
                            isDark ? 'bg-[#151821] border-gray-700 text-gray-100' : 'bg-white border-gray-300 text-slate-900'
                          }`}
                        />
                      </div>
                      <div className="sm:col-span-4">
                        <label className="block text-[11px] font-semibold text-gray-500 mb-1">
                          Otros detalles / Observaciones
                        </label>
                        <input
                          type="text"
                          value={newExpenseDetails}
                          onChange={(e) => setNewExpenseDetails(e.target.value)}
                          placeholder="Referencia, período, concepto adicional..."
                          className={`w-full px-3 py-2 rounded-lg border outline-none ${
                            isDark ? 'bg-[#151821] border-gray-700 text-gray-100' : 'bg-white border-gray-300 text-slate-900'
                          }`}
                        />
                      </div>
                      <div className="sm:col-span-2">
                        <button
                          type="submit"
                          className="w-full py-2 px-3 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-semibold transition cursor-pointer"
                        >
                          + Agregar gasto
                        </button>
                      </div>
                    </div>
                  </form>

                  {expenseFeedback && (
                    <div className="px-3 py-2 rounded-lg text-xs font-medium bg-emerald-500/10 text-emerald-500 border border-emerald-500/25">
                      {expenseFeedback}
                    </div>
                  )}

                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="border-b border-gray-200 dark:border-gray-800 text-[11px] uppercase text-gray-400">
                          <th className="py-2 font-medium">Fecha</th>
                          <th className="py-2 font-medium">Motivo</th>
                          <th className="py-2 font-medium">N° Factura</th>
                          <th className="py-2 font-medium">Otros detalles</th>
                          <th className="py-2 font-medium text-right">Monto</th>
                          <th className="py-2 font-medium text-right">Acción</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100 dark:divide-gray-800/60 text-xs">
                        {(state.generalExpenses || [])
                          .filter(
                            (g) =>
                              !q ||
                              (g.reason || '').toLowerCase().includes(q) ||
                              (g.invoiceNumber || '').toLowerCase().includes(q) ||
                              (g.notes || '').toLowerCase().includes(q) ||
                              (g.supplierOrBeneficiary || '').toLowerCase().includes(q) ||
                              (g.date || '').includes(q)
                          )
                          .map((g) => (
                            <tr key={g.id}>
                              <td className="py-2.5 text-gray-500 tabular-nums whitespace-nowrap pr-2">{g.date}</td>
                              <td className="py-2.5 font-medium px-2">{g.reason}</td>
                              <td className="py-2.5 font-mono text-indigo-500 px-2 whitespace-nowrap">
                                {g.invoiceNumber || 'S/N'}
                              </td>
                              <td className="py-2.5 text-gray-500 px-2">
                                <div>
                                  {[
                                    g.supplierOrBeneficiary ? `Beneficiario: ${g.supplierOrBeneficiary}` : '',
                                    g.paymentMethod ? `Pago: ${g.paymentMethod}` : '',
                                  ]
                                    .filter(Boolean)
                                    .join(' · ') || '-'}
                                </div>
                                {g.notes && <div className="text-[11px] text-gray-400">{g.notes}</div>}
                              </td>
                              <td className="py-2.5 text-right font-semibold text-rose-500 tabular-nums px-2 whitespace-nowrap">
                                ${Number(g.amount || 0).toFixed(2)}
                              </td>
                              <td className="py-2.5 text-right pl-2 whitespace-nowrap">
                                <button
                                  type="button"
                                  onClick={() => handleDeleteGeneralExpense(g.id)}
                                  className="px-2.5 py-1 rounded-md text-[11px] font-semibold border border-rose-500/30 text-rose-500 hover:bg-rose-500/10 transition cursor-pointer"
                                >
                                  Borrar
                                </button>
                              </td>
                            </tr>
                          ))}
                        {(state.generalExpenses || []).length === 0 && (
                          <tr>
                            <td colSpan={6} className="py-6 text-center text-gray-400">
                              No hay gastos generales registrados. Usa el formulario de arriba para agregar un gasto.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {state.operationsSection === 'cierre_de_caja' && (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-gray-200 dark:border-gray-800 text-[11px] uppercase text-gray-400">
                        <th className="py-2 font-medium">Fecha</th>
                        <th className="py-2 font-medium">Operador</th>
                        <th className="py-2 font-medium text-right">Apertura</th>
                        <th className="py-2 font-medium text-right">Esperado</th>
                        <th className="py-2 font-medium text-right">Contado</th>
                        <th className="py-2 font-medium text-right">Estado</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-gray-800/60 text-xs">
                      {state.cashClosings
                        .filter(
                          (cc) =>
                            !q ||
                            cc.operator.toLowerCase().includes(q) ||
                            cc.status.toLowerCase().includes(q) ||
                            cc.date.includes(q)
                        )
                        .map((cc) => (
                          <tr key={cc.id}>
                            <td className="py-2.5 text-gray-500 tabular-nums">{cc.date}</td>
                            <td className="py-2.5 font-medium">{cc.operator}</td>
                            <td className="py-2.5 text-right tabular-nums">${cc.openingCash.toFixed(2)}</td>
                            <td className="py-2.5 text-right tabular-nums">${cc.expectedCash.toFixed(2)}</td>
                            <td className="py-2.5 text-right font-semibold tabular-nums">${cc.countedCash.toFixed(2)}</td>
                            <td className="py-2.5 text-right">
                              <span
                                className={`px-2 py-0.5 rounded-full text-[11px] font-medium ${
                                  cc.status === 'Cuadrado'
                                    ? 'bg-emerald-500/10 text-emerald-500'
                                    : 'bg-amber-500/10 text-amber-500'
                                }`}
                              >
                                {cc.status}
                              </span>
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              )}

              {state.operationsSection === 'cuentas_de_operadores' && (
                <div className="space-y-4 text-xs">
                  <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-gray-200 dark:border-gray-800">
                    <div>
                      <p className="text-gray-500">
                        Roles disponibles: <strong>Administrador</strong>, <strong>Gerente</strong> y cantidad ilimitada de <strong>Operadores</strong> creados por el Administrador.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setLoginSelectedOpId(currentOperator?.id || state.operatorAccounts[0]?.id || '');
                        setLoginPinInput('');
                        setLoginError(null);
                        setIsSwitchOperatorOpen(true);
                      }}
                      className="px-3 py-1.5 rounded-lg border border-indigo-500/30 bg-indigo-500/10 text-indigo-500 font-semibold hover:bg-indigo-600 hover:text-white transition cursor-pointer"
                    >
                      Cambiar / Entrar como operador
                    </button>
                  </div>

                  {canManageOperators && (
                    <form
                      onSubmit={handleSaveAdminDiscountPin}
                      className={`rounded-xl border p-3.5 flex flex-col sm:flex-row sm:items-end justify-between gap-3 ${
                        isDark ? 'bg-gray-900/50 border-gray-800' : 'bg-white border-indigo-200/70'
                      }`}
                    >
                      <div className="space-y-0.5">
                        <p className="font-bold text-indigo-500">
                          Clave de Administrador para Descuentos en Ventas
                        </p>
                        <p className="text-[11px] text-gray-500">
                          Clave actual: <strong className="tabular-nums">{state.adminDiscountPin || '1234'}</strong> · Requerida para aplicar cualquier % de descuento en la factura total.
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <input
                          type="password"
                          maxLength={12}
                          placeholder="Nueva clave admin..."
                          value={adminPinDraft}
                          onChange={(e) => {
                            setAdminPinDraft(e.target.value);
                            setAdminPinMsg(null);
                          }}
                          className={`px-3 py-1.5 rounded-lg border text-xs tabular-nums outline-none ${
                            isDark ? 'bg-gray-950 border-gray-700' : 'bg-[#F8FAFF] border-gray-300'
                          }`}
                        />
                        <button
                          type="submit"
                          className="px-3.5 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs transition cursor-pointer shrink-0"
                        >
                          Guardar clave
                        </button>
                      </div>
                    </form>
                  )}

                  {adminPinMsg && (
                    <div className="flex items-center justify-between rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3.5 py-2 text-xs text-emerald-600 dark:text-emerald-300 font-medium">
                      <span>{adminPinMsg}</span>
                      <button type="button" onClick={() => setAdminPinMsg(null)}>
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}

                  {canManageOperators ? (
                    <form
                      onSubmit={handleCreateOperator}
                      className={`rounded-xl border p-4 space-y-3.5 ${
                        isDark ? 'bg-gray-900/50 border-gray-800' : 'bg-white border-indigo-200/70'
                      }`}
                    >
                      <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-end">
                        <div className="sm:col-span-5">
                          <label className="block text-[11px] text-gray-500 mb-1">Nombre del operador</label>
                          <input
                            type="text"
                            required
                            placeholder="Ej. Carlos (Operador Ventas)..."
                            value={newOpName}
                            onChange={(e) => setNewOpName(e.target.value)}
                            className={`w-full px-3 py-2 rounded-lg border outline-none ${
                              isDark ? 'bg-gray-950 border-gray-700' : 'bg-[#F8FAFF] border-gray-300'
                            }`}
                          />
                        </div>

                        <div className="sm:col-span-4">
                          <label className="block text-[11px] text-gray-500 mb-1">Rol</label>
                          <select
                            value={newOpRole}
                            onChange={(e) => {
                              const nextRole = e.target.value as OperatorRoleType;
                              setNewOpRole(nextRole);
                              setNewOpPermissions(ROLE_DEFAULT_PERMISSIONS[nextRole]);
                            }}
                            className={`w-full px-3 py-2 rounded-lg border font-semibold outline-none ${
                              isDark ? 'bg-gray-950 border-gray-700' : 'bg-[#F8FAFF] border-gray-300'
                            }`}
                          >
                            <option value="Administrador">Administrador</option>
                            <option value="Gerente">Gerente</option>
                            <option value="Operador">Operador</option>
                          </select>
                        </div>

                        <div className="sm:col-span-3">
                          <label className="block text-[11px] text-gray-500 mb-1">PIN acceso (opcional)</label>
                          <input
                            type="text"
                            maxLength={8}
                            placeholder="Ej. 1234"
                            value={newOpPin}
                            onChange={(e) => setNewOpPin(e.target.value)}
                            className={`w-full px-3 py-2 rounded-lg border tabular-nums outline-none ${
                              isDark ? 'bg-gray-950 border-gray-700' : 'bg-[#F8FAFF] border-gray-300'
                            }`}
                          />
                        </div>
                      </div>

                      <div className="pt-2 border-t border-gray-200/70 dark:border-gray-800 space-y-2">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <span className="text-[11px] font-bold uppercase tracking-wider text-indigo-500">
                            Permisos otorgados al entrar:
                          </span>
                          {newOpRole !== 'Administrador' && (
                            <div className="flex items-center gap-2 text-[11px]">
                              <button
                                type="button"
                                onClick={() => setNewOpPermissions(['ventas'])}
                                className="px-2 py-0.5 rounded border border-indigo-500/30 text-indigo-500 font-semibold hover:bg-indigo-500/10 cursor-pointer"
                              >
                                Solo Ventas
                              </button>
                              <button
                                type="button"
                                onClick={() => setNewOpPermissions(ALL_OPERATOR_PERMISSIONS.map((p) => p.key))}
                                className="px-2 py-0.5 rounded border border-gray-300 dark:border-gray-700 text-gray-500 font-semibold cursor-pointer"
                              >
                                Todos
                              </button>
                              <button
                                type="button"
                                onClick={() => setNewOpPermissions([])}
                                className="px-2 py-0.5 rounded border border-gray-300 dark:border-gray-700 text-gray-500 font-semibold cursor-pointer"
                              >
                                Ninguno
                              </button>
                            </div>
                          )}
                        </div>

                        {newOpRole === 'Administrador' ? (
                          <p className="text-[11px] text-emerald-500 font-semibold">
                            El rol Administrador tiene acceso completo a todas las secciones y permisos.
                          </p>
                        ) : (
                          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                            {ALL_OPERATOR_PERMISSIONS.map((perm) => {
                              const checked = newOpPermissions.includes(perm.key);
                              return (
                                <label
                                  key={perm.key}
                                  className={`flex items-center gap-2 px-2.5 py-1.5 rounded-lg border cursor-pointer transition ${
                                    checked
                                      ? 'bg-indigo-600/10 border-indigo-500/40 text-indigo-600 dark:text-indigo-300 font-semibold'
                                      : isDark
                                      ? 'bg-gray-950 border-gray-800 text-gray-400'
                                      : 'bg-[#F8FAFF] border-gray-200 text-gray-600'
                                  }`}
                                >
                                  <input
                                    type="checkbox"
                                    checked={checked}
                                    onChange={(e) => {
                                      if (e.target.checked) {
                                        setNewOpPermissions((prev) => Array.from(new Set([...prev, perm.key])));
                                      } else {
                                        setNewOpPermissions((prev) => prev.filter((k) => k !== perm.key));
                                      }
                                    }}
                                    className="rounded"
                                  />
                                  <span className="truncate">{perm.label}</span>
                                </label>
                              );
                            })}
                          </div>
                        )}
                      </div>

                      <div className="flex justify-end">
                        <button
                          type="submit"
                          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-semibold transition cursor-pointer"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          <span>Crear Operador</span>
                        </button>
                      </div>
                    </form>
                  ) : (
                    <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-amber-600 dark:text-amber-300 font-medium">
                      Estás conectado como <strong>{currentOperator?.operatorName}</strong> ({currentRole}). Solo un <strong>Administrador</strong> puede crear operadores o modificar permisos.
                    </div>
                  )}

                  {opFeedback && (
                    <div className="flex items-center justify-between rounded-lg border border-indigo-500/30 bg-indigo-500/10 px-3.5 py-2 text-xs text-indigo-600 dark:text-indigo-300 font-medium">
                      <span>{opFeedback}</span>
                      <button type="button" onClick={() => setOpFeedback(null)}>
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}

                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="border-b border-gray-200 dark:border-gray-800 text-[11px] uppercase text-gray-400">
                          <th className="py-2 font-medium">Operador</th>
                          <th className="py-2 font-medium">Rol</th>
                          <th className="py-2 font-medium">Cuenta vinculada</th>
                          <th className="py-2 font-medium">Permisos</th>
                          <th className="py-2 font-medium text-right">Estado</th>
                          <th className="py-2 font-medium text-right">Acciones</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100 dark:divide-gray-800/60 text-xs">
                        {state.operatorAccounts
                          .filter(
                            (op) =>
                              !q ||
                              op.operatorName.toLowerCase().includes(q) ||
                              op.role.toLowerCase().includes(q) ||
                              (op.assignedAccount || '').toLowerCase().includes(q)
                          )
                          .map((op) => {
                            const normRole = normalizeOperatorRole(op.role);
                            const opPerms = getEffectiveOperatorPermissions(op);
                            const permLabels =
                              normRole === 'Administrador'
                                ? 'Acceso total'
                                : opPerms.length === 0
                                ? 'Sin permisos'
                                : opPerms
                                    .map(
                                      (pk) =>
                                        ALL_OPERATOR_PERMISSIONS.find((p) => p.key === pk)?.label || pk
                                    )
                                    .join(', ');
                            const isCurrent = currentOperator?.id === op.id;

                            return (
                              <tr key={op.id} className="hover:bg-black/[0.02] dark:hover:bg-white/[0.02]">
                                <td className="py-2.5 font-semibold">
                                  {op.operatorName}{' '}
                                  {isCurrent && (
                                    <span className="ml-1.5 text-[10px] px-1.5 py-0.5 rounded bg-indigo-500/15 text-indigo-500 font-bold">
                                      Activo ahora
                                    </span>
                                  )}
                                </td>
                                <td className="py-2.5">
                                  <span
                                    className={`px-2 py-0.5 rounded-md text-[11px] font-semibold ${
                                      normRole === 'Administrador'
                                        ? 'bg-indigo-500/15 text-indigo-500'
                                        : normRole === 'Gerente'
                                        ? 'bg-amber-500/15 text-amber-600 dark:text-amber-300'
                                        : 'bg-sky-500/15 text-sky-600 dark:text-sky-300'
                                    }`}
                                  >
                                    {normRole}
                                  </span>
                                </td>
                                <td className="py-2.5 text-gray-500">{op.assignedAccount}</td>
                                <td className="py-2.5 text-gray-500 max-w-xs truncate" title={permLabels}>
                                  {permLabels}
                                </td>
                                <td className="py-2.5 text-right">
                                  <button
                                    type="button"
                                    disabled={!canManageOperators}
                                    onClick={() => handleToggleOperatorStatus(op.id)}
                                    className={`px-2.5 py-1 rounded-md text-[11px] font-medium border transition disabled:opacity-50 ${
                                      op.active
                                        ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/30'
                                        : 'text-gray-400 border-gray-300 dark:border-gray-700'
                                    }`}
                                  >
                                    {op.active ? 'Activa' : 'Inactiva'}
                                  </button>
                                </td>
                                <td className="py-2.5 text-right whitespace-nowrap">
                                  <div className="inline-flex items-center justify-end gap-1.5">
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setLoginSelectedOpId(op.id);
                                        setLoginPinInput('');
                                        setLoginError(null);
                                        setIsSwitchOperatorOpen(true);
                                      }}
                                      className="px-2.5 py-1 rounded-md text-[11px] font-medium border border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-300 hover:bg-emerald-600 hover:text-white transition cursor-pointer"
                                    >
                                      Entrar
                                    </button>
                                    {canManageOperators && (
                                      <>
                                        <button
                                          type="button"
                                          onClick={() => handleOpenEditOperator(op)}
                                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-medium bg-indigo-500/10 text-indigo-500 border border-indigo-500/30 hover:bg-indigo-600 hover:text-white transition cursor-pointer"
                                        >
                                          <Pencil className="w-3 h-3" />
                                          <span>Editar</span>
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() => handleDeleteOperator(op.id)}
                                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-medium bg-rose-500/10 text-rose-500 border border-rose-500/30 hover:bg-rose-500 hover:text-white transition cursor-pointer"
                                        >
                                          <Trash2 className="w-3 h-3" />
                                          <span>Borrar</span>
                                        </button>
                                      </>
                                    )}
                                  </div>
                                </td>
                              </tr>
                            );
                          })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

                            {state.operationsSection === 'categoria_de_productos' && (
                <div className="space-y-4">
                  <form
                    onSubmit={handleAddProductCategory}
                    className={`rounded-xl border p-4 flex flex-col sm:flex-row gap-3 items-stretch sm:items-end text-xs ${
                      isDark ? 'bg-gray-900/50 border-gray-800' : 'bg-white border-indigo-200/70'
                    }`}
                  >
                    <div className="flex-1">
                      <label className="block text-[11px] text-gray-500 mb-1">
                        Nombre de la categoría de productos
                      </label>
                      <input
                        type="text"
                        required
                        placeholder="Ej. Bebidas, Filtros, Lubricantes, Accesorios..."
                        value={newProductCategoryName}
                        onChange={(e) => {
                          setNewProductCategoryName(e.target.value);
                          setCategoryFeedback(null);
                        }}
                        className={`w-full px-3 py-2 rounded-lg border text-xs outline-none ${
                          isDark ? 'bg-gray-950 border-gray-700' : 'bg-[#F8FAFF] border-gray-300'
                        }`}
                      />
                    </div>
                    <button
                      type="submit"
                      className="px-4 py-2 rounded-lg font-semibold bg-indigo-600 text-white hover:bg-indigo-700 transition cursor-pointer"
                    >
                      + Agregar Categoría
                    </button>
                  </form>

                  {categoryFeedback && (
                    <div
                      className={`px-3.5 py-2 rounded-lg border text-xs font-medium ${
                        isDark
                          ? 'bg-indigo-950/50 border-indigo-800 text-indigo-200'
                          : 'bg-indigo-50 border-indigo-200 text-indigo-800'
                      }`}
                    >
                      {categoryFeedback}
                    </div>
                  )}

                  <div
                    className={`rounded-xl border overflow-x-auto ${
                      isDark ? 'bg-gray-900/40 border-gray-800' : 'bg-white border-indigo-200/70'
                    }`}
                  >
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr
                          className={`border-b text-[11px] uppercase tracking-wider ${
                            isDark ? 'border-gray-800 text-gray-400' : 'border-gray-200 text-gray-500'
                          }`}
                        >
                          <th className="py-3 px-4">Categoría</th>
                          <th className="py-3 px-4">Productos asignados</th>
                          <th className="py-3 px-4 text-right">Acción</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200 dark:divide-gray-800">
                        {availableProductCategories
                          .filter((c) => !opsSearchQuery.trim() || c.toLowerCase().includes(opsSearchQuery.trim().toLowerCase()))
                          .map((catName) => {
                            const count = state.products.filter(
                              (p) => p.category.toLowerCase() === catName.toLowerCase()
                            ).length;
                            return (
                              <tr key={catName}>
                                <td className="py-3 px-4 font-semibold">{catName}</td>
                                <td className="py-3 px-4 tabular-nums text-gray-500">
                                  {count} producto{count === 1 ? '' : 's'}
                                </td>
                                <td className="py-3 px-4 text-right">
                                  <button
                                    type="button"
                                    onClick={() => handleDeleteProductCategory(catName)}
                                    className="px-2.5 py-1 rounded-lg border border-rose-500/40 text-rose-500 hover:bg-rose-500/10 text-[11px] font-semibold cursor-pointer"
                                  >
                                    Eliminar
                                  </button>
                                </td>
                              </tr>
                            );
                          })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

                          {dueSoonReminders.length > 0 && (
              <div
                className={`mb-4 rounded-xl border px-4 py-3 text-xs flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 ${
                  isDark
                    ? 'bg-amber-950/40 border-amber-700/60 text-amber-200'
                    : 'bg-amber-50 border-amber-300 text-amber-950'
                }`}
              >
                <div className="space-y-0.5">
                  <div className="font-bold">
                    Recordatorio de vencimientos ({dueSoonReminders.length} cuenta{dueSoonReminders.length === 1 ? '' : 's'} próxima{dueSoonReminders.length === 1 ? '' : 's'} o vencida{dueSoonReminders.length === 1 ? '' : 's'}, incl. Cashea)
                  </div>
                  <div className="text-[11px] opacity-90">
                    {dueSoonReminders.slice(0, 3).map((al) => `${al.kind} ${al.title} (${al.channel} · vence ${al.dueDate} · $${al.balance.toFixed(2)})`).join(' · ')}
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => handleSelectOperationsSection('cuentas_por_cobrar')}
                    className="px-3 py-1.5 rounded-lg font-semibold bg-amber-600 text-white hover:bg-amber-700 cursor-pointer"
                  >
                    Ver Cobros
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSelectOperationsSection('cuentas_por_pagar')}
                    className="px-3 py-1.5 rounded-lg font-semibold border border-amber-500/50 hover:bg-amber-500/10 cursor-pointer"
                  >
                    Ver Pagos
                  </button>
                </div>
              </div>
            )}

                            {state.operationsSection === 'cuentas_por_cobrar' && (
                <div className="space-y-4">
                  <form
                    onSubmit={handleCreateReceivable}
                    className={`rounded-xl border p-4 grid grid-cols-1 sm:grid-cols-12 gap-3 items-end text-xs ${
                      isDark ? 'bg-gray-900/50 border-gray-800' : 'bg-white border-indigo-200/70'
                    }`}
                  >
                    <div className="sm:col-span-3">
                      <label className="block text-[11px] text-gray-500 mb-1">Cliente / Afiliado *</label>
                      <input
                        type="text"
                        required
                        placeholder="Nombre del cliente..."
                        value={recCustomerName}
                        onChange={(e) => setRecCustomerName(e.target.value)}
                        className={`w-full px-3 py-2 rounded-lg border text-xs outline-none ${isDark ? 'bg-gray-950 border-gray-700' : 'bg-[#F8FAFF] border-gray-300'}`}
                      />
                    </div>
                    <div className="sm:col-span-2">
                      <label className="block text-[11px] text-gray-500 mb-1">Cuenta / Plan</label>
                      <select
                        value={recChannel}
                        onChange={(e) => setRecChannel(e.target.value)}
                        className={`w-full px-3 py-2 rounded-lg border text-xs font-semibold outline-none ${isDark ? 'bg-gray-950 border-gray-700' : 'bg-[#F8FAFF] border-gray-300'}`}
                      >
                        <option value="Cashea">Cashea</option>
                        <option value="Crédito Directo">Crédito Directo</option>
                        <option value="Cuenta Principal">Cuenta Principal</option>
                        <option value="Billetera Digital">Billetera Digital</option>
                      </select>
                    </div>
                    <div className="sm:col-span-2">
                      <label className="block text-[11px] text-gray-500 mb-1">Referencia</label>
                      <input
                        type="text"
                        placeholder="Ej. FAC-1020"
                        value={recReference}
                        onChange={(e) => setRecReference(e.target.value)}
                        className={`w-full px-3 py-2 rounded-lg border text-xs outline-none ${isDark ? 'bg-gray-950 border-gray-700' : 'bg-[#F8FAFF] border-gray-300'}`}
                      />
                    </div>
                    <div className="sm:col-span-2">
                      <label className="block text-[11px] text-gray-500 mb-1">Monto ($) *</label>
                      <input
                        type="number"
                        step="0.01"
                        min="0.01"
                        required
                        value={recAmount}
                        onChange={(e) => setRecAmount(e.target.value)}
                        className={`w-full px-3 py-2 rounded-lg border text-xs tabular-nums outline-none ${isDark ? 'bg-gray-950 border-gray-700' : 'bg-[#F8FAFF] border-gray-300'}`}
                      />
                    </div>
                    <div className="sm:col-span-2">
                      <label className="block text-[11px] text-gray-500 mb-1">Vencimiento</label>
                      <input
                        type="date"
                        value={recDueDate}
                        onChange={(e) => setRecDueDate(e.target.value)}
                        className={`w-full px-3 py-2 rounded-lg border text-xs outline-none ${isDark ? 'bg-gray-950 border-gray-700' : 'bg-[#F8FAFF] border-gray-300'}`}
                      />
                    </div>
                    <div className="sm:col-span-1">
                      <button
                        type="submit"
                        className="w-full py-2 px-2.5 rounded-lg font-semibold bg-indigo-600 text-white hover:bg-indigo-700 cursor-pointer"
                      >
                        + Crear
                      </button>
                    </div>
                  </form>

                  <div className={`rounded-xl border overflow-x-auto ${isDark ? 'bg-gray-900/40 border-gray-800' : 'bg-white border-indigo-200/70'}`}>
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className={`border-b text-[11px] uppercase ${isDark ? 'border-gray-800 text-gray-400' : 'border-gray-200 text-gray-500'}`}>
                          <th className="py-3 px-3">Cliente</th>
                          <th className="py-3 px-3">Cuenta</th>
                          <th className="py-3 px-3">Ref.</th>
                          <th className="py-3 px-3">Vence</th>
                          <th className="py-3 px-3 text-right">Saldo</th>
                          <th className="py-3 px-3">Estado</th>
                          <th className="py-3 px-3 text-right">Cobro / Anticipado</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200 dark:divide-gray-800">
                        {(state.receivables || []).map((r) => (
                          <tr key={r.id}>
                            <td className="py-3 px-3 font-semibold">{r.customerName}</td>
                            <td className="py-3 px-3">{r.channelOrAccount}</td>
                            <td className="py-3 px-3 tabular-nums">{r.reference}</td>
                            <td className="py-3 px-3 tabular-nums">{r.dueDate}</td>
                            <td className="py-3 px-3 text-right font-bold tabular-nums">${r.balanceDue.toFixed(2)}</td>
                            <td className="py-3 px-3 font-semibold">{r.status}</td>
                            <td className="py-3 px-3 text-right">
                              {r.balanceDue > 0 ? (
                                <div className="inline-flex items-center gap-1.5">
                                  <input
                                    type="number"
                                    step="0.01"
                                    placeholder={r.balanceDue.toFixed(2)}
                                    value={recPaymentAmount[r.id] || ''}
                                    onChange={(e) => setRecPaymentAmount((prev) => ({ ...prev, [r.id]: e.target.value }))}
                                    className={`w-20 px-2 py-1 rounded border text-[11px] tabular-nums ${isDark ? 'bg-gray-950 border-gray-700' : 'bg-white border-gray-300'}`}
                                  />
                                  <button
                                    type="button"
                                    onClick={() => handlePayReceivable(r.id, false)}
                                    className="px-2.5 py-1 rounded bg-emerald-600 text-white text-[11px] font-semibold hover:bg-emerald-700 cursor-pointer"
                                  >
                                    Abonar
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handlePayReceivable(r.id, true)}
                                    className="px-2.5 py-1 rounded bg-indigo-600 text-white text-[11px] font-semibold hover:bg-indigo-700 cursor-pointer"
                                  >
                                    Cobro anticipado
                                  </button>
                                </div>
                              ) : (
                                <span className="text-[11px] text-emerald-600 font-semibold">Liquidada</span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {state.operationsSection === 'cuentas_por_pagar' && (
                <div className="space-y-4">
                  <form
                    onSubmit={handleCreatePayable}
                    className={`rounded-xl border p-4 grid grid-cols-1 sm:grid-cols-12 gap-3 items-end text-xs ${
                      isDark ? 'bg-gray-900/50 border-gray-800' : 'bg-white border-indigo-200/70'
                    }`}
                  >
                    <div className="sm:col-span-3">
                      <label className="block text-[11px] text-gray-500 mb-1">Proveedor / Beneficiario *</label>
                      <input
                        type="text"
                        required
                        placeholder="Nombre del proveedor..."
                        value={paySupplierName}
                        onChange={(e) => setPaySupplierName(e.target.value)}
                        className={`w-full px-3 py-2 rounded-lg border text-xs outline-none ${isDark ? 'bg-gray-950 border-gray-700' : 'bg-[#F8FAFF] border-gray-300'}`}
                      />
                    </div>
                    <div className="sm:col-span-2">
                      <label className="block text-[11px] text-gray-500 mb-1">Cuenta</label>
                      <input
                        type="text"
                        value={payChannel}
                        onChange={(e) => setPayChannel(e.target.value)}
                        className={`w-full px-3 py-2 rounded-lg border text-xs outline-none ${isDark ? 'bg-gray-950 border-gray-700' : 'bg-[#F8FAFF] border-gray-300'}`}
                      />
                    </div>
                    <div className="sm:col-span-2">
                      <label className="block text-[11px] text-gray-500 mb-1">Referencia</label>
                      <input
                        type="text"
                        placeholder="Ej. COMP-305"
                        value={payReference}
                        onChange={(e) => setPayReference(e.target.value)}
                        className={`w-full px-3 py-2 rounded-lg border text-xs outline-none ${isDark ? 'bg-gray-950 border-gray-700' : 'bg-[#F8FAFF] border-gray-300'}`}
                      />
                    </div>
                    <div className="sm:col-span-2">
                      <label className="block text-[11px] text-gray-500 mb-1">Monto ($) *</label>
                      <input
                        type="number"
                        step="0.01"
                        min="0.01"
                        required
                        value={payAmount}
                        onChange={(e) => setPayAmount(e.target.value)}
                        className={`w-full px-3 py-2 rounded-lg border text-xs tabular-nums outline-none ${isDark ? 'bg-gray-950 border-gray-700' : 'bg-[#F8FAFF] border-gray-300'}`}
                      />
                    </div>
                    <div className="sm:col-span-2">
                      <label className="block text-[11px] text-gray-500 mb-1">Vencimiento</label>
                      <input
                        type="date"
                        value={payDueDate}
                        onChange={(e) => setPayDueDate(e.target.value)}
                        className={`w-full px-3 py-2 rounded-lg border text-xs outline-none ${isDark ? 'bg-gray-950 border-gray-700' : 'bg-[#F8FAFF] border-gray-300'}`}
                      />
                    </div>
                    <div className="sm:col-span-1">
                      <button
                        type="submit"
                        className="w-full py-2 px-2.5 rounded-lg font-semibold bg-indigo-600 text-white hover:bg-indigo-700 cursor-pointer"
                      >
                        + Crear
                      </button>
                    </div>
                  </form>

                  <div className={`rounded-xl border overflow-x-auto ${isDark ? 'bg-gray-900/40 border-gray-800' : 'bg-white border-indigo-200/70'}`}>
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className={`border-b text-[11px] uppercase ${isDark ? 'border-gray-800 text-gray-400' : 'border-gray-200 text-gray-500'}`}>
                          <th className="py-3 px-3">Proveedor</th>
                          <th className="py-3 px-3">Ref.</th>
                          <th className="py-3 px-3">Vence</th>
                          <th className="py-3 px-3 text-right">Saldo</th>
                          <th className="py-3 px-3">Estado</th>
                          <th className="py-3 px-3 text-right">Pago / Anticipado</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200 dark:divide-gray-800">
                        {(state.payables || []).map((p) => (
                          <tr key={p.id}>
                            <td className="py-3 px-3 font-semibold">{p.supplierName}</td>
                            <td className="py-3 px-3 tabular-nums">{p.reference}</td>
                            <td className="py-3 px-3 tabular-nums">{p.dueDate}</td>
                            <td className="py-3 px-3 text-right font-bold tabular-nums">${p.balanceDue.toFixed(2)}</td>
                            <td className="py-3 px-3 font-semibold">{p.status}</td>
                            <td className="py-3 px-3 text-right">
                              {p.balanceDue > 0 ? (
                                <div className="inline-flex items-center gap-1.5">
                                  <input
                                    type="number"
                                    step="0.01"
                                    placeholder={p.balanceDue.toFixed(2)}
                                    value={payPaymentAmount[p.id] || ''}
                                    onChange={(e) => setPayPaymentAmount((prev) => ({ ...prev, [p.id]: e.target.value }))}
                                    className={`w-20 px-2 py-1 rounded border text-[11px] tabular-nums ${isDark ? 'bg-gray-950 border-gray-700' : 'bg-white border-gray-300'}`}
                                  />
                                  <button
                                    type="button"
                                    onClick={() => handlePayPayable(p.id, false)}
                                    className="px-2.5 py-1 rounded bg-emerald-600 text-white text-[11px] font-semibold hover:bg-emerald-700 cursor-pointer"
                                  >
                                    Pagar
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handlePayPayable(p.id, true)}
                                    className="px-2.5 py-1 rounded bg-indigo-600 text-white text-[11px] font-semibold hover:bg-indigo-700 cursor-pointer"
                                  >
                                    Pago anticipado
                                  </button>
                                </div>
                              ) : (
                                <span className="text-[11px] text-emerald-600 font-semibold">Pagada</span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {state.operationsSection === 'auditoria_general' && (
                <div className="space-y-4">
                  <div className={`rounded-xl border p-4 flex flex-wrap items-end justify-between gap-3 text-xs ${isDark ? 'bg-gray-900/50 border-gray-800' : 'bg-white border-indigo-200/70'}`}>
                    <div className="flex flex-wrap items-end gap-3">
                      <div>
                        <label className="block text-[11px] text-gray-500 mb-1">Buscar por fecha</label>
                        <input
                          type="date"
                          value={auditDateFilter}
                          onChange={(e) => setAuditDateFilter(e.target.value)}
                          className={`px-3 py-2 rounded-lg border text-xs outline-none ${isDark ? 'bg-gray-950 border-gray-700' : 'bg-[#F8FAFF] border-gray-300'}`}
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] text-gray-500 mb-1">Módulo</label>
                        <select
                          value={auditModuleFilter}
                          onChange={(e) => setAuditModuleFilter(e.target.value)}
                          className={`px-3 py-2 rounded-lg border text-xs font-semibold outline-none ${isDark ? 'bg-gray-950 border-gray-700' : 'bg-[#F8FAFF] border-gray-300'}`}
                        >
                          <option value="Todas">Todas las secciones</option>
                          {Array.from(new Set((state.auditLog || []).map((a) => a.module))).map((m) => (
                            <option key={m} value={m}>{m}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] font-semibold px-2.5 py-1.5 rounded-lg bg-emerald-500/15 text-emerald-600">
                        Registro Inmutable (Sin Borrado)
                      </span>
                      <button
                        type="button"
                        onClick={handleExportAuditCsv}
                        className="px-3 py-1.5 rounded-lg font-semibold bg-indigo-600 text-white hover:bg-indigo-700 cursor-pointer"
                      >
                        Exportar CSV Auditoría
                      </button>
                    </div>
                  </div>

                  <div className={`rounded-xl border overflow-x-auto ${isDark ? 'bg-gray-900/40 border-gray-800' : 'bg-white border-indigo-200/70'}`}>
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className={`border-b text-[11px] uppercase ${isDark ? 'border-gray-800 text-gray-400' : 'border-gray-200 text-gray-500'}`}>
                          <th className="py-3 px-3">Correlativo</th>
                          <th className="py-3 px-3">Fecha / Hora</th>
                          <th className="py-3 px-3">Operador</th>
                          <th className="py-3 px-3">Sección</th>
                          <th className="py-3 px-3">Evento</th>
                          <th className="py-3 px-3">Detalle del Cambio</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200 dark:divide-gray-800">
                        {(state.auditLog || [])
                          .filter((entry) => {
                            const matchDate = !auditDateFilter || entry.dateOnly === auditDateFilter;
                            const matchMod = auditModuleFilter === 'Todas' || entry.module === auditModuleFilter;
                            const q = opsSearchQuery.trim().toLowerCase();
                            const matchSearch =
                              !q ||
                              entry.summary.toLowerCase().includes(q) ||
                              entry.operatorName.toLowerCase().includes(q) ||
                              entry.correlative.toLowerCase().includes(q);
                            return matchDate && matchMod && matchSearch;
                          })
                          .map((entry) => (
                            <tr key={entry.id}>
                              <td className="py-3 px-3 font-mono text-[11px] font-semibold">{entry.correlative}</td>
                              <td className="py-3 px-3 tabular-nums text-[11px]">{entry.timestamp}</td>
                              <td className="py-3 px-3 font-semibold">{entry.operatorName} ({entry.operatorRole})</td>
                              <td className="py-3 px-3">{entry.module}</td>
                              <td className="py-3 px-3 font-semibold">{entry.actionType}</td>
                              <td className="py-3 px-3">{entry.summary}</td>
                            </tr>
                          ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {state.operationsSection === 'monedas' && (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-gray-200 dark:border-gray-800 text-[11px] uppercase text-gray-400">
                        <th className="py-2 font-medium">Código</th>
                        <th className="py-2 font-medium">Moneda</th>
                        <th className="py-2 font-medium">Símbolo</th>
                        <th className="py-2 font-medium text-right">Tasa vs USD</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-gray-800/60 text-xs">
                      {state.currencies
                        .filter(
                          (c) =>
                            !q ||
                            c.code.toLowerCase().includes(q) ||
                            c.name.toLowerCase().includes(q) ||
                            c.symbol.toLowerCase().includes(q)
                        )
                        .map((cur) => (
                          <tr key={cur.id}>
                            <td className="py-2.5 font-semibold">{cur.code}</td>
                            <td className="py-2.5">{cur.name}</td>
                            <td className="py-2.5 text-gray-500">{cur.symbol}</td>
                            <td className="py-2.5 text-right tabular-nums">
                              {cur.isBase ? 'Base (1.00)' : cur.rateToUsd.toFixed(2)}
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              )}

              {state.operationsSection === 'tipo_de_pago' && (
                <div className="space-y-4">
                  <form
                    onSubmit={handleAddPaymentMethod}
                    className={`rounded-xl border p-4 grid grid-cols-1 sm:grid-cols-12 gap-3 items-end text-xs ${
                      isDark ? 'bg-gray-900/50 border-gray-800' : 'bg-white border-indigo-200/70'
                    }`}
                  >
                    <div className="sm:col-span-3">
                      <label className="block text-[11px] text-gray-500 mb-1">Nombre del método</label>
                      <input
                        type="text"
                        required
                        placeholder="Ej. Pago Móvil BDV, Zelle, Efectivo..."
                        value={newPmName}
                        onChange={(e) => setNewPmName(e.target.value)}
                        className={`w-full px-3 py-2 rounded-lg border text-xs outline-none ${
                          isDark ? 'bg-gray-950 border-gray-700' : 'bg-[#F8FAFF] border-gray-300'
                        }`}
                      />
                    </div>

                    <div className="sm:col-span-3">
                      <label className="block text-[11px] text-gray-500 mb-1">Vincular a Cuenta</label>
                      <select
                        value={newPmCategory}
                        onChange={(e) => setNewPmCategory(e.target.value as PaymentAccountCategory)}
                        className={`w-full px-3 py-2 rounded-lg border text-xs font-semibold outline-none ${
                          isDark ? 'bg-gray-950 border-gray-700' : 'bg-[#F8FAFF] border-gray-300'
                        }`}
                      >
                        {PAYMENT_ACCOUNT_CATEGORIES.map((cat) => (
                          <option key={cat} value={cat}>
                            {cat}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="sm:col-span-2">
                      <label className="block text-[11px] text-gray-500 mb-1">Canal / Etiqueta</label>
                      <input
                        type="text"
                        placeholder="Ej. Banca en línea..."
                        value={newPmChannel}
                        onChange={(e) => setNewPmChannel(e.target.value)}
                        className={`w-full px-3 py-2 rounded-lg border text-xs outline-none ${
                          isDark ? 'bg-gray-950 border-gray-700' : 'bg-[#F8FAFF] border-gray-300'
                        }`}
                      />
                    </div>

                    <div className="sm:col-span-2">
                      <label className="block text-[11px] text-gray-500 mb-1">Comisión (%)</label>
                      <input
                        type="number"
                        step="0.1"
                        min="0"
                        value={newPmFee}
                        onChange={(e) => setNewPmFee(e.target.value)}
                        className={`w-full px-3 py-2 rounded-lg border text-xs tabular-nums outline-none ${
                          isDark ? 'bg-gray-950 border-gray-700' : 'bg-[#F8FAFF] border-gray-300'
                        }`}
                      />
                    </div>

                    <div className="sm:col-span-2">
                      <button
                        type="submit"
                        className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold transition shadow-2xs cursor-pointer"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Agregar</span>
                      </button>
                    </div>
                  </form>

                  {pmFeedback && (
                    <div className="flex items-center justify-between rounded-lg border border-indigo-500/30 bg-indigo-500/10 px-3.5 py-2 text-xs text-indigo-600 dark:text-indigo-300 font-medium">
                      <span>{pmFeedback}</span>
                      <button type="button" onClick={() => setPmFeedback(null)}>
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}

                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="border-b border-gray-200 dark:border-gray-800 text-[11px] uppercase text-gray-400">
                          <th className="py-2 font-medium">Método de pago</th>
                          <th className="py-2 font-medium">Cuenta vinculada</th>
                          <th className="py-2 font-medium">Canal</th>
                          <th className="py-2 font-medium text-right">Comisión</th>
                          <th className="py-2 font-medium text-right">Estado</th>
                          <th className="py-2 font-medium text-right">Acciones</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100 dark:divide-gray-800/60 text-xs">
                        {(() => {
                          const listWithCashea = (state.paymentMethods || []).some((m) => /cashea/i.test(m.name))
                            ? state.paymentMethods
                            : [
                                ...(state.paymentMethods || []),
                                {
                                  id: 'pm-cashea',
                                  name: 'Cashea',
                                  channel: 'Cuotas / Financiamiento',
                                  feePercent: 0,
                                  active: true,
                                  accountCategory: 'Billetera Digital' as PaymentAccountCategory,
                                },
                              ];
                          return listWithCashea.filter(
                            (pm) =>
                              !q ||
                              pm.name.toLowerCase().includes(q) ||
                              pm.channel.toLowerCase().includes(q) ||
                              (pm.accountCategory || '').toLowerCase().includes(q)
                          );
                        })()
                          .map((pm) => (
                            <tr key={pm.id} className="hover:bg-black/[0.02] dark:hover:bg-white/[0.02]">
                              <td className="py-2.5 font-semibold">{pm.name}</td>
                              <td className="py-2.5">
                                <select
                                  value={pm.accountCategory || 'Cuenta Principal'}
                                  onChange={(e) =>
                                    handleChangePaymentMethodCategory(
                                      pm.id,
                                      e.target.value as PaymentAccountCategory
                                    )
                                  }
                                  className={`px-2 py-1 rounded-md border text-[11px] font-semibold outline-none ${
                                    isDark
                                      ? 'bg-gray-900 border-gray-700 text-indigo-300'
                                      : 'bg-indigo-50/70 border-indigo-200 text-indigo-800'
                                  }`}
                                >
                                  {PAYMENT_ACCOUNT_CATEGORIES.map((cat) => (
                                    <option key={cat} value={cat}>
                                      {cat}
                                    </option>
                                  ))}
                                </select>
                              </td>
                              <td className="py-2.5 text-gray-500">{pm.channel}</td>
                              <td className="py-2.5 text-right tabular-nums">{pm.feePercent.toFixed(1)}%</td>
                              <td className="py-2.5 text-right">
                                <button
                                  type="button"
                                  onClick={() => handleTogglePaymentMethod(pm.id)}
                                  className={`px-2.5 py-1 rounded-md text-[11px] font-medium border transition ${
                                    pm.active
                                      ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/30'
                                      : 'text-gray-400 border-gray-300 dark:border-gray-700'
                                  }`}
                                >
                                  {pm.active ? 'Habilitado' : 'Deshabilitado'}
                                </button>
                              </td>
                              <td className="py-2.5 text-right">
                                <button
                                  type="button"
                                  onClick={() => handleOpenEditPaymentMethod(pm)}
                                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-medium bg-indigo-500/10 text-indigo-500 border border-indigo-500/30 hover:bg-indigo-600 hover:text-white transition mr-1.5 cursor-pointer"
                                  title="Editar método de pago"
                                >
                                  <Pencil className="w-3 h-3" />
                                  <span>Editar</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleDeletePaymentMethod(pm.id)}
                                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-medium bg-rose-500/10 text-rose-500 border border-rose-500/30 hover:bg-rose-500 hover:text-white transition cursor-pointer"
                                  title="Borrar método de pago"
                                >
                                  <Trash2 className="w-3 h-3" />
                                  <span>Borrar</span>
                                </button>
                              </td>
                            </tr>
                          ))}
                        {state.paymentMethods.length === 0 && (
                          <tr>
                            <td colSpan={5} className="py-6 text-center text-gray-400">
                              No hay métodos de pago configurados. Agrega uno arriba.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {state.operationsSection === 'factura' && (() => {
                const tpl = state.invoiceTemplate || DEFAULT_STATE.invoiceTemplate;
                const updateTpl = (patch: Partial<typeof tpl>) => {
                  setState((prev) => ({
                    ...prev,
                    invoiceTemplate: {
                      ...(prev.invoiceTemplate || DEFAULT_STATE.invoiceTemplate),
                      ...patch,
                    },
                  }));
                };

                const sampleItems = [
                  { name: 'Desengrasante Industrial 20L', qty: 1, unitPrice: 45.0, hasIva: true },
                  { name: 'Limpiador de Bobinas', qty: 2, unitPrice: 24.0, hasIva: false },
                ];
                const sampleBase = sampleItems.reduce((s, i) => s + i.unitPrice * i.qty, 0);
                const sampleIva = sampleItems.reduce(
                  (s, i) => s + (i.hasIva ? i.unitPrice * i.qty * IVA_RATE : 0),
                  0
                );
                const sampleTotal = sampleBase + sampleIva;

                const buildSingleSlipHtml = (copyLabel: string, compactLetter: boolean) => {
                  const isThermal = !compactLetter;
                  const rowsHtml = sampleItems
                    .map((it) => {
                      const tot = getEffectiveUnitTotal(it.unitPrice, it.hasIva) * it.qty;
                      return `<tr>
                        <td style="padding:${compactLetter ? '3px 2px' : '5px 2px'};border-bottom:1px dashed #cbd5e1;">${it.name} <small style="color:#64748b;">(${it.qty} x $${it.unitPrice.toFixed(2)} ${it.hasIva ? 'IVA 16%' : 'Exento'})</small></td>
                        <td style="padding:${compactLetter ? '3px 2px' : '5px 2px'};border-bottom:1px dashed #cbd5e1;text-align:right;font-weight:700;">$${tot.toFixed(2)}</td>
                      </tr>`;
                    })
                    .join('');

                  return `<div class="slip ${compactLetter ? 'slip-carta' : 'slip-80mm'}">
                    <div class="slip-top">
                      <span class="copy-tag">${copyLabel}</span>
                      <span class="meta"><strong>Factura:</strong> FAC-0001 &nbsp;|&nbsp; <strong>Fecha:</strong> 2026-11-21</span>
                    </div>
                    <div class="center">
                      <p class="biz">${tpl.businessName || 'Nombre del local'}</p>
                      ${tpl.showTaxId && tpl.taxId ? `<div class="meta">RIF / ID: ${tpl.taxId}</div>` : ''}
                      ${tpl.showAddress && tpl.address ? `<div class="meta">${tpl.address}</div>` : ''}
                      ${tpl.showContact && (tpl.phone || tpl.email) ? `<div class="meta">${[tpl.phone, tpl.email].filter(Boolean).join(' · ')}</div>` : ''}
                    </div>
                    ${tpl.headerNote ? `<div class="banner">${tpl.headerNote}</div>` : ''}
                    <div class="meta"><strong>Cliente:</strong> Cliente Mostrador</div>
                    <table>
                      <thead>
                        <tr>
                          <th style="text-align:left;border-bottom:1px solid #94a3b8;padding-bottom:3px;">Descripción</th>
                          <th style="text-align:right;border-bottom:1px solid #94a3b8;padding-bottom:3px;">Total</th>
                        </tr>
                      </thead>
                      <tbody>${rowsHtml}</tbody>
                    </table>
                    <div class="breakdown">
                      <div class="breakdown-row"><span>Sub Total</span><span>$${sampleBase.toFixed(2)}</span></div>
                      <div class="breakdown-row"><span>IVA (16%)</span><span>$${sampleIva.toFixed(2)}</span></div>
                    </div>
                    <div class="total">
                      <span>TOTAL</span>
                      <span>$${sampleTotal.toFixed(2)}</span>
                    </div>
                    ${tpl.footerNote ? `<div class="footer">${tpl.footerNote}</div>` : ''}
                    ${!isThermal && tpl.showExtraFooterOnCarta !== false ? `
                      <div class="extra-footer">
                        ${tpl.bankAccountInfo ? `<div><strong>Banco / Pago:</strong> ${tpl.bankAccountInfo}</div>` : ''}
                        ${tpl.socialMediaInfo ? `<div><strong>Redes / Contacto:</strong> ${tpl.socialMediaInfo}</div>` : ''}
                        ${tpl.paymentTermsInfo ? `<div><strong>Condiciones / Notas:</strong> ${tpl.paymentTermsInfo}</div>` : ''}
                      </div>
                    ` : ''}
                  </div>`;
                };

                const handlePreviewPrint = (overrideFormat?: '80mm' | 'carta') => {
                  const activeFormat = overrideFormat || tpl.paperWidth || '80mm';
                  const isThermal = activeFormat === '80mm';

                  const bodyContent = isThermal
                    ? `<div class="ticket-80mm">${buildSingleSlipHtml('ORIGINAL — CLIENTE', false)}</div>`
                    : `<div class="sheet-carta">
                        ${buildSingleSlipHtml('ORIGINAL — CLIENTE', true)}
                        <div class="cut-divider"><span>✂ CORTE AQUÍ · COPIA DE REGISTRO ✂</span></div>
                        ${buildSingleSlipHtml('COPIA — REGISTRO', true)}
                      </div>`;

                  const html = `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Vista Previa (${activeFormat.toUpperCase()}) — ${tpl.businessName}</title>
  <style>
    @page {
      size: ${isThermal ? '80mm auto' : 'letter'};
      margin: ${isThermal ? '4mm' : '6mm 8mm'};
    }
    body {
      font-family: system-ui, -apple-system, sans-serif;
      margin: 0;
      padding: ${isThermal ? '12px' : '14px'};
      color: #0f172a;
      background: #fff;
    }
    .ticket-80mm {
      max-width: 300px;
      margin: 0 auto;
    }
    .sheet-carta {
      max-width: 760px;
      margin: 0 auto;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      min-height: 256mm;
      height: 256mm;
      gap: 6px;
      box-sizing: border-box;
    }
    .slip {
      border: 1px solid #cbd5e1;
      border-radius: 8px;
      padding: 12px 14px;
      background: #fff;
      box-sizing: border-box;
    }
    .slip-carta {
      flex: 1 1 0;
      height: calc(50% - 10px);
      max-height: calc(50% - 10px);
      padding: 8px 12px;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      overflow: hidden;
    }
    .slip-top {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 8px;
      margin-bottom: 4px;
    }
    .copy-tag {
      font-size: 10px;
      font-weight: 800;
      letter-spacing: 0.04em;
      padding: 2px 7px;
      border-radius: 999px;
      background: #eff6ff;
      color: #1d4ed8;
      border: 1px solid #bfdbfe;
    }
    .cut-divider {
      border-top: 1.5px dashed #64748b;
      text-align: center;
      margin: 2px 0;
      line-height: 1;
    }
    .cut-divider span {
      display: inline-block;
      transform: translateY(-6px);
      background: #fff;
      padding: 0 8px;
      font-size: 9px;
      font-weight: 700;
      color: #475569;
    }
    .center { text-align: center; }
    .biz { font-size: ${isThermal ? '15px' : '16px'}; font-weight: 800; margin: 0; }
    .meta { font-size: 10.5px; color: #475569; margin-top: 2px; }
    .banner { margin: 6px 0; padding: 4px 8px; background: #f1f5f9; border-radius: 5px; font-size: 10px; font-weight: 700; text-align: center; }
    table { width: 100%; border-collapse: collapse; font-size: 11px; margin-top: 6px; }
     .breakdown { margin-top: 6px; padding-top: 5px; border-top: 1px dashed #cbd5e1; font-size: 10.5px; color: #334155; display: flex; flex-direction: column; gap: 2px; } .breakdown-row { display: flex; justify-content: space-between; } .total { margin-top: 6px; padding-top: 6px; border-top: 2px solid #0f172a; display: flex; justify-content: space-between; font-size: 13px; font-weight: 800; }
    .footer { margin-top: 8px; padding-top: 6px; border-top: 1px dashed #cbd5e1; font-size: 9.5px; color: #475569; text-align: center; white-space: pre-line; } .extra-footer { margin-top: 6px; padding-top: 5px; border-top: 1px dotted #94a3b8; font-size: 9px; color: #334155; display: flex; flex-direction: column; gap: 2px; text-align: left; }
    @media print {
      body { padding: 0; }
      .ticket-80mm, .sheet-carta { max-width: 100%; width: 100%; }
      .slip { border-color: #94a3b8; }
    }
  </style>
</head>
<body>
  ${bodyContent}
  <script>window.onload = function() { window.print(); };</script>
</body>
</html>`;

                  const win = window.open('', '_blank', isThermal ? 'width=440,height=640' : 'width=840,height=920');
                  if (win) {
                    win.document.write(html);
                    win.document.close();
                  }
                };

                return (
                  <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start text-xs">
                    {/* Formulario de Membrete e Inicio/Final */}
                    <div
                      className={`lg:col-span-7 rounded-xl border p-4 space-y-3.5 ${
                        isDark ? 'bg-gray-900/50 border-gray-800' : 'bg-white border-indigo-200/70'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2 pb-2 border-b border-gray-200 dark:border-gray-800">
                        <div>
                          <h4 className="font-bold text-sm">Membrete y Texto de Impresión</h4>
                          <p className="text-[11px] text-gray-500">
                            Se guarda automáticamente y se aplica al imprimir facturas.
                          </p>
                        </div>
                        <div className="flex items-center gap-1.5">
                          {(['80mm', 'carta'] as const).map((pw) => (
                            <button
                              key={pw}
                              type="button"
                              onClick={() => updateTpl({ paperWidth: pw })}
                              className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border transition cursor-pointer ${
                                tpl.paperWidth === pw
                                  ? 'bg-indigo-600 text-white border-indigo-600'
                                  : isDark
                                  ? 'bg-gray-950 border-gray-700 text-gray-300'
                                  : 'bg-gray-50 border-gray-300 text-gray-700'
                              }`}
                            >
                              {pw === '80mm' ? 'Térmica 80mm' : 'Tamaño Carta (2x Hoja)'}
                            </button>
                          ))}
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <label className="block text-[11px] text-gray-500 mb-1">
                            Nombre del local {currentOperator?.commerceName ? '(Fijo en usuario)' : ''}
                          </label>
                          <input
                            type="text"
                            value={currentOperator?.commerceName || tpl.businessName}
                            readOnly={Boolean(currentOperator?.commerceName)}
                            disabled={Boolean(currentOperator?.commerceName)}
                            onChange={(e) => {
                              if (currentOperator?.commerceName) return;
                              const nextName = e.target.value;
                              updateTpl({ businessName: nextName });
                              if (currentOperator?.id && nextName.trim()) {
                                setState((prev) => ({
                                  ...prev,
                                  operatorAccounts: prev.operatorAccounts.map((op) =>
                                    op.id === currentOperator.id && !op.commerceName
                                      ? { ...op, commerceName: nextName.trim() }
                                      : op
                                  ),
                                }));
                              }
                            }}
                            placeholder="Ej. Inversiones Génesis C.A."
                            className={`w-full px-3 py-2 rounded-lg border outline-none ${
                              currentOperator?.commerceName ? 'opacity-75 cursor-not-allowed' : ''
                            } ${
                              isDark ? 'bg-gray-950 border-gray-700' : 'bg-[#F8FAFF] border-gray-300'
                            }`}
                          />
                        </div>

          <TplTaxIdField tpl={tpl} updateTpl={updateTpl} isDark={isDark} />
                      </div>

                      <div>
                        <label className="block text-[11px] text-gray-500 mb-1">Dirección del local</label>
                        <input
                          type="text"
                          value={tpl.address}
                          onChange={(e) => updateTpl({ address: e.target.value })}
                          placeholder="Av. Principal, Local, Ciudad..."
                          className={`w-full px-3 py-2 rounded-lg border outline-none ${
                            isDark ? 'bg-gray-950 border-gray-700' : 'bg-[#F8FAFF] border-gray-300'
                          }`}
                        />
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <label className="block text-[11px] text-gray-500 mb-1">Teléfono</label>
                          <input
                            type="text"
                            value={tpl.phone}
                            onChange={(e) => updateTpl({ phone: e.target.value })}
                            placeholder="Ej. +58 412-0000000"
                            className={`w-full px-3 py-2 rounded-lg border outline-none ${
                              isDark ? 'bg-gray-950 border-gray-700' : 'bg-[#F8FAFF] border-gray-300'
                            }`}
                          />
                        </div>
                        <div>
                          <label className="block text-[11px] text-gray-500 mb-1">Correo / Contacto</label>
                          <input
                            type="text"
                            value={tpl.email}
                            onChange={(e) => updateTpl({ email: e.target.value })}
                            placeholder="Ej. contacto@local.com"
                            className={`w-full px-3 py-2 rounded-lg border outline-none ${
                              isDark ? 'bg-gray-950 border-gray-700' : 'bg-[#F8FAFF] border-gray-300'
                            }`}
                          />
                        </div>
                      </div>

                      <div>
                        <label className="block text-[11px] text-gray-500 mb-1">
                          Encabezado / Inicio de factura
                        </label>
                        <input
                          type="text"
                          value={tpl.headerNote}
                          onChange={(e) => updateTpl({ headerNote: e.target.value })}
                          placeholder="Ej. FACTURA ORIGINAL · SERVICIO DE ATENCIÓN..."
                          className={`w-full px-3 py-2 rounded-lg border outline-none ${
                            isDark ? 'bg-gray-950 border-gray-700' : 'bg-[#F8FAFF] border-gray-300'
                          }`}
                        />
                      </div>

                      <div>
                        <label className="block text-[11px] text-gray-500 mb-1">
                          Pie / Final de factura (condiciones, garantía, mensaje)
                        </label>
                        <textarea
                          rows={3}
                          value={tpl.footerNote}
                          onChange={(e) => updateTpl({ footerNote: e.target.value })}
                          placeholder="Escribe aquí lo que quieras colocar al final de la factura..."
                          className={`w-full px-3 py-2 rounded-lg border outline-none resize-none ${
                            isDark ? 'bg-gray-950 border-gray-700' : 'bg-[#F8FAFF] border-gray-300'
                          }`}
                        />
                      </div>

                      <div className="rounded-xl border border-indigo-500/25 bg-indigo-500/5 p-3 space-y-2.5">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-[11px] font-bold text-indigo-400">
                            Información Extra en Pie de Factura (Tamaño Carta · Original y Copia)
                          </span>
                          <button
                            type="button"
                            onClick={() =>
                              updateTpl({
                                showExtraFooterOnCarta: tpl.showExtraFooterOnCarta === false ? true : false,
                              })
                            }
                            className={`px-2 py-0.5 rounded text-[10px] font-bold border cursor-pointer ${
                              tpl.showExtraFooterOnCarta !== false
                                ? 'bg-indigo-600 text-white border-indigo-600'
                                : 'bg-transparent text-gray-400 border-gray-500/40'
                            }`}
                          >
                            {tpl.showExtraFooterOnCarta !== false ? 'Activo en Carta' : 'Oculto'}
                          </button>
                        </div>

                        <div>
                          <label className="block text-[10.5px] text-gray-500 mb-1">
                            Cuenta de banco / Datos de transferencia o Pago Móvil
                          </label>
                          <input
                            type="text"
                            value={tpl.bankAccountInfo || ''}
                            onChange={(e) => updateTpl({ bankAccountInfo: e.target.value })}
                            placeholder="Ej. Banco Banesco 0134 · Cta. 0134-0000-00-0000000000 · RIF..."
                            className={`w-full px-3 py-1.5 rounded-lg border outline-none ${
                              isDark ? 'bg-gray-950 border-gray-700' : 'bg-white border-gray-300'
                            }`}
                          />
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                          <div>
                            <label className="block text-[10.5px] text-gray-500 mb-1">
                              Redes sociales / WhatsApp / Web
                            </label>
                            <input
                              type="text"
                              value={tpl.socialMediaInfo || ''}
                              onChange={(e) => updateTpl({ socialMediaInfo: e.target.value })}
                              placeholder="Ej. IG/FB: @minegocio · WA: +58..."
                              className={`w-full px-3 py-1.5 rounded-lg border outline-none ${
                                isDark ? 'bg-gray-950 border-gray-700' : 'bg-white border-gray-300'
                              }`}
                            />
                          </div>

                          <div>
                            <label className="block text-[10.5px] text-gray-500 mb-1">
                              Condiciones / Garantía / Observaciones extra
                            </label>
                            <input
                              type="text"
                              value={tpl.paymentTermsInfo || ''}
                              onChange={(e) => updateTpl({ paymentTermsInfo: e.target.value })}
                              placeholder="Ej. Garantía 30 días · No se aceptan devoluciones..."
                              className={`w-full px-3 py-1.5 rounded-lg border outline-none ${
                                isDark ? 'bg-gray-950 border-gray-700' : 'bg-white border-gray-300'
                              }`}
                            />
                          </div>
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={() => updateTpl({ showTaxId: !tpl.showTaxId })}
                            className={`px-2.5 py-1 rounded-md text-[11px] font-semibold border cursor-pointer ${
                              tpl.showTaxId
                                ? 'bg-indigo-600/12 text-indigo-500 border-indigo-500/30'
                                : 'text-gray-400 border-gray-300 dark:border-gray-700'
                            }`}
                          >
                            RIF {tpl.showTaxId ? 'Visible' : 'Oculto'}
                          </button>
                          <button
                            type="button"
                            onClick={() => updateTpl({ showAddress: !tpl.showAddress })}
                            className={`px-2.5 py-1 rounded-md text-[11px] font-semibold border cursor-pointer ${
                              tpl.showAddress
                                ? 'bg-indigo-600/12 text-indigo-500 border-indigo-500/30'
                                : 'text-gray-400 border-gray-300 dark:border-gray-700'
                            }`}
                          >
                            Dirección {tpl.showAddress ? 'Visible' : 'Oculta'}
                          </button>
                          <button
                            type="button"
                            onClick={() => updateTpl({ showContact: !tpl.showContact })}
                            className={`px-2.5 py-1 rounded-md text-[11px] font-semibold border cursor-pointer ${
                              tpl.showContact
                                ? 'bg-indigo-600/12 text-indigo-500 border-indigo-500/30'
                                : 'text-gray-400 border-gray-300 dark:border-gray-700'
                            }`}
                          >
                            Contacto {tpl.showContact ? 'Visible' : 'Oculto'}
                          </button>
                        </div>

                        <div className="flex flex-wrap items-center gap-2">
                          <button
                            type="button"
                            onClick={() => setIsInvoicePreviewModalOpen(true)}
                            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs transition cursor-pointer"
                          >
                            <Eye className="w-3.5 h-3.5" />
                            <span>Vista previa</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => handlePreviewPrint('80mm')}
                            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs transition cursor-pointer"
                          >
                            <Printer className="w-3.5 h-3.5" />
                            <span>Imprimir 80 mm</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => handlePreviewPrint('carta')}
                            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-white font-semibold text-xs transition cursor-pointer"
                          >
                            <Printer className="w-3.5 h-3.5" />
                            <span>Imprimir Carta (2 Copias)</span>
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Vista Previa en Vivo de Factura Impresa */}
                    <div
                      className={`lg:col-span-5 rounded-xl border p-4 space-y-3 ${
                        isDark ? 'bg-gray-900/50 border-gray-800' : 'bg-white border-indigo-200/70'
                      }`}
                    >
                      <div className="flex items-center justify-between pb-2 border-b border-gray-200 dark:border-gray-800">
                        <span className="font-bold text-xs uppercase tracking-wider text-indigo-500">
                          Vista Previa de Impresión ({tpl.paperWidth === 'carta' ? 'CARTA · ORIGINAL + COPIA' : '80MM'})
                        </span>
                        <span className="text-[10px] font-semibold text-emerald-500">
                          Sincronizado
                        </span>
                      </div>

                      {tpl.paperWidth === '80mm' ? (
                        <div className="rounded-lg border p-4 space-y-2.5 shadow-2xs max-w-[300px] mx-auto bg-white text-slate-900 border-slate-200">
                          <div className="text-center space-y-0.5">
                            <p className="text-sm font-black tracking-tight text-slate-900">
                              {tpl.businessName || 'Nombre del local'}
                            </p>
                            {tpl.showTaxId && tpl.taxId && (
                              <p className="text-[10px] font-semibold text-slate-600 tabular-nums">
                                RIF: {tpl.taxId}
                              </p>
                            )}
                            {tpl.showAddress && tpl.address && (
                              <p className="text-[10px] text-slate-600">{tpl.address}</p>
                            )}
                            {tpl.showContact && (tpl.phone || tpl.email) && (
                              <p className="text-[10px] text-slate-500">
                                {[tpl.phone, tpl.email].filter(Boolean).join(' · ')}
                              </p>
                            )}
                          </div>

                          {tpl.headerNote && (
                            <div className="rounded bg-slate-100 px-2 py-1 text-center text-[10px] font-bold text-slate-800">
                              {tpl.headerNote}
                            </div>
                          )}

                          <div className="text-[10px] text-slate-500 flex justify-between border-y border-dashed border-slate-300 py-1.5 tabular-nums">
                            <span>FAC-0001</span>
                            <span>2026-11-21</span>
                          </div>

                          <div className="space-y-1 text-[10px]">
                            {sampleItems.map((it, idx) => (
                              <div key={idx} className="flex justify-between gap-2">
                                <span className="truncate text-slate-700">
                                  {it.qty}x {it.name}
                                </span>
                                <span className="font-bold tabular-nums text-slate-900">
                                  ${(getEffectiveUnitTotal(it.unitPrice, it.hasIva) * it.qty).toFixed(2)}
                                </span>
                              </div>
                            ))}
                          </div>

                          <div className="pt-1 border-t border-dashed border-slate-300 space-y-0.5 text-[10px] text-slate-700 tabular-nums">
                            <div className="flex justify-between">
                              <span>Sub Total</span>
                              <span className="font-semibold">${sampleBase.toFixed(2)}</span>
                            </div>
                            <div className="flex justify-between">
                              <span>IVA (16%)</span>
                              <span className="font-semibold">${sampleIva.toFixed(2)}</span>
                            </div>
                          </div>
                          <div className="flex justify-between items-center pt-1.5 border-t-2 border-slate-900 text-xs font-black text-slate-900 tabular-nums">
                            <span>TOTAL</span>
                            <span>${sampleTotal.toFixed(2)}</span>
                          </div>

                          {tpl.footerNote && (
                            <p className="text-[9.5px] text-slate-500 text-center pt-1 border-t border-dashed border-slate-200 whitespace-pre-line">
                              {tpl.footerNote}
                            </p>
                          )}
                        </div>
                      ) : (
                        <div className="rounded-lg border p-3 space-y-2.5 bg-white text-slate-900 border-slate-300 shadow-2xs">
                          {(['ORIGINAL — CLIENTE', 'COPIA — REGISTRO'] as const).map((copyTitle, cIdx) => (
                            <React.Fragment key={copyTitle}>
                              {cIdx === 1 && (
                                <div className="border-t border-dashed border-slate-400 pt-1 text-center text-[9px] font-bold text-slate-500">
                                  ✂ CORTE EN LA MISMA HOJA CARTA · COPIA PARA REGISTRO ✂
                                </div>
                              )}
                              <div className="rounded border border-slate-200 p-2.5 space-y-1.5 bg-slate-50/50">
                                <div className="flex items-center justify-between gap-2">
                                  <span className="text-[9px] font-extrabold px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200">
                                    {copyTitle}
                                  </span>
                                  <span className="text-[9.5px] text-slate-500 tabular-nums">
                                    FAC-0001 · 2026-11-21
                                  </span>
                                </div>
                                <div className="text-center">
                                  <p className="text-xs font-black text-slate-900">
                                    {tpl.businessName || 'Nombre del local'}
                                  </p>
                                  {tpl.showTaxId && tpl.taxId && (
                                    <p className="text-[9px] text-slate-600 tabular-nums">
                                      RIF: {tpl.taxId}
                                      {tpl.showAddress && tpl.address ? ` · ${tpl.address}` : ''}
                                    </p>
                                  )}
                                </div>
                                {tpl.headerNote && (
                                  <div className="rounded bg-slate-100 px-2 py-0.5 text-center text-[9px] font-bold text-slate-800">
                                    {tpl.headerNote}
                                  </div>
                                )}
                                <div className="space-y-0.5 text-[9.5px]">
                                  {sampleItems.map((it, idx) => (
                                    <div key={idx} className="flex justify-between gap-2">
                                      <span className="truncate text-slate-700">
                                        {it.qty}x {it.name}
                                      </span>
                                      <span className="font-bold tabular-nums text-slate-900">
                                        ${(getEffectiveUnitTotal(it.unitPrice, it.hasIva) * it.qty).toFixed(2)}
                                      </span>
                                    </div>
                                  ))}
                                </div>
                                <div className="pt-1 border-t border-dashed border-slate-300 space-y-0.5 text-[9px] text-slate-700 tabular-nums">
                                  <div className="flex justify-between">
                                    <span>Sub Total</span>
                                    <span className="font-semibold">${sampleBase.toFixed(2)}</span>
                                  </div>
                                  <div className="flex justify-between">
                                    <span>IVA (16%)</span>
                                    <span className="font-semibold">${sampleIva.toFixed(2)}</span>
                                  </div>
                                </div>
                                <div className="flex justify-between items-center pt-1 border-t border-slate-900 text-[10.5px] font-black text-slate-900 tabular-nums">
                                  <span>TOTAL</span>
                                  <span>${sampleTotal.toFixed(2)}</span>
                                </div>
                                {tpl.showExtraFooterOnCarta !== false && (tpl.bankAccountInfo || tpl.socialMediaInfo || tpl.paymentTermsInfo || tpl.footerNote) && (
                                  <div className="pt-1 border-t border-dashed border-slate-300 text-[8.5px] text-slate-600 space-y-0.5">
                                    {tpl.footerNote && <p className="whitespace-pre-line">{tpl.footerNote}</p>}
                                    {tpl.bankAccountInfo && <p><strong>Banco:</strong> {tpl.bankAccountInfo}</p>}
                                    {tpl.socialMediaInfo && <p><strong>Redes:</strong> {tpl.socialMediaInfo}</p>}
                                    {tpl.paymentTermsInfo && <p><strong>Notas:</strong> {tpl.paymentTermsInfo}</p>}
                                  </div>
                                )}
                              </div>
                            </React.Fragment>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })()}

              {isInvoicePreviewModalOpen && (() => {
                const tpl = state.invoiceTemplate || DEFAULT_STATE.invoiceTemplate;
                const latestSale = state.sales && state.sales[0];
                const previewItems =
                  latestSale && latestSale.items && latestSale.items.length > 0
                    ? latestSale.items.map((it) => ({
                        name: it.name,
                        qty: it.quantity,
                        unitPrice: it.unitPrice,
                        hasIva: it.hasIva,
                      }))
                    : [
                        { name: 'Desengrasante Industrial 20L', qty: 1, unitPrice: 45.0, hasIva: true },
                        { name: 'Limpiador de Bobinas', qty: 2, unitPrice: 24.0, hasIva: false },
                      ];
                const previewRef = latestSale?.reference || 'FAC-0001';
                const previewDate = latestSale?.date || '2026-11-21';
                const previewCustomer =
                  latestSale?.customerDetails?.fullName || latestSale?.customerOrNote || 'Cliente Mostrador';
                const previewSubTotal = previewItems.reduce(
                  (acc, it) => acc + it.unitPrice * it.qty,
                  0
                );
                const previewIva = previewItems.reduce(
                  (acc, it) => acc + (it.hasIva ? it.unitPrice * it.qty * IVA_RATE : 0),
                  0
                );
                const previewTotal = latestSale
                  ? latestSale.total
                  : Number((previewSubTotal + previewIva).toFixed(2));

                const setFormat = (pw: '80mm' | 'carta') => {
                  setState((prev) => ({
                    ...prev,
                    invoiceTemplate: {
                      ...(prev.invoiceTemplate || DEFAULT_STATE.invoiceTemplate),
                      paperWidth: pw,
                    },
                  }));
                };

                const printCurrentPreview = (overrideFormat?: '80mm' | 'carta') => {
                  const fmt = overrideFormat || tpl.paperWidth || '80mm';
                  const isThermal = fmt === '80mm';
                  const rowsHtml = previewItems
                    .map((it) => {
                      const tot = getEffectiveUnitTotal(it.unitPrice, it.hasIva) * it.qty;
                      return `<tr>
                        <td style="padding:${isThermal ? '4px 2px' : '3px 2px'};border-bottom:1px dashed #cbd5e1;">${it.name} <small style="color:#64748b;">(${it.qty} x $${it.unitPrice.toFixed(2)} ${it.hasIva ? 'IVA 16%' : 'Exento'})</small></td>
                        <td style="padding:${isThermal ? '4px 2px' : '3px 2px'};border-bottom:1px dashed #cbd5e1;text-align:right;font-weight:700;">$${tot.toFixed(2)}</td>
                      </tr>`;
                    })
                    .join('');

                  const makeSlip = (tag: string) => `
                    <div class="slip ${isThermal ? 'slip-80mm' : 'slip-carta'}">
                      <div class="slip-top">
                        <span class="copy-tag">${tag}</span>
                        <span class="meta"><strong>Factura:</strong> ${previewRef} &nbsp;|&nbsp; <strong>Fecha:</strong> ${previewDate}</span>
                      </div>
                      <div class="center">
                        <p class="biz">${tpl.businessName || 'Nombre del local'}</p>
                        ${tpl.showTaxId && tpl.taxId ? `<div class="meta">RIF / ID: ${tpl.taxId}</div>` : ''}
                        ${tpl.showAddress && tpl.address ? `<div class="meta">${tpl.address}</div>` : ''}
                        ${tpl.showContact && (tpl.phone || tpl.email) ? `<div class="meta">${[tpl.phone, tpl.email].filter(Boolean).join(' · ')}</div>` : ''}
                      </div>
                      ${tpl.headerNote ? `<div class="banner">${tpl.headerNote}</div>` : ''}
                      <div class="meta"><strong>Cliente:</strong> ${previewCustomer}</div>
                      <table>
                        <thead>
                          <tr>
                            <th style="text-align:left;border-bottom:1px solid #94a3b8;padding-bottom:3px;">Descripción</th>
                            <th style="text-align:right;border-bottom:1px solid #94a3b8;padding-bottom:3px;">Total</th>
                          </tr>
                        </thead>
                        <tbody>${rowsHtml}</tbody>
                      </table>
                      <div class="breakdown">
                        <div class="breakdown-row"><span>Sub Total</span><span>$${previewSubTotal.toFixed(2)}</span></div>
                        <div class="breakdown-row"><span>IVA (16%)</span><span>$${previewIva.toFixed(2)}</span></div>
                      </div>
                      <div class="total">
                        <span>TOTAL</span>
                        <span>$${previewTotal.toFixed(2)}</span>
                      </div>
                      ${tpl.footerNote ? `<div class="footer">${tpl.footerNote}</div>` : ''}
                    ${!isThermal && tpl.showExtraFooterOnCarta !== false ? `
                      <div class="extra-footer">
                        ${tpl.bankAccountInfo ? `<div><strong>Banco / Pago:</strong> ${tpl.bankAccountInfo}</div>` : ''}
                        ${tpl.socialMediaInfo ? `<div><strong>Redes / Contacto:</strong> ${tpl.socialMediaInfo}</div>` : ''}
                        ${tpl.paymentTermsInfo ? `<div><strong>Condiciones / Notas:</strong> ${tpl.paymentTermsInfo}</div>` : ''}
                      </div>
                    ` : ''}
                    </div>`;

                  const bodyHtml = isThermal
                    ? `<div class="ticket-80mm">${makeSlip('ORIGINAL — CLIENTE')}</div>`
                    : `<div class="sheet-carta">
                        ${makeSlip('ORIGINAL — CLIENTE')}
                        <div class="cut-divider"><span>✂ CORTE AQUÍ · COPIA PARA REGISTRO ✂</span></div>
                        ${makeSlip('COPIA — REGISTRO')}
                      </div>`;

                  const html = `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Factura ${previewRef} (${fmt.toUpperCase()})</title>
  <style>
    @page { size: ${isThermal ? '80mm auto' : 'letter'}; margin: ${isThermal ? '4mm' : '6mm 8mm'}; }
    body { font-family: system-ui, -apple-system, sans-serif; margin: 0; padding: ${isThermal ? '12px' : '12px'}; color: #0f172a; background: #fff; }
    .ticket-80mm { max-width: 300px; margin: 0 auto; }
    .sheet-carta { max-width: 760px; margin: 0 auto; display: flex; flex-direction: column; justify-content: space-between; min-height: 256mm; height: 256mm; gap: 6px; box-sizing: border-box; }
    .slip { border: 1px solid #cbd5e1; border-radius: 8px; padding: 12px 14px; background: #fff; box-sizing: border-box; }
    .slip-carta { flex: 1 1 0; height: calc(50% - 10px); max-height: calc(50% - 10px); padding: 8px 12px; display: flex; flex-direction: column; justify-content: space-between; overflow: hidden; }
    .slip-top { display: flex; justify-content: space-between; align-items: center; gap: 8px; margin-bottom: 4px; }
    .copy-tag { font-size: 9.5px; font-weight: 800; padding: 2px 7px; border-radius: 999px; background: #eff6ff; color: #1d4ed8; border: 1px solid #bfdbfe; }
    .cut-divider { border-top: 1.5px dashed #64748b; text-align: center; margin: 2px 0; }
    .cut-divider span { display: inline-block; transform: translateY(-6px); background: #fff; padding: 0 8px; font-size: 9px; font-weight: 700; color: #475569; }
    .center { text-align: center; }
    .biz { font-size: ${isThermal ? '15px' : '16px'}; font-weight: 800; margin: 0; }
    .meta { font-size: 10.5px; color: #475569; margin-top: 2px; }
    .banner { margin: 6px 0; padding: 4px 8px; background: #f1f5f9; border-radius: 5px; font-size: 10px; font-weight: 700; text-align: center; }
    table { width: 100%; border-collapse: collapse; font-size: 11px; margin-top: 6px; }
     .breakdown { margin-top: 6px; padding-top: 5px; border-top: 1px dashed #cbd5e1; font-size: 10.5px; color: #334155; display: flex; flex-direction: column; gap: 2px; } .breakdown-row { display: flex; justify-content: space-between; } .total { margin-top: 6px; padding-top: 6px; border-top: 2px solid #0f172a; display: flex; justify-content: space-between; font-size: 13px; font-weight: 800; }
    .footer { margin-top: 8px; padding-top: 6px; border-top: 1px dashed #cbd5e1; font-size: 9.5px; color: #475569; text-align: center; white-space: pre-line; } .extra-footer { margin-top: 6px; padding-top: 5px; border-top: 1px dotted #94a3b8; font-size: 9px; color: #334155; display: flex; flex-direction: column; gap: 2px; text-align: left; }
    @media print { body { padding: 0; } .ticket-80mm, .sheet-carta { max-width: 100%; width: 100%; } }
  </style>
</head>
<body>
  ${bodyHtml}
  <script>window.onload = function() { window.print(); };</script>
</body>
</html>`;

                  const win = window.open('', '_blank', isThermal ? 'width=440,height=640' : 'width=840,height=920');
                  if (win) {
                    win.document.write(html);
                    win.document.close();
                  }
                };

                return (
                  <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
                    <div className="w-full max-w-4xl max-h-[92vh] rounded-2xl border border-slate-300 bg-white text-slate-900 shadow-2xl flex flex-col overflow-hidden">
                      <div className="flex flex-wrap items-center justify-between gap-2 px-5 py-3 border-b border-slate-200 bg-slate-50">
                        <div className="flex items-center gap-2">
                          <Eye className="w-4 h-4 text-indigo-600" />
                          <span className="text-sm font-bold">
                            Vista Previa de Factura ({tpl.paperWidth === 'carta' ? 'Tamaño Carta · 2 Copias en Hoja' : 'Térmica 80 mm'})
                          </span>
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                          <button
                            type="button"
                            onClick={() => setFormat('80mm')}
                            className={`px-2.5 py-1 rounded-lg text-xs font-bold border cursor-pointer ${
                              tpl.paperWidth !== 'carta'
                                ? 'bg-indigo-600 text-white border-indigo-600'
                                : 'bg-white text-slate-700 border-slate-300'
                            }`}
                          >
                            80 mm
                          </button>
                          <button
                            type="button"
                            onClick={() => setFormat('carta')}
                            className={`px-2.5 py-1 rounded-lg text-xs font-bold border cursor-pointer ${
                              tpl.paperWidth === 'carta'
                                ? 'bg-indigo-600 text-white border-indigo-600'
                                : 'bg-white text-slate-700 border-slate-300'
                            }`}
                          >
                            Carta (2 Copias)
                          </button>
                          <button
                            type="button"
                            onClick={() => printCurrentPreview()}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white cursor-pointer"
                          >
                            <Printer className="w-3.5 h-3.5" />
                            Imprimir
                          </button>
                          <button
                            type="button"
                            onClick={() => setIsInvoicePreviewModalOpen(false)}
                            className="p-1.5 rounded-lg text-slate-600 hover:bg-slate-200 cursor-pointer"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      </div>

                      <div className="p-5 overflow-y-auto bg-slate-100 flex justify-center">
                        {tpl.paperWidth === 'carta' ? (
                          <div className="w-full max-w-3xl rounded-xl border border-slate-300 bg-white p-5 space-y-3 shadow-xs text-xs">
                            {(['ORIGINAL — CLIENTE', 'COPIA — REGISTRO'] as const).map((copyLbl, idx) => (
                              <React.Fragment key={copyLbl}>
                                {idx === 1 && (
                                  <div className="border-t-2 border-dashed border-slate-400 pt-1 text-center text-[10px] font-bold text-slate-500">
                                    ✂ CORTE EN LA MISMA HOJA · COPIA PARA REGISTRO ✂
                                  </div>
                                )}
                                <div className="rounded-lg border border-slate-200 p-3 space-y-1.5 bg-white">
                                  <div className="flex items-center justify-between gap-2">
                                    <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200">
                                      {copyLbl}
                                    </span>
                                    <span className="text-[10px] text-slate-500 tabular-nums">
                                      {previewRef} · {previewDate}
                                    </span>
                                  </div>
                                  <div className="text-center">
                                    <p className="text-sm font-black text-slate-900">
                                      {tpl.businessName || 'Nombre del local'}
                                    </p>
                                    {tpl.showTaxId && tpl.taxId && (
                                      <p className="text-[10px] text-slate-600">
                                        RIF: {tpl.taxId}
                                        {tpl.showAddress && tpl.address ? ` · ${tpl.address}` : ''}
                                      </p>
                                    )}
                                  </div>
                                  {tpl.headerNote && (
                                    <div className="rounded bg-slate-100 px-2 py-1 text-center text-[10px] font-bold text-slate-800">
                                      {tpl.headerNote}
                                    </div>
                                  )}
                                  <div className="text-[10px] text-slate-600">
                                    <strong>Cliente:</strong> {previewCustomer}
                                  </div>
                                  <div className="space-y-1 text-[10.5px]">
                                    {previewItems.map((it, i) => (
                                      <div key={i} className="flex justify-between gap-2">
                                        <span>
                                          {it.qty}x {it.name}
                                        </span>
                                        <span className="font-bold tabular-nums">
                                          ${(getEffectiveUnitTotal(it.unitPrice, it.hasIva) * it.qty).toFixed(2)}
                                        </span>
                                      </div>
                                    ))}
                                  </div>
                                  <div className="pt-1 border-t border-dashed border-slate-300 space-y-0.5 text-[9.5px] text-slate-700 tabular-nums">
                                    <div className="flex justify-between">
                                      <span>Sub Total</span>
                                      <span className="font-semibold">${previewSubTotal.toFixed(2)}</span>
                                    </div>
                                    <div className="flex justify-between">
                                      <span>IVA (16%)</span>
                                      <span className="font-semibold">${previewIva.toFixed(2)}</span>
                                    </div>
                                  </div>
                                  <div className="flex justify-between items-center pt-1.5 border-t border-slate-900 text-xs font-black tabular-nums">
                                    <span>TOTAL</span>
                                    <span>${previewTotal.toFixed(2)}</span>
                                  </div>
                                  {tpl.showExtraFooterOnCarta !== false && (tpl.bankAccountInfo || tpl.socialMediaInfo || tpl.paymentTermsInfo || tpl.footerNote) && (
                                    <div className="pt-1.5 border-t border-dashed border-slate-300 text-[9.5px] text-slate-600 space-y-0.5">
                                      {tpl.footerNote && <p className="whitespace-pre-line">{tpl.footerNote}</p>}
                                      {tpl.bankAccountInfo && <p><strong>Cuenta Bancaria / Pago:</strong> {tpl.bankAccountInfo}</p>}
                                      {tpl.socialMediaInfo && <p><strong>Redes Sociales / Contacto:</strong> {tpl.socialMediaInfo}</p>}
                                      {tpl.paymentTermsInfo && <p><strong>Condiciones / Observaciones:</strong> {tpl.paymentTermsInfo}</p>}
                                    </div>
                                  )}
                                </div>
                              </React.Fragment>
                            ))}
                          </div>
                        ) : (
                          <div className="w-full max-w-[320px] rounded-xl border border-slate-300 bg-white p-4 space-y-2.5 shadow-xs text-xs">
                            <div className="text-center space-y-0.5">
                              <p className="text-sm font-black text-slate-900">
                                {tpl.businessName || 'Nombre del local'}
                              </p>
                              {tpl.showTaxId && tpl.taxId && (
                                <p className="text-[10px] text-slate-600">RIF: {tpl.taxId}</p>
                              )}
                              {tpl.showAddress && tpl.address && (
                                <p className="text-[10px] text-slate-600">{tpl.address}</p>
                              )}
                              {tpl.showContact && (tpl.phone || tpl.email) && (
                                <p className="text-[10px] text-slate-500">
                                  {[tpl.phone, tpl.email].filter(Boolean).join(' · ')}
                                </p>
                              )}
                            </div>
                            {tpl.headerNote && (
                              <div className="rounded bg-slate-100 px-2 py-1 text-center text-[10px] font-bold text-slate-800">
                                {tpl.headerNote}
                              </div>
                            )}
                            <div className="text-[10px] text-slate-500 flex justify-between border-y border-dashed border-slate-300 py-1 tabular-nums">
                              <span>{previewRef}</span>
                              <span>{previewDate}</span>
                            </div>
                            <div className="space-y-1 text-[10.5px]">
                              {previewItems.map((it, i) => (
                                <div key={i} className="flex justify-between gap-2">
                                  <span>
                                    {it.qty}x {it.name}
                                  </span>
                                  <span className="font-bold tabular-nums">
                                    ${(getEffectiveUnitTotal(it.unitPrice, it.hasIva) * it.qty).toFixed(2)}
                                  </span>
                                </div>
                              ))}
                            </div>
                            <div className="flex justify-between items-center pt-1.5 border-t-2 border-slate-900 text-xs font-black tabular-nums">
                              <span>TOTAL</span>
                              <span>${previewTotal.toFixed(2)}</span>
                            </div>
                            {tpl.footerNote && (
                              <p className="text-[9.5px] text-slate-500 text-center pt-1 border-t border-dashed border-slate-200 whitespace-pre-line">
                                {tpl.footerNote}
                              </p>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })()}
            </div>
          </div>
        )}
      </main>

      {/* Ventana Aislada de Ventas (Modal + Ruta /ventas) */}
      {isSalesWindowModalOpen && (
        <div className="fixed inset-0 bg-black/65 backdrop-blur-xs flex items-center justify-center z-50 p-3 sm:p-5">
          <div className="w-full max-w-6xl">
            <PosSalesWindow
              onCloseModal={() => {
                setIsSalesWindowModalOpen(false);
                const saved = localStorage.getItem(STORAGE_KEY);
                if (saved) {
                  try {
                    const parsed = JSON.parse(saved);
                    setState((prev) => ({ ...prev, ...parsed }));
                  } catch {}
                }
              }}
            />
          </div>
        </div>
      )}

      {/* Modal Modificar Producto */}
      {editingProductId && (() => {
        const eCostNum = parseFloat(editProdCostPrice);
        const eSaleNum = parseFloat(editProdSalePrice);
        const eValid = !isNaN(eCostNum) && eCostNum >= 0 && !isNaN(eSaleNum) && eSaleNum > 0;
        const eProfitPct = eValid ? calcProfitMarginPercent(eCostNum, eSaleNum) : null;
        const eProfitUnit = eValid ? eSaleNum - eCostNum : null;
        const eAdjustedSale =
          !isNaN(eSaleNum) && eSaleNum > 0 ? eSaleNum * activeRateValue : null;

        return (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className={`w-full max-w-md rounded-2xl p-6 border shadow-xl ${isDark ? 'bg-[#14171D] border-gray-800' : 'bg-white border-gray-200'}`}>
              <div className="flex justify-between items-center mb-4">
                <h3 className="font-semibold text-base">Modificar Producto</h3>
                <button type="button" onClick={() => setEditingProductId(null)}>
                  <X className="w-4 h-4 text-gray-400" />
                </button>
              </div>

              <form onSubmit={handleSaveEditedProduct} className="space-y-3.5 text-sm">
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Nombre del producto</label>
                  <input
                    type="text"
                    required
                    value={editProdName}
                    onChange={(e) => setEditProdName(e.target.value)}
                    className={`w-full px-3 py-2 rounded-lg border text-xs outline-none ${isDark ? 'bg-gray-900 border-gray-700' : 'bg-white border-gray-300'}`}
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Código de barra</label>
                    <input
                      type="text"
                      value={editProdBarcode}
                      onChange={(e) => setEditProdBarcode(e.target.value)}
                      className={`w-full px-3 py-2 rounded-lg border text-xs tabular-nums outline-none ${isDark ? 'bg-gray-900 border-gray-700' : 'bg-white border-gray-300'}`}
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Categoría</label>
                    <select
                      value={editProdCategory}
                      onChange={(e) => setEditProdCategory(e.target.value)}
                      className={`w-full px-3 py-2 rounded-lg border text-xs outline-none ${isDark ? 'bg-gray-900 border-gray-700' : 'bg-white border-gray-300'}`}
                    >
                      {Array.from(new Set([editProdCategory, ...availableProductCategories].filter(Boolean))).map((catName) => (
                        <option key={catName} value={catName}>
                          {catName}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Precio (Costo $)</label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      required
                      value={editProdCostPrice}
                      onChange={(e) => setEditProdCostPrice(e.target.value)}
                      className={`w-full px-3 py-2 rounded-lg border text-xs tabular-nums outline-none ${isDark ? 'bg-gray-900 border-gray-700' : 'bg-white border-gray-300'}`}
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Precio Venta ($)</label>
                    <input
                      type="number"
                      step="0.01"
                      min="0.01"
                      required
                      value={editProdSalePrice}
                      onChange={(e) => setEditProdSalePrice(e.target.value)}
                      className={`w-full px-3 py-2 rounded-lg border text-xs tabular-nums outline-none ${isDark ? 'bg-gray-900 border-gray-700' : 'bg-white border-gray-300'}`}
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Stock</label>
                    <input
                      type="number"
                      min="0"
                      value={editProdStock}
                      onChange={(e) => setEditProdStock(e.target.value)}
                      className={`w-full px-3 py-2 rounded-lg border text-xs tabular-nums outline-none ${isDark ? 'bg-gray-900 border-gray-700' : 'bg-white border-gray-300'}`}
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs text-gray-500 mb-1">Condición de IVA</label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setEditProdHasIva(true)}
                      className={`py-2 px-3 rounded-lg text-xs font-semibold border transition ${
                        editProdHasIva
                          ? 'bg-amber-500 text-white border-amber-500'
                          : isDark
                          ? 'bg-gray-900 border-gray-700 text-gray-300'
                          : 'bg-white border-gray-300 text-gray-700'
                      }`}
                    >
                      Con IVA (16%)
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditProdHasIva(false)}
                      className={`py-2 px-3 rounded-lg text-xs font-semibold border transition ${
                        !editProdHasIva
                          ? 'bg-emerald-600 text-white border-emerald-600'
                          : isDark
                          ? 'bg-gray-900 border-gray-700 text-gray-300'
                          : 'bg-white border-gray-300 text-gray-700'
                      }`}
                    >
                      Sin IVA (Exento)
                    </button>
                  </div>
                </div>

                <div className={`rounded-xl border p-3.5 space-y-2 text-xs ${isDark ? 'bg-gray-900/70 border-gray-800' : 'bg-gray-50 border-gray-200'}`}>
                  <div className="flex items-center justify-between">
                    <span className="text-gray-500">Porcentaje de ganancia:</span>
                    {eProfitPct !== null ? (
                      <span
                        className={`font-bold tabular-nums ${
                          eProfitPct >= 25
                            ? 'text-emerald-500'
                            : eProfitPct > 0
                            ? 'text-amber-500'
                            : 'text-rose-500'
                        }`}
                      >
                        {eProfitPct.toFixed(1)}% ({eProfitUnit !== null && eProfitUnit >= 0 ? `+$${eProfitUnit.toFixed(2)}` : `-$${Math.abs(eProfitUnit ?? 0).toFixed(2)}`})
                      </span>
                    ) : (
                      <span className="text-gray-400">—</span>
                    )}
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-gray-500">
                      Precio ajustado a tasa ({activeRateCurrency?.code ?? 'VES'} @ {activeRateValue.toFixed(2)}):
                    </span>
                    {eAdjustedSale !== null ? (
                      <span className="font-bold text-indigo-500 tabular-nums">
                        {activeRateSymbol} {eAdjustedSale.toFixed(2)}
                      </span>
                    ) : (
                      <span className="text-gray-400">—</span>
                    )}
                  </div>
                </div>

                <div>
                  <label className="block text-xs text-gray-500 mb-1">
                    Foto pequeña del producto (opcional)
                  </label>
                  <div className="flex items-center gap-3">
                    <img
                      src={editProdImageUrl.trim() || makeThumbDataUri(editProdName || 'PR', '#4F46E5')}
                      alt="Vista previa"
                      onError={(e) => {
                        const fallbackImg = makeThumbDataUri(editProdName || 'PR', '#4F46E5');
                        if (e.currentTarget.src !== fallbackImg) {
                          e.currentTarget.src = fallbackImg;
                        }
                      }}
                      className="w-10 h-10 rounded-lg object-cover shrink-0 border border-gray-300 dark:border-gray-700"
                    />
                    <div className="flex-1 space-y-1.5">
                      <input
                        type="text"
                        placeholder="Pega URL de imagen o sube un archivo..."
                        value={editProdImageUrl.startsWith('data:image/') ? 'Imagen lista para mostrar' : editProdImageUrl}
                        onChange={(e) => {
                          const v = e.target.value;
                          if (v !== 'Imagen lista para mostrar') {
                            setEditProdImageUrl(v);
                          }
                        }}
                        className={`w-full px-3 py-1.5 rounded-lg border text-xs outline-none ${isDark ? 'bg-gray-900 border-gray-700' : 'bg-white border-gray-300'}`}
                      />
                      <div className="flex items-center gap-2">
                        <label className="px-2.5 py-1 rounded-md border text-[11px] font-medium cursor-pointer hover:opacity-90 border-gray-300 dark:border-gray-700">
                          Subir foto
                          <input
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={async (e) => {
                              const file = e.target.files?.[0];
                              if (!file) return;
                              const compressed = await fileToCompressedDataUri(file);
                              setEditProdImageUrl(compressed);
                            }}
                          />
                        </label>
                        <button
                          type="button"
                          onClick={async () => {
                            setProdFeedback(`Buscando foto referencial (prioridad Venezuela) para "${editProdName || 'Producto'}"...`);
                            const res = await fetchProductPhotoFromInternet(editProdName || 'Producto', editProdCategory);
                            setEditProdImageUrl(res.url);
                            setProdFeedback(
                              res.foundOnline
                                ? `Foto encontrada en internet para "${editProdName || 'Producto'}".`
                                : `Vista referencial asignada para "${editProdName || 'Producto'}".`
                            );
                          }}
                          className="px-2.5 py-1 rounded-md border border-sky-500/40 text-sky-500 hover:bg-sky-500/10 text-[11px] font-medium cursor-pointer"
                        >
                          Foto IA por nombre
                        </button>
                        {editProdImageUrl && (
                          <button
                            type="button"
                            onClick={() => setEditProdImageUrl('')}
                            className="text-[11px] text-rose-500 hover:underline cursor-pointer"
                          >
                            Restablecer iniciales
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => setEditingProductId(null)}
                    className={`flex-1 py-2.5 rounded-lg border text-xs font-medium transition ${
                      isDark ? 'border-gray-700 hover:bg-gray-800' : 'border-gray-200 hover:bg-gray-50'
                    }`}
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="flex-1 py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-medium text-xs transition"
                  >
                    Guardar Cambios
                  </button>
                </div>
              </form>
            </div>
          </div>
        );
      })()}

      {/* Modal Crear Producto */}
      {isAddProductOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className={`w-full max-w-md rounded-2xl p-6 border shadow-xl ${isDark ? 'bg-[#14171D] border-gray-800' : 'bg-white border-gray-200'}`}>
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-semibold text-base">Crear Nuevo Producto</h3>
              <button type="button" onClick={() => setIsAddProductOpen(false)}>
                <X className="w-4 h-4 text-gray-400" />
              </button>
            </div>

            <form onSubmit={handleCreateProduct} className="space-y-3.5 text-sm">
              <div>
                <label className="block text-xs text-gray-500 mb-1">Nombre del producto</label>
                <input
                  type="text"
                  required
                  placeholder="Ej. Desengrasante Industrial 5L"
                  value={prodName}
                  onChange={(e) => setProdName(e.target.value)}
                  className={`w-full px-3 py-2 rounded-lg border text-xs outline-none ${isDark ? 'bg-gray-900 border-gray-700' : 'bg-white border-gray-300'}`}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Código de barra</label>
                  <input
                    type="text"
                    placeholder="Ej. 7591001000070"
                    value={prodBarcode}
                    onChange={(e) => setProdBarcode(e.target.value)}
                    className={`w-full px-3 py-2 rounded-lg border text-xs tabular-nums outline-none ${isDark ? 'bg-gray-900 border-gray-700' : 'bg-white border-gray-300'}`}
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Categoría (creada previamente)</label>
                  <select
                    value={availableProductCategories.includes(prodCategory) ? prodCategory : (availableProductCategories[0] || 'General')}
                    onChange={(e) => setProdCategory(e.target.value)}
                    className={`w-full px-3 py-2 rounded-lg border text-xs outline-none ${isDark ? 'bg-gray-900 border-gray-700' : 'bg-white border-gray-300'}`}
                  >
                    {availableProductCategories.map((catName) => (
                      <option key={catName} value={catName}>
                        {catName}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Precio (Costo $)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    required
                    placeholder="0.00"
                    value={prodCostPrice}
                    onChange={(e) => setProdCostPrice(e.target.value)}
                    className={`w-full px-3 py-2 rounded-lg border text-xs tabular-nums outline-none ${isDark ? 'bg-gray-900 border-gray-700' : 'bg-white border-gray-300'}`}
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Precio Venta ($)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    required
                    placeholder="0.00"
                    value={prodSalePrice}
                    onChange={(e) => setProdSalePrice(e.target.value)}
                    className={`w-full px-3 py-2 rounded-lg border text-xs tabular-nums outline-none ${isDark ? 'bg-gray-900 border-gray-700' : 'bg-white border-gray-300'}`}
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Stock inicial</label>
                  <input
                    type="number"
                    min="0"
                    value={prodStock}
                    onChange={(e) => setProdStock(e.target.value)}
                    className={`w-full px-3 py-2 rounded-lg border text-xs tabular-nums outline-none ${isDark ? 'bg-gray-900 border-gray-700' : 'bg-white border-gray-300'}`}
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs text-gray-500 mb-1">Condición de IVA al cargar</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setProdHasIva(true)}
                    className={`py-2 px-3 rounded-lg text-xs font-semibold border transition ${
                      prodHasIva
                        ? 'bg-amber-500 text-white border-amber-500'
                        : isDark
                        ? 'bg-gray-900 border-gray-700 text-gray-300'
                        : 'bg-white border-gray-300 text-gray-700'
                    }`}
                  >
                    Con IVA (16%)
                  </button>
                  <button
                    type="button"
                    onClick={() => setProdHasIva(false)}
                    className={`py-2 px-3 rounded-lg text-xs font-semibold border transition ${
                      !prodHasIva
                        ? 'bg-emerald-600 text-white border-emerald-600'
                        : isDark
                        ? 'bg-gray-900 border-gray-700 text-gray-300'
                        : 'bg-white border-gray-300 text-gray-700'
                    }`}
                  >
                    Sin IVA (Exento)
                  </button>
                </div>
              </div>

              {/* Vista previa en tiempo real de % de ganancia y precio ajustado a la tasa */}
              <div className={`rounded-xl border p-3.5 space-y-2 text-xs ${isDark ? 'bg-gray-900/70 border-gray-800' : 'bg-gray-50 border-gray-200'}`}>
                <div className="flex items-center justify-between">
                  <span className="text-gray-500">Porcentaje de ganancia:</span>
                  {draftProfitPct !== null ? (
                    <span
                      className={`font-bold tabular-nums ${
                        draftProfitPct >= 25
                          ? 'text-emerald-500'
                          : draftProfitPct > 0
                          ? 'text-amber-500'
                          : 'text-rose-500'
                      }`}
                    >
                      {draftProfitPct.toFixed(1)}% ({draftProfitUnit !== null && draftProfitUnit >= 0 ? `+$${draftProfitUnit.toFixed(2)}` : `-$${Math.abs(draftProfitUnit ?? 0).toFixed(2)}`})
                    </span>
                  ) : (
                    <span className="text-gray-400">—</span>
                  )}
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-gray-500">
                    Precio ajustado a tasa ({activeRateCurrency?.code ?? 'VES'} @ {activeRateValue.toFixed(2)}):
                  </span>
                  {draftAdjustedSale !== null ? (
                    <span className="font-bold text-indigo-500 tabular-nums">
                      {activeRateSymbol} {draftAdjustedSale.toFixed(2)}
                    </span>
                  ) : (
                    <span className="text-gray-400">—</span>
                  )}
                </div>
              </div>

              <div>
                <label className="block text-xs text-gray-500 mb-1">
                  Foto pequeña del producto (opcional)
                </label>
                <div className="flex items-center gap-3">
                  <img
                    src={prodImageUrl.trim() || makeThumbDataUri(prodName || 'PR', '#4F46E5')}
                    alt="Vista previa"
                    onError={(e) => {
                      const fallbackImg = makeThumbDataUri(prodName || 'PR', '#4F46E5');
                      if (e.currentTarget.src !== fallbackImg) {
                        e.currentTarget.src = fallbackImg;
                      }
                    }}
                    className="w-10 h-10 rounded-lg object-cover shrink-0 border border-gray-300 dark:border-gray-700"
                  />
                  <div className="flex-1 space-y-1.5">
                    <input
                      type="text"
                      placeholder="Pega URL de imagen o sube un archivo..."
                      value={prodImageUrl.startsWith('data:image/') ? 'Imagen lista para mostrar' : prodImageUrl}
                      onChange={(e) => {
                        const v = e.target.value;
                        if (v !== 'Imagen lista para mostrar') {
                          setProdImageUrl(v);
                        }
                      }}
                      className={`w-full px-3 py-1.5 rounded-lg border text-xs outline-none ${isDark ? 'bg-gray-900 border-gray-700' : 'bg-white border-gray-300'}`}
                    />
                    <div className="flex items-center gap-2">
                      <label className="px-2.5 py-1 rounded-md border text-[11px] font-medium cursor-pointer hover:opacity-90 border-gray-300 dark:border-gray-700">
                        Subir foto
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={async (e) => {
                            const file = e.target.files?.[0];
                            if (!file) return;
                            const compressed = await fileToCompressedDataUri(file);
                            setProdImageUrl(compressed);
                          }}
                        />
                      </label>
                      <button
                        type="button"
                        onClick={async () => {
                          setProdFeedback(`Buscando foto referencial (prioridad Venezuela) para "${prodName || 'Producto'}"...`);
                          const res = await fetchProductPhotoFromInternet(prodName || 'Producto', prodCategory);
                          setProdImageUrl(res.url);
                          setProdFeedback(
                            res.foundOnline
                              ? `Foto encontrada en internet para "${prodName || 'Producto'}".`
                              : `Vista referencial asignada para "${prodName || 'Producto'}".`
                          );
                        }}
                        className="px-2.5 py-1 rounded-md border border-sky-500/40 text-sky-500 hover:bg-sky-500/10 text-[11px] font-medium cursor-pointer"
                      >
                        Foto IA por nombre
                      </button>
                      {prodImageUrl && (
                        <button
                          type="button"
                          onClick={() => setProdImageUrl('')}
                          className="text-[11px] text-rose-500 hover:underline cursor-pointer"
                        >
                          Quitar foto
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              <button
                type="submit"
                className="w-full py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-medium text-xs transition"
              >
                Guardar Producto
              </button>
            </form>
          </div>
        </div>
      )}

      {isAddTxOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className={`w-full max-w-md rounded-2xl p-6 border shadow-xl ${isDark ? 'bg-[#14171D] border-gray-800' : 'bg-white border-gray-200'}`}>
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-semibold text-base">Registrar Movimiento en Génesis</h3>
              <button onClick={() => setIsAddTxOpen(false)}><X className="w-4 h-4 text-gray-400" /></button>
            </div>
            <form onSubmit={handleAddTransaction} className="space-y-3.5 text-sm">
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setTxType('expense')}
                  className={`py-2 rounded-lg font-medium text-xs border ${txType === 'expense' ? 'bg-rose-500 text-white border-rose-500' : 'border-gray-300 dark:border-gray-700'}`}
                >
                  Gasto (-)
                </button>
                <button
                  type="button"
                  onClick={() => setTxType('income')}
                  className={`py-2 rounded-lg font-medium text-xs border ${txType === 'income' ? 'bg-emerald-500 text-white border-emerald-500' : 'border-gray-300 dark:border-gray-700'}`}
                >
                  Ingreso (+)
                </button>
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Comercio o descripción</label>
                <input
                  type="text"
                  required
                  placeholder="Ej. Supermercado, Pago cliente..."
                  value={txMerchant}
                  onChange={(e) => setTxMerchant(e.target.value)}
                  className={`w-full px-3 py-2 rounded-lg border text-xs ${isDark ? 'bg-gray-900 border-gray-700' : 'bg-white border-gray-300'}`}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Monto ($)</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    placeholder="0.00"
                    value={txAmount}
                    onChange={(e) => setTxAmount(e.target.value)}
                    className={`w-full px-3 py-2 rounded-lg border text-xs tabular-nums ${isDark ? 'bg-gray-900 border-gray-700' : 'bg-white border-gray-300'}`}
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Fecha</label>
                  <input
                    type="date"
                    value={txDate}
                    onChange={(e) => setTxDate(e.target.value)}
                    className={`w-full px-3 py-2 rounded-lg border text-xs ${isDark ? 'bg-gray-900 border-gray-700' : 'bg-white border-gray-300'}`}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Cuenta</label>
                  <select
                    value={txAccount}
                    onChange={(e) => setTxAccount(e.target.value)}
                    className={`w-full px-3 py-2 rounded-lg border text-xs ${isDark ? 'bg-gray-900 border-gray-700' : 'bg-white border-gray-300'}`}
                  >
                    {state.accounts.map((a) => (
                      <option key={a.id} value={a.id}>{a.name}</option>
                    ))}
                  </select>
                </div>
                {txType === 'expense' && (
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Categoría</label>
                    <select
                      value={txCategory}
                      onChange={(e) => setTxCategory(e.target.value)}
                      className={`w-full px-3 py-2 rounded-lg border text-xs ${isDark ? 'bg-gray-900 border-gray-700' : 'bg-white border-gray-300'}`}
                    >
                      {state.categories.filter((c) => c.id !== 'cat-income').map((c) => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                    </select>
                  </div>
                )}
              </div>
              <button
                type="submit"
                className="w-full py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-medium text-xs transition"
              >
                Guardar Movimiento
              </button>
            </form>
          </div>
        </div>
      )}

      {isAddBlockOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className={`w-full max-w-sm rounded-2xl p-6 border shadow-xl ${isDark ? 'bg-[#14171D] border-gray-800' : 'bg-white border-gray-200'}`}>
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-semibold text-base">Añadir Bloque Modular</h3>
              <button onClick={() => setIsAddBlockOpen(false)}><X className="w-4 h-4 text-gray-400" /></button>
            </div>
            <div className="space-y-2">
              {[
                { type: 'kpi_balance' as BlockType, title: 'Patrimonio Neto', span: 1 as const },
                { type: 'kpi_income' as BlockType, title: 'Ingresos Totales', span: 1 as const },
                { type: 'kpi_expense' as BlockType, title: 'Gastos Totales', span: 1 as const },
                { type: 'chart_categories' as BlockType, title: 'Desglose por Categoría', span: 1 as const },
                { type: 'table_transactions' as BlockType, title: 'Tabla de Movimientos', span: 2 as const },
              ].map((item) => (
                <button
                  key={item.type}
                  onClick={() => handleAddBlock(item.type, item.title, item.span)}
                  className={`w-full text-left px-3.5 py-2.5 rounded-lg border text-xs font-medium hover:border-indigo-500 transition ${
                    isDark ? 'border-gray-800 bg-gray-900/50' : 'border-gray-200 bg-gray-50'
                  }`}
                >
                  + {item.title}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {isCopilotOpen && (
        <div className="fixed inset-0 bg-black/40 flex justify-end z-50">
          <div className={`w-full max-w-md h-full flex flex-col border-l p-5 shadow-2xl ${isDark ? 'bg-[#14171D] border-gray-800' : 'bg-white border-gray-200'}`}>
            <div className="flex items-center justify-between pb-4 border-b border-gray-200 dark:border-gray-800">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-indigo-500" />
                <h3 className="font-semibold text-sm">Génesis IA — Copiloto</h3>
              </div>
              <button onClick={() => setIsCopilotOpen(false)}><X className="w-4 h-4 text-gray-400" /></button>
            </div>
            <div className="flex-1 overflow-y-auto py-4 space-y-3">
              {copilotMessages.map((m, idx) => (
                <div
                  key={idx}
                  className={`p-3 rounded-xl text-xs leading-relaxed ${
                    m.role === 'user'
                      ? 'bg-indigo-600 text-white ml-8'
                      : isDark
                      ? 'bg-gray-800 text-gray-200 mr-8'
                      : 'bg-gray-100 text-gray-800 mr-8'
                  }`}
                >
                  {m.text}
                </div>
              ))}
            </div>
            <form onSubmit={handleCopilotSubmit} className="pt-3 border-t border-gray-200 dark:border-gray-800 flex gap-2">
              <input
                type="text"
                placeholder="Pregunta o escribe: regla uber -> Transporte"
                value={copilotInput}
                onChange={(e) => setCopilotInput(e.target.value)}
                className={`flex-1 px-3 py-2 rounded-lg border text-xs outline-none ${
                  isDark ? 'bg-gray-900 border-gray-700' : 'bg-white border-gray-300'
                }`}
              />
              <button type="submit" className="px-3.5 py-2 rounded-lg bg-indigo-600 text-white text-xs font-medium">
                Enviar
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Modal Modificar Método de Pago */}
      {editingPmId && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div
            className={`w-full max-w-md rounded-2xl p-6 border shadow-xl ${
              isDark ? 'bg-[#14171D] border-gray-800' : 'bg-white border-gray-200'
            }`}
          >
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-semibold text-base">Modificar Método de Pago</h3>
              <button
                type="button"
                onClick={() => setEditingPmId(null)}
                className="cursor-pointer"
              >
                <X className="w-4 h-4 text-gray-400" />
              </button>
            </div>

            <form onSubmit={handleSaveEditedPaymentMethod} className="space-y-3.5 text-sm">
              <div>
                <label className="block text-xs text-gray-500 mb-1">Nombre del método</label>
                <input
                  type="text"
                  required
                  value={editPmName}
                  onChange={(e) => setEditPmName(e.target.value)}
                  className={`w-full px-3 py-2 rounded-lg border text-xs outline-none ${
                    isDark ? 'bg-gray-900 border-gray-700' : 'bg-white border-gray-300'
                  }`}
                />
              </div>

              <div>
                <label className="block text-xs text-gray-500 mb-1">Vincular a Cuenta</label>
                <select
                  value={editPmCategory}
                  onChange={(e) => setEditPmCategory(e.target.value as PaymentAccountCategory)}
                  className={`w-full px-3 py-2 rounded-lg border text-xs font-semibold outline-none ${
                    isDark ? 'bg-gray-900 border-gray-700' : 'bg-white border-gray-300'
                  }`}
                >
                  {PAYMENT_ACCOUNT_CATEGORIES.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Canal / Etiqueta</label>
                  <input
                    type="text"
                    value={editPmChannel}
                    onChange={(e) => setEditPmChannel(e.target.value)}
                    className={`w-full px-3 py-2 rounded-lg border text-xs outline-none ${
                      isDark ? 'bg-gray-900 border-gray-700' : 'bg-white border-gray-300'
                    }`}
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Comisión (%)</label>
                  <input
                    type="number"
                    step="0.1"
                    min="0"
                    value={editPmFee}
                    onChange={(e) => setEditPmFee(e.target.value)}
                    className={`w-full px-3 py-2 rounded-lg border text-xs tabular-nums outline-none ${
                      isDark ? 'bg-gray-900 border-gray-700' : 'bg-white border-gray-300'
                    }`}
                  />
                </div>
              </div>

              <label className="flex items-center gap-2 text-xs font-medium cursor-pointer pt-1">
                <input
                  type="checkbox"
                  checked={editPmActive}
                  onChange={(e) => setEditPmActive(e.target.checked)}
                  className="rounded"
                />
                <span>Método habilitado para cobros</span>
              </label>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setEditingPmId(null)}
                  className="px-4 py-2 rounded-lg text-xs border border-gray-300 dark:border-gray-700 cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg text-xs bg-indigo-600 hover:bg-indigo-700 text-white font-semibold cursor-pointer"
                >
                  Guardar cambios
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Editar Operador y Permisos */}
      {editingOpId && canManageOperators && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div
            className={`w-full max-w-lg rounded-2xl p-6 border shadow-xl max-h-[90vh] overflow-y-auto ${
              isDark ? 'bg-[#14171D] border-gray-800' : 'bg-white border-gray-200'
            }`}
          >
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-semibold text-base">Editar Operador y Permisos</h3>
              <button type="button" onClick={() => setEditingOpId(null)} className="cursor-pointer">
                <X className="w-4 h-4 text-gray-400" />
              </button>
            </div>

            <form onSubmit={handleSaveEditedOperator} className="space-y-3.5 text-xs">
              <div>
                <label className="block text-[11px] text-gray-500 mb-1">Nombre del operador</label>
                <input
                  type="text"
                  required
                  value={editOpName}
                  onChange={(e) => setEditOpName(e.target.value)}
                  className={`w-full px-3 py-2 rounded-lg border outline-none ${
                    isDark ? 'bg-gray-900 border-gray-700' : 'bg-white border-gray-300'
                  }`}
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-[11px] text-gray-500 mb-1">Rol</label>
                  <select
                    value={editOpRole}
                    onChange={(e) => {
                      const nextRole = e.target.value as OperatorRoleType;
                      setEditOpRole(nextRole);
                      setEditOpPermissions(ROLE_DEFAULT_PERMISSIONS[nextRole]);
                    }}
                    className={`w-full px-3 py-2 rounded-lg border font-semibold outline-none ${
                      isDark ? 'bg-gray-900 border-gray-700' : 'bg-white border-gray-300'
                    }`}
                  >
                    <option value="Administrador">Administrador</option>
                    <option value="Gerente">Gerente</option>
                    <option value="Operador">Operador</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] text-gray-500 mb-1">Cuenta asignada</label>
                  <select
                    value={editOpAccount}
                    onChange={(e) => setEditOpAccount(e.target.value)}
                    className={`w-full px-3 py-2 rounded-lg border outline-none ${
                      isDark ? 'bg-gray-900 border-gray-700' : 'bg-white border-gray-300'
                    }`}
                  >
                    {state.accounts.map((a) => (
                      <option key={a.id} value={a.name}>
                        {a.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] text-gray-500 mb-1">PIN acceso</label>
                  <input
                    type="text"
                    maxLength={8}
                    placeholder="Opcional"
                    value={editOpPin}
                    onChange={(e) => setEditOpPin(e.target.value)}
                    className={`w-full px-3 py-2 rounded-lg border tabular-nums outline-none ${
                      isDark ? 'bg-gray-900 border-gray-700' : 'bg-white border-gray-300'
                    }`}
                  />
                </div>
              </div>

              <div className="pt-2 border-t border-gray-200 dark:border-gray-800 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-indigo-500">
                    Permisos al entrar:
                  </span>
                  {editOpRole !== 'Administrador' && (
                    <button
                      type="button"
                      onClick={() => setEditOpPermissions(['ventas'])}
                      className="text-[11px] text-indigo-500 font-semibold hover:underline cursor-pointer"
                    >
                      Solo Ventas
                    </button>
                  )}
                </div>

                {editOpRole === 'Administrador' ? (
                  <p className="text-[11px] text-emerald-500 font-semibold">
                    Administrador tiene acceso completo a todo el sistema.
                  </p>
                ) : (
                  <div className="grid grid-cols-2 gap-2">
                    {ALL_OPERATOR_PERMISSIONS.map((perm) => {
                      const checked = editOpPermissions.includes(perm.key);
                      return (
                        <label
                          key={perm.key}
                          className={`flex items-center gap-2 px-2.5 py-1.5 rounded-lg border cursor-pointer ${
                            checked
                              ? 'bg-indigo-600/10 border-indigo-500/40 text-indigo-600 dark:text-indigo-300 font-semibold'
                              : isDark
                              ? 'bg-gray-900 border-gray-800 text-gray-400'
                              : 'bg-gray-50 border-gray-200 text-gray-600'
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setEditOpPermissions((prev) => Array.from(new Set([...prev, perm.key])));
                              } else {
                                setEditOpPermissions((prev) => prev.filter((k) => k !== perm.key));
                              }
                            }}
                            className="rounded"
                          />
                          <span className="truncate">{perm.label}</span>
                        </label>
                      );
                    })}
                  </div>
                )}
              </div>

              <label className="flex items-center gap-2 font-medium cursor-pointer pt-1">
                <input
                  type="checkbox"
                  checked={editOpActive}
                  onChange={(e) => setEditOpActive(e.target.checked)}
                  className="rounded"
                />
                <span>Operador activo</span>
              </label>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setEditingOpId(null)}
                  className="px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-700 cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-semibold cursor-pointer"
                >
                  Guardar cambios
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal de Inicio: Solicita Clave al Abrir el Programa */}
      {isStartupLoginOpen && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div
            className={`w-full max-w-md rounded-2xl p-6 border shadow-2xl ${
              isDark ? 'bg-[#14171D] border-gray-800' : 'bg-white border-gray-200'
            }`}
          >
            <div className="flex items-center gap-2.5 mb-4">
              <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center text-white font-bold text-base">
                G
              </div>
              <div>
                <h3 className="font-bold text-base">Acceso a Génesis</h3>
                <p className="text-[11px] text-gray-500">
                  Selecciona perfil e ingresa la clave si corresponde
                </p>
              </div>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                const targetOp = state.operatorAccounts.find((o) => o.id === startupOpId);
                if (!targetOp) return;
                const isAdmin = normalizeOperatorRole(targetOp.role) === 'Administrador';
                const requiredPin = isAdmin
                  ? 'admin1'
                  : (targetOp.pin || '').trim();

                if (requiredPin && startupPasswordInput.trim() !== requiredPin && startupPasswordInput.trim() !== (targetOp.pin || '').trim()) {
                  setStartupLoginError('Clave incorrecta. Intenta de nuevo.');
                  return;
                }

                const perms = getEffectiveOperatorPermissions(targetOp);
                setState((prev) => {
                  const next: GenesisState = {
                    ...prev,
                    currentOperatorId: targetOp.id,
                  };
                  if (!isAdmin) {
                    if (!perms.includes('dashboard') && perms.includes(prev.operationsSection)) {
                      setActiveViewMode('operations');
                      if (prev.operationsSection === 'ventas') {
                        setIsSalesWindowModalOpen(true);
                      }
                    } else if (!perms.includes('dashboard')) {
                      const firstOp = ALL_OPERATOR_PERMISSIONS.find(
                        (p) => p.group === 'operations' && perms.includes(p.key)
                      );
                      if (firstOp) {
                        next.operationsSection = firstOp.key as OperationsSubSection;
                        setActiveViewMode('operations');
                        if (firstOp.key === 'ventas') {
                          setIsSalesWindowModalOpen(true);
                        }
                      }
                    } else {
                      setActiveViewMode('dashboard');
                    }
                  } else {
                    setActiveViewMode('dashboard');
                  }
                  return next;
                });

                setStartupLoginError(null);
                setStartupPasswordInput('');
                setIsStartupLoginOpen(false);
              }}
              className="space-y-3.5 text-xs"
            >
              <div>
                <label className="block text-[11px] text-gray-500 mb-1">Cuenta / Rol</label>
                <select
                  value={startupOpId}
                  onChange={(e) => {
                    setStartupOpId(e.target.value);
                    setStartupPasswordInput('');
                    setStartupLoginError(null);
                  }}
                  className={`w-full px-3 py-2 rounded-lg border font-semibold outline-none ${
                    isDark ? 'bg-gray-900 border-gray-700' : 'bg-white border-gray-300'
                  }`}
                >
                  {state.operatorAccounts.map((op) => {
                    const isAdmin = normalizeOperatorRole(op.role) === 'Administrador';
                    return (
                      <option key={op.id} value={op.id}>
                        {op.operatorName} ({normalizeOperatorRole(op.role)}) — {isAdmin ? 'Requiere clave' : 'Sin clave'}
                      </option>
                    );
                  })}
                </select>
              </div>

              {(() => {
                const selOp = state.operatorAccounts.find((o) => o.id === startupOpId);
                const isAdmin = selOp ? normalizeOperatorRole(selOp.role) === 'Administrador' : true;
                const needsPin = isAdmin || Boolean(selOp?.pin && selOp.pin.trim());
                if (!needsPin) {
                  return (
                    <div
                      className={`rounded-xl border p-3 text-[11px] ${
                        isDark ? 'bg-gray-900/70 border-gray-800 text-gray-300' : 'bg-gray-50 border-gray-200 text-gray-600'
                      }`}
                    >
                      Este operador está configurado sin clave por el momento. Puedes entrar directamente.
                    </div>
                  );
                }
                return (
                  <div>
                    <label className="block text-[11px] text-gray-500 mb-1">
                      Clave de acceso {isAdmin ? '(Administrador)' : ''}
                    </label>
                    <input
                      ref={startupPinInputRef}
                      type="password"
                      autoFocus
                      required
                      value={startupPasswordInput}
                      onMouseDown={(e) => {
                        e.stopPropagation();
                        e.currentTarget.focus();
                      }}
                      onClick={(e) => {
                        e.stopPropagation();
                        e.currentTarget.focus();
                      }}
                      onChange={(e) => {
                        setStartupPasswordInput(e.target.value);
                        setStartupLoginError(null);
                      }}
                      placeholder="Ingresa la clave..."
                      className={`w-full px-3 py-2 rounded-lg border outline-none ${
                        isDark ? 'bg-gray-900 border-gray-700' : 'bg-white border-gray-300'
                      }`}
                    />
                  </div>
                );
              })()}

              {startupLoginError && (
                <p className="text-rose-500 font-semibold text-[11px]">{startupLoginError}</p>
              )}

              <button
                type="submit"
                className="w-full py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs transition cursor-pointer"
              >
                Ingresar
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Modal Cambiar Operador / Entrar con Permisos */}
      {isSwitchOperatorOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div
            className={`w-full max-w-md rounded-2xl p-6 border shadow-xl ${
              isDark ? 'bg-[#14171D] border-gray-800' : 'bg-white border-gray-200'
            }`}
          >
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-semibold text-base">Cambiar Operador / Acceso</h3>
              <button
                type="button"
                onClick={() => setIsSwitchOperatorOpen(false)}
                className="cursor-pointer"
              >
                <X className="w-4 h-4 text-gray-400" />
              </button>
            </div>

            <form onSubmit={handleSwitchOperatorSubmit} className="space-y-3.5 text-xs">
              <div>
                <label className="block text-[11px] text-gray-500 mb-1">Selecciona operador</label>
                <select
                  value={loginSelectedOpId}
                  onChange={(e) => {
                    setLoginSelectedOpId(e.target.value);
                    setLoginError(null);
                  }}
                  className={`w-full px-3 py-2 rounded-lg border font-semibold outline-none ${
                    isDark ? 'bg-gray-900 border-gray-700' : 'bg-white border-gray-300'
                  }`}
                >
                  {state.operatorAccounts.map((op) => (
                    <option key={op.id} value={op.id}>
                      {op.operatorName} ({normalizeOperatorRole(op.role)}) {!op.active ? '· Inactivo' : ''}
                    </option>
                  ))}
                </select>
              </div>

              {(() => {
                const selOp = state.operatorAccounts.find((o) => o.id === loginSelectedOpId);
                if (!selOp) return null;
                const perms = getEffectiveOperatorPermissions(selOp);
                return (
                  <div
                    className={`rounded-xl border p-3 space-y-1.5 ${
                      isDark ? 'bg-gray-900/70 border-gray-800' : 'bg-gray-50 border-gray-200'
                    }`}
                  >
                    <p className="font-semibold">
                      Rol: <span className="text-indigo-500">{normalizeOperatorRole(selOp.role)}</span>
                    </p>
                    <p className="text-[11px] text-gray-500">
                      Permisos al entrar:{' '}
                      <strong className="text-gray-700 dark:text-gray-200">
                        {normalizeOperatorRole(selOp.role) === 'Administrador'
                          ? 'Todos los módulos'
                          : perms.length === 0
                          ? 'Ninguno'
                          : perms
                              .map(
                                (pk) =>
                                  ALL_OPERATOR_PERMISSIONS.find((p) => p.key === pk)?.label || pk
                              )
                              .join(', ')}
                      </strong>
                    </p>
                    {selOp.pin && (
                      <div className="pt-1">
                        <label className="block text-[11px] text-gray-500 mb-1">PIN de acceso</label>
                        <input
                          type="password"
                          value={loginPinInput}
                          onChange={(e) => setLoginPinInput(e.target.value)}
                          placeholder="Ingresa el PIN del operador"
                          className={`w-full px-3 py-1.5 rounded-lg border tabular-nums outline-none ${
                            isDark ? 'bg-gray-950 border-gray-700' : 'bg-white border-gray-300'
                          }`}
                        />
                      </div>
                    )}
                  </div>
                );
              })()}

              {loginError && (
                <p className="text-rose-500 font-semibold text-[11px]">{loginError}</p>
              )}

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsSwitchOperatorOpen(false)}
                  className="px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-700 cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-semibold cursor-pointer"
                >
                  Entrar con este operador
                </button>
              </div>
            </form>
          </div>
        </div>
      )}


      {isMasterRestoreModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div
            className={`w-full max-w-sm rounded-2xl border p-5 shadow-2xl ${
              isDark ? 'bg-[#14171D] border-gray-800 text-gray-100' : 'bg-white border-indigo-200 text-slate-900'
            }`}
          >
            <h3 className="text-sm font-bold mb-1">Restaurar con Llave Maestra</h3>
            <p className="text-xs text-gray-500 mb-3">
              Ingresa la llave maestra del creador para restaurar el sistema.
            </p>
            <form onSubmit={handleConfirmMasterRestore} className="space-y-3">
              <input
                type="password"
                value={masterRestoreKeyInput}
                onChange={(e) => {
                  setMasterRestoreKeyInput(e.target.value);
                  if (masterRestoreError) setMasterRestoreError(null);
                }}
                placeholder="Llave maestra"
                autoFocus
                className={`w-full px-3 py-2 rounded-lg border text-xs outline-none ${
                  isDark ? 'bg-[#0F1115] border-gray-700 text-gray-100' : 'bg-slate-50 border-gray-300 text-slate-900'
                }`}
              />
              {masterRestoreError && (
                <p className="text-xs font-medium text-rose-500">{masterRestoreError}</p>
              )}
              <div className="flex justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => {
                    setIsMasterRestoreModalOpen(false);
                    setMasterRestoreKeyInput('');
                    setMasterRestoreError(null);
                  }}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium border cursor-pointer ${
                    isDark ? 'border-gray-700 text-gray-300 hover:bg-gray-800' : 'border-gray-300 text-gray-700 hover:bg-gray-100'
                  }`}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 text-white cursor-pointer"
                >
                  Restaurar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
