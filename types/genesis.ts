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

export interface GenesisState {
  [key: string]: any;
}
