export type PaymentAccountCategory = string;
export type CashKindOption = string;

export type MeasurementUnit = 'und' | 'kg' | 'g' | 'L' | 'ml' | 'm' | 'cm';

export interface ProductItem {
  id: string;
  sku?: string;
  barcode?: string;
  name: string;
  price: number;
  costPrice?: number;
  stock: number;
  unit?: MeasurementUnit;
  category?: string;
  hasIva?: boolean;
  [key: string]: unknown;
}

export interface SaleInvoiceItem {
  productId?: string;
  sku?: string;
  barcode?: string;
  name: string;
  quantity: number;
  unit?: MeasurementUnit;
  baseQuantity?: number;
  unitPrice: number;
  subtotal?: number;
  hasIva?: boolean;
  [key: string]: unknown;
}

export interface SaleRecord {
  id?: string;
  date?: string;
  customerOrNote?: string;
  items?: SaleInvoiceItem[];
  total?: number;
  subtotal?: number;
  [key: string]: unknown;
}

export interface GeneralExpenseItem {
  id?: string;
  date?: string;
  description?: string;
  amount: number;
  category?: string;
  [key: string]: unknown;
}

export interface Transaction {
  id?: string;
  date?: string;
  type?: string;
  merchant?: string;
  amount: number;
  quantity?: number;
  subtotal?: number;
  category?: string;
  [key: string]: unknown;
}

export interface OperatorAccount {
  id: string;
  operatorName?: string;
  role?: string;
  permissions?: string[];
  [key: string]: unknown;
}

export interface GenesisState {
  products: ProductItem[];
  sales?: SaleRecord[];
  transactions?: Transaction[];
  generalExpenses?: GeneralExpenseItem[];
  currentOperatorId?: string;
  operatorAccounts?: OperatorAccount[];
  paymentMethods?: { name: string; [key: string]: unknown }[];
  [key: string]: unknown;
}