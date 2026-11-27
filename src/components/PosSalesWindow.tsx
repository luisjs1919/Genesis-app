'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Plus, Minus, Trash2, Barcode, CheckCircle2, Receipt, X, Search,
  Moon, Sun, ExternalLink, ArrowLeft, Sparkles, Layers, ShieldCheck
} from 'lucide-react';
import {
  GenesisState,
  ProductItem,
  SaleInvoiceItem,
  SaleRecord,
  Transaction,
  PaymentAccountCategory,
  CashKindOption,
} from '../types/genesis';
import AdminAuthModal from './AdminAuthModal';

const STORAGE_KEY = 'genesis_app_v13_state';

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

function getProductUnitInfo(
  product?: Partial<ProductItem> & {
    unit?: string;
    unitOfMeasure?: string;
    measurementUnit?: string;
    unidad?: string;
    unidadMedida?: string;
    weightOrQty?: number;
    unitWeight?: number;
  },
  invoiceItem?: Partial<SaleInvoiceItem> & {
    unit?: string;
    unitOfMeasure?: string;
    measurementUnit?: string;
    unidad?: string;
    unidadMedida?: string;
  }
): { shortLabel: string; fullLabel: string } {
  const raw = String(
    invoiceItem?.unit ||
      invoiceItem?.unitOfMeasure ||
      invoiceItem?.measurementUnit ||
      invoiceItem?.unidad ||
      invoiceItem?.unidadMedida ||
      product?.unit ||
      product?.unitOfMeasure ||
      product?.measurementUnit ||
      product?.unidad ||
      product?.unidadMedida ||
      ''
  )
    .trim()
    .toLowerCase();

  if (!raw || raw === 'unidad' || raw === 'unidades' || raw === 'ud' || raw === 'uds' || raw === 'unit') {
    return { shortLabel: 'ud', fullLabel: 'Unidad' };
  }
  if (raw.includes('litro') || raw === 'l' || raw === 'lt' || raw === 'lts') {
    return { shortLabel: 'L', fullLabel: 'Litros (L)' };
  }
  if (raw.includes('kilo') || raw.includes('peso') || raw === 'kg' || raw === 'kgs') {
    return { shortLabel: 'kg', fullLabel: 'Peso (kg)' };
  }
  if (raw.includes('gramo') || raw === 'g' || raw === 'gr' || raw === 'grs') {
    return { shortLabel: 'g', fullLabel: 'Gramos (g)' };
  }
  if (raw.includes('mililitro') || raw === 'ml') {
    return { shortLabel: 'ml', fullLabel: 'Mililitros (ml)' };
  }
  if (raw.includes('metro') || raw === 'm' || raw === 'mt' || raw === 'mts') {
    return { shortLabel: 'm', fullLabel: 'Metros (m)' };
  }
  return {
    shortLabel: raw.slice(0, 6),
    fullLabel:
      invoiceItem?.unit ||
      invoiceItem?.unitOfMeasure ||
      product?.unit ||
      product?.unitOfMeasure ||
      raw,
  };
}

function getEffectiveUnitTotal(unitPrice: number, hasIva?: boolean): number {
  return hasIva ? unitPrice * (1 + IVA_RATE) : unitPrice;
}

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

interface OperatorAccountItem {
  id: string;
  operatorName: string;
  role: string;
  assignedAccount?: string;
  active?: boolean;
  permissions?: string[];
  pin?: string;
}

const FALLBACK_POS_STATE: GenesisState = {
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
  rules: [],
  pages: [
    {
      id: 'page-1',
      title: 'Resumen General',
      blocks: [],
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
  operatorAccounts: [
    {
      id: 'op-1',
      operatorName: 'administrador',
      role: 'Administrador',
      assignedAccount: 'Cuenta Principal',
      active: true,
      permissions: ['dashboard', 'ventas', 'productos', 'proveedores', 'clientes_afiliados', 'cierre_de_caja', 'cuentas_de_operadores', 'monedas', 'tasa_de_cambio', 'tipo_de_pago', 'factura', 'gastos_generales'],
      pin: 'admin1',
    },
    {
      id: 'op-gerente',
      operatorName: 'Gerente de Tienda',
      role: 'Gerente',
      assignedAccount: 'Cuenta Principal',
      active: true,
      permissions: ['dashboard', 'ventas', 'productos', 'proveedores', 'clientes_afiliados', 'cierre_de_caja', 'monedas', 'tasa_de_cambio', 'tipo_de_pago', 'factura'],
      pin: '',
    },
    {
      id: 'op-ventas',
      operatorName: 'Operador de Ventas',
      role: 'Operador',
      assignedAccount: 'Efectivo',
      active: true,
      permissions: ['ventas'],
      pin: '',
    },
  ],
  currentOperatorId: 'op-1',
  adminDiscountPin: '',
  paymentMethods: [
    { id: 'pm-1', name: 'Efectivo', channel: 'Caja', feePercent: 0, active: true, accountCategory: 'Efectivo' },
    { id: 'pm-2', name: 'Transferencia / Pago Móvil', channel: 'Banca', feePercent: 0, active: true, accountCategory: 'Cuenta Principal' },
    { id: 'pm-3', name: 'Punto de Venta / Débito', channel: 'POS', feePercent: 0, active: true, accountCategory: 'Cuenta Principal' },
    { id: 'pm-cashea', name: 'Cashea', channel: 'Cuotas / Financiamiento', feePercent: 0, active: true, accountCategory: 'Billetera Digital' },
  ],
  currencies: [
    { id: 'cur-usd', code: 'USD', name: 'Dólar Estadounidense', symbol: '$', rateToUsd: 1, isBase: true },
    { id: 'cur-ves', code: 'VES', name: 'Bolívar Digital', symbol: 'Bs.', rateToUsd: 45 },
    { id: 'cur-cop', code: 'COP', name: 'Peso Colombiano', symbol: 'COP$', rateToUsd: 4200 },
  ],
  affiliatedCustomers: [],
  invoiceTemplate: {
    businessName: 'Génesis Comercial',
    taxId: 'J-00000000-0',
    phone: '',
    email: '',
    address: 'Sede Principal',
    headerNote: '',
    footerNote: 'Gracias por su compra',
    showTaxId: true,
    showAddress: true,
    showContact: true,
    showExtraFooterOnCarta: false,
    paperWidth: '80mm',
  },
};

export interface PosSalesWindowProps {
  isStandaloneWindow?: boolean;
  onCloseModal?: () => void;
  state?: GenesisState | null;
  setState?: React.Dispatch<React.SetStateAction<GenesisState | null>> | React.Dispatch<any>;
  cart?: SaleInvoiceItem[];
  setCart?: React.Dispatch<React.SetStateAction<SaleInvoiceItem[]>>;
  onAddProduct?: (product: ProductItem, qty?: number) => void;
  searchInputRef?: React.RefObject<HTMLInputElement | null> | React.RefObject<any>;
  activeRate?: unknown;
  darkMode?: boolean;
  onAudit?: (action: string, detail: string) => void;
}

export default function PosSalesWindow({
  isStandaloneWindow = false,
  onCloseModal,
  state: externalState,
  setState: externalSetState,
  cart: externalCart,
  setCart: externalSetCart,
  onAddProduct: externalOnAddProduct,
  searchInputRef: externalSearchInputRef,
  darkMode: externalDarkMode,
  onAudit,
}: PosSalesWindowProps) {
  const [state, setState] = useState<GenesisState | null>(null);
  const [posScanInput, setPosScanInput] = useState('');
  const [posScanFeedback, setPosScanFeedback] = useState<string | null>(null);
  const [posLowStockAlert, setPosLowStockAlert] = useState<boolean>(false);
  const [posNextMultiplier, setPosNextMultiplier] = useState<number>(1);
  const [editingQtyProductId, setEditingQtyProductId] = useState<string | null>(null);
  const [editingQtyDraft, setEditingQtyDraft] = useState<string>('');
  const [selectedPosCategory, setSelectedPosCategory] = useState<string>('Todas');
  const [internalInvoiceItems, setInternalInvoiceItems] = useState<SaleInvoiceItem[]>([]);
  const invoiceItems = externalCart !== undefined ? externalCart : internalInvoiceItems;
  const setInvoiceItems = externalSetCart !== undefined ? externalSetCart : setInternalInvoiceItems;
  const [, setInvoiceNote] = useState('Cliente General');
  const [customInvoiceMode, setCustomInvoiceMode] = useState(false);
  const [custFullName, setCustFullName] = useState('');
  const [custTaxOrId, setCustTaxOrId] = useState('');
  const [custAddress, setCustAddress] = useState('');
  const [custPhone, setCustPhone] = useState('');
  const [matchedCustomerId, setMatchedCustomerId] = useState<string | null>(null);
  const [affiliateDropdownOpen, setAffiliateDropdownOpen] = useState(false);
  const [affiliateSearchQuery, setAffiliateSearchQuery] = useState('');
  const [invoicePaymentType, setInvoicePaymentType] = useState('Efectivo');
  const [invoiceCurrency, setInvoiceCurrency] = useState('USD');
  const [invoiceAccountId, setInvoiceAccountId] = useState('acc-1');
  const [invoiceCashType, setInvoiceCashType] = useState<CashKindOption>('Efectivo Divisa');
  const [casheaInitialPct, setCasheaInitialPct] = useState<number>(40);
  const [casheaInstallments, setCasheaInstallments] = useState<1 | 2 | 3>(3);
  const [lastSaleBanner, setLastSaleBanner] = useState<string | null>(null);
  const [discountPercentDraft, setDiscountPercentDraft] = useState<string>('');
  const [discountAuthPinInput, setDiscountAuthPinInput] = useState<string>('');
  const [appliedDiscountPct, setAppliedDiscountPct] = useState<number>(0);
  const [discountError, setDiscountError] = useState<string | null>(null);
  const [discountSuccessMsg, setDiscountSuccessMsg] = useState<string | null>(null);

  // Estado de Crédito / Fiado con autorización obligatoria mediante Clave de Administrador
  const [isCreditSale, setIsCreditSale] = useState<boolean>(false);
  const [creditAuthorized, setCreditAuthorized] = useState<boolean>(false);
  const [creditAuthModalOpen, setCreditAuthModalOpen] = useState<boolean>(false);
  const [creditInitialPaidDraft, setCreditInitialPaidDraft] = useState<string>('0');
  const [creditAuthNotice, setCreditAuthNotice] = useState<string | null>(null);
  const [creditAdminPinInput, setCreditAdminPinInput] = useState<string>('');
  const [creditInlineError, setCreditInlineError] = useState<string | null>(null);
  const [pendingSwitchOp, setPendingSwitchOp] = useState<OperatorAccountItem | null>(null);
  const [standaloneUnlocked, setStandaloneUnlocked] = useState<boolean>(false);
  const [standaloneOpId, setStandaloneOpId] = useState<string>('');
  const [standalonePinInput, setStandalonePinInput] = useState<string>('');
  const [standaloneLoginError, setStandaloneLoginError] = useState<string | null>(null);
  const [switchOpPinInput, setSwitchOpPinInput] = useState<string>('');
  const [switchOpError, setSwitchOpError] = useState<string | null>(null);

  const [paymentModalOpen, setPaymentModalOpen] = useState<boolean>(false);
  const [tenderedAmountDraft, setTenderedAmountDraft] = useState<string>('');
  const [tenderedCurrencyMode, setTenderedCurrencyMode] = useState<'USD' | 'ACTIVE'>('USD');
  const [paymentModalError, setPaymentModalError] = useState<string | null>(null);
  const [bypassPaymentModalOnce, setBypassPaymentModalOnce] = useState<boolean>(false);

  const [returnSaleId, setReturnSaleId] = useState<string>('');
  const [returnAdminPin, setReturnAdminPin] = useState<string>('');
  const [returnNotice, setReturnNotice] = useState<string | null>(null);
  const [returnError, setReturnError] = useState<string | null>(null);

  const localPosInputRef = useRef<HTMLInputElement | null>(null);
  const posInputRef = externalSearchInputRef || localPosInputRef;
  const invoiceFormRef = useRef<HTMLFormElement | null>(null);

  const loadFromStorage = () => {
    try {
      const raw = localStorage.getItem('genesis_app_v13_state') || localStorage.getItem('genesis_app_v12_state');
      const parsed = raw ? JSON.parse(raw) : { ...FALLBACK_POS_STATE };
      if (Array.isArray(parsed.currencies) && !parsed.currencies.some((c: { code?: string }) => c?.code === 'COP')) {
        parsed.currencies = [
          ...parsed.currencies,
          { id: 'cur-cop', code: 'COP', name: 'Peso Colombiano', symbol: 'COP$', rateToUsd: 4200 },
        ];
      }
      if (Array.isArray(parsed.paymentMethods) && !parsed.paymentMethods.some((p: { name?: string }) => /cashea/i.test(String(p?.name || '')))) {
        parsed.paymentMethods = [
          ...parsed.paymentMethods,
          {
            id: 'pm-cashea',
            name: 'Cashea',
            channel: 'Cuotas / Financiamiento',
            feePercent: 0,
            active: true,
            accountCategory: 'Billetera Digital',
          },
        ];
      }
      if (Array.isArray(parsed.operatorAccounts) && parsed.operatorAccounts.length > 0) {
        setStandaloneOpId((cur) => {
          const validCur = parsed.operatorAccounts.some((o: { id?: string }) => o.id === cur);
          if (validCur) return cur;
          const validParsedCur = parsed.operatorAccounts.some((o: { id?: string }) => o.id === parsed.currentOperatorId);
          return validParsedCur ? parsed.currentOperatorId : parsed.operatorAccounts[0].id;
        });
      }
      setState((prev) => {
        if (!prev) {
          const activePm = (parsed.paymentMethods || []).find((p: { active: boolean }) => p.active);
          if (activePm) setInvoicePaymentType(activePm.name);
          if (parsed.accounts?.[0]?.id) setInvoiceAccountId(parsed.accounts[0].id);
          return parsed;
        }
        try {
          if (JSON.stringify(prev) === JSON.stringify(parsed)) {
            return prev;
          }
        } catch {}
        return parsed;
      });
    } catch (e) {
      console.error('Error leyendo estado de ventas:', e);
    }
  };

  useEffect(() => {
    loadFromStorage();
    const onStorage = (e: StorageEvent) => {
      if (!e.key || e.key === 'genesis_app_v13_state' || e.key === 'genesis_app_v12_state') {
        loadFromStorage();
      }
    };
    const onFocusOrVisible = () => {
      if (document.visibilityState === 'visible') {
        loadFromStorage();
      }
    };
    const syncTimer = window.setInterval(() => {
      loadFromStorage();
    }, 900);
    window.addEventListener('storage', onStorage);
    window.addEventListener('focus', onFocusOrVisible);
    document.addEventListener('visibilitychange', onFocusOrVisible);
    return () => {
      window.clearInterval(syncTimer);
      window.removeEventListener('storage', onStorage);
      window.removeEventListener('focus', onFocusOrVisible);
      document.removeEventListener('visibilitychange', onFocusOrVisible);
    };
  }, []);

  useEffect(() => {
    if (pendingSwitchOp || creditAuthModalOpen || isCreditSale || !standaloneUnlocked) return;
    const activeEl = document.activeElement as HTMLElement | null;
    if (activeEl && activeEl !== posInputRef.current && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'SELECT' || activeEl.tagName === 'TEXTAREA')) {
      return;
    }
    const timer = setTimeout(() => {
      if (!pendingSwitchOp && !creditAuthModalOpen) {
        posInputRef.current?.focus();
      }
    }, 80);
    return () => clearTimeout(timer);
  }, [state, pendingSwitchOp, creditAuthModalOpen, isCreditSale, standaloneUnlocked]);

  const persistState = (next: GenesisState) => {
    setState(next);
    if (externalSetState) {
      try {
        externalSetState(next);
      } catch {}
    }
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      window.dispatchEvent(new StorageEvent('storage', { key: STORAGE_KEY }));
    } catch (e) {
      console.error('Error guardando estado de ventas:', e);
    }
  };

  const authorizedAdminPins = useMemo(() => {
    if (!state) return [];
    const pins: string[] = [];
    const rawDiscountPin = state.adminDiscountPin ? String(state.adminDiscountPin).trim() : '';
    if (rawDiscountPin) {
      pins.push(rawDiscountPin);
    }
    (state.operatorAccounts || []).forEach((op) => {
      const opPin = op.pin ? String(op.pin).trim() : '';
      if ((String(op.role) === 'Administrador' || String(op.role) === 'Admin') && opPin) {
        pins.push(opPin);
      }
    });
    return Array.from(new Set(pins));
  }, [state]);

  const validateAdminSecret = (pin: string): boolean => {
    const clean = pin.trim();
    if (!clean) return false;
    const defaultAdmin =
      (typeof process !== 'undefined' && process.env?.NEXT_PUBLIC_GENESIS_ADMIN_PASS) || 'admin1';
    const allowed = [defaultAdmin.trim(), ...authorizedAdminPins].filter(Boolean);
    return allowed.includes(clean);
  };

  const activeRateCurrency = useMemo(() => {
    if (!state) return null;
    const currencyList = Array.isArray(state.currencies) ? state.currencies : [];
    if (currencyList.length === 0) return null;
    return (
      currencyList.find((c) => c.code === state.activeRateCurrencyCode) ||
      currencyList.find((c) => !c.isBase) ||
      currencyList[0]
    );
  }, [state]);

  const activeRateValue = activeRateCurrency?.rateToUsd ?? 1;
  const activeRateSymbol = activeRateCurrency?.symbol ?? '';
  const [billingMode, setBillingMode] = useState<'unidad' | 'medida'>('unidad');
  const [itemMeasureValues, setItemMeasureValues] = useState<Record<string, number>>({});

  const selectedCurrencyObj = useMemo(() => {
    const fallbackUsd = { id: 'cur-usd', code: 'USD', name: 'Dólar Estadounidense', symbol: '$', rateToUsd: 1, isBase: true };
    if (!state) return fallbackUsd;
    const currencyList = Array.isArray(state.currencies) ? state.currencies : [];
    if (invoiceCurrency === 'COP') {
      return (
        currencyList.find((c) => c.code === 'COP') || {
          id: 'cur-cop',
          code: 'COP',
          name: 'Peso Colombiano',
          symbol: 'COP$',
          rateToUsd: 4200,
          isBase: false,
        }
      );
    }
    return (
      currencyList.find((c) => c.code === invoiceCurrency) ||
      currencyList.find((c) => c.code === 'USD') ||
      currencyList[0] ||
      fallbackUsd
    );
  }, [state, invoiceCurrency]);

  const posCategories = useMemo(() => {
    if (!state) return ['Todas'];
    const baseCats = ['Químicos', 'Detalle', 'Mantenimiento', 'General'];
    const fromProducts = state.products.map((p) => p.category).filter(Boolean);
    return ['Todas', ...Array.from(new Set([...baseCats, ...fromProducts]))];
  }, [state]);

  const filteredPosProducts = useMemo(() => {
    if (!state) return [];
    const term = posScanInput.trim().toLowerCase();
    return state.products.filter((prod) => {
      const matchesCat = selectedPosCategory === 'Todas' || prod.category === selectedPosCategory;
      const matchesTerm =
        !term ||
        prod.name.toLowerCase().includes(term) ||
        (prod.barcode || '').toLowerCase().includes(term) ||
        (prod.sku || '').toLowerCase().includes(term);
      return matchesCat && matchesTerm;
    });
  }, [state, selectedPosCategory, posScanInput]);

  const getItemBillingFactor = (item: SaleInvoiceItem) => {
    if (billingMode === 'medida') {
      const pid = item.productId || '';
      const m = pid ? itemMeasureValues[pid] : undefined;
      return typeof m === 'number' && !isNaN(m) && m > 0 ? m : Math.max(0.01, Number(item.quantity) || 1);
    }
    return Math.max(0, Number(item.quantity) || 0);
  };

  const invoiceBaseTotal = useMemo(() => {
    return invoiceItems.reduce((sum, item) => sum + item.unitPrice * getItemBillingFactor(item), 0);
  }, [invoiceItems, billingMode, itemMeasureValues]);

  const invoiceIvaTotal = useMemo(() => {
    return invoiceItems.reduce(
      (sum, item) => sum + (item.hasIva ? item.unitPrice * getItemBillingFactor(item) * IVA_RATE : 0),
      0
    );
  }, [invoiceItems, billingMode, itemMeasureValues]);

  const invoiceSubtotal = useMemo(() => {
    return invoiceBaseTotal + invoiceIvaTotal;
  }, [invoiceBaseTotal, invoiceIvaTotal]);

  const invoiceDiscountAmount = useMemo(() => {
    if (appliedDiscountPct <= 0 || invoiceSubtotal <= 0) return 0;
    return Number(((invoiceSubtotal * appliedDiscountPct) / 100).toFixed(2));
  }, [appliedDiscountPct, invoiceSubtotal]);

  const invoiceAfterDiscountTotal = useMemo(() => {
    return Math.max(0, Number((invoiceSubtotal - invoiceDiscountAmount).toFixed(2)));
  }, [invoiceSubtotal, invoiceDiscountAmount]);

  const activePaymentMethodObj = useMemo(() => {
    return (state?.paymentMethods || []).find((pm) => pm.name === invoicePaymentType);
  }, [state?.paymentMethods, invoicePaymentType]);

  const isCasheaPaymentActive = /cashea/i.test(invoicePaymentType);

  const casheaFeePct = useMemo(() => {
    if (!isCasheaPaymentActive) return 0;
    const rawFee = Number(activePaymentMethodObj?.feePercent ?? 0);
    return isNaN(rawFee) || rawFee < 0 ? 0 : rawFee;
  }, [isCasheaPaymentActive, activePaymentMethodObj]);

  const casheaFeeAmount = useMemo(() => {
    if (!isCasheaPaymentActive || casheaFeePct <= 0 || invoiceAfterDiscountTotal <= 0) return 0;
    return Number(((invoiceAfterDiscountTotal * casheaFeePct) / 100).toFixed(2));
  }, [isCasheaPaymentActive, casheaFeePct, invoiceAfterDiscountTotal]);

  const invoiceFinalTotal = useMemo(() => {
    return Math.max(0, Number((invoiceAfterDiscountTotal + casheaFeeAmount).toFixed(2)));
  }, [invoiceAfterDiscountTotal, casheaFeeAmount]);

  const handleEmitCreditNoteReturn = () => {
    if (!state) return;
    setReturnNotice(null);
    setReturnError(null);
    if (!validateAdminSecret(returnAdminPin)) {
      setReturnError('Clave de administrador inválida. Se requiere clave admin para devolver factura y emitir nota de crédito.');
      return;
    }
    const salesList = Array.isArray(state.sales) ? state.sales : [];
    const targetSale = salesList.find((s) => s.id === returnSaleId) || salesList[0];
    if (!targetSale) {
      setReturnError('No hay facturas registradas disponibles para devolver.');
      return;
    }
    const returnRef = `NC-${Date.now().toString().slice(-6)}`;
    const todayStr = new Date().toISOString().slice(0, 10);
    const refundAmt = Math.abs(Number(targetSale.total || 0));

    const productsList = Array.isArray(state.products) ? state.products : [];
    const updatedProducts = productsList.map((prod) => {
      const matchedItems = (targetSale.items || []).filter((it) => it.productId === prod.id);
      if (matchedItems.length === 0) return prod;
      const restoredQty = matchedItems.reduce((sum, it) => sum + Math.max(0, Number(it.quantity || 0)), 0);
      return { ...prod, stock: prod.stock + restoredQty };
    });

    const txList = Array.isArray(state.transactions) ? state.transactions : [];
    const creditNoteTx: Transaction = {
      id: `tx-nc-${Date.now()}`,
      date: todayStr,
      merchant: `Nota de Crédito ${returnRef} (Dev. Factura ${targetSale.reference || targetSale.id} — ${targetSale.customerOrNote || 'Cliente General'})`,
      amount: -refundAmt,
      categoryId: 'cat-refund',
      accountId: state.accounts?.[0]?.id || 'acc-1',
    };

    const nextState: GenesisState = {
      ...state,
      products: updatedProducts,
      transactions: [creditNoteTx, ...txList],
      auditLog: [
        ...(state.auditLog || []),
        {
          id: `aud-nc-${Date.now()}`,
          correlative: `AUD-${Date.now().toString().slice(-6)}`,
          timestamp: new Date().toISOString(),
          dateOnly: todayStr,
          operatorName:
            (state.operatorAccounts || []).find((op) => op.id === state.currentOperatorId)?.operatorName ||
            'Administrador',
          operatorRole:
            (state.operatorAccounts || []).find((op) => op.id === state.currentOperatorId)?.role ||
            'Administrador',
          module: 'Factura / Notas de Crédito',
          actionType: 'Devolución y Nota de Crédito',
          reference: returnRef,
          summary: `Emitida ${returnRef} por $${refundAmt.toFixed(2)} sobre factura ${targetSale.reference || targetSale.id} con clave admin.`,
          immutable: true,
        },
      ],
    };

    persistState(nextState);
    setReturnAdminPin('');
    setReturnNotice(`Nota de crédito ${returnRef} emitida por $${refundAmt.toFixed(2)} (stock restaurado y asentado en contabilidad).`);
  };

  const handleToggleCreditSale = (checked: boolean) => {
    setCreditAuthNotice(null);
    setCreditInlineError(null);
    if (!checked) {
      setIsCreditSale(false);
      setCreditAuthorized(false);
      setCreditAdminPinInput('');
      setCreditInitialPaidDraft('0');
      return;
    }
    setCreditAuthorized(false);
    setCreditAuthModalOpen(true);
  };

  const handleVerifyInlineCreditPin = () => {
    if (validateAdminSecret(creditAdminPinInput)) {
      setCreditAuthorized(true);
      setIsCreditSale(true);
      setCreditInlineError(null);
      setCreditAuthNotice('Clave de administrador validada: crédito habilitado.');
    } else {
      setCreditAuthorized(false);
      setCreditInlineError('Clave de administrador incorrecta. Debes ingresar una clave válida para dar crédito.');
    }
  };

  const handleApplyInvoiceDiscount = (e: React.FormEvent) => {
    e.preventDefault();
    setDiscountError(null);
    setDiscountSuccessMsg(null);
    if (!state) return;
    const pct = parseFloat(discountPercentDraft);
    if (isNaN(pct) || pct <= 0 || pct > 100) {
      setDiscountError('Ingresa un porcentaje válido mayor a 0 y hasta 100%.');
      return;
    }
    if (!validateAdminSecret(discountAuthPinInput)) {
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

  const addProductToInvoice = (product: ProductItem, overrideQty?: number) => {
    const qtyToAdd = Math.max(1, overrideQty ?? posNextMultiplier);
    const isLowStock = product.stock < 5;
    let resultingQty = qtyToAdd;

    setInvoiceItems((prev) => {
      const existingIdx = prev.findIndex((i) => i.productId === product.id);
      if (existingIdx >= 0) {
        const updated = [...prev];
        resultingQty = updated[existingIdx].quantity + qtyToAdd;
        updated[existingIdx] = { ...updated[existingIdx], quantity: resultingQty };
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

    if (externalOnAddProduct) {
      try {
        externalOnAddProduct(product, qtyToAdd);
      } catch {}
    }
    if (onAudit) {
      try {
        onAudit('POS_ADD_ITEM', `Agregado x${qtyToAdd}: ${product.name}`);
      } catch {}
    }
    setPosLowStockAlert(isLowStock);
    setPosScanFeedback(
      isLowStock
        ? `Agregado x${qtyToAdd}: ${product.name} (Total x${resultingQty}) — Stock bajo: ${product.stock} uds.`
        : `Agregado x${qtyToAdd}: ${product.name} (Total x${resultingQty})`
    );
    setLastSaleBanner(null);
  };

  const handleScanOrSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!state) return;
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
    const exactBarcode = state.products.find((p) => (p.barcode || '').toLowerCase() === lower);
    if (exactBarcode) {
      addProductToInvoice(exactBarcode, parsedQty);
      setPosScanInput('');
      posInputRef.current?.focus();
      return;
    }

    const exactSku = state.products.find((p) => (p.sku || '').toLowerCase() === lower);
    if (exactSku) {
      addProductToInvoice(exactSku, parsedQty);
      setPosScanInput('');
      posInputRef.current?.focus();
      return;
    }

    const matches = state.products.filter(
      (p) =>
        p.name.toLowerCase().includes(lower) ||
        (p.barcode || '').toLowerCase().includes(lower) ||
        (p.sku || '').toLowerCase().includes(lower)
    );

    if (matches.length === 1) {
      addProductToInvoice(matches[0], parsedQty);
      setPosScanInput('');
      posInputRef.current?.focus();
    } else if (matches.length > 1) {
      setPosLowStockAlert(false);
      setPosScanFeedback(`Se encontraron ${matches.length} productos. Toca el deseado.`);
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

  const handleSetInvoiceItemQty = (productId: string, newQty: number) => {
    const cleanQty = Math.floor(newQty);
    if (isNaN(cleanQty) || cleanQty <= 0) {
      setInvoiceItems((prev) => prev.filter((item) => item.productId !== productId));
      setEditingQtyProductId(null);
      return;
    }
    setInvoiceItems((prev) =>
      prev.map((item) => (item.productId === productId ? { ...item, quantity: cleanQty } : item))
    );
    setEditingQtyProductId(null);
  };

  const handleRemoveInvoiceItem = (productId: string) => {
    setInvoiceItems((prev) => prev.filter((item) => item.productId !== productId));
  };

  const handleToggleInvoiceItemIva = (productId: string) => {
    setInvoiceItems((prev) =>
      prev.map((item) => (item.productId === productId ? { ...item, hasIva: !item.hasIva } : item))
    );
  };

  const affiliatedList = state?.affiliatedCustomers || [];

  const filteredAffiliates = useMemo(() => {
    const q = affiliateSearchQuery.trim().toLowerCase();
    if (!q) return affiliatedList;
    return affiliatedList.filter(
      (c) =>
        c.fullName.toLowerCase().includes(q) ||
        c.taxOrId.toLowerCase().includes(q) ||
        c.phone.toLowerCase().includes(q) ||
        c.address.toLowerCase().includes(q)
    );
  }, [affiliatedList, affiliateSearchQuery]);

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
    setAffiliateSearchQuery(`${cust.taxOrId ? cust.taxOrId + ' · ' : ''}${cust.fullName}`);
    setAffiliateDropdownOpen(false);
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
    const found = affiliatedList.find(
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

  const handleCompleteSale = (e: React.FormEvent) => {
    e.preventDefault();
    if (!state || invoiceItems.length === 0 || invoiceSubtotal <= 0) return;

    if (!isCreditSale && !bypassPaymentModalOnce) {
      const useSelectedNonUsd = invoiceCurrency !== 'USD' && (selectedCurrencyObj?.rateToUsd ?? 1) > 0;
      const useActive = Boolean(activeRateCurrency && !activeRateCurrency.isBase);
      const initialMode: 'USD' | 'ACTIVE' = useSelectedNonUsd || useActive ? 'ACTIVE' : 'USD';
      const rateForPrefill = useSelectedNonUsd
        ? Number(selectedCurrencyObj?.rateToUsd || 1)
        : useActive
        ? activeRateValue
        : 1;
      const initialAmt = initialMode === 'ACTIVE'
        ? Number((invoiceFinalTotal * rateForPrefill).toFixed(2))
        : Number(invoiceFinalTotal.toFixed(2));
      setTenderedCurrencyMode(initialMode);
      setTenderedAmountDraft(String(initialAmt));
      setPaymentModalError(null);
      setPaymentModalOpen(true);
      return;
    }
    if (bypassPaymentModalOnce) {
      setBypassPaymentModalOnce(false);
    }

    if (isCreditSale && !creditAuthorized) {
      if (validateAdminSecret(creditAdminPinInput)) {
        setCreditAuthorized(true);
      } else {
        setCreditAuthModalOpen(true);
        return;
      }
    }

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
    const isCasheaSelected = /cashea/i.test(invoicePaymentType);
    const finalChargeTotal = invoiceFinalTotal;
    const casheaInitVal = isCasheaSelected
      ? Math.min(finalChargeTotal, Number(((finalChargeTotal * casheaInitialPct) / 100).toFixed(2)))
      : 0;
    const effectivePaymentLabel = cashActive
      ? `${invoicePaymentType} (${invoiceCashType})`
      : isCasheaSelected
      ? `${invoicePaymentType} (${casheaFeePct}% recargo +$${casheaFeeAmount.toFixed(2)}) · Inicial ${casheaInitialPct}% ($${casheaInitVal.toFixed(2)}) · ${casheaInstallments} ${casheaInstallments === 1 ? 'cuota' : 'cuotas'}`
      : invoicePaymentType;

    const effectiveCreditMode = isCreditSale || isCasheaSelected;
    const parsedInitialPaid = isCasheaSelected
      ? casheaInitVal
      : isCreditSale
      ? Math.min(finalChargeTotal, Math.max(0, parseFloat(creditInitialPaidDraft) || 0))
      : finalChargeTotal;
    const pendingCreditBalance = effectiveCreditMode
      ? Math.max(0, Number((finalChargeTotal - parsedInitialPaid).toFixed(2)))
      : 0;
    const creditLabel = isCasheaSelected
      ? `Cuenta por Cobrar · ${effectivePaymentLabel} (Saldo $${pendingCreditBalance.toFixed(2)})`
      : isCreditSale
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
      isCredit: effectiveCreditMode,
      creditStatus: effectiveCreditMode ? (pendingCreditBalance > 0 ? 'Pendiente' : 'Pagado') : 'Pagado',
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
      merchant: effectiveCreditMode
        ? `Cuenta por Cobrar ${refNumber} — ${noteText} [${effectivePaymentLabel}] (Total $${finalChargeTotal.toFixed(2)}, Inicial/Abono $${parsedInitialPaid.toFixed(2)}, Por Cobrar $${pendingCreditBalance.toFixed(2)})`
        : `Venta ${refNumber} — ${noteText} [${effectivePaymentLabel}]${appliedDiscountPct > 0 ? ` (Desc. ${appliedDiscountPct}%)` : ''}`,
      amount: Math.abs(parsedInitialPaid),
      categoryId: 'cat-income',
      accountId: resolvedAccountId,
    };

    const nextState: GenesisState = {
      ...state,
      affiliatedCustomers: updatedAffiliates,
      sales: [newSale, ...state.sales],
      transactions: [newTx, ...state.transactions],
      products: state.products.map((prod) => {
        const soldItem = invoiceItems.find((i) => i.productId === prod.id);
        if (!soldItem) return prod;
        return { ...prod, stock: Math.max(0, prod.stock - soldItem.quantity) };
      }),
    };

    persistState(nextState);
    setInvoiceItems([]);
    setInvoiceNote('Cliente General');
    setCustomInvoiceMode(false);
    setCustFullName('');
    setCustTaxOrId('');
    setCustAddress('');
    setCustPhone('');
    setMatchedCustomerId(null);
    setAffiliateSearchQuery('');
    setAffiliateDropdownOpen(false);
    setPosScanFeedback(null);
    setPosLowStockAlert(false);
    setAppliedDiscountPct(0);
    setDiscountPercentDraft('');
    setDiscountAuthPinInput('');
    setDiscountError(null);
    setDiscountSuccessMsg(null);
    setIsCreditSale(false);
    setCreditAuthorized(false);
    setCreditAdminPinInput('');
    setCreditInlineError(null);
    setCreditInitialPaidDraft('0');
    setCreditAuthNotice(null);
    setLastSaleBanner(
      effectiveCreditMode
        ? `${isCasheaSelected ? 'Venta Cashea registrada en Cuenta por Cobrar' : 'Factura a crédito/fiado'} (${refNumber}) por $${finalChargeTotal.toFixed(2)} · Inicial/Abono: $${parsedInitialPaid.toFixed(2)} · Por cobrar: $${pendingCreditBalance.toFixed(2)} · Inventario descontado.`
        : (() => {
            const rawTendered = parseFloat(tenderedAmountDraft);
            const tenderedUsd =
              !isNaN(rawTendered) && rawTendered > 0
                ? tenderedCurrencyMode === 'ACTIVE' && activeRateCurrency && !activeRateCurrency.isBase && activeRateValue > 0
                  ? rawTendered / activeRateValue
                  : rawTendered
                : finalChargeTotal;
            const changeUsd = Math.max(0, Number((tenderedUsd - finalChargeTotal).toFixed(2)));
            const changeActive =
              activeRateCurrency && !activeRateCurrency.isBase
                ? ` (${activeRateSymbol} ${(changeUsd * activeRateValue).toFixed(2)})`
                : '';
            return `Cobro registrado (${refNumber}) por $${finalChargeTotal.toFixed(2)} · Pagado: $${tenderedUsd.toFixed(2)} · Vuelto: $${changeUsd.toFixed(2)}${changeActive}${
              appliedDiscountPct > 0 ? ` (Descuento ${appliedDiscountPct}%: -$${invoiceDiscountAmount.toFixed(2)})` : ''
            } · Inventario descontado.`;
          })()
    );
    posInputRef.current?.focus();
  };

  const handlePrintInvoice = (sale: SaleRecord, formatOverride?: '80mm' | 'carta') => {
    const tpl = state?.invoiceTemplate || {
      businessName: 'Génesis Comercial',
      taxId: 'J-00000000-0',
      phone: '',
      email: '',
      address: '',
      headerNote: 'Factura / Comprobante de Venta',
      footerNote: 'Gracias por su compra.',
      showTaxId: true,
      showAddress: true,
      showContact: true,
      paperWidth: '80mm' as const,
    };
    const activeFormat = formatOverride || tpl.paperWidth || '80mm';
    const isThermal = activeFormat === '80mm';

    const itemsRows = (sale.items && sale.items.length > 0
      ? sale.items
      : [
          {
            productId: 'custom',
            sku: '-',
            barcode: '-',
            name: sale.customerOrNote,
            unitPrice: sale.total,
            quantity: 1,
            hasIva: false,
          },
        ]
    )
      .map((it) => {
        const lineTot = getEffectiveUnitTotal(it.unitPrice, it.hasIva) * it.quantity;
        return `<tr>
          <td style="padding:${isThermal ? '4px 2px' : '3px 2px'};border-bottom:1px dashed #cbd5e1;">${it.name}<br><small style="color:#64748b;">${it.quantity} x $${it.unitPrice.toFixed(2)} ${it.hasIva ? '(IVA 16%)' : '(Exento)'}</small></td>
          <td style="padding:${isThermal ? '4px 2px' : '3px 2px'};border-bottom:1px dashed #cbd5e1;text-align:right;font-weight:700;">$${lineTot.toFixed(2)}</td>
        </tr>`;
      })
      .join('');

    const extraFooterHtml = (() => {
      if (isThermal || tpl.showExtraFooterOnCarta === false) return '';
      const parts: string[] = [];
      if (tpl.bankAccountInfo) parts.push(`<div><strong>Banco / Pago:</strong> ${tpl.bankAccountInfo}</div>`);
      if (tpl.socialMediaInfo) parts.push(`<div><strong>Redes / Contacto:</strong> ${tpl.socialMediaInfo}</div>`);
      if (tpl.paymentTermsInfo) parts.push(`<div><strong>Condiciones / Notas:</strong> ${tpl.paymentTermsInfo}</div>`);
      return parts.length > 0 ? `<div class="extra-footer">${parts.join('')}</div>` : '';
    })();

    const renderSlip = (copyLabel: string) => `
      <div class="slip ${isThermal ? 'slip-80mm' : 'slip-carta'}">
        <div class="slip-top">
          <span class="copy-tag">${copyLabel}</span>
          <span class="meta"><strong>Ref:</strong> ${sale.reference} &nbsp;|&nbsp; <strong>Fecha:</strong> ${sale.date}</span>
        </div>
        <div class="center">
          <p class="biz">${tpl.businessName}</p>
          ${tpl.showTaxId && tpl.taxId ? `<div class="meta">RIF / ID: ${tpl.taxId}</div>` : ''}
          ${tpl.showAddress && tpl.address ? `<div class="meta">${tpl.address}</div>` : ''}
          ${tpl.showContact && (tpl.phone || tpl.email) ? `<div class="meta">${[tpl.phone, tpl.email].filter(Boolean).join(' · ')}</div>` : ''}
        </div>
        ${tpl.headerNote ? `<div class="banner">${tpl.headerNote}</div>` : ''}
        <div class="meta"><strong>Cliente:</strong> ${sale.customerDetails?.fullName || sale.customerOrNote}</div>
        ${sale.customerDetails?.taxOrId ? `<div class="meta"><strong>Cédula / RIF:</strong> ${sale.customerDetails.taxOrId}</div>` : ''}
        <div class="meta"><strong>Pago:</strong> ${sale.paymentType} (${sale.currency})</div>
        <table>
          <thead>
            <tr>
              <th style="text-align:left;border-bottom:1px solid #94a3b8;padding-bottom:3px;">Descripción</th>
              <th style="text-align:right;border-bottom:1px solid #94a3b8;padding-bottom:3px;">Total</th>
            </tr>
          </thead>
          <tbody>${itemsRows}</tbody>
        </table>
        ${sale.discountPercent ? `<div class="meta"><strong>Descuento aplicado:</strong> ${sale.discountPercent}% (-$${(sale.discountAmount || 0).toFixed(2)})</div>` : ''}
        ${sale.isCredit ? `<div class="meta"><strong>Condición:</strong> CRÉDITO / FIADO · <strong>Abonado:</strong> $${(sale.amountPaid || 0).toFixed(2)} · <strong>Pendiente:</strong> $${(sale.balanceDue ?? sale.total).toFixed(2)}</div>` : ''}
        ${(() => {
          const calcItems = sale.items && sale.items.length > 0 ? sale.items : [];
          const subTot = calcItems.length > 0
            ? calcItems.reduce((s, it) => s + it.unitPrice * it.quantity, 0)
            : Number((sale.total / (1 + IVA_RATE)).toFixed(2));
          const ivaAmt = calcItems.length > 0
            ? calcItems.reduce((s, it) => s + (it.hasIva ? it.unitPrice * it.quantity * IVA_RATE : 0), 0)
            : Number(Math.max(0, sale.total - subTot).toFixed(2));
          return `<div class="breakdown">
            <div class="breakdown-row"><span>Sub Total</span><span>$${subTot.toFixed(2)}</span></div>
            <div class="breakdown-row"><span>IVA (16%)</span><span>$${ivaAmt.toFixed(2)}</span></div>
          </div>`;
        })()}
        <div class="total">
          <span>TOTAL</span>
          <span>$${sale.total.toFixed(2)}</span>
        </div>
        ${tpl.footerNote ? `<div class="footer">${tpl.footerNote}</div>` : ''}
        ${extraFooterHtml}
      </div>`;

    const bodyHtml = isThermal
      ? `<div class="ticket-80mm">${renderSlip('ORIGINAL — CLIENTE')}</div>`
      : `<div class="sheet-carta">
          ${renderSlip('ORIGINAL — CLIENTE')}
          <div class="cut-divider"><span>✂ COPIA PARA REGISTRO ✂</span></div>
          ${renderSlip('COPIA — REGISTRO')}
        </div>`;

    const printHtml = `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Factura ${sale.reference} (${activeFormat.toUpperCase()})</title>
  <style>
    @page {
      size: ${isThermal ? '80mm auto' : 'letter'};
      margin: ${isThermal ? '4mm' : '6mm 8mm'};
    }
    body { font-family: system-ui, -apple-system, sans-serif; margin: 0; padding: ${isThermal ? '14px' : '12px'}; color: #0f172a; background: #fff; }
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
    .breakdown { margin-top: 6px; padding-top: 5px; border-top: 1px dashed #cbd5e1; font-size: 10.5px; color: #334155; display: flex; flex-direction: column; gap: 2px; }
    .breakdown-row { display: flex; justify-content: space-between; }
    .total { margin-top: 6px; padding-top: 6px; border-top: 2px solid #0f172a; display: flex; justify-content: space-between; font-size: 13px; font-weight: 800; }
    .footer { margin-top: 8px; padding-top: 6px; border-top: 1px dashed #cbd5e1; font-size: 9.5px; color: #475569; text-align: center; white-space: pre-line; }
    .extra-footer { margin-top: 6px; padding-top: 5px; border-top: 1px dotted #94a3b8; font-size: 9px; color: #334155; display: flex; flex-direction: column; gap: 2px; text-align: left; }
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
      win.document.write(printHtml);
      win.document.close();
    }
  };

  if (!state) {
    return (
      <div
        className="min-h-screen flex items-center justify-center text-xs font-bold"
        style={{ backgroundColor: '#1E3A8A', color: '#DBEAFE' }}
      >
        Cargando ventana de Ventas...
      </div>
    );
  }

  const isDark = typeof externalDarkMode === 'boolean' ? externalDarkMode : state.darkMode;

  const palette = isDark
    ? {
        shellBg: '#0B1528',
        shellBorder: '#2563EB',
        panelBg: '#112240',
        panelBorder: '#1E40AF',
        cardBg: '#162A4D',
        cardHoverBg: '#1B3460',
        cardBorder: '#2563EB',
        footerStripBg: '#1D4ED8',
        footerStripBorder: '#3B82F6',
        textPrimary: '#F0F9FF',
        textSecondary: '#BFDBFE',
        textBlueAccent: '#93C5FD',
        priceColor: '#60A5FA',
        inputBg: '#0C1930',
        inputBorder: '#2563EB',
        accentPrimary: '#1D4ED8',
      }
    : {
        shellBg: '#DBEAFE',
        shellBorder: '#2563EB',
        panelBg: '#EFF6FF',
        panelBorder: '#60A5FA',
        cardBg: '#DBEAFE',
        cardHoverBg: '#BFDBFE',
        cardBorder: '#3B82F6',
        footerStripBg: '#BFDBFE',
        footerStripBorder: '#60A5FA',
        textPrimary: '#0F172A',
        textSecondary: '#1E3A8A',
        textBlueAccent: '#1D4ED8',
        priceColor: '#1E40AF',
        inputBg: '#FFFFFF',
        inputBorder: '#3B82F6',
        accentPrimary: '#1D4ED8',
      };

  if (!standaloneUnlocked) {
    const opsList = Array.isArray(state.operatorAccounts) && state.operatorAccounts.length > 0
      ? state.operatorAccounts
      : FALLBACK_POS_STATE.operatorAccounts || [];
    const selectedOp =
      opsList.find((o) => o.id === standaloneOpId) ||
      opsList.find((o) => o.id === state.currentOperatorId) ||
      opsList[0];
    const isSelAdmin =
      String(selectedOp?.role || '') === 'Administrador' || String(selectedOp?.role || '') === 'Admin';
    const reqPin = isSelAdmin ? ((selectedOp?.pin || '').trim() || 'admin1') : (selectedOp?.pin || '').trim();

    const handleSalesLoginSubmit = (e: React.FormEvent) => {
      e.preventDefault();
      if (!selectedOp) return;
      const entered = standalonePinInput.trim();
      if (reqPin && entered !== reqPin && !(isSelAdmin && validateAdminSecret(entered))) {
        setStandaloneLoginError('Clave incorrecta. Intenta de nuevo.');
        return;
      }
      const nextState: GenesisState = {
        ...state,
        currentOperatorId: selectedOp.id,
      };
      setState(nextState);
      try {
        const serialized = JSON.stringify(nextState);
        localStorage.setItem('genesis_app_v13_state', serialized);
        localStorage.setItem('genesis_app_v12_state', serialized);
        window.dispatchEvent(new StorageEvent('storage', { key: 'genesis_app_v13_state' }));
      } catch {}
      setStandaloneLoginError(null);
      setStandalonePinInput('');
      setStandaloneUnlocked(true);
      setPosScanFeedback(`Operador activo: ${selectedOp.operatorName} (${selectedOp.role})`);
    };

    return (
      <div
        className={`${
          isStandaloneWindow
            ? 'min-h-screen flex items-center justify-center p-4'
            : 'rounded-2xl border-2 p-6 flex items-center justify-center min-h-[420px]'
        }`}
        style={{
          backgroundColor: '#0B1528',
          borderColor: '#2563EB',
          color: '#F0F9FF',
        }}
      >
        <div
          className="w-full max-w-md rounded-2xl border p-6 shadow-2xl space-y-4"
          style={{ backgroundColor: '#112240', borderColor: '#2563EB' }}
        >
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2.5">
              <div
                className="w-8 h-8 rounded-lg flex items-center justify-center font-extrabold text-sm"
                style={{ backgroundColor: '#1D4ED8', color: '#FFFFFF' }}
              >
                POS
              </div>
              <div>
                <h2 className="text-sm font-extrabold">Acceso a Ventas — Génesis</h2>
                <p className="text-[11px]" style={{ color: '#BFDBFE' }}>
                  Identifica el operador e ingresa su clave si corresponde
                </p>
              </div>
            </div>
            {!isStandaloneWindow && onCloseModal && (
              <button
                type="button"
                onClick={onCloseModal}
                className="p-1.5 rounded-lg cursor-pointer"
                style={{ backgroundColor: '#0F296A', color: '#FFFFFF' }}
                title="Cerrar"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          <form onSubmit={handleSalesLoginSubmit} className="space-y-3 text-xs">
            <div>
              <label className="block text-[11px] font-bold mb-1" style={{ color: '#BFDBFE' }}>
                Operador
              </label>
              <select
                value={selectedOp?.id || ''}
                onChange={(e) => {
                  setStandaloneOpId(e.target.value);
                  setStandalonePinInput('');
                  setStandaloneLoginError(null);
                }}
                className="w-full px-3 py-2 rounded-lg border font-bold outline-none"
                style={{ backgroundColor: '#0C1930', borderColor: '#2563EB', color: '#F0F9FF' }}
              >
                {opsList.map((op) => {
                  const admRole =
                    String(op.role || '') === 'Administrador' || String(op.role || '') === 'Admin';
                  return (
                    <option key={op.id} value={op.id}>
                      {op.operatorName} ({op.role}) — {admRole || (op.pin && op.pin.trim()) ? 'Requiere clave' : 'Sin clave'}
                    </option>
                  );
                })}
              </select>
            </div>

            {reqPin ? (
              <div>
                <label className="block text-[11px] font-bold mb-1" style={{ color: '#BFDBFE' }}>
                  Clave de acceso
                </label>
                <input
                  type="password"
                  autoFocus
                  required
                  value={standalonePinInput}
                  onMouseDown={(e) => {
                    e.stopPropagation();
                    e.currentTarget.focus();
                  }}
                  onClick={(e) => {
                    e.stopPropagation();
                    e.currentTarget.focus();
                  }}
                  onChange={(e) => {
                    setStandalonePinInput(e.target.value);
                    setStandaloneLoginError(null);
                  }}
                  placeholder="Ingresa la clave..."
                  className="w-full px-3 py-2 rounded-lg border outline-none"
                  style={{ backgroundColor: '#0C1930', borderColor: '#2563EB', color: '#F0F9FF' }}
                />
              </div>
            ) : (
              <div
                className="rounded-xl border p-3 text-[11px]"
                style={{ backgroundColor: '#0C1930', borderColor: '#1E40AF', color: '#BFDBFE' }}
              >
                Este operador está configurado sin clave. Pulsa Ingresar para continuar.
              </div>
            )}

            {standaloneLoginError && (
              <p className="text-[11px] font-extrabold" style={{ color: '#F87171' }}>
                {standaloneLoginError}
              </p>
            )}

            <button
              type="submit"
              className="w-full py-2.5 rounded-xl font-extrabold text-xs cursor-pointer"
              style={{ backgroundColor: '#1D4ED8', color: '#FFFFFF' }}
            >
              Ingresar a Ventas
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div
      data-sales-window="true"
      className={`${
        isStandaloneWindow
          ? 'min-h-screen'
          : 'rounded-2xl border-2 shadow-2xl max-h-[90vh] overflow-y-auto'
      }`}
      style={{
        backgroundColor: palette.shellBg,
        borderColor: palette.shellBorder,
        color: palette.textPrimary,
      }}
    >
      <header
        className="h-14 px-4 sm:px-5 border-b flex items-center justify-between sticky top-0 z-20"
        style={{
          backgroundColor: '#1D4ED8',
          borderColor: '#1E40AF',
          color: '#FFFFFF',
        }}
      >
        <div className="flex items-center gap-2.5">
          <div
            className="w-7 h-7 rounded-lg font-extrabold text-[11px] flex items-center justify-center"
            style={{ backgroundColor: '#0F296A', color: '#FFFFFF' }}
          >
            POS
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xs sm:text-sm font-extrabold tracking-tight text-white">
                Ventana de Ventas
              </h1>
              <span
                className="hidden sm:inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full"
                style={{ backgroundColor: '#0F296A', color: '#BFDBFE' }}
              >
                <Sparkles className="w-2.5 h-2.5" /> Caja Activa
              </span>
              {Array.isArray(state.operatorAccounts) && state.operatorAccounts.length > 0 && (
                <div className="inline-flex items-center gap-1.5 text-[10px] font-extrabold">
                  <span className="hidden md:inline" style={{ color: '#DBEAFE' }}>Operador:</span>
                  <select
                    value={
                      state.operatorAccounts.some((o) => o.id === state.currentOperatorId)
                        ? state.currentOperatorId
                        : state.operatorAccounts[0]?.id || ''
                    }
                    onChange={(e) => {
                      const nextOpId = e.target.value;
                      const currentId = state.operatorAccounts.some((o) => o.id === state.currentOperatorId)
                        ? state.currentOperatorId
                        : state.operatorAccounts[0]?.id || '';
                      if (nextOpId === currentId) return;
                      const targetOp = state.operatorAccounts.find((o) => o.id === nextOpId);
                      const needsPin = Boolean(
                        (targetOp?.pin && String(targetOp.pin).trim()) ||
                          String(targetOp?.role || '') === 'Administrador' ||
                          String(targetOp?.role || '') === 'Admin'
                      );
                      if (needsPin && targetOp) {
                        setPendingSwitchOp(targetOp);
                        setSwitchOpPinInput('');
                        setSwitchOpError(null);
                      } else if (targetOp) {
                        setPendingSwitchOp(null);
                        setSwitchOpPinInput('');
                        setSwitchOpError(null);
                        setStandaloneOpId(targetOp.id);
                        const nextOpState: GenesisState = { ...state, currentOperatorId: nextOpId };
                        setState(nextOpState);
                        try {
                          const serialized = JSON.stringify(nextOpState);
                          localStorage.setItem('genesis_app_v13_state', serialized);
                          localStorage.setItem('genesis_app_v12_state', serialized);
                          window.dispatchEvent(new StorageEvent('storage', { key: 'genesis_app_v13_state' }));
                        } catch {}
                        setPosScanFeedback(`Operador activo cambiado a: ${targetOp.operatorName}`);
                      }
                    }}
                    className="px-2 py-0.5 rounded-lg text-[10px] font-extrabold border outline-none cursor-pointer"
                    style={{
                      backgroundColor: '#0F296A',
                      borderColor: '#93C5FD',
                      color: '#FFFFFF',
                    }}
                    title="Cambiar operador activo"
                  >
                    {state.operatorAccounts.map((op) => (
                      <option key={op.id} value={op.id}>
                        {op.operatorName} ({op.role})
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>
            <span className="text-[10px]" style={{ color: '#DBEAFE' }}>
              Facturación rápida y control de inventario
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {!isStandaloneWindow && (
            <a
              href="/ventas"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-bold transition"
              style={{ backgroundColor: '#0F296A', color: '#FFFFFF' }}
              title="Abrir en pestaña independiente"
            >
              <ExternalLink className="w-3 h-3" />
              <span className="hidden sm:inline">Pestaña nueva</span>
            </a>
          )}

          {isStandaloneWindow ? (
            <button
              type="button"
              onClick={() => window.close()}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-bold transition cursor-pointer"
              style={{ backgroundColor: '#0F296A', color: '#FFFFFF' }}
            >
              <ArrowLeft className="w-3 h-3" />
              <span>Cerrar</span>
            </button>
          ) : (
            onCloseModal && (
              <button
                type="button"
                onClick={() => {
                  try {
                    const raw = localStorage.getItem(STORAGE_KEY);
                    if (raw) {
                      const parsed = JSON.parse(raw);
                      const list = parsed.operatorAccounts || [];
                      const activeOp = list.find((o: { id: string }) => o.id === parsed.currentOperatorId) || list[0];
                      const role = activeOp?.role;
                      const perms: string[] = activeOp?.permissions || [];
                      if (role !== 'Administrador' && !perms.includes('dashboard')) {
                        const firstNonSales = perms.find((p: string) => p !== 'ventas' && p !== 'dashboard');
                        if (firstNonSales) {
                          parsed.operationsSection = firstNonSales;
                          localStorage.setItem(STORAGE_KEY, JSON.stringify(parsed));
                        } else {
                          setPosScanFeedback('Tu cuenta de operador solo tiene permiso para operar en Ventas.');
                          return;
                        }
                      }
                    }
                  } catch {}
                  onCloseModal();
                }}
                className="p-1.5 rounded-lg transition cursor-pointer"
                style={{ backgroundColor: '#0F296A', color: '#FFFFFF' }}
                title="Cerrar ventana de ventas"
              >
                <X className="w-4 h-4" />
              </button>
            )
          )}

          <button
            type="button"
            onClick={() => persistState({ ...state, darkMode: !state.darkMode })}
            className="p-1.5 rounded-lg transition cursor-pointer"
            style={{ backgroundColor: '#0F296A', color: '#FFFFFF' }}
            title="Cambiar tema"
          >
            {isDark ? <Sun className="w-3.5 h-3.5" /> : <Moon className="w-3.5 h-3.5" />}
          </button>
        </div>
      </header>

      <div className="p-4 max-w-6xl mx-auto space-y-4">
        {lastSaleBanner && (
          <div
            className="flex items-center justify-between gap-2 rounded-xl border px-3.5 py-2.5 text-xs font-extrabold"
            style={{
              backgroundColor: '#DBEAFE',
              borderColor: '#2563EB',
              color: '#1E3A8A',
            }}
          >
            <span className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0" style={{ color: '#1D4ED8' }} />
              {lastSaleBanner}
            </span>
            <div className="flex items-center gap-2">
              {state.sales[0] && (
                <button
                  type="button"
                  onClick={() => handlePrintInvoice(state.sales[0])}
                  className="px-2.5 py-1 rounded-lg text-[10px] font-extrabold cursor-pointer"
                  style={{ backgroundColor: '#1D4ED8', color: '#FFFFFF' }}
                >
                  Imprimir factura
                </button>
              )}
              <button type="button" onClick={() => setLastSaleBanner(null)}>
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
          {/* Panel Izquierdo: Productos en Venta */}
          <div
            className="lg:col-span-7 rounded-2xl border p-3.5 sm:p-4 space-y-3"
            style={{
              backgroundColor: palette.panelBg,
              borderColor: palette.panelBorder,
              color: palette.textPrimary,
            }}
          >
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span
                  className="w-6 h-6 rounded-lg flex items-center justify-center"
                  style={{ backgroundColor: '#1D4ED8', color: '#FFFFFF' }}
                >
                  <Layers className="w-3.5 h-3.5" />
                </span>
                <div>
                  <h2
                    className="text-xs sm:text-sm font-extrabold"
                    style={{ color: palette.textPrimary }}
                  >
                    Productos en Venta
                  </h2>
                  <p
                    className="text-[10px] font-semibold"
                    style={{ color: palette.textSecondary }}
                  >
                    Toca un recuadro para agregar
                  </p>
                </div>
              </div>
              <span
                className="text-[10px] font-extrabold px-2 py-0.5 rounded-full tabular-nums"
                style={{ backgroundColor: '#1D4ED8', color: '#FFFFFF' }}
              >
                {filteredPosProducts.length} items
              </span>
            </div>

            <form onSubmit={handleScanOrSearchSubmit} className="flex gap-2">
              <div className="relative flex-1">
                <Barcode
                  className="w-3.5 h-3.5 absolute left-2.5 top-2"
                  style={{ color: palette.textBlueAccent }}
                />
                <input
                  ref={posInputRef}
                  type="text"
                  value={posScanInput}
                  onChange={(e) => setPosScanInput(e.target.value)}
                  placeholder="Buscar nombre o código de barra..."
                  className="w-full pl-8 pr-7 py-1.5 text-xs rounded-lg border outline-none"
                  style={{
                    backgroundColor: palette.inputBg,
                    borderColor: palette.inputBorder,
                    color: palette.textPrimary,
                  }}
                />
                {posScanInput && (
                  <button
                    type="button"
                    onClick={() => setPosScanInput('')}
                    className="absolute right-2 top-2"
                    style={{ color: palette.textSecondary }}
                  >
                    <Search className="w-3 h-3" />
                  </button>
                )}
              </div>
              <button
                type="submit"
                className="px-3 py-1.5 rounded-lg text-xs font-extrabold shrink-0 transition cursor-pointer"
                style={{ backgroundColor: '#1D4ED8', color: '#FFFFFF' }}
              >
                Cargar
              </button>
            </form>

            {posScanFeedback && (
              <p
                className="text-[11px] font-bold px-2.5 py-1.5 rounded-lg border"
                style={{
                  backgroundColor: posLowStockAlert ? '#FEE2E2' : '#DBEAFE',
                  borderColor: posLowStockAlert ? '#DC2626' : '#2563EB',
                  color: posLowStockAlert ? '#991B1B' : '#1E3A8A',
                }}
              >
                {posScanFeedback}
              </p>
            )}

            <div
              className="flex flex-wrap items-center gap-1 pb-1.5 border-b"
              style={{ borderColor: palette.panelBorder }}
            >
              <span
                className="text-[10px] font-bold mr-1"
                style={{ color: palette.textSecondary }}
              >
                Cant.:
              </span>
              {[1, 2, 3, 5, 10].map((mult) => {
                const selected = posNextMultiplier === mult;
                return (
                  <button
                    key={mult}
                    type="button"
                    onClick={() => {
                      setPosNextMultiplier(mult);
                      posInputRef.current?.focus();
                    }}
                    className="px-2 py-0.5 rounded-md text-[11px] font-extrabold tabular-nums border transition cursor-pointer"
                    style={{
                      backgroundColor: selected ? '#1D4ED8' : palette.inputBg,
                      borderColor: '#2563EB',
                      color: selected ? '#FFFFFF' : palette.textPrimary,
                    }}
                  >
                    x{mult}
                  </button>
                );
              })}
            </div>

            <div className="flex flex-wrap gap-1">
              {posCategories.map((cat) => {
                const active = selectedPosCategory === cat;
                return (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setSelectedPosCategory(cat)}
                    className="px-2.5 py-1 rounded-lg text-[11px] font-bold border transition cursor-pointer"
                    style={{
                      backgroundColor: active ? '#1D4ED8' : palette.inputBg,
                      borderColor: '#2563EB',
                      color: active ? '#FFFFFF' : palette.textPrimary,
                    }}
                  >
                    {cat}
                  </button>
                );
              })}
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 pt-0.5">
              {filteredPosProducts.map((prod) => {
                const inCart = invoiceItems.find((i) => i.productId === prod.id);
                const accent = prod.accentColor || '#1D4ED8';
                const unitFinal = getEffectiveUnitTotal(prod.price, prod.hasIva);
                const isLow = prod.stock < 5;

                return (
                  <button
                    key={prod.id}
                    type="button"
                    onClick={() => addProductToInvoice(prod)}
                    className="relative overflow-hidden text-left rounded-xl border p-2 flex flex-col justify-between gap-1.5 transition cursor-pointer"
                    style={{
                      backgroundColor: inCart ? palette.cardHoverBg : palette.cardBg,
                      borderColor: inCart ? '#1D4ED8' : palette.cardBorder,
                      color: palette.textPrimary,
                    }}
                  >
                    <div
                      className="absolute inset-x-0 top-0 h-1"
                      style={{ backgroundColor: accent }}
                    />

                    <div className="flex items-start gap-1.5 pt-0.5">
                      <img
                        src={prod.imageUrl || makeThumbDataUri(prod.name.slice(0, 2) || 'PR', accent)}
                        alt={prod.name}
                        className="w-8 h-8 rounded-lg object-cover shrink-0 border"
                        style={{ borderColor: '#2563EB' }}
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-1">
                          <span
                            className="text-[9px] font-extrabold uppercase px-1.5 py-0.5 rounded truncate"
                            style={{
                              backgroundColor: isDark ? '#1E3A8A' : '#93C5FD',
                              color: isDark ? '#EFF6FF' : '#0F172A',
                            }}
                          >
                            {prod.category}
                          </span>
                          {inCart && (
                            <span
                              className="text-[9px] font-black px-1.5 py-0.5 rounded-full tabular-nums"
                              style={{ backgroundColor: '#1D4ED8', color: '#FFFFFF' }}
                            >
                              x{inCart.quantity}
                            </span>
                          )}
                        </div>
                        <p
                          className="text-[11px] font-extrabold leading-tight line-clamp-2 mt-1"
                          style={{ color: palette.textPrimary }}
                        >
                          {prod.name}
                        </p>
                      </div>
                    </div>

                    <div
                      className="rounded-lg p-1.5 space-y-1 border"
                      style={{
                        backgroundColor: palette.footerStripBg,
                        borderColor: palette.footerStripBorder,
                      }}
                    >
                      <div className="flex items-center justify-between gap-1">
                        <span
                          className="text-xs font-black tabular-nums"
                          style={{ color: palette.priceColor }}
                        >
                          ${unitFinal.toFixed(2)}
                        </span>
                        <span
                          className="text-[9px] font-extrabold px-1.5 py-0.5 rounded"
                          style={{
                            backgroundColor: isDark ? '#0F296A' : '#EFF6FF',
                            color: isDark ? '#DBEAFE' : '#1E3A8A',
                          }}
                        >
                          {prod.hasIva ? 'Con IVA' : 'Sin IVA'}
                        </span>
                      </div>

                      <div
                        className="flex items-center justify-between text-[9px] font-extrabold tabular-nums pt-0.5 border-t"
                        style={{
                          borderColor: isDark ? 'rgba(147,197,253,0.22)' : 'rgba(30,58,138,0.16)',
                          color: isLow ? '#DC2626' : palette.textSecondary,
                        }}
                      >
                        <span>Disponibles</span>
                        <span>{prod.stock} uds</span>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Panel Derecho: Factura y Cobro */}
          <form
            ref={invoiceFormRef}
            onSubmit={handleCompleteSale}
            className="lg:col-span-5 rounded-2xl border p-3.5 sm:p-4 space-y-3"
            style={{
              backgroundColor: palette.panelBg,
              borderColor: palette.panelBorder,
              color: palette.textPrimary,
            }}
          >
            <div
              className="flex items-center justify-between border-b pb-2.5"
              style={{ borderColor: palette.panelBorder }}
            >
              <div className="flex items-center gap-2">
                <span
                  className="w-6 h-6 rounded-lg flex items-center justify-center"
                  style={{ backgroundColor: '#1D4ED8', color: '#FFFFFF' }}
                >
                  <Receipt className="w-3.5 h-3.5" />
                </span>
                <div>
                  <h2
                    className="text-xs sm:text-sm font-extrabold"
                    style={{ color: palette.textPrimary }}
                  >
                    Factura en Curso
                  </h2>
                  <p
                    className="text-[10px] font-semibold"
                    style={{ color: palette.textSecondary }}
                  >
                    Detalle y cobro
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-1.5">
                {(() => {
                  const firstProd = invoiceItems[0]
                    ? state.products.find((p) => p.id === invoiceItems[0].productId)
                    : undefined;
                  const modeUnit = getProductUnitInfo(firstProd, invoiceItems[0]);
                  const medidaLabel = modeUnit.shortLabel !== 'ud' ? `Medida (${modeUnit.shortLabel})` : 'Por medida';
                  return (
                    <div
                      className="inline-flex rounded-lg border p-0.5 text-[10px] font-extrabold"
                      style={{ backgroundColor: palette.inputBg, borderColor: '#2563EB' }}
                      title="Elegir si se cobra por unidad o por la unidad/medida configurada en el producto"
                    >
                      <button
                        type="button"
                        onClick={() => setBillingMode('unidad')}
                        className="px-2 py-0.5 rounded-md cursor-pointer transition"
                        style={{
                          backgroundColor: billingMode === 'unidad' ? '#1D4ED8' : 'transparent',
                          color: billingMode === 'unidad' ? '#FFFFFF' : palette.textPrimary,
                        }}
                      >
                        Unidad
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setBillingMode('medida');
                          setItemMeasureValues((prev) => {
                            const next = { ...prev };
                            invoiceItems.forEach((it) => {
                              const prodObj = state.products.find((p) => p.id === it.productId) as
                                | (ProductItem & { weightOrQty?: number; unitWeight?: number })
                                | undefined;
                              const defaultVal =
                                Number(prodObj?.weightOrQty || prodObj?.unitWeight || it.quantity || 1) || 1;
                              if (next[it.productId] === undefined) {
                                next[it.productId] = defaultVal;
                              }
                            });
                            return next;
                          });
                        }}
                        className="px-2 py-0.5 rounded-md cursor-pointer transition"
                        style={{
                          backgroundColor: billingMode === 'medida' ? '#1D4ED8' : 'transparent',
                          color: billingMode === 'medida' ? '#FFFFFF' : palette.textPrimary,
                        }}
                      >
                        {medidaLabel}
                      </button>
                    </div>
                  );
                })()}
                {invoiceItems.length > 0 && (
                  <button
                    type="button"
                    onClick={() => {
                      setInvoiceItems([]);
                      setItemMeasureValues({});
                    }}
                    className="text-[10px] font-extrabold px-2 py-1 rounded-lg transition cursor-pointer"
                    style={{ backgroundColor: '#DBEAFE', color: '#1E3A8A' }}
                  >
                    Vaciar
                  </button>
                )}
              </div>
            </div>

            <div
              className="max-h-52 overflow-y-auto divide-y"
              style={{ borderColor: palette.panelBorder }}
            >
              {invoiceItems.length === 0 ? (
                <div
                  className="py-8 text-center text-xs font-semibold"
                  style={{ color: palette.textSecondary }}
                >
                  Toca o escanea productos para armar la factura.
                </div>
              ) : (
                invoiceItems.map((item) => {
                  const prodMatch = state.products.find((p) => p.id === item.productId) as
                    | (ProductItem & { weightOrQty?: number; unitWeight?: number })
                    | undefined;
                  const unitInfo = getProductUnitInfo(prodMatch, item);
                  const billingFactor = getItemBillingFactor(item);
                  const lineTotal = getEffectiveUnitTotal(item.unitPrice, item.hasIva) * billingFactor;
                  return (
                    <div
                      key={item.productId}
                      className="py-2 flex items-center justify-between gap-1.5 text-xs"
                      style={{ borderColor: palette.panelBorder }}
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1">
                          <p
                            className="font-bold truncate"
                            style={{ color: palette.textPrimary }}
                          >
                            {item.name}
                          </p>
                          <button
                            type="button"
                            onClick={() => handleToggleInvoiceItemIva(item.productId)}
                            className="text-[9px] font-extrabold px-1.5 py-0.5 rounded cursor-pointer"
                            style={{ backgroundColor: '#DBEAFE', color: '#1E3A8A' }}
                          >
                            {item.hasIva ? 'IVA' : 'Exento'}
                          </button>
                        </div>
                        <p
                          className="text-[10px] font-semibold tabular-nums"
                          style={{ color: palette.textSecondary }}
                        >
                          ${item.unitPrice.toFixed(2)} {billingMode === 'medida' ? `/ ${unitInfo.shortLabel}` : 'base'}
                        </p>
                      </div>

                      {billingMode === 'medida' ? (
                        <div className="flex items-center gap-1">
                          <input
                            type="number"
                            step="0.01"
                            min="0.01"
                            value={(item.productId ? itemMeasureValues[item.productId] : undefined) ?? item.quantity}
                            onChange={(e) => {
                              const val = parseFloat(e.target.value);
                              setItemMeasureValues((prev) => ({
                                ...prev,
                                ...(item.productId ? { [item.productId]: isNaN(val) ? 0 : val } : {}),
                              }));
                            }}
                            className="w-16 px-1.5 py-0.5 rounded border text-right text-xs font-extrabold tabular-nums"
                            style={{
                              backgroundColor: palette.inputBg,
                              borderColor: '#2563EB',
                              color: palette.textPrimary,
                            }}
                            title={`Cantidad en ${unitInfo.fullLabel}`}
                          />
                          <span className="text-[10px] font-extrabold" style={{ color: palette.textSecondary }}>
                            {unitInfo.shortLabel}
                          </span>
                        </div>
                      ) : (
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => handleAdjustInvoiceQty(item.productId, -1)}
                          className="p-1 rounded border cursor-pointer"
                          style={{
                            backgroundColor: palette.inputBg,
                            borderColor: palette.inputBorder,
                            color: palette.textPrimary,
                          }}
                        >
                          <Minus className="w-3 h-3" />
                        </button>
                        {editingQtyProductId === item.productId ? (
                          <input
                            type="number"
                            min="1"
                            autoFocus
                            value={editingQtyDraft}
                            onChange={(e) => setEditingQtyDraft(e.target.value)}
                            onBlur={() =>
                              handleSetInvoiceItemQty(item.productId, parseInt(editingQtyDraft, 10))
                            }
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                e.preventDefault();
                                handleSetInvoiceItemQty(item.productId, parseInt(editingQtyDraft, 10));
                              }
                            }}
                            className="w-11 px-1 py-0.5 rounded border text-center text-xs font-extrabold tabular-nums"
                            style={{
                              backgroundColor: '#FFFFFF',
                              borderColor: '#1D4ED8',
                              color: '#0F172A',
                            }}
                          />
                        ) : (
                          <button
                            type="button"
                            onClick={() => {
                              setEditingQtyProductId(item.productId);
                              setEditingQtyDraft(String(item.quantity));
                            }}
                            className="px-2 py-0.5 rounded font-extrabold tabular-nums cursor-pointer"
                            style={{ backgroundColor: '#DBEAFE', color: '#1E3A8A' }}
                          >
                            x{item.quantity}
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => handleAdjustInvoiceQty(item.productId, 1)}
                          className="p-1 rounded border cursor-pointer"
                          style={{
                            backgroundColor: palette.inputBg,
                            borderColor: palette.inputBorder,
                            color: palette.textPrimary,
                          }}
                        >
                          <Plus className="w-3 h-3" />
                        </button>
                      </div>
                      )}

                      <span
                        className="w-14 text-right font-extrabold tabular-nums"
                        style={{ color: palette.textPrimary }}
                      >
                        ${lineTotal.toFixed(2)}
                      </span>

                      <button
                        type="button"
                        onClick={() => handleRemoveInvoiceItem(item.productId)}
                        className="p-1 cursor-pointer"
                        style={{ color: palette.textSecondary }}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  );
                })
              )}
            </div>

            <div
              className="space-y-2.5 pt-2.5 border-t text-xs"
              style={{ borderColor: palette.panelBorder }}
            >
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <span
                    className="text-[11px] font-bold"
                    style={{ color: palette.textSecondary }}
                  >
                    {customInvoiceMode ? 'Factura Personalizada' : 'Factura: Cliente General'}
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      const nextMode = !customInvoiceMode;
                      setCustomInvoiceMode(nextMode);
                      if (!nextMode) {
                        setInvoiceNote('Cliente General');
                        setMatchedCustomerId(null);
                      } else {
                        setInvoiceNote(custFullName || '');
                      }
                    }}
                    className="px-2.5 py-1 rounded-lg text-[10px] font-extrabold border cursor-pointer transition"
                    style={{
                      backgroundColor: customInvoiceMode ? '#1D4ED8' : palette.inputBg,
                      borderColor: '#2563EB',
                      color: customInvoiceMode ? '#FFFFFF' : palette.textPrimary,
                    }}
                  >
                    {customInvoiceMode ? 'Usar Cliente General' : '+ Factura Personalizada'}
                  </button>
                </div>

                {!customInvoiceMode ? (
                  <input
                    type="text"
                    readOnly
                    value="Cliente General"
                    className="w-full px-3 py-1.5 rounded-lg border outline-none opacity-85"
                    style={{
                      backgroundColor: palette.inputBg,
                      borderColor: palette.inputBorder,
                      color: palette.textPrimary,
                    }}
                  />
                ) : (
                  <div
                    className="rounded-xl border p-2.5 space-y-2"
                    style={{
                      backgroundColor: palette.inputBg,
                      borderColor: palette.inputBorder,
                    }}
                  >
                    <div className="relative">
                      <div className="flex items-center gap-1.5">
                        <input
                          type="text"
                          value={affiliateSearchQuery}
                          onFocus={() => setAffiliateDropdownOpen(true)}
                          onChange={(e) => {
                            const val = e.target.value;
                            setAffiliateSearchQuery(val);
                            setAffiliateDropdownOpen(true);
                            handleCustomLookupChange('name', val);
                          }}
                          placeholder="Buscar afiliado por número (cédula/RIF/tel) o letra..."
                          className="w-full px-2.5 py-1.5 rounded-lg border text-xs outline-none"
                          style={{
                            backgroundColor: palette.panelBg,
                            borderColor: palette.inputBorder,
                            color: palette.textPrimary,
                          }}
                        />
                        <button
                          type="button"
                          onClick={() => setAffiliateDropdownOpen((prev) => !prev)}
                          className="px-2.5 py-1.5 rounded-lg border text-[10px] font-extrabold shrink-0 cursor-pointer"
                          style={{
                            backgroundColor: palette.cardBg,
                            borderColor: '#2563EB',
                            color: palette.textPrimary,
                          }}
                        >
                          {affiliateDropdownOpen ? 'Ocultar' : 'Lista'}
                        </button>
                      </div>

                      {affiliateDropdownOpen && (
                        <div
                          className="mt-1 rounded-lg border max-h-40 overflow-y-auto divide-y shadow-lg"
                          style={{
                            backgroundColor: palette.panelBg,
                            borderColor: palette.inputBorder,
                          }}
                        >
                          {filteredAffiliates.length === 0 ? (
                            <div
                              className="px-3 py-2 text-[11px]"
                              style={{ color: palette.textSecondary }}
                            >
                              Sin coincidencias entre clientes afiliados.
                            </div>
                          ) : (
                            filteredAffiliates.map((c) => (
                              <button
                                key={c.id}
                                type="button"
                                onClick={() => applyAffiliatedCustomer(c)}
                                className="w-full px-3 py-1.5 text-left text-[11px] flex items-center justify-between gap-2 cursor-pointer transition"
                                style={{
                                  backgroundColor:
                                    matchedCustomerId === c.id ? '#1D4ED8' : 'transparent',
                                  color:
                                    matchedCustomerId === c.id ? '#FFFFFF' : palette.textPrimary,
                                }}
                              >
                                <span className="truncate font-bold">
                                  {c.fullName} {c.taxOrId ? `· ${c.taxOrId}` : ''}
                                </span>
                                <span className="text-[10px] opacity-80 shrink-0 tabular-nums">
                                  {c.phone || ''}
                                </span>
                              </button>
                            ))
                          )}
                        </div>
                      )}
                    </div>

                    <input
                      type="text"
                      value={custFullName}
                      onChange={(e) => handleCustomLookupChange('name', e.target.value)}
                      placeholder="Nombre completo (autocompleta si existe)"
                      className="w-full px-2.5 py-1.5 rounded-lg border text-xs outline-none"
                      style={{
                        backgroundColor: palette.panelBg,
                        borderColor: palette.inputBorder,
                        color: palette.textPrimary,
                      }}
                    />

                    <div className="grid grid-cols-2 gap-2">
                      <input
                        type="text"
                        value={custTaxOrId}
                        onChange={(e) => handleCustomLookupChange('id', e.target.value)}
                        placeholder="Cédula o RIF"
                        className="w-full px-2.5 py-1.5 rounded-lg border text-xs tabular-nums outline-none"
                        style={{
                          backgroundColor: palette.panelBg,
                          borderColor: palette.inputBorder,
                          color: palette.textPrimary,
                        }}
                      />
                      <input
                        type="text"
                        value={custPhone}
                        onChange={(e) => handleCustomLookupChange('phone', e.target.value)}
                        placeholder="Teléfono"
                        className="w-full px-2.5 py-1.5 rounded-lg border text-xs tabular-nums outline-none"
                        style={{
                          backgroundColor: palette.panelBg,
                          borderColor: palette.inputBorder,
                          color: palette.textPrimary,
                        }}
                      />
                    </div>

                    <input
                      type="text"
                      value={custAddress}
                      onChange={(e) => handleCustomLookupChange('address', e.target.value)}
                      placeholder="Dirección"
                      className="w-full px-2.5 py-1.5 rounded-lg border text-xs outline-none"
                      style={{
                        backgroundColor: palette.panelBg,
                        borderColor: palette.inputBorder,
                        color: palette.textPrimary,
                      }}
                    />

                    {matchedCustomerId && (
                      <p
                        className="text-[10px] font-extrabold"
                        style={{ color: palette.textBlueAccent }}
                      >
                        Cliente afiliado encontrado y cargado automáticamente.
                      </p>
                    )}
                  </div>
                )}
              </div>

              {(() => {
                const activePmObj = state.paymentMethods.find((pm) => pm.name === invoicePaymentType);
                const cashMode = isCashPaymentMethod(invoicePaymentType, activePmObj?.accountCategory);
                const linkedCat = activePmObj?.accountCategory || (cashMode ? 'Efectivo' : 'Cuenta Principal');
                return (
                  <div className="space-y-2">
                    <div className="grid grid-cols-2 gap-2">
                      <select
                        value={invoicePaymentType}
                        onChange={(e) => {
                          const nextName = e.target.value;
                          setInvoicePaymentType(nextName);
                          const pmMatch = state.paymentMethods.find((p) => p.name === nextName);
                          if (isCashPaymentMethod(nextName, pmMatch?.accountCategory)) {
                            setInvoiceCashType(invoiceCurrency === 'VES' ? 'Efectivo Bolívares' : 'Efectivo Divisa');
                          }
                        }}
                        className="px-2.5 py-1.5 rounded-lg border outline-none"
                        style={{
                          backgroundColor: palette.inputBg,
                          borderColor: palette.inputBorder,
                          color: palette.textPrimary,
                        }}
                      >
                        {(() => {
                          const list = (state.paymentMethods || []).filter((pm) => pm.active);
                          const hasCashea = list.some((pm) => /cashea/i.test(pm.name));
                          return (
                            <>
                              {list.map((pm) => (
                                <option key={pm.id} value={pm.name}>
                                  {pm.name}
                                </option>
                              ))}
                              {!hasCashea && <option value="Cashea">Cashea</option>}
                            </>
                          );
                        })()}
                      </select>

                      <select
                        value={invoiceCurrency}
                        onChange={(e) => {
                          const nextCur = e.target.value;
                          setInvoiceCurrency(nextCur);
                          if (cashMode) {
                            setInvoiceCashType(nextCur === 'VES' ? 'Efectivo Bolívares' : 'Efectivo Divisa');
                          }
                        }}
                        className="px-2.5 py-1.5 rounded-lg border outline-none"
                        style={{
                          backgroundColor: palette.inputBg,
                          borderColor: palette.inputBorder,
                          color: palette.textPrimary,
                        }}
                      >
                        {state.currencies.map((c) => (
                          <option key={c.id} value={c.code}>
                            {c.code}
                          </option>
                        ))}
                        {!state.currencies.some((c) => c.code === 'COP') && (
                          <option value="COP">COP</option>
                        )}
                      </select>
                    </div>

                    {cashMode && (
                      <div className="grid grid-cols-2 gap-2">
                        {(['Efectivo Bolívares', 'Efectivo Divisa'] as CashKindOption[]).map((cKind) => {
                          const selectedKind = invoiceCashType === cKind;
                          return (
                            <button
                              key={cKind}
                              type="button"
                              onClick={() => {
                                setInvoiceCashType(cKind);
                                if (cKind === 'Efectivo Bolívares' && state.currencies.some((c) => c.code === 'VES')) {
                                  setInvoiceCurrency('VES');
                                } else if (cKind === 'Efectivo Divisa' && invoiceCurrency === 'VES') {
                                  setInvoiceCurrency('USD');
                                }
                              }}
                              className="py-1.5 px-2.5 rounded-lg text-[11px] font-bold border transition cursor-pointer"
                              style={{
                                backgroundColor: selectedKind ? palette.accentPrimary : palette.inputBg,
                                borderColor: selectedKind ? palette.accentPrimary : palette.inputBorder,
                                color: selectedKind ? '#ffffff' : palette.textPrimary,
                              }}
                            >
                              {cKind}
                            </button>
                          );
                        })}
                      </div>
                    )}

                    <p className="text-[10px]" style={{ color: palette.textSecondary }}>
                      Cuenta automática: <strong style={{ color: palette.textBlueAccent }}>{linkedCat}</strong>
                    </p>

                    {/cashea/i.test(invoicePaymentType) && (() => {
                      const initAmount = Number(((invoiceFinalTotal * casheaInitialPct) / 100).toFixed(2));
                      const financedAmount = Math.max(0, Number((invoiceFinalTotal - initAmount).toFixed(2)));
                      const perInstallment = Number((financedAmount / casheaInstallments).toFixed(2));
                      return (
                        <div
                          className="rounded-xl p-2.5 border space-y-2 text-[11px]"
                          style={{
                            backgroundColor: palette.panelBg,
                            borderColor: palette.panelBorder,
                            color: palette.textPrimary,
                          }}
                        >
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <span className="font-extrabold" style={{ color: palette.textBlueAccent }}>
                              Plan Cashea · Inicial {casheaInitialPct}%
                            </span>
                            <div className="flex flex-wrap items-center gap-1">
                              {[0, 20, 30, 40, 50, 60].map((pct) => (
                                <button
                                  key={pct}
                                  type="button"
                                  onClick={() => setCasheaInitialPct(pct)}
                                  className="px-2 py-0.5 rounded text-[10px] font-bold border cursor-pointer"
                                  style={{
                                    backgroundColor: casheaInitialPct === pct ? palette.accentPrimary : palette.inputBg,
                                    borderColor: casheaInitialPct === pct ? palette.accentPrimary : palette.inputBorder,
                                    color: casheaInitialPct === pct ? '#ffffff' : palette.textPrimary,
                                  }}
                                >
                                  {pct}%
                                </button>
                              ))}
                            </div>
                          </div>

                          <div className="flex flex-wrap items-center justify-between gap-2 pt-0.5">
                            <span className="text-[10.5px] font-semibold" style={{ color: palette.textSecondary }}>
                              Cuotas según nivel del cliente:
                            </span>
                            <div className="flex items-center gap-1">
                              {([1, 2, 3] as const).map((numCuotas) => (
                                <button
                                  key={numCuotas}
                                  type="button"
                                  onClick={() => setCasheaInstallments(numCuotas)}
                                  className="px-2.5 py-0.5 rounded text-[10px] font-bold border cursor-pointer"
                                  style={{
                                    backgroundColor: casheaInstallments === numCuotas ? palette.accentPrimary : palette.inputBg,
                                    borderColor: casheaInstallments === numCuotas ? palette.accentPrimary : palette.inputBorder,
                                    color: casheaInstallments === numCuotas ? '#ffffff' : palette.textPrimary,
                                  }}
                                >
                                  {numCuotas} {numCuotas === 1 ? 'cuota' : 'cuotas'}
                                </button>
                              ))}
                            </div>
                          </div>

                          <div className="grid grid-cols-3 gap-2 text-[10.5px] tabular-nums">
                            <div>
                              <span style={{ color: palette.textSecondary }}>Inicial ({casheaInitialPct}%):</span>{' '}
                              <strong style={{ color: palette.priceColor }}>${initAmount.toFixed(2)}</strong>
                            </div>
                            <div>
                              <span style={{ color: palette.textSecondary }}>Por cobrar:</span>{' '}
                              <strong style={{ color: '#D97706' }}>${financedAmount.toFixed(2)}</strong>
                            </div>
                            <div>
                              <span style={{ color: palette.textSecondary }}>
                                {casheaInstallments} {casheaInstallments === 1 ? 'Cuota' : 'Cuotas'}:
                              </span>{' '}
                              <strong>~${perInstallment.toFixed(2)} c/u</strong>
                            </div>
                          </div>
                          <div className="flex flex-wrap items-center justify-between gap-2 text-[10.5px] tabular-nums">
                            <span style={{ color: palette.textSecondary }}>
                              Recargo Cashea ({casheaFeePct}% configurado en método):
                            </span>
                            <strong style={{ color: '#1D4ED8' }}>+${casheaFeeAmount.toFixed(2)}</strong>
                          </div>
                          <p className="text-[10px]" style={{ color: palette.textSecondary }}>
                            Se registra automáticamente como <strong>Cuenta por Cobrar</strong> por el saldo restante en{' '}
                            <strong>{casheaInstallments} {casheaInstallments === 1 ? 'cuota' : 'cuotas'}</strong>.
                          </p>
                        </div>
                      );
                    })()}
                  </div>
                );
              })()}

              {/* Descuento % con Clave Admin */}
              <div
                className="rounded-xl p-2.5 space-y-2 border"
                style={{
                  backgroundColor: palette.inputBg,
                  borderColor: palette.inputBorder,
                }}
              >
                <div className="flex items-center justify-between">
                  <span
                    className="text-[11px] font-extrabold"
                    style={{ color: palette.textBlueAccent }}
                  >
                    Descuento % Total (Clave Admin)
                  </span>
                  {appliedDiscountPct > 0 && (
                    <button
                      type="button"
                      onClick={handleClearInvoiceDiscount}
                      className="text-[10px] font-extrabold underline cursor-pointer"
                      style={{ color: '#DC2626' }}
                    >
                      Quitar ({appliedDiscountPct}%)
                    </button>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    max="100"
                    placeholder="% (ej. 10)"
                    value={discountPercentDraft}
                    onChange={(e) => {
                      setDiscountPercentDraft(e.target.value);
                      setDiscountError(null);
                    }}
                    className="px-2.5 py-1.5 rounded-lg border text-xs font-bold tabular-nums outline-none"
                    style={{
                      backgroundColor: palette.panelBg,
                      borderColor: palette.inputBorder,
                      color: palette.textPrimary,
                    }}
                  />
                  <input
                    type="password"
                    placeholder="Clave admin"
                    value={discountAuthPinInput}
                    onChange={(e) => {
                      setDiscountAuthPinInput(e.target.value);
                      setDiscountError(null);
                    }}
                    className="px-2.5 py-1.5 rounded-lg border text-xs font-bold tabular-nums outline-none"
                    style={{
                      backgroundColor: palette.panelBg,
                      borderColor: palette.inputBorder,
                      color: palette.textPrimary,
                    }}
                  />
                </div>
                <button
                  type="button"
                  onClick={handleApplyInvoiceDiscount}
                  className="w-full py-1.5 rounded-lg text-[11px] font-extrabold transition cursor-pointer"
                  style={{ backgroundColor: '#1D4ED8', color: '#FFFFFF' }}
                >
                  Aplicar descuento con clave admin
                </button>
                {discountError && (
                  <p className="text-[10px] font-extrabold" style={{ color: '#DC2626' }}>
                    {discountError}
                  </p>
                )}
                {discountSuccessMsg && (
                  <p className="text-[10px] font-extrabold" style={{ color: palette.textBlueAccent }}>
                    {discountSuccessMsg}
                  </p>
                )}
              </div>

              <div
                className="rounded-xl p-3 space-y-1 border"
                style={{
                  backgroundColor: palette.footerStripBg,
                  borderColor: palette.footerStripBorder,
                  color: palette.textPrimary,
                }}
              >
                <div
                  className="flex justify-between font-bold"
                  style={{ color: palette.textSecondary }}
                >
                  <span>Subtotal (sin IVA)</span>
                  <span className="tabular-nums">${invoiceBaseTotal.toFixed(2)}</span>
                </div>
                <div
                  className="flex justify-between font-bold"
                  style={{ color: palette.textSecondary }}
                >
                  <span>IVA (16%)</span>
                  <span className="tabular-nums">${invoiceIvaTotal.toFixed(2)}</span>
                </div>
                {appliedDiscountPct > 0 && (
                  <div
                    className="flex justify-between font-extrabold"
                    style={{ color: '#B45309' }}
                  >
                    <span>Descuento ({appliedDiscountPct}%)</span>
                    <span className="tabular-nums">-${invoiceDiscountAmount.toFixed(2)}</span>
                  </div>
                )}
                {isCasheaPaymentActive && casheaFeePct > 0 && (
                  <div
                    className="flex justify-between font-extrabold"
                    style={{ color: '#1D4ED8' }}
                  >
                    <span>Recargo Cashea ({casheaFeePct}%)</span>
                    <span className="tabular-nums">+${casheaFeeAmount.toFixed(2)}</span>
                  </div>
                )}
                <div
                  className="flex items-center justify-between pt-1.5 border-t"
                  style={{ borderColor: palette.cardBorder }}
                >
                  <span
                    className="font-extrabold uppercase text-[11px]"
                    style={{ color: palette.textPrimary }}
                  >
                    Total a Cobrar
                  </span>
                  <span
                    className="text-xl font-black tabular-nums"
                    style={{ color: palette.priceColor }}
                  >
                    ${invoiceFinalTotal.toFixed(2)}
                  </span>
                </div>
                {invoiceCurrency !== 'USD' && selectedCurrencyObj && (
                  <div
                    className="flex justify-between font-extrabold"
                    style={{ color: palette.textBlueAccent }}
                  >
                    <span>Total en {selectedCurrencyObj.code}</span>
                    <span className="tabular-nums">
                      {selectedCurrencyObj.symbol} {(invoiceFinalTotal * (selectedCurrencyObj.rateToUsd || 1)).toFixed(2)}
                    </span>
                  </div>
                )}
                {activeRateCurrency && !activeRateCurrency.isBase && activeRateCurrency.code !== invoiceCurrency && (
                  <div
                    className="flex justify-between font-extrabold"
                    style={{ color: palette.textBlueAccent }}
                  >
                    <span>Ref. {activeRateCurrency.code}</span>
                    <span className="tabular-nums">
                      {activeRateSymbol} {(invoiceFinalTotal * activeRateValue).toFixed(2)}
                    </span>
                  </div>
                )}
              </div>

              {/* Crédito / Fiado protegido por Clave de Administrador */}
              <div
                className="rounded-xl p-2.5 space-y-2 border"
                style={{
                  backgroundColor: palette.inputBg,
                  borderColor: '#D97706',
                }}
              >
                <label className="flex items-center justify-between gap-2 cursor-pointer">
                  <span className="inline-flex items-center gap-1.5 text-[11px] font-extrabold" style={{ color: '#B45309' }}>
                    <ShieldCheck className="w-3.5 h-3.5 shrink-0" />
                    <span>Factura a Crédito / Fiado (Clave Admin)</span>
                  </span>
                  <input
                    type="checkbox"
                    checked={isCreditSale}
                    onChange={(e) => handleToggleCreditSale(e.target.checked)}
                    className="rounded cursor-pointer"
                  />
                </label>

                {creditAuthNotice && (
                  <p className="text-[10px] font-extrabold" style={{ color: '#1D4ED8' }}>
                    {creditAuthNotice}
                  </p>
                )}

                {isCreditSale && (
                  <div className="space-y-2 pt-1.5 border-t" style={{ borderColor: palette.cardBorder }}>
                    {!creditAuthorized ? (
                      <div className="space-y-1.5">
                        <p className="text-[10px] font-extrabold" style={{ color: '#B45309' }}>
                          Ingresa clave de administrador para autorizar el crédito:
                        </p>
                        <div className="flex items-center gap-1.5">
                          <input
                            type="password"
                            value={creditAdminPinInput}
                            onChange={(e) => {
                              setCreditAdminPinInput(e.target.value);
                              if (creditInlineError) setCreditInlineError(null);
                            }}
                            placeholder="Clave administrador"
                            className="flex-1 px-2.5 py-1 rounded-lg border text-xs font-bold outline-none"
                            style={{
                              backgroundColor: palette.panelBg,
                              borderColor: palette.inputBorder,
                              color: palette.textPrimary,
                            }}
                          />
                          <button
                            type="button"
                            onClick={handleVerifyInlineCreditPin}
                            className="px-2.5 py-1 rounded-lg text-[10px] font-extrabold cursor-pointer"
                            style={{ backgroundColor: '#B45309', color: '#FFFFFF' }}
                          >
                            Autorizar
                          </button>
                        </div>
                        {creditInlineError && (
                          <p className="text-[10px] font-extrabold" style={{ color: '#DC2626' }}>
                            {creditInlineError}
                          </p>
                        )}
                      </div>
                    ) : (
                      <>
                        <div className="flex items-center justify-between gap-2 text-[11px]">
                          <span style={{ color: palette.textSecondary }}>Abono inicial ($):</span>
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            max={invoiceFinalTotal}
                            value={creditInitialPaidDraft}
                            onChange={(e) => setCreditInitialPaidDraft(e.target.value)}
                            className="w-24 px-2 py-1 rounded-lg border text-xs font-bold tabular-nums outline-none"
                            style={{
                              backgroundColor: palette.panelBg,
                              borderColor: palette.inputBorder,
                              color: palette.textPrimary,
                            }}
                          />
                        </div>
                        <div className="flex items-center justify-between text-[11px] font-extrabold" style={{ color: '#B45309' }}>
                          <span>Saldo pendiente:</span>
                          <span className="tabular-nums">
                            ${Math.max(0, invoiceFinalTotal - (parseFloat(creditInitialPaidDraft) || 0)).toFixed(2)}
                          </span>
                        </div>
                      </>
                    )}
                  </div>
                )}
              </div>

              {/* Devolución de Factura y Nota de Crédito con Clave Admin */}
              <div
                className="rounded-xl p-2.5 space-y-2 border"
                style={{
                  backgroundColor: palette.inputBg,
                  borderColor: '#DC2626',
                }}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="inline-flex items-center gap-1.5 text-[11px] font-extrabold" style={{ color: '#DC2626' }}>
                    <ShieldCheck className="w-3.5 h-3.5 shrink-0" />
                    <span>Devolución / Nota de Crédito (Clave Admin)</span>
                  </span>
                </div>

                <select
                  value={returnSaleId || (state?.sales?.[0]?.id ?? '')}
                  onChange={(e) => {
                    setReturnSaleId(e.target.value);
                    if (returnError) setReturnError(null);
                  }}
                  className="w-full px-2 py-1 rounded-lg border text-[11px] font-bold outline-none"
                  style={{
                    backgroundColor: palette.panelBg,
                    borderColor: palette.inputBorder,
                    color: palette.textPrimary,
                  }}
                >
                  {(state?.sales || []).length === 0 ? (
                    <option value="">Sin facturas emitidas</option>
                  ) : (
                    (state?.sales || []).slice(0, 30).map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.reference || s.id} · {s.customerOrNote || 'Cliente General'} (${Number(s.total || 0).toFixed(2)})
                      </option>
                    ))
                  )}
                </select>

                <div className="flex items-center gap-1.5">
                  <input
                    type="password"
                    value={returnAdminPin}
                    onChange={(e) => {
                      setReturnAdminPin(e.target.value);
                      if (returnError) setReturnError(null);
                    }}
                    placeholder="Clave admin"
                    className="flex-1 px-2 py-1 rounded-lg border text-xs font-bold outline-none"
                    style={{
                      backgroundColor: palette.panelBg,
                      borderColor: palette.inputBorder,
                      color: palette.textPrimary,
                    }}
                  />
                  <button
                    type="button"
                    onClick={handleEmitCreditNoteReturn}
                    className="px-2.5 py-1 rounded-lg text-[10px] font-extrabold cursor-pointer whitespace-nowrap"
                    style={{ backgroundColor: '#DC2626', color: '#FFFFFF' }}
                  >
                    Emitir Nota Crédito
                  </button>
                </div>

                {returnError && (
                  <p className="text-[10px] font-extrabold" style={{ color: '#DC2626' }}>
                    {returnError}
                  </p>
                )}
                {returnNotice && (
                  <p className="text-[10px] font-extrabold" style={{ color: '#059669' }}>
                    {returnNotice}
                  </p>
                )}
              </div>

              <button
                type="submit"
                disabled={invoiceItems.length === 0 || (isCreditSale && !creditAuthorized)}
                className="w-full py-2.5 rounded-xl font-extrabold text-xs tracking-wide transition cursor-pointer disabled:opacity-50"
                style={{ backgroundColor: isCreditSale ? '#B45309' : '#1D4ED8', color: '#FFFFFF' }}
              >
                {isCreditSale
                  ? creditAuthorized
                    ? `Emitir Factura a Crédito / Fiado ($${invoiceFinalTotal.toFixed(2)})`
                    : `Requiere Clave Admin para Crédito ($${invoiceFinalTotal.toFixed(2)})`
                  : `Cobrar Factura ($${invoiceFinalTotal.toFixed(2)})`}
              </button>
            </div>
          </form>
        </div>
      </div>

      {pendingSwitchOp && state && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ backgroundColor: 'rgba(15, 23, 42, 0.65)' }}
        >
          <div
            className="w-full max-w-sm rounded-2xl border p-4 space-y-3 shadow-2xl"
            style={{
              backgroundColor: palette.panelBg,
              borderColor: palette.panelBorder,
              color: palette.textPrimary,
            }}
          >
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-extrabold">
                Cambiar a {pendingSwitchOp.operatorName} ({pendingSwitchOp.role})
              </h3>
              <button
                type="button"
                onClick={() => {
                  setPendingSwitchOp(null);
                  setSwitchOpPinInput('');
                  setSwitchOpError(null);
                }}
                className="p-1 rounded-lg cursor-pointer"
                style={{ color: palette.textSecondary }}
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="text-[11px]" style={{ color: palette.textSecondary }}>
              Ingresa la clave de acceso para activar este operador en Ventas:
            </p>
            <input
              type="password"
              autoFocus
              onMouseDown={(e) => {
                e.stopPropagation();
                e.currentTarget.focus();
              }}
              onClick={(e) => {
                e.stopPropagation();
                e.currentTarget.focus();
              }}
              value={switchOpPinInput}
              onChange={(e) => {
                setSwitchOpPinInput(e.target.value);
                if (switchOpError) setSwitchOpError(null);
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  const entered = switchOpPinInput.trim();
                  const opPin = (pendingSwitchOp.pin || '').trim();
                  const isAdm =
                    String(pendingSwitchOp.role || '') === 'Administrador' ||
                    String(pendingSwitchOp.role || '') === 'Admin';
                  const valid = opPin ? entered === opPin || (isAdm && validateAdminSecret(entered)) : isAdm ? validateAdminSecret(entered) : true;
                  if (valid) {
                    persistState({ ...state, currentOperatorId: pendingSwitchOp.id });
                    setPosScanFeedback(`Operador activo cambiado a: ${pendingSwitchOp.operatorName}`);
                    setPendingSwitchOp(null);
                    setSwitchOpPinInput('');
                    setSwitchOpError(null);
                  } else {
                    setSwitchOpError('Clave incorrecta para este operador.');
                  }
                }
              }}
              placeholder="Clave del operador / administrador"
              className="w-full px-3 py-2 rounded-lg border text-xs font-bold outline-none"
              style={{
                backgroundColor: palette.inputBg,
                borderColor: palette.inputBorder,
                color: palette.textPrimary,
              }}
            />
            {switchOpError && (
              <p className="text-[10px] font-extrabold" style={{ color: '#DC2626' }}>
                {switchOpError}
              </p>
            )}
            <div className="flex justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => {
                  setPendingSwitchOp(null);
                  setSwitchOpPinInput('');
                  setSwitchOpError(null);
                }}
                className="px-3 py-1.5 rounded-lg text-[11px] font-bold border cursor-pointer"
                style={{
                  backgroundColor: palette.inputBg,
                  borderColor: palette.inputBorder,
                  color: palette.textPrimary,
                }}
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => {
                  const entered = switchOpPinInput.trim();
                  const opPin = (pendingSwitchOp.pin || '').trim();
                  const isAdm =
                    String(pendingSwitchOp.role || '') === 'Administrador' ||
                    String(pendingSwitchOp.role || '') === 'Admin';
                  const valid = opPin ? entered === opPin || (isAdm && validateAdminSecret(entered)) : isAdm ? validateAdminSecret(entered) : true;
                  if (valid) {
                    persistState({ ...state, currentOperatorId: pendingSwitchOp.id });
                    setPosScanFeedback(`Operador activo cambiado a: ${pendingSwitchOp.operatorName}`);
                    setPendingSwitchOp(null);
                    setSwitchOpPinInput('');
                    setSwitchOpError(null);
                  } else {
                    setSwitchOpError('Clave incorrecta para este operador.');
                  }
                }}
                className="px-3 py-1.5 rounded-lg text-[11px] font-extrabold cursor-pointer"
                style={{ backgroundColor: '#1D4ED8', color: '#FFFFFF' }}
              >
                Confirmar operador
              </button>
            </div>
          </div>
        </div>
      )}

      <AdminAuthModal
        abierto={creditAuthModalOpen}
        motivo="Autorización de Administrador requerida para habilitar Crédito / Fiado"
        clavesAdicionales={authorizedAdminPins}
        onCerrar={() => {
          setCreditAuthModalOpen(false);
          setIsCreditSale(false);
          setCreditAuthNotice('Crédito / Fiado cancelado: se requiere clave de administrador.');
        }}
        onExito={() => {
          setCreditAuthModalOpen(false);
          setCreditAuthorized(true);
          setIsCreditSale(true);
          setCreditAuthNotice('Crédito / Fiado autorizado por Administrador.');
        }}
      />

      {paymentModalOpen && state && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ backgroundColor: 'rgba(15, 23, 42, 0.7)' }}
        >
          {(() => {
            const hasActiveRate = Boolean(activeRateCurrency && !activeRateCurrency.isBase && activeRateValue > 0);
            const enteredNum = parseFloat(tenderedAmountDraft);
            const safeEntered = !isNaN(enteredNum) && enteredNum >= 0 ? enteredNum : 0;
            const paidInUsd =
              tenderedCurrencyMode === 'ACTIVE' && hasActiveRate
                ? safeEntered / activeRateValue
                : safeEntered;
            const changeUsd = Math.max(0, Number((paidInUsd - invoiceFinalTotal).toFixed(2)));
            const changeInActive = hasActiveRate ? Number((changeUsd * activeRateValue).toFixed(2)) : 0;
            const isInsufficient = paidInUsd + 0.0001 < invoiceFinalTotal;

            return (
              <div
                className="w-full max-w-md rounded-2xl border p-5 space-y-4 shadow-2xl"
                style={{
                  backgroundColor: palette.panelBg,
                  borderColor: palette.panelBorder,
                  color: palette.textPrimary,
                }}
              >
                <div className="flex items-center justify-between border-b pb-3" style={{ borderColor: palette.cardBorder }}>
                  <div>
                    <h3 className="text-sm font-extrabold">Cobro de Factura y Cálculo de Vuelto</h3>
                    <p className="text-[11px]" style={{ color: palette.textSecondary }}>
                      Ingresa el monto con el que paga el cliente para calcular el vuelto.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setPaymentModalOpen(false);
                      setPaymentModalError(null);
                    }}
                    className="p-1 rounded-lg cursor-pointer"
                    style={{ color: palette.textSecondary }}
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <div
                  className="rounded-xl p-3 space-y-1.5 border text-xs"
                  style={{ backgroundColor: palette.inputBg, borderColor: palette.cardBorder }}
                >
                  <div className="flex items-center justify-between font-extrabold">
                    <span>Total a Cobrar (USD):</span>
                    <span className="tabular-nums text-sm">${invoiceFinalTotal.toFixed(2)}</span>
                  </div>
                  {hasActiveRate && activeRateCurrency && (
                    <div className="flex items-center justify-between font-bold" style={{ color: palette.textBlueAccent }}>
                      <span>Referencia ({activeRateCurrency.code}):</span>
                      <span className="tabular-nums">
                        {activeRateSymbol} {(invoiceFinalTotal * activeRateValue).toFixed(2)}
                      </span>
                    </div>
                  )}
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <label className="text-xs font-extrabold">Monto con el que paga el cliente</label>
                    {hasActiveRate && activeRateCurrency && (
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => {
                            setTenderedCurrencyMode('USD');
                            setTenderedAmountDraft(invoiceFinalTotal.toFixed(2));
                            setPaymentModalError(null);
                          }}
                          className="px-2 py-0.5 rounded-md text-[10px] font-extrabold border cursor-pointer"
                          style={{
                            backgroundColor: tenderedCurrencyMode === 'USD' ? '#1D4ED8' : palette.panelBg,
                            color: tenderedCurrencyMode === 'USD' ? '#FFFFFF' : palette.textPrimary,
                            borderColor: palette.inputBorder,
                          }}
                        >
                          USD ($)
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setTenderedCurrencyMode('ACTIVE');
                            setTenderedAmountDraft((invoiceFinalTotal * activeRateValue).toFixed(2));
                            setPaymentModalError(null);
                          }}
                          className="px-2 py-0.5 rounded-md text-[10px] font-extrabold border cursor-pointer"
                          style={{
                            backgroundColor: tenderedCurrencyMode === 'ACTIVE' ? '#1D4ED8' : palette.panelBg,
                            color: tenderedCurrencyMode === 'ACTIVE' ? '#FFFFFF' : palette.textPrimary,
                            borderColor: palette.inputBorder,
                          }}
                        >
                          {activeRateCurrency.code} ({activeRateSymbol})
                        </button>
                      </div>
                    )}
                  </div>

                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    autoFocus
                    value={tenderedAmountDraft}
                    onChange={(e) => {
                      setTenderedAmountDraft(e.target.value);
                      if (paymentModalError) setPaymentModalError(null);
                    }}
                    placeholder="0.00"
                    className="w-full px-3 py-2 rounded-xl border text-sm font-extrabold tabular-nums outline-none"
                    style={{
                      backgroundColor: palette.inputBg,
                      borderColor: palette.inputBorder,
                      color: palette.textPrimary,
                    }}
                  />
                </div>

                <div
                  className="rounded-xl p-3 space-y-1 border"
                  style={{
                    backgroundColor: isInsufficient ? 'rgba(220,38,38,0.08)' : 'rgba(5,150,105,0.1)',
                    borderColor: isInsufficient ? '#DC2626' : '#059669',
                  }}
                >
                  <div className="flex items-center justify-between text-xs font-extrabold">
                    <span style={{ color: isInsufficient ? '#DC2626' : '#059669' }}>
                      {isInsufficient ? 'Monto insuficiente (faltante):' : 'Vuelto a entregar (USD):'}
                    </span>
                    <span
                      className="tabular-nums text-sm"
                      style={{ color: isInsufficient ? '#DC2626' : '#059669' }}
                    >
                      ${isInsufficient ? (invoiceFinalTotal - paidInUsd).toFixed(2) : changeUsd.toFixed(2)}
                    </span>
                  </div>
                  {!isInsufficient && hasActiveRate && activeRateCurrency && (
                    <div className="flex items-center justify-between text-[11px] font-extrabold" style={{ color: '#059669' }}>
                      <span>Vuelto en {activeRateCurrency.code}:</span>
                      <span className="tabular-nums">
                        {activeRateSymbol} {changeInActive.toFixed(2)}
                      </span>
                    </div>
                  )}
                </div>

                {paymentModalError && (
                  <p className="text-[11px] font-extrabold" style={{ color: '#DC2626' }}>
                    {paymentModalError}
                  </p>
                )}

                <div className="flex items-center justify-end gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => {
                      setPaymentModalOpen(false);
                      setPaymentModalError(null);
                    }}
                    className="px-3.5 py-2 rounded-xl text-xs font-bold border cursor-pointer"
                    style={{
                      backgroundColor: palette.inputBg,
                      borderColor: palette.inputBorder,
                      color: palette.textPrimary,
                    }}
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (isInsufficient) {
                        setPaymentModalError('El monto con el que paga el cliente es menor al total a cobrar.');
                        return;
                      }
                      setPaymentModalOpen(false);
                      setPaymentModalError(null);
                      setBypassPaymentModalOnce(true);
                      window.setTimeout(() => {
                        invoiceFormRef.current?.requestSubmit();
                      }, 10);
                    }}
                    className="px-4 py-2 rounded-xl text-xs font-extrabold cursor-pointer"
                    style={{ backgroundColor: '#059669', color: '#FFFFFF' }}
                  >
                    Confirmar Cobro y Facturar
                  </button>
                </div>
              </div>
            );
          })()}
        </div>
      )}
    </div>
  );
}
