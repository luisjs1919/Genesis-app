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
  | 'SETTINGS'
  | string;

export type BlockType =
  | 'kpi_summary'
  | 'chart_cashflow'
  | 'chart_categories'
  | 'table_transactions'
  | string;

export type PaymentAccountCategory =
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
  operatorName: string;
  role?: string;
  action: string;
  detail: string;
  [key: string]: any;
}

export type GenesisState = Record<string, any>;
export type Transaction = Record<string, any>;
export type DashboardBlock = Record<string, any>;
export type ProductItem = Record<string, any>;
export type SaleInvoiceItem = Record<string, any>;
export type OperatorRoleType = string;
export type OperatorPermissionKey = string;
export type OperatorAccountItem = Record<string, any>;
export type ReceivableAccountItem = Record<string, any>;
export type PayableAccountItem = Record<string, any>;
export type SupplierItem = Record<string, any>;
export type GeneralExpenseItem = Record<string, any>;
