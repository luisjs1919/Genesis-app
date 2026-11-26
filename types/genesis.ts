export type OperationsSubSection =
  | 'OVERVIEW'
  | 'POS'
  | 'INVENTORY'
  | 'SUPPLIERS'
  | 'RECEIVABLES'
  | 'EXPENSES'
  | 'REPORTS'
  | 'ACCOUNTING'
  | 'SENIAT'
  | 'SETTINGS';

export type PaymentMethod =
  | 'PAGO_MOVIL'
  | 'TRANSFERENCIA_BS'
  | 'EFECTIVO_USD'
  | 'EFECTIVO_BS'
  | 'PUNTO_VENTA'
  | 'ZELLE'
  | string;

export interface ProductItem {
  id: string;
  sku?: string;
  barcode?: string;
  name: string;
  category?: string;
  brand?: string;
  supplierName?: string;
  costUsd?: number;
  priceUsd: number;
  taxRate?: number;
  stock: number;
  minStock?: number;
  [key: string]: any;
}

export interface AuditEntry {
  id: string;
  timestamp: string;
  operatorName?: string;
  role?: string;
  action: string;
  detail: string;
}

export interface SaleRecord {
  id: string;
  invoiceNumber?: string;
  date: string;
  customerName?: string;
  customerRif?: string;
  subtotalUsd?: number;
  taxUsd?: number;
  igtfUsd?: number;
  totalUsd: number;
  totalBs?: number;
  rate?: number;
  paymentMethod?: PaymentMethod;
  status?: string;
  items?: any[];
  [key: string]: any;
}

export interface GeneralExpenseItem {
  id: string;
  date: string;
  category?: string;
  description: string;
  paymentMethod?: PaymentMethod;
  amountUsd: number;
  reference?: string;
  status?: string;
  [key: string]: any;
}

export interface Transaction {
  id: string;
  date: string;
  description: string;
  category?: string;
  type: 'income' | 'expense' | string;
  amountUsd: number;
  paymentMethod?: PaymentMethod;
  status?: string;
  [key: string]: any;
}

export interface CustomerRecord {
  id: string;
  name: string;
  rif?: string;
  phone?: string;
  email?: string;
  address?: string;
  [key: string]: any;
}

export interface SupplierRecord {
  id: string;
  rif?: string;
  name: string;
  contact?: string;
  phone?: string;
  email?: string;
  category?: string;
  creditDays?: number;
  balanceUsd?: number;
  [key: string]: any;
}

export interface ReceivableItem {
  id: string;
  customerName: string;
  customerRif?: string;
  invoiceNumber?: string;
  date: string;
  dueDate?: string;
  totalUsd: number;
  paidUsd: number;
  status?: string;
  [key: string]: any;
}

export interface PayableItem {
  id: string;
  supplierName: string;
  supplierRif?: string;
  invoiceNumber?: string;
  date: string;
  dueDate?: string;
  totalUsd: number;
  paidUsd: number;
  status?: string;
  [key: string]: any;
}

export interface CreditNoteRecord {
  id: string;
  creditNoteNumber?: string;
  invoiceNumber?: string;
  date: string;
  customerName?: string;
  customerRif?: string;
  reason?: string;
  totalUsd: number;
  [key: string]: any;
}

export interface GenesisState {
  [key: string]: any;
}
