'use client';

import GenesisCloudSyncLayer from './GenesisCloudSyncLayer';
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
  ShoppingBag, Package, Truck,
  ClipboardCheck, Users, Receipt, FileText, Scale, Eye, BarChart3
} from 'lucide-react';
import {
  GenesisState, Transaction, DashboardBlock, BlockType,
  OperationsSubSection, ProductItem, SaleInvoiceItem,
  PaymentAccountCategory, OperatorRoleType, OperatorPermissionKey, OperatorAccountItem,
  AuditEntry, ReceivableAccountItem, PayableAccountItem,
  SupplierItem, GeneralExpenseItem
} from '../types/genesis';

const STORAGE_KEY = 'genesis_business_dashboard_v1';
const AUDIT_STORAGE_KEY = 'genesis_audit_log_v1';
const OPERATOR_SESSIONS_KEY = 'genesis_operator_sessions_v1';
const STARTUP_LOCK_ENABLED_KEY = 'genesis_startup_lock_enabled_v1';

const DEFAULT_OPERATOR_ACCOUNTS: OperatorAccountItem[] = [
  {
    id: 'op-admin',
    name: 'Administrador Principal',
    role: 'ADMIN' as OperatorRoleType as OperatorRoleType,
    pin: '1234',
    permissions: [
      'POS_SELL',
      'CASH_MANAGE',
      'INVENTORY_EDIT',
      'DISCOUNT_APPLY',
      'VOID_SALE',
      'REPORTS_VIEW',
      'AUDIT_VIEW',
      'USERS_MANAGE',
      'SETTINGS_EDIT'
    ] as OperatorPermissionKey[],
    active: true
  },
  {
    id: 'op-cajero',
    name: 'Cajero Mostrador 01',
    role: 'CAJERO' as OperatorRoleType as OperatorRoleType,
    pin: '2222',
    permissions: ['POS_SELL', 'CASH_MANAGE', 'DISCOUNT_APPLY', 'REPORTS_VIEW'] as OperatorPermissionKey[],
    active: true
  },
  {
    id: 'op-almacen',
    name: 'Encargado Almacén',
    role: 'ALMACEN' as OperatorRoleType as OperatorRoleType,
    pin: '3333',
    permissions: ['INVENTORY_EDIT', 'REPORTS_VIEW'] as OperatorPermissionKey[],
    active: true
  },
  {
    id: 'op-auditor',
    name: 'Auditor / Supervisor',
    role: 'AUDITOR' as OperatorRoleType as OperatorRoleType,
    pin: '4444',
    permissions: ['REPORTS_VIEW', 'AUDIT_VIEW'] as OperatorPermissionKey[],
    active: true
  }
];

const OPERATOR_ROLE_LABELS: Record<OperatorRoleType, string> = {
  ADMIN: 'Administrador',
  CAJERO: 'Cajero',
  ALMACEN: 'Almacén',
  AUDITOR: 'Auditor'
};

const INITIAL_PRODUCTS: ProductItem[] = [
  {
    id: 'prod-1',
    sku: 'SKU-001',
    barcode: '7591234500011',
    name: 'Harina de Maíz Precocida 1kg',
    category: 'Alimentos',
    brand: 'Polar',
    supplierName: 'Distribuidora Central C.A.',
    costUsd: 0.95,
    priceUsd: 1.45,
    taxRate: 0,
    stock: 48,
    minStock: 10
  },
  {
    id: 'prod-2',
    sku: 'SKU-002',
    barcode: '7591234500028',
    name: 'Aceite Vegetal 1L',
    category: 'Alimentos',
    brand: 'Vatel',
    supplierName: 'Distribuidora Central C.A.',
    costUsd: 1.85,
    priceUsd: 2.75,
    taxRate: 16,
    stock: 32,
    minStock: 8
  },
  {
    id: 'prod-3',
    sku: 'SKU-003',
    barcode: '7591234500035',
    name: 'Café Molido 500g',
    category: 'Bebidas',
    brand: 'Amanecer',
    supplierName: 'Alimentos del Sur',
    costUsd: 2.40,
    priceUsd: 3.80,
    taxRate: 16,
    stock: 7,
    minStock: 10
  },
  {
    id: 'prod-4',
    sku: 'SKU-004',
    barcode: '7591234500042',
    name: 'Detergente Líquido 1.8L',
    category: 'Limpieza',
    brand: 'Las Llaves',
    supplierName: 'Insumos Hogar Pro',
    costUsd: 2.10,
    priceUsd: 3.35,
    taxRate: 16,
    stock: 24,
    minStock: 6
  }
];

const INITIAL_SUPPLIERS: SupplierItem[] = [
  {
    id: 'sup-1',
    rif: 'J-30123456-7',
    name: 'Distribuidora Central C.A.',
    contact: 'Carlos Mendoza',
    phone: '0414-5550101',
    email: 'ventas@distcentral.com',
    category: 'Alimentos y Víveres',
    creditDays: 15,
    balanceUsd: 145.00
  },
  {
    id: 'sup-2',
    rif: 'J-40987654-3',
    name: 'Alimentos del Sur',
    contact: 'María Rojas',
    phone: '0424-5550202',
    email: 'cobranzas@alimentosdelsur.com',
    category: 'Bebidas y Café',
    creditDays: 21,
    balanceUsd: 88.50
  },
  {
    id: 'sup-3',
    rif: 'J-29876123-0',
    name: 'Insumos Hogar Pro',
    contact: 'José Silva',
    phone: '0412-5550303',
    email: 'administracion@hogarpro.com',
    category: 'Limpieza',
    creditDays: 30,
    balanceUsd: 0
  }
];

const INITIAL_RECEIVABLES: ReceivableAccountItem[] = [
  {
    id: 'cxc-1',
    customerName: 'Bodega El Samán',
    customerRif: 'J-50112233-4',
    invoiceNumber: 'FAC-000104',
    date: '2026-11-10',
    dueDate: '2026-11-25',
    totalUsd: 120.00,
    paidUsd: 45.00,
    status: 'PARCIAL'
  },
  {
    id: 'cxc-2',
    customerName: 'Mini Market La Paz',
    customerRif: 'V-18445990-1',
    invoiceNumber: 'FAC-000108',
    date: '2026-11-18',
    dueDate: '2026-12-03',
    totalUsd: 85.50,
    paidUsd: 0,
    status: 'PENDIENTE'
  }
];

const INITIAL_PAYABLES: PayableAccountItem[] = [
  {
    id: 'cxp-1',
    supplierName: 'Distribuidora Central C.A.',
    supplierRif: 'J-30123456-7',
    invoiceNumber: 'FAC-PROV-882',
    date: '2026-11-12',
    dueDate: '2026-11-27',
    totalUsd: 145.00,
    paidUsd: 0,
    status: 'PENDIENTE'
  },
  {
    id: 'cxp-2',
    supplierName: 'Alimentos del Sur',
    supplierRif: 'J-40987654-3',
    invoiceNumber: 'FAC-PROV-915',
    date: '2026-11-15',
    dueDate: '2026-12-06',
    totalUsd: 88.50,
    paidUsd: 0,
    status: 'PENDIENTE'
  }
];

const INITIAL_GENERAL_EXPENSES: GeneralExpenseItem[] = [
  {
    id: 'exp-1',
    date: '2026-11-05',
    category: 'Alquiler y Servicios',
    description: 'Servicio de Internet Fibra y Línea Local',
    paymentMethod: 'PAGO_MOVIL',
    amountUsd: 35.00,
    reference: 'PM-99812',
    status: 'PAGADO'
  },
  {
    id: 'exp-2',
    date: '2026-11-16',
    category: 'Gastos de Oficina / Insumos',
    description: 'Rollos térmicos para impresora fiscal / POS',
    paymentMethod: 'EFECTIVO_USD',
    amountUsd: 18.00,
    reference: 'CAJ-014',
    status: 'PAGADO'
  }
];

const INITIAL_TRANSACTIONS: Transaction[] = [
  {
    id: 'tx-1',
    date: '2026-11-20',
    description: 'Venta Mostrador #001 - Factura FAC-000112',
    category: 'Ventas Mostrador',
    type: 'income',
    amountUsd: 64.50,
    paymentMethod: 'PAGO_MOVIL',
    status: 'Completado'
  },
  {
    id: 'tx-2',
    date: '2026-11-21',
    description: 'Reposición parcial mercancía bodega',
    category: 'Compras Mercancía',
    type: 'expense',
    amountUsd: 42.00,
    paymentMethod: 'EFECTIVO_USD',
    status: 'Completado'
  },
  {
    id: 'tx-3',
    date: '2026-11-22',
    description: 'Venta Mostrador #002 - Factura FAC-000113',
    category: 'Ventas Mostrador',
    type: 'income',
    amountUsd: 93.20,
    paymentMethod: 'TRANSFERENCIA_BS',
    status: 'Completado'
  }
];

const INITIAL_BLOCKS: DashboardBlock[] = [
  {
    id: 'blk-kpi-1',
    type: 'kpi_summary',
    title: 'Indicadores Clave del Negocio',
    colSpan: 2,
    visible: true
  },
  {
    id: 'blk-chart-1',
    type: 'chart_cashflow',
    title: 'Flujo de Caja Mensual (USD)',
    colSpan: 1,
    visible: true
  },
  {
    id: 'blk-chart-2',
    type: 'chart_categories',
    title: 'Ingresos vs Egresos por Categoría',
    colSpan: 1,
    visible: true
  },
  {
    id: 'blk-table-1',
    type: 'table_transactions',
    title: 'Movimientos Recientes',
    colSpan: 2,
    visible: true
  }
];

function createDefaultState(): GenesisState {
  return {
    businessName: 'Genesis-app',
    businessRif: 'J-4546474849',
    businessPhone: '0412-6371242',
    businessAddress: 'Av. Principal, Local 4, Caracas',
    currencyLabel: 'USD',
    bcvUsdRate: 46.80,
    bcvEurRate: 50.40,
    parallelUsdRate: 54.20,
    activeRateSource: 'BCV_USD',
    ivaRate: 16,
    igtfRate: 3,
    applyIgtfOnForeignCash: true,
    nextInvoiceNumber: 114,
    cashRegisterOpen: true,
    openingCashUsd: 100.00,
    openingCashBs: 4680.00,
    products: INITIAL_PRODUCTS,
    salesHistory: [],
    creditNotes: [],
    suppliers: INITIAL_SUPPLIERS,
    receivables: INITIAL_RECEIVABLES,
    payables: INITIAL_PAYABLES,
    generalExpenses: INITIAL_GENERAL_EXPENSES,
    transactions: INITIAL_TRANSACTIONS,
    blocks: INITIAL_BLOCKS
  };
}

function formatMoneyUsd(val: number): string {
  const safe = Number.isFinite(val) ? val : 0;
  return `$${safe.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatMoneyBs(val: number): string {
  const safe = Number.isFinite(val) ? val : 0;
  return `Bs. ${safe.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function normalizeRif(raw: string): string {
  const clean = (raw || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (!clean) return 'J-00000000-0';
  const prefix = /^[VJEGPC]/.test(clean) ? clean[0] : 'J';
  const digits = clean.replace(/^[VJEGPC]/, '').replace(/\D/g, '');
  if (!digits) return `${prefix}-00000000-0`;
  if (digits.length <= 8) return `${prefix}-${digits.padStart(8, '0')}-0`;
  const body = digits.slice(0, -1);
  const dv = digits.slice(-1);
  return `${prefix}-${body}-${dv}`;
}

export default function GenesisDashboard() {
  const [state, setState] = useState<GenesisState & { invoiceTemplate?: { businessName?: string; taxId?: string } }>(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved =
          localStorage.getItem(STORAGE_KEY) || localStorage.getItem('genesis_app_v13_state');
        if (saved) {
          const parsed = JSON.parse(saved);
          const merged = { ...createDefaultState(), ...parsed };
          const rif = normalizeRif(
            parsed?.businessRif || parsed?.taxId || parsed?.invoiceTemplate?.taxId || merged.businessRif
          );
          const name =
            parsed?.businessName || parsed?.invoiceTemplate?.businessName || merged.businessName;
          return {
            ...merged,
            businessName: name,
            businessRif: rif,
            invoiceTemplate: {
              ...(parsed?.invoiceTemplate || {}),
              businessName: name,
              taxId: rif
            }
          };
        }
      } catch (err) {
        console.error('Error reading Genesis state:', err);
      }
    }
    const initial = createDefaultState();
    return {
      ...initial,
      invoiceTemplate: {
        businessName: initial.businessName,
        taxId: initial.businessRif
      }
    };
  });

  const [darkMode, setDarkMode] = useState<boolean>(false);
  const [activeSubSection, setActiveSubSection] = useState<OperationsSubSection>('OVERVIEW');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<string>('ALL');

  const [isAddBlockOpen, setIsAddBlockOpen] = useState<boolean>(false);
  const [newBlockTitle, setNewBlockTitle] = useState<string>('');
  const [newBlockType, setNewBlockType] = useState<BlockType>('kpi_summary');
  const [newBlockColSpan, setNewBlockColSpan] = useState<1 | 2>(1);

  const [isAddTxOpen, setIsAddTxOpen] = useState<boolean>(false);
  const [txDate, setTxDate] = useState<string>(() => new Date().toISOString().slice(0, 10));
  const [txDescription, setTxDescription] = useState<string>('');
  const [txCategory, setTxCategory] = useState<string>('Ventas Mostrador');
  const [txType, setTxType] = useState<'income' | 'expense'>('income');
  const [txAmountUsd, setTxAmountUsd] = useState<string>('');
  const [txPaymentMethod, setTxPaymentMethod] = useState<PaymentAccountCategory>('PAGO_MOVIL');

  const [operators] = useState<OperatorAccountItem[]>(() => {
    if (typeof window !== 'undefined') {
      try {
        const raw = localStorage.getItem(OPERATOR_SESSIONS_KEY);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed) && parsed.length > 0) return parsed;
        }
      } catch {}
    }
    return DEFAULT_OPERATOR_ACCOUNTS;
  });

  const [currentOperator, setCurrentOperator] = useState<OperatorAccountItem>(() => {
    return operators[0] || DEFAULT_OPERATOR_ACCOUNTS[0];
  });

  const [startupLockEnabled, setStartupLockEnabled] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem(STARTUP_LOCK_ENABLED_KEY) === 'true';
    }
    return false;
  });

  const [isStartupLoginOpen, setIsStartupLoginOpen] = useState<boolean>(false);
  const [isSwitchOperatorOpen, setIsSwitchOperatorOpen] = useState<boolean>(false);
  const [selectedOperatorId, setSelectedOperatorId] = useState<string>(DEFAULT_OPERATOR_ACCOUNTS[0].id);
  const [pinInput, setPinInput] = useState<string>('');
  const [pinError, setPinError] = useState<string>('');

  const [isCopilotOpen, setIsCopilotOpen] = useState<boolean>(false);
  const [copilotPrompt, setCopilotPrompt] = useState<string>('');
  const [copilotReply, setCopilotReply] = useState<string>(
    'Asistente Genesis listo. Puedo resumir ventas, márgenes, cuentas por cobrar/pagar, tasas BCV/Paralelo o sugerir ajustes de inventario.'
  );

  const [isMasterRestoreModalOpen, setIsMasterRestoreModalOpen] = useState<boolean>(false);
  const [masterRestoreInput, setMasterRestoreInput] = useState<string>('');

  const [auditLogs, setAuditLogs] = useState<AuditEntry[]>(() => {
    if (typeof window !== 'undefined') {
      try {
        const raw = localStorage.getItem(AUDIT_STORAGE_KEY);
        if (raw) return JSON.parse(raw);
      } catch {}
    }
    return [
      {
        id: 'aud-init',
        timestamp: new Date().toISOString(),
        operatorName: 'Administrador Principal',
        role: 'ADMIN' as OperatorRoleType as OperatorRoleType,
        action: 'SYSTEM_INIT',
        detail: 'Inicialización del panel Genesis Business Dashboard'
      }
    ];
  });

  const [posCart, setPosCart] = useState<SaleInvoiceItem[]>([]);
  const posSearchInputRef = useRef<HTMLInputElement | null>(null);
  const startupPinInputRef = useRef<HTMLInputElement | null>(null);

  const appendAuditLog = (action: string, detail: string) => {
    const entry: AuditEntry = {
      id: `aud-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      timestamp: new Date().toISOString(),
      operatorName: currentOperator?.name || 'Operador',
      role: currentOperator?.role || 'ADMIN',
      action,
      detail
    };
    setAuditLogs((prev) => {
      const next = [entry, ...prev].slice(0, 250);
      if (typeof window !== 'undefined') {
        try {
          localStorage.setItem(AUDIT_STORAGE_KEY, JSON.stringify(next));
        } catch {}
      }
      return next;
    });
  };

  const hasPermission = (perm: OperatorPermissionKey): boolean => {
    if (!currentOperator) return true;
    if (currentOperator.role === 'ADMIN') return true;
    return currentOperator.permissions.includes(perm);
  };

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const serialized = JSON.stringify(state);
      localStorage.setItem(STORAGE_KEY, serialized);
      localStorage.setItem('genesis_app_v13_state', serialized);
    } catch (err) {
      console.error('Error saving Genesis state:', err);
    }
  }, [state]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      localStorage.setItem(STARTUP_LOCK_ENABLED_KEY, String(startupLockEnabled));
    } catch {}
  }, [startupLockEnabled]);

  useEffect(() => {
    if (startupLockEnabled) {
      setIsStartupLoginOpen(true);
    }
  }, [startupLockEnabled]);

  useEffect(() => {
    if (isStartupLoginOpen || isSwitchOperatorOpen) {
      const timer = setTimeout(() => {
        startupPinInputRef.current?.focus();
      }, 60);
      return () => clearTimeout(timer);
    }
  }, [isStartupLoginOpen, isSwitchOperatorOpen]);

  const activeRate = useMemo(() => {
    if (state.activeRateSource === 'BCV_EUR') return state.bcvEurRate || 50.4;
    if (state.activeRateSource === 'PARALLEL_USD') return state.parallelUsdRate || 54.2;
    return state.bcvUsdRate || 46.8;
  }, [state.activeRateSource, state.bcvUsdRate, state.bcvEurRate, state.parallelUsdRate]);

  const addProductToInvoice = (product: ProductItem, qty = 1) => {
    if (!hasPermission('POS_SELL')) {
      alert('Tu rol actual no tiene permiso para facturar en POS.');
      return;
    }
    if (product.stock <= 0) {
      alert(`Sin existencias disponibles para "${product.name}".`);
      return;
    }
    setPosCart((prev) => {
      const existing = prev.find((item) => item.productId === product.id);
      if (existing) {
        const nextQty = Math.min(product.stock, existing.quantity + qty);
        return prev.map((item) =>
          item.productId === product.id
            ? {
                ...item,
                quantity: nextQty,
                subtotalUsd: Number((nextQty * item.unitPriceUsd).toFixed(2))
              }
            : item
        );
      }
      const safeQty = Math.min(product.stock, qty);
      return [
        ...prev,
        {
          productId: product.id,
          sku: product.sku,
          name: product.name,
          quantity: safeQty,
          unitPriceUsd: product.priceUsd,
          discountPct: 0,
          taxRate: product.taxRate,
          subtotalUsd: Number((safeQty * product.priceUsd).toFixed(2))
        }
      ];
    });
  };

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setActiveSubSection('POS');
        setTimeout(() => {
          posSearchInputRef.current?.focus();
        }, 50);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  const summary = useMemo(() => {
    const incomeUsd = state.transactions
      .filter((t) => t.type === 'income')
      .reduce((acc, t) => acc + (Number(t.amountUsd) || 0), 0);
    const expenseUsd = state.transactions
      .filter((t) => t.type === 'expense')
      .reduce((acc, t) => acc + (Number(t.amountUsd) || 0), 0);
    const netUsd = incomeUsd - expenseUsd;
    const receivablesPendingUsd = state.receivables.reduce(
      (acc, r) => acc + Math.max(0, (r.totalUsd || 0) - (r.paidUsd || 0)),
      0
    );
    const payablesPendingUsd = state.payables.reduce(
      (acc, p) => acc + Math.max(0, (p.totalUsd || 0) - (p.paidUsd || 0)),
      0
    );
    const inventoryValueUsd = state.products.reduce(
      (acc, item) => acc + (item.stock || 0) * (item.costUsd || 0),
      0
    );
    const lowStockCount = state.products.filter((p) => p.stock <= p.minStock).length;

    return {
      incomeUsd,
      expenseUsd,
      netUsd,
      netBs: netUsd * activeRate,
      receivablesPendingUsd,
      payablesPendingUsd,
      inventoryValueUsd,
      lowStockCount
    };
  }, [state.transactions, state.receivables, state.payables, state.products, activeRate]);

  const filteredTransactions = useMemo(() => {
    return state.transactions.filter((tx) => {
      const matchesCat =
        selectedCategoryFilter === 'ALL' || tx.category === selectedCategoryFilter;
      const q = searchQuery.trim().toLowerCase();
      const matchesQuery =
        !q ||
        tx.description.toLowerCase().includes(q) ||
        tx.category.toLowerCase().includes(q) ||
        tx.paymentMethod.toLowerCase().includes(q);
      return matchesCat && matchesQuery;
    });
  }, [state.transactions, selectedCategoryFilter, searchQuery]);

  const categories = useMemo(() => {
    const set = new Set<string>(['Ventas Mostrador', 'Compras Mercancía', 'Servicios', 'Nómina']);
    state.transactions.forEach((t) => {
      if (t.category) set.add(t.category);
    });
    return Array.from(set);
  }, [state.transactions]);

  const handleAddTransaction = (e: React.FormEvent) => {
    e.preventDefault();
    const numericAmount = parseFloat(txAmountUsd);
    if (!txDescription.trim() || !Number.isFinite(numericAmount) || numericAmount <= 0) {
      return;
    }
    const newTx: Transaction = {
      id: `tx-${Date.now()}`,
      date: txDate || new Date().toISOString().slice(0, 10),
      description: txDescription.trim(),
      category: txCategory.trim() || 'General',
      type: txType,
      amountUsd: Number(numericAmount.toFixed(2)),
      paymentMethod: txPaymentMethod,
      status: 'Completado'
    };
    setState((prev) => ({
      ...prev,
      transactions: [newTx, ...prev.transactions]
    }));
    appendAuditLog(
      txType === 'income' ? 'INCOME_ADDED' : 'EXPENSE_ADDED',
      `${newTx.description} (${formatMoneyUsd(newTx.amountUsd)})`
    );
    setTxDescription('');
    setTxAmountUsd('');
    setIsAddTxOpen(false);
  };

  const handleDeleteTransaction = (id: string) => {
    if (!hasPermission('VOID_SALE')) {
      alert('No tienes permiso para eliminar registros.');
      return;
    }
    const target = state.transactions.find((t) => t.id === id);
    setState((prev) => ({
      ...prev,
      transactions: prev.transactions.filter((t) => t.id !== id)
    }));
    if (target) {
      appendAuditLog('TX_DELETED', `${target.description} (${formatMoneyUsd(target.amountUsd)})`);
    }
  };

  const handleAddBlock = (e: React.FormEvent) => {
    e.preventDefault();
    const title =
      newBlockTitle.trim() ||
      (newBlockType === 'kpi_summary'
        ? 'Indicadores Clave'
        : newBlockType === 'chart_cashflow'
        ? 'Flujo de Caja'
        : newBlockType === 'chart_categories'
        ? 'Análisis por Categoría'
        : 'Tabla de Movimientos');

    const block: DashboardBlock = {
      id: `blk-${Date.now()}`,
      type: newBlockType,
      title,
      colSpan: newBlockColSpan,
      visible: true
    };
    setState((prev) => ({
      ...prev,
      blocks: [...prev.blocks, block]
    }));
    appendAuditLog('BLOCK_ADDED', `Bloque "${title}" (${newBlockType})`);
    setNewBlockTitle('');
    setIsAddBlockOpen(false);
  };

  const toggleBlockVisibility = (blockId: string) => {
    setState((prev) => ({
      ...prev,
      blocks: prev.blocks.map((b) => (b.id === blockId ? { ...b, visible: !b.visible } : b))
    }));
  };

  const handleExportJson = () => {
    const payload = {
      exportedAt: new Date().toISOString(),
      state,
      auditLogs
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `genesis-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    appendAuditLog('BACKUP_EXPORTED', 'Exportación JSON completa del estado');
  };

  const handleResetDemoState = () => {
    const fresh = createDefaultState();
    setState({
      ...fresh,
      invoiceTemplate: {
        businessName: fresh.businessName,
        taxId: fresh.businessRif
      }
    });
    appendAuditLog('STATE_RESET', 'Restauración de valores iniciales');
  };

  const handleVerifyPin = (targetOperatorId: string, onSuccess: (op: OperatorAccountItem) => void) => {
    const found = operators.find((o) => o.id === targetOperatorId);
    if (!found) {
      setPinError('Operador no encontrado.');
      return;
    }
    if (found.pin.trim() !== pinInput.trim()) {
      setPinError('PIN incorrecto.');
      return;
    }
    setPinError('');
    setPinInput('');
    setCurrentOperator(found);
    appendAuditLog('OPERATOR_LOGIN', `Ingreso como ${found.name} (${found.role})`);
    onSuccess(found);
  };

  const handleCopilotSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const q = copilotPrompt.trim();
    if (!q) return;
    const summaryText = `Resumen actual (${state.businessName} - ${normalizeRif(state.businessRif)}): Ingresos ${formatMoneyUsd(
      summary.incomeUsd
    )}, Egresos ${formatMoneyUsd(summary.expenseUsd)}, Balance Neto ${formatMoneyUsd(
      summary.netUsd
    )} (${formatMoneyBs(summary.netBs)} a tasa ${activeRate.toFixed(2)}). CxC pendientes: ${formatMoneyUsd(
      summary.receivablesPendingUsd
    )}, CxP pendientes: ${formatMoneyUsd(summary.payablesPendingUsd)}, Stock bajo mínimo: ${
      summary.lowStockCount
    } producto(s). Consulta: "${q}".`;
    setCopilotReply(summaryText);
    setCopilotPrompt('');
  };

  const handleMasterRestoreSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const parsed = JSON.parse(masterRestoreInput);
      const nextState = parsed.state
        ? { ...createDefaultState(), ...parsed.state }
        : { ...createDefaultState(), ...parsed };
      setState(nextState);
      if (Array.isArray(parsed.auditLogs)) {
        setAuditLogs(parsed.auditLogs);
      }
      appendAuditLog('MASTER_RESTORE', 'Restauración manual desde respaldo JSON');
      setMasterRestoreInput('');
      setIsMasterRestoreModalOpen(false);
    } catch {
      alert('El JSON ingresado no es válido. Verifica la estructura del respaldo.');
    }
  };

  const handleImportExcelSheets = (sheets: ExcelSheetData[]) => {
    if (!sheets || sheets.length === 0) return;
    const firstSheet = sheets[0];
    const importedTx: Transaction[] = [];
    for (const row of firstSheet.rows || []) {
      if (!row || row.length < 2) continue;
      const desc = String(row[0] ?? '').trim();
      const amt = parseFloat(String(row[1] ?? '').replace(/[^0-9.-]/g, ''));
      if (desc && Number.isFinite(amt) && amt !== 0) {
        importedTx.push({
          id: `tx-imp-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          date: String(row[2] ?? new Date().toISOString().slice(0, 10)),
          description: desc,
          category: String(row[3] ?? 'Importado Excel'),
          type: amt >= 0 ? 'income' : 'expense',
          amountUsd: Math.abs(amt),
          paymentMethod: 'TRANSFERENCIA_BS',
          status: 'Completado'
        });
      }
    }
    if (importedTx.length > 0) {
      setState((prev) => ({
        ...prev,
        transactions: [...importedTx, ...prev.transactions]
      }));
      appendAuditLog('EXCEL_IMPORT', `Importados ${importedTx.length} movimientos desde "${firstSheet.name}"`);
    }
  };

  return (
    <div
      className={`min-h-screen transition-colors ${
        darkMode ? 'bg-slate-950 text-slate-100' : 'bg-slate-50 text-slate-900'
      }`}
    >
      <header
        className={`sticky top-0 z-30 border-b px-4 py-3 backdrop-blur ${
          darkMode
            ? 'border-slate-800 bg-slate-900/90 text-slate-100'
            : 'border-slate-200 bg-white/90 text-slate-900'
        }`}
      >
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-600 text-white shadow-sm">
              <LayoutDashboard className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base font-bold tracking-tight">{state.businessName}</h1>
                <span className="rounded-md bg-indigo-500/10 px-2 py-0.5 text-xs font-semibold text-indigo-500">
                  {normalizeRif(state.businessRif)}
                </span>
              </div>
              <p className="text-xs opacity-70">
                Operador: <span className="font-medium">{currentOperator.name}</span> ({OPERATOR_ROLE_LABELS[currentOperator.role]}) · Tasa activa: {activeRate.toFixed(2)} Bs
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setIsAddTxOpen(true)}
              className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-indigo-700"
            >
              <Plus className="h-3.5 w-3.5" />
              Movimiento
            </button>

            <button
              type="button"
              onClick={() => setIsAddBlockOpen(true)}
              className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium ${
                darkMode
                  ? 'border-slate-700 bg-slate-800 hover:bg-slate-700'
                  : 'border-slate-300 bg-white hover:bg-slate-100'
              }`}
            >
              <Columns className="h-3.5 w-3.5" />
              Bloque
            </button>

            <button
              type="button"
              onClick={() => setIsCopilotOpen(true)}
              className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium ${
                darkMode
                  ? 'border-slate-700 bg-slate-800 hover:bg-slate-700'
                  : 'border-slate-300 bg-white hover:bg-slate-100'
              }`}
            >
              <Sparkles className="h-3.5 w-3.5 text-amber-500" />
              Copilot
            </button>

            <button
              type="button"
              onClick={() => {
                setSelectedOperatorId(currentOperator.id);
                setPinInput('');
                setPinError('');
                setIsSwitchOperatorOpen(true);
              }}
              className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium ${
                darkMode
                  ? 'border-slate-700 bg-slate-800 hover:bg-slate-700'
                  : 'border-slate-300 bg-white hover:bg-slate-100'
              }`}
            >
              <Users className="h-3.5 w-3.5" />
              Operador
            </button>

            <button
              type="button"
              onClick={handleExportJson}
              title="Exportar respaldo JSON"
              className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-medium ${
                darkMode
                  ? 'border-slate-700 bg-slate-800 hover:bg-slate-700'
                  : 'border-slate-300 bg-white hover:bg-slate-100'
              }`}
            >
              <Download className="h-3.5 w-3.5" />
            </button>

            <button
              type="button"
              onClick={handleResetDemoState}
              title="Restablecer valores iniciales"
              className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-medium ${
                darkMode
                  ? 'border-slate-700 bg-slate-800 hover:bg-slate-700'
                  : 'border-slate-300 bg-white hover:bg-slate-100'
              }`}
            >
              <RotateCcw className="h-3.5 w-3.5" />
            </button>

            <button
              type="button"
              onClick={() => setDarkMode((prev) => !prev)}
              title="Cambiar tema"
              className={`inline-flex items-center justify-center rounded-lg border p-1.5 ${
                darkMode
                  ? 'border-slate-700 bg-slate-800 text-amber-400 hover:bg-slate-700'
                  : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-100'
              }`}
            >
              {darkMode ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </button>
          </div>
        </div>

        <nav className="mx-auto mt-3 flex max-w-7xl flex-wrap items-center gap-1.5 border-t pt-2.5 border-slate-200/70 dark:border-slate-800">
          {(
            [
              ['OVERVIEW', 'Resumen', LayoutDashboard],
              ['POS', 'Caja / POS', ShoppingBag],
              ['INVENTORY', 'Inventario', Package],
              ['SUPPLIERS', 'Proveedores', Truck],
              ['RECEIVABLES', 'CxC / CxP', Wallet],
              ['EXPENSES', 'Gastos', Receipt],
              ['REPORTS', 'Reportes', BarChart3],
              ['ACCOUNTING', 'Contabilidad', Scale],
              ['SENIAT', 'SENIAT', FileText],
              ['SETTINGS', 'Ajustes', ClipboardCheck]
            ] as [OperationsSubSection, string, React.ComponentType<{ className?: string }>][]
          ).map(([key, label, Icon]) => {
            const active = activeSubSection === key;
            return (
              <button
                key={key}
                type="button"
                onClick={() => setActiveSubSection(key)}
                className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition ${
                  active
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : darkMode
                    ? 'text-slate-300 hover:bg-slate-800'
                    : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                <Icon className="h-3.5 w-3.5" />
                {label}
              </button>
            );
          })}
        </nav>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-6">
        {activeSubSection === 'OVERVIEW' && (
          <div className="space-y-6">
            <div
              className={`flex flex-wrap items-center justify-between gap-3 rounded-xl border p-3 ${
                darkMode ? 'border-slate-800 bg-slate-900' : 'border-slate-200 bg-white'
              }`}
            >
              <div className="relative min-w-[220px] flex-1">
                <Search className="absolute left-3 top-2.5 h-4 w-4 opacity-50" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Buscar movimientos, categorías o métodos de pago..."
                  className={`w-full rounded-lg border py-1.5 pl-9 pr-3 text-sm outline-none ${
                    darkMode
                      ? 'border-slate-700 bg-slate-800 text-slate-100'
                      : 'border-slate-300 bg-slate-50 text-slate-900'
                  }`}
                />
              </div>

              <div className="flex items-center gap-2">
                <select
                  value={selectedCategoryFilter}
                  onChange={(e) => setSelectedCategoryFilter(e.target.value)}
                  className={`rounded-lg border px-3 py-1.5 text-xs font-medium outline-none ${
                    darkMode
                      ? 'border-slate-700 bg-slate-800 text-slate-100'
                      : 'border-slate-300 bg-slate-50 text-slate-900'
                  }`}
                >
                  <option value="ALL">Todas las categorías</option>
                  {categories.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
              {state.blocks
                .filter((b) => b.visible)
                .map((block) => (
                  <section
                    key={block.id}
                    className={`rounded-2xl border p-4 shadow-xs ${
                      block.colSpan === 2 ? 'md:col-span-2' : 'md:col-span-1'
                    } ${
                      darkMode ? 'border-slate-800 bg-slate-900' : 'border-slate-200 bg-white'
                    }`}
                  >
                    <div className="mb-4 flex items-center justify-between gap-2">
                      <h2 className="text-sm font-bold">{block.title}</h2>
                      <button
                        type="button"
                        onClick={() => toggleBlockVisibility(block.id)}
                        title="Ocultar bloque"
                        className="rounded-md p-1 opacity-60 hover:opacity-100"
                      >
                        <Eye className="h-4 w-4" />
                      </button>
                    </div>

                    {block.type === 'kpi_summary' && (
                      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                        <div
                          className={`rounded-xl border p-3.5 ${
                            darkMode ? 'border-slate-800 bg-slate-950/60' : 'border-slate-100 bg-slate-50'
                          }`}
                        >
                          <p className="text-xs opacity-70">Ingresos Totales</p>
                          <p className="mt-1 text-lg font-bold text-emerald-500">
                            {formatMoneyUsd(summary.incomeUsd)}
                          </p>
                          <p className="text-xs opacity-60">
                            {formatMoneyBs(summary.incomeUsd * activeRate)}
                          </p>
                        </div>

                        <div
                          className={`rounded-xl border p-3.5 ${
                            darkMode ? 'border-slate-800 bg-slate-950/60' : 'border-slate-100 bg-slate-50'
                          }`}
                        >
                          <p className="text-xs opacity-70">Egresos Totales</p>
                          <p className="mt-1 text-lg font-bold text-rose-500">
                            {formatMoneyUsd(summary.expenseUsd)}
                          </p>
                          <p className="text-xs opacity-60">
                            {formatMoneyBs(summary.expenseUsd * activeRate)}
                          </p>
                        </div>

                        <div
                          className={`rounded-xl border p-3.5 ${
                            darkMode ? 'border-slate-800 bg-slate-950/60' : 'border-slate-100 bg-slate-50'
                          }`}
                        >
                          <p className="text-xs opacity-70">Balance Neto</p>
                          <p
                            className={`mt-1 text-lg font-bold ${
                              summary.netUsd >= 0 ? 'text-indigo-500' : 'text-rose-500'
                            }`}
                          >
                            {formatMoneyUsd(summary.netUsd)}
                          </p>
                          <p className="text-xs opacity-60">{formatMoneyBs(summary.netBs)}</p>
                        </div>

                        <div
                          className={`rounded-xl border p-3.5 ${
                            darkMode ? 'border-slate-800 bg-slate-950/60' : 'border-slate-100 bg-slate-50'
                          }`}
                        >
                          <p className="text-xs opacity-70">Valor Inventario (Costo)</p>
                          <p className="mt-1 text-lg font-bold text-amber-500">
                            {formatMoneyUsd(summary.inventoryValueUsd)}
                          </p>
                          <p className="text-xs opacity-60">
                            Stock bajo: {summary.lowStockCount} producto(s)
                          </p>
                        </div>
                      </div>
                    )}

                    {(block.type === 'chart_cashflow' || block.type === 'chart_categories') && (
                      <Movements3dChart
                        transactions={filteredTransactions}
                        mode={block.type === 'chart_cashflow' ? 'cashflow' : 'categories'}
                        darkMode={darkMode}
                      />
                    )}

                    {block.type === 'table_transactions' && (
                      <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs">
                          <thead>
                            <tr className="border-b border-slate-200 dark:border-slate-800 opacity-75">
                              <th className="py-2 pr-3">Fecha</th>
                              <th className="py-2 pr-3">Descripción</th>
                              <th className="py-2 pr-3">Categoría</th>
                              <th className="py-2 pr-3">Método</th>
                              <th className="py-2 pr-3 text-right">Monto USD</th>
                              <th className="py-2 pr-3 text-right">Equiv. Bs</th>
                              <th className="py-2 text-right">Acción</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-200/60 dark:divide-slate-800/60">
                            {filteredTransactions.length === 0 ? (
                              <tr>
                                <td colSpan={7} className="py-6 text-center opacity-60">
                                  No hay movimientos que coincidan con el filtro.
                                </td>
                              </tr>
                            ) : (
                              filteredTransactions.map((tx) => (
                                <tr key={tx.id}>
                                  <td className="py-2.5 pr-3 whitespace-nowrap">{tx.date}</td>
                                  <td className="py-2.5 pr-3 font-medium">{tx.description}</td>
                                  <td className="py-2.5 pr-3 whitespace-nowrap">{tx.category}</td>
                                  <td className="py-2.5 pr-3 whitespace-nowrap">{tx.paymentMethod}</td>
                                  <td
                                    className={`py-2.5 pr-3 text-right font-semibold whitespace-nowrap ${
                                      tx.type === 'income' ? 'text-emerald-500' : 'text-rose-500'
                                    }`}
                                  >
                                    {tx.type === 'income' ? '+' : '-'}
                                    {formatMoneyUsd(tx.amountUsd)}
                                  </td>
                                  <td className="py-2.5 pr-3 text-right whitespace-nowrap opacity-80">
                                    {formatMoneyBs(tx.amountUsd * activeRate)}
                                  </td>
                                  <td className="py-2.5 text-right">
                                    <button
                                      type="button"
                                      onClick={() => handleDeleteTransaction(tx.id)}
                                      title="Eliminar movimiento"
                                      className="rounded p-1 text-rose-500 hover:bg-rose-500/10"
                                    >
                                      <Trash2 className="h-3.5 w-3.5" />
                                    </button>
                                  </td>
                                </tr>
                              ))
                            )}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </section>
                ))}
            </div>
          </div>
        )}

        {activeSubSection === 'POS' && (
          <PosSalesWindow
            state={state}
            setState={setState}
            cart={posCart}
            setCart={setPosCart}
            onAddProduct={addProductToInvoice}
            searchInputRef={posSearchInputRef}
            activeRate={activeRate}
            darkMode={darkMode}
            onAudit={appendAuditLog}
          />
        )}

        {activeSubSection === 'INVENTORY' && (
          <div
            className={`rounded-2xl border p-5 ${
              darkMode ? 'border-slate-800 bg-slate-900' : 'border-slate-200 bg-white'
            }`}
          >
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h2 className="text-base font-bold">Inventario de Productos</h2>
                <p className="text-xs opacity-70">
                  Total productos: {state.products.length} · Valor costo: {formatMoneyUsd(summary.inventoryValueUsd)}
                </p>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-800 opacity-75">
                    <th className="py-2 pr-3">SKU</th>
                    <th className="py-2 pr-3">Producto</th>
                    <th className="py-2 pr-3">Categoría</th>
                    <th className="py-2 pr-3 text-right">Costo USD</th>
                    <th className="py-2 pr-3 text-right">Precio USD</th>
                    <th className="py-2 pr-3 text-right">IVA %</th>
                    <th className="py-2 pr-3 text-right">Stock</th>
                    <th className="py-2 text-right">POS</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200/60 dark:divide-slate-800/60">
                  {state.products.map((prod) => (
                    <tr key={prod.id}>
                      <td className="py-2.5 pr-3 font-mono">{prod.sku}</td>
                      <td className="py-2.5 pr-3 font-medium">{prod.name}</td>
                      <td className="py-2.5 pr-3">{prod.category}</td>
                      <td className="py-2.5 pr-3 text-right">{formatMoneyUsd(prod.costUsd)}</td>
                      <td className="py-2.5 pr-3 text-right font-semibold">{formatMoneyUsd(prod.priceUsd)}</td>
                      <td className="py-2.5 pr-3 text-right">{prod.taxRate}%</td>
                      <td
                        className={`py-2.5 pr-3 text-right font-semibold ${
                          prod.stock <= prod.minStock ? 'text-amber-500' : 'text-emerald-500'
                        }`}
                      >
                        {prod.stock}
                      </td>
                      <td className="py-2.5 text-right">
                        <button
                          type="button"
                          onClick={() => {
                            addProductToInvoice(prod, 1);
                            setActiveSubSection('POS');
                          }}
                          className="rounded-lg bg-indigo-600 px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-indigo-700"
                        >
                          Agregar
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeSubSection === 'SUPPLIERS' && (
          <div
            className={`rounded-2xl border p-5 ${
              darkMode ? 'border-slate-800 bg-slate-900' : 'border-slate-200 bg-white'
            }`}
          >
            <h2 className="mb-4 text-base font-bold">Directorio de Proveedores</h2>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              {state.suppliers.map((sup) => (
                <div
                  key={sup.id}
                  className={`rounded-xl border p-4 ${
                    darkMode ? 'border-slate-800 bg-slate-950/60' : 'border-slate-200 bg-slate-50'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-semibold text-indigo-500">{sup.rif}</span>
                    <span className="text-xs opacity-70">{sup.creditDays} días crédito</span>
                  </div>
                  <h3 className="mt-1 text-sm font-bold">{sup.name}</h3>
                  <p className="mt-1 text-xs opacity-75">Contacto: {sup.contact || 'N/A'}</p>
                  <p className="text-xs opacity-75">Tel: {sup.phone || 'N/A'}</p>
                  <p className="mt-2 text-xs font-semibold text-amber-500">
                    Saldo pendiente: {formatMoneyUsd(sup.balanceUsd)}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeSubSection === 'RECEIVABLES' && (
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <div
              className={`rounded-2xl border p-5 ${
                darkMode ? 'border-slate-800 bg-slate-900' : 'border-slate-200 bg-white'
              }`}
            >
              <h2 className="mb-3 text-base font-bold">Cuentas por Cobrar (CxC)</h2>
              <p className="mb-4 text-xs opacity-70">
                Pendiente total: {formatMoneyUsd(summary.receivablesPendingUsd)}
              </p>
              <div className="space-y-2.5">
                {state.receivables.map((item) => {
                  const pending = Math.max(0, item.totalUsd - item.paidUsd);
                  return (
                    <div
                      key={item.id}
                      className={`flex items-center justify-between rounded-xl border p-3 text-xs ${
                        darkMode ? 'border-slate-800 bg-slate-950/50' : 'border-slate-200 bg-slate-50'
                      }`}
                    >
                      <div>
                        <p className="font-bold">{item.customerName}</p>
                        <p className="opacity-70">
                          {item.invoiceNumber} · Vence: {item.dueDate}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="font-bold text-amber-500">{formatMoneyUsd(pending)}</p>
                        <p className="opacity-65">Total: {formatMoneyUsd(item.totalUsd)}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div
              className={`rounded-2xl border p-5 ${
                darkMode ? 'border-slate-800 bg-slate-900' : 'border-slate-200 bg-white'
              }`}
            >
              <h2 className="mb-3 text-base font-bold">Cuentas por Pagar (CxP)</h2>
              <p className="mb-4 text-xs opacity-70">
                Pendiente total: {formatMoneyUsd(summary.payablesPendingUsd)}
              </p>
              <div className="space-y-2.5">
                {state.payables.map((item) => {
                  const pending = Math.max(0, item.totalUsd - item.paidUsd);
                  return (
                    <div
                      key={item.id}
                      className={`flex items-center justify-between rounded-xl border p-3 text-xs ${
                        darkMode ? 'border-slate-800 bg-slate-950/50' : 'border-slate-200 bg-slate-50'
                      }`}
                    >
                      <div>
                        <p className="font-bold">{item.supplierName}</p>
                        <p className="opacity-70">
                          {item.invoiceNumber} · Vence: {item.dueDate}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="font-bold text-rose-500">{formatMoneyUsd(pending)}</p>
                        <p className="opacity-65">Total: {formatMoneyUsd(item.totalUsd)}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {activeSubSection === 'EXPENSES' && (
          <div
            className={`rounded-2xl border p-5 ${
              darkMode ? 'border-slate-800 bg-slate-900' : 'border-slate-200 bg-white'
            }`}
          >
            <h2 className="mb-4 text-base font-bold">Gastos Operativos Generales</h2>
            <div className="space-y-2.5">
              {state.generalExpenses.map((exp) => (
                <div
                  key={exp.id}
                  className={`flex items-center justify-between rounded-xl border p-3 text-xs ${
                    darkMode ? 'border-slate-800 bg-slate-950/50' : 'border-slate-200 bg-slate-50'
                  }`}
                >
                  <div>
                    <p className="font-bold">{exp.description}</p>
                    <p className="opacity-70">
                      {exp.date} · {exp.category} · Ref: {exp.reference}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-rose-500">{formatMoneyUsd(exp.amountUsd)}</p>
                    <p className="opacity-65">{exp.status}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeSubSection === 'REPORTS' && (
          <GeneralReportsPanel
            state={state}
            activeRate={activeRate}
            darkMode={darkMode}
            onImportSheets={handleImportExcelSheets}
          />
        )}

        {activeSubSection === 'ACCOUNTING' && (
          <AccountingBookPanel state={state} activeRate={activeRate} darkMode={darkMode} />
        )}

        {activeSubSection === 'SENIAT' && (
          <SeniatDocumentsPanel state={state} activeRate={activeRate} darkMode={darkMode} />
        )}

        {activeSubSection === 'SETTINGS' && (
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <div
              className={`space-y-4 rounded-2xl border p-5 ${
                darkMode ? 'border-slate-800 bg-slate-900' : 'border-slate-200 bg-white'
              }`}
            >
              <h2 className="text-base font-bold">Datos del Negocio y Tasas</h2>

              <div>
                <label className="mb-1 block text-xs font-medium opacity-75">Razón Social</label>
                <input
                  type="text"
                  value={state.businessName}
                  onChange={(e) => {
                    const nextName = e.target.value;
                    setState((prev) => ({
                      ...prev,
                      businessName: nextName,
                      invoiceTemplate: {
                        ...(prev.invoiceTemplate || {}),
                        businessName: nextName
                      }
                    }));
                  }}
                  className={`w-full rounded-lg border px-3 py-2 text-sm outline-none ${
                    darkMode ? 'border-slate-700 bg-slate-800' : 'border-slate-300 bg-slate-50'
                  }`}
                />
              </div>

              <TplTaxIdField
                label="RIF Fiscal"
                value={state.businessRif}
                onChange={(val: string) => {
                  const cleanRif = normalizeRif(val);
                  setState((prev) => ({
                    ...prev,
                    businessRif: cleanRif,
                    invoiceTemplate: {
                      ...(prev.invoiceTemplate || {}),
                      taxId: cleanRif
                    }
                  }));
                }}
                darkMode={darkMode}
              />

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <div>
                  <label className="mb-1 block text-xs font-medium opacity-75">Tasa BCV USD</label>
                  <input
                    type="number"
                    step="0.01"
                    value={state.bcvUsdRate}
                    onChange={(e) =>
                      setState((prev) => ({
                        ...prev,
                        bcvUsdRate: parseFloat(e.target.value) || 0
                      }))
                    }
                    className={`w-full rounded-lg border px-3 py-1.5 text-sm outline-none ${
                      darkMode ? 'border-slate-700 bg-slate-800' : 'border-slate-300 bg-slate-50'
                    }`}
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium opacity-75">Tasa BCV EUR</label>
                  <input
                    type="number"
                    step="0.01"
                    value={state.bcvEurRate}
                    onChange={(e) =>
                      setState((prev) => ({
                        ...prev,
                        bcvEurRate: parseFloat(e.target.value) || 0
                      }))
                    }
                    className={`w-full rounded-lg border px-3 py-1.5 text-sm outline-none ${
                      darkMode ? 'border-slate-700 bg-slate-800' : 'border-slate-300 bg-slate-50'
                    }`}
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium opacity-75">Tasa Paralelo</label>
                  <input
                    type="number"
                    step="0.01"
                    value={state.parallelUsdRate}
                    onChange={(e) =>
                      setState((prev) => ({
                        ...prev,
                        parallelUsdRate: parseFloat(e.target.value) || 0
                      }))
                    }
                    className={`w-full rounded-lg border px-3 py-1.5 text-sm outline-none ${
                      darkMode ? 'border-slate-700 bg-slate-800' : 'border-slate-300 bg-slate-50'
                    }`}
                  />
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
                <label className="flex items-center gap-2 text-xs font-medium">
                  <input
                    type="checkbox"
                    checked={startupLockEnabled}
                    onChange={(e) => setStartupLockEnabled(e.target.checked)}
                  />
                  Solicitar PIN al iniciar aplicación
                </label>

                <button
                  type="button"
                  onClick={() => setIsMasterRestoreModalOpen(true)}
                  className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-1.5 text-xs font-semibold text-amber-500 hover:bg-amber-500/20"
                >
                  Restaurar Respaldo JSON
                </button>
              </div>
            </div>

            <div
              className={`rounded-2xl border p-5 ${
                darkMode ? 'border-slate-800 bg-slate-900' : 'border-slate-200 bg-white'
              }`}
            >
              <h2 className="mb-3 text-base font-bold">Bitácora de Auditoría</h2>
              <div className="max-h-80 space-y-2 overflow-y-auto pr-1 text-xs">
                {auditLogs.map((log) => (
                  <div
                    key={log.id}
                    className={`rounded-lg border p-2.5 ${
                      darkMode ? 'border-slate-800 bg-slate-950/60' : 'border-slate-200 bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-semibold text-indigo-500">{log.action}</span>
                      <span className="opacity-60">{new Date(log.timestamp).toLocaleString()}</span>
                    </div>
                    <p className="mt-0.5">{log.detail}</p>
                    <p className="mt-0.5 opacity-65">Por: {log.operatorName}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </main>

      {isAddTxOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div
            className={`w-full max-w-md rounded-2xl border p-5 shadow-xl ${
              darkMode ? 'border-slate-800 bg-slate-900 text-slate-100' : 'border-slate-200 bg-white text-slate-900'
            }`}
          >
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-base font-bold">Nuevo Movimiento</h3>
              <button type="button" onClick={() => setIsAddTxOpen(false)}>
                <X className="h-4 w-4" />
              </button>
            </div>
            <form onSubmit={handleAddTransaction} className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block font-medium">Tipo</label>
                  <select
                    value={txType}
                    onChange={(e) => setTxType(e.target.value as 'income' | 'expense')}
                    className={`w-full rounded-lg border px-3 py-2 ${
                      darkMode ? 'border-slate-700 bg-slate-800' : 'border-slate-300 bg-slate-50'
                    }`}
                  >
                    <option value="income">Ingreso (+)</option>
                    <option value="expense">Egreso (-)</option>
                  </select>
                </div>
                <div>
                  <label className="mb-1 block font-medium">Fecha</label>
                  <input
                    type="date"
                    value={txDate}
                    onChange={(e) => setTxDate(e.target.value)}
                    className={`w-full rounded-lg border px-3 py-2 ${
                      darkMode ? 'border-slate-700 bg-slate-800' : 'border-slate-300 bg-slate-50'
                    }`}
                  />
                </div>
              </div>

              <div>
                <label className="mb-1 block font-medium">Descripción</label>
                <input
                  type="text"
                  required
                  value={txDescription}
                  onChange={(e) => setTxDescription(e.target.value)}
                  placeholder="Ej. Venta mostrador o pago proveedor"
                  className={`w-full rounded-lg border px-3 py-2 ${
                    darkMode ? 'border-slate-700 bg-slate-800' : 'border-slate-300 bg-slate-50'
                  }`}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block font-medium">Monto USD</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    required
                    value={txAmountUsd}
                    onChange={(e) => setTxAmountUsd(e.target.value)}
                    placeholder="0.00"
                    className={`w-full rounded-lg border px-3 py-2 ${
                      darkMode ? 'border-slate-700 bg-slate-800' : 'border-slate-300 bg-slate-50'
                    }`}
                  />
                </div>
                <div>
                  <label className="mb-1 block font-medium">Método de Pago</label>
                  <select
                    value={txPaymentMethod}
                    onChange={(e) => setTxPaymentMethod(e.target.value as PaymentAccountCategory)}
                    className={`w-full rounded-lg border px-3 py-2 ${
                      darkMode ? 'border-slate-700 bg-slate-800' : 'border-slate-300 bg-slate-50'
                    }`}
                  >
                    <option value="PAGO_MOVIL">Pago Móvil</option>
                    <option value="TRANSFERENCIA_BS">Transferencia Bs</option>
                    <option value="EFECTIVO_USD">Efectivo USD</option>
                    <option value="EFECTIVO_BS">Efectivo Bs</option>
                    <option value="PUNTO_VENTA">Punto de Venta</option>
                    <option value="ZELLE">Zelle</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="mb-1 block font-medium">Categoría</label>
                <input
                  type="text"
                  value={txCategory}
                  onChange={(e) => setTxCategory(e.target.value)}
                  className={`w-full rounded-lg border px-3 py-2 ${
                    darkMode ? 'border-slate-700 bg-slate-800' : 'border-slate-300 bg-slate-50'
                  }`}
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsAddTxOpen(false)}
                  className="rounded-lg border px-4 py-2 font-medium opacity-75 hover:opacity-100"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="rounded-lg bg-indigo-600 px-4 py-2 font-semibold text-white hover:bg-indigo-700"
                >
                  Guardar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {isAddBlockOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div
            className={`w-full max-w-md rounded-2xl border p-5 shadow-xl ${
              darkMode ? 'border-slate-800 bg-slate-900 text-slate-100' : 'border-slate-200 bg-white text-slate-900'
            }`}
          >
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-base font-bold">Añadir Bloque al Panel</h3>
              <button type="button" onClick={() => setIsAddBlockOpen(false)}>
                <X className="h-4 w-4" />
              </button>
            </div>
            <form onSubmit={handleAddBlock} className="space-y-3 text-xs">
              <div>
                <label className="mb-1 block font-medium">Tipo de Bloque</label>
                <select
                  value={newBlockType}
                  onChange={(e) => setNewBlockType(e.target.value as BlockType)}
                  className={`w-full rounded-lg border px-3 py-2 ${
                    darkMode ? 'border-slate-700 bg-slate-800' : 'border-slate-300 bg-slate-50'
                  }`}
                >
                  <option value="kpi_summary">Indicadores Clave (KPIs)</option>
                  <option value="chart_cashflow">Gráfico Flujo de Caja</option>
                  <option value="chart_categories">Gráfico por Categoría</option>
                  <option value="table_transactions">Tabla de Movimientos</option>
                </select>
              </div>

              <div>
                <label className="mb-1 block font-medium">Título del Bloque</label>
                <input
                  type="text"
                  value={newBlockTitle}
                  onChange={(e) => setNewBlockTitle(e.target.value)}
                  placeholder="Título personalizado (opcional)"
                  className={`w-full rounded-lg border px-3 py-2 ${
                    darkMode ? 'border-slate-700 bg-slate-800' : 'border-slate-300 bg-slate-50'
                  }`}
                />
              </div>

              <div>
                <label className="mb-1 block font-medium">Ancho de Columnas</label>
                <select
                  value={newBlockColSpan}
                  onChange={(e) => setNewBlockColSpan((Number(e.target.value) === 2 ? 2 : 1))}
                  className={`w-full rounded-lg border px-3 py-2 ${
                    darkMode ? 'border-slate-700 bg-slate-800' : 'border-slate-300 bg-slate-50'
                  }`}
                >
                  <option value={1}>1 Columna</option>
                  <option value={2}>2 Columnas (Ancho completo)</option>
                </select>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsAddBlockOpen(false)}
                  className="rounded-lg border px-4 py-2 font-medium opacity-75 hover:opacity-100"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="rounded-lg bg-indigo-600 px-4 py-2 font-semibold text-white hover:bg-indigo-700"
                >
                  Añadir Bloque
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {isSwitchOperatorOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div
            className={`w-full max-w-md rounded-2xl border p-5 shadow-xl ${
              darkMode ? 'border-slate-800 bg-slate-900 text-slate-100' : 'border-slate-200 bg-white text-slate-900'
            }`}
          >
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-base font-bold">Cambiar Operador</h3>
              <button type="button" onClick={() => setIsSwitchOperatorOpen(false)}>
                <X className="h-4 w-4" />
              </button>
            </div>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleVerifyPin(selectedOperatorId, () => setIsSwitchOperatorOpen(false));
              }}
              className="space-y-3 text-xs"
            >
              <div>
                <label className="mb-1 block font-medium">Seleccionar Operador</label>
                <select
                  value={selectedOperatorId}
                  onChange={(e) => {
                    setSelectedOperatorId(e.target.value);
                    setPinError('');
                  }}
                  className={`w-full rounded-lg border px-3 py-2 ${
                    darkMode ? 'border-slate-700 bg-slate-800' : 'border-slate-300 bg-slate-50'
                  }`}
                >
                  {operators.map((op) => (
                    <option key={op.id} value={op.id}>
                      {op.name} ({OPERATOR_ROLE_LABELS[op.role]})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-1 block font-medium">PIN de Acceso</label>
                <input
                  ref={startupPinInputRef}
                  type="password"
                  value={pinInput}
                  onChange={(e) => setPinInput(e.target.value)}
                  placeholder="Ingresa PIN"
                  className={`w-full rounded-lg border px-3 py-2 ${
                    darkMode ? 'border-slate-700 bg-slate-800' : 'border-slate-300 bg-slate-50'
                  }`}
                />
                {pinError && <p className="mt-1 text-rose-500">{pinError}</p>}
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsSwitchOperatorOpen(false)}
                  className="rounded-lg border px-4 py-2 font-medium opacity-75 hover:opacity-100"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="rounded-lg bg-indigo-600 px-4 py-2 font-semibold text-white hover:bg-indigo-700"
                >
                  Cambiar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {isStartupLoginOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4">
          <div
            className={`w-full max-w-sm rounded-2xl border p-5 shadow-2xl ${
              darkMode ? 'border-slate-800 bg-slate-900 text-slate-100' : 'border-slate-200 bg-white text-slate-900'
            }`}
          >
            <h3 className="mb-1 text-base font-bold">Desbloquear Genesis</h3>
            <p className="mb-4 text-xs opacity-70">Ingresa el PIN del operador para continuar.</p>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleVerifyPin(selectedOperatorId, () => setIsStartupLoginOpen(false));
              }}
              className="space-y-3 text-xs"
            >
              <select
                value={selectedOperatorId}
                onChange={(e) => {
                  setSelectedOperatorId(e.target.value);
                  setPinError('');
                }}
                className={`w-full rounded-lg border px-3 py-2 ${
                  darkMode ? 'border-slate-700 bg-slate-800' : 'border-slate-300 bg-slate-50'
                }`}
              >
                {operators.map((op) => (
                  <option key={op.id} value={op.id}>
                    {op.name} ({OPERATOR_ROLE_LABELS[op.role]})
                  </option>
                ))}
              </select>

              <input
                ref={startupPinInputRef}
                type="password"
                value={pinInput}
                onChange={(e) => setPinInput(e.target.value)}
                placeholder="PIN"
                className={`w-full rounded-lg border px-3 py-2 ${
                  darkMode ? 'border-slate-700 bg-slate-800' : 'border-slate-300 bg-slate-50'
                }`}
              />
              {pinError && <p className="text-rose-500">{pinError}</p>}

              <button
                type="submit"
                className="w-full rounded-lg bg-indigo-600 py-2 font-semibold text-white hover:bg-indigo-700"
              >
                Ingresar
              </button>
            </form>
          </div>
        </div>
      )}

      {isCopilotOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div
            className={`w-full max-w-lg rounded-2xl border p-5 shadow-xl ${
              darkMode ? 'border-slate-800 bg-slate-900 text-slate-100' : 'border-slate-200 bg-white text-slate-900'
            }`}
          >
            <div className="mb-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-amber-500" />
                <h3 className="text-base font-bold">Genesis Copilot</h3>
              </div>
              <button type="button" onClick={() => setIsCopilotOpen(false)}>
                <X className="h-4 w-4" />
              </button>
            </div>

            <div
              className={`mb-3 rounded-xl border p-3.5 text-xs leading-relaxed ${
                darkMode ? 'border-slate-800 bg-slate-950/60' : 'border-slate-200 bg-slate-50'
              }`}
            >
              {copilotReply}
            </div>

            <form onSubmit={handleCopilotSubmit} className="flex gap-2 text-xs">
              <input
                type="text"
                value={copilotPrompt}
                onChange={(e) => setCopilotPrompt(e.target.value)}
                placeholder="Pregunta sobre caja, stock bajo, tasas o cuentas..."
                className={`flex-1 rounded-lg border px-3 py-2 outline-none ${
                  darkMode ? 'border-slate-700 bg-slate-800' : 'border-slate-300 bg-slate-50'
                }`}
              />
              <button
                type="submit"
                className="rounded-lg bg-indigo-600 px-4 py-2 font-semibold text-white hover:bg-indigo-700"
              >
                Consultar
              </button>
            </form>
          </div>
        </div>
      )}

      {isMasterRestoreModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div
            className={`w-full max-w-lg rounded-2xl border p-5 shadow-xl ${
              darkMode ? 'border-slate-800 bg-slate-900 text-slate-100' : 'border-slate-200 bg-white text-slate-900'
            }`}
          >
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-base font-bold">Restaurar Respaldo JSON</h3>
              <button type="button" onClick={() => setIsMasterRestoreModalOpen(false)}>
                <X className="h-4 w-4" />
              </button>
            </div>
            <form onSubmit={handleMasterRestoreSubmit} className="space-y-3 text-xs">
              <textarea
                rows={8}
                value={masterRestoreInput}
                onChange={(e) => setMasterRestoreInput(e.target.value)}
                placeholder="Pega aquí el contenido JSON de respaldo..."
                className={`w-full rounded-lg border p-3 font-mono outline-none ${
                  darkMode ? 'border-slate-700 bg-slate-800' : 'border-slate-300 bg-slate-50'
                }`}
              />
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsMasterRestoreModalOpen(false)}
                  className="rounded-lg border px-4 py-2 font-medium opacity-75 hover:opacity-100"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="rounded-lg bg-amber-600 px-4 py-2 font-semibold text-white hover:bg-amber-700"
                >
                  Aplicar Respaldo
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <GenesisCloudSyncLayer
        state={state}
        setState={setState}
        localStorageKey={STORAGE_KEY}
      />
    </div>
  );
}
