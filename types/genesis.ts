export type BlockType =
  | 'kpi_balance'
  | 'kpi_income'
  | 'kpi_expense'
  | 'chart_categories'
  | 'table_transactions';

export type OperationsSubSection =
  | 'ventas'
  | 'productos'
  | 'proveedores'
  | 'clientes_afiliados'
  | 'cierre_de_caja'
  | 'cuentas_de_operadores'
  | 'monedas'
  | 'tasa_de_cambio'
  | 'tipo_de_pago'
  | 'factura'
  | 'gastos_generales'
  | 'categoria_de_productos'
  | 'auditoria_general'
  | 'cuentas_por_cobrar'
  | 'cuentas_por_pagar';

export type PaymentAccountCategory =
  | 'Cuenta Principal'
  | 'Billetera Digital'
  | 'Efectivo';

export type CashKindOption = 'Efectivo Bolívares' | 'Efectivo Divisa';

export type RolUsuario = 'operador' | 'administrador';

export interface Account {
  id: string;
  name: string;
  type: 'checking' | 'wallet' | 'credit' | 'cash';
  initialBalance: number;
}

export interface Category {
  id: string;
  name: string;
  color: string;
}

export interface Transaction {
  id: string;
  date: string;
  merchant: string;
  amount: number; // positivo = ingreso, negativo = gasto
  categoryId: string;
  accountId: string;
}

export interface DashboardBlock {
  id: string;
  type: BlockType;
  title: string;
  span: 1 | 2;
}

export interface DashboardPage {
  id: string;
  title: string;
  blocks: DashboardBlock[];
}

export interface AiRule {
  id: string;
  keyword: string;
  categoryId: string;
}

export interface SaleInvoiceItem {
  productId: string;
  sku: string;
  barcode: string;
  name: string;
  unitPrice: number;
  quantity: number;
  hasIva?: boolean;
}

export interface AffiliatedCustomer {
  id: string;
  fullName: string;
  taxOrId: string; // Cédula / RIF / Identificación
  address: string;
  phone: string;
  createdAt?: string;
}

export interface SaleRecord {
  id: string;
  date: string;
  reference: string;
  customerOrNote: string;
  paymentType: string;
  cashType?: CashKindOption;
  currency: string;
  total: number;
  isCredit?: boolean;
  creditStatus?: 'Pendiente' | 'Pagado';
  amountPaid?: number;
  balanceDue?: number;
  discountPercent?: number;
  discountAmount?: number;
  items?: SaleInvoiceItem[];
  customerDetails?: {
    isCustom: boolean;
    fullName: string;
    taxOrId?: string;
    address?: string;
    phone?: string;
  };
}

export interface ProductItem {
  id: string;
  sku: string;
  barcode: string;
  name: string;
  category: string;
  costPrice: number; // Precio de costo (USD base)
  price: number;     // Precio de venta (USD base)
  hasIva?: boolean;  // Si aplica IVA (16% por defecto al cargar/facturar)
  stock: number;
  imageUrl: string;
  accentColor: string;
}

export interface SupplierItem {
  id: string;
  name: string;
  contact: string;
  category: string;
  balanceDue: number;
}

export interface GeneralExpenseItem {
  id: string;
  date: string;
  reason: string;
  invoiceNumber: string;
  amount: number;
  supplierOrBeneficiary?: string;
  paymentMethod?: string;
  accountId?: string;
  notes?: string;
}

export interface CashClosingRecord {
  id: string;
  date: string;
  operator: string;
  openingCash: number;
  expectedCash: number;
  countedCash: number;
  status: 'Cuadrado' | 'Diferencia';
}

export type OperatorRoleType = 'Administrador' | 'Gerente' | 'Operador';

export type OperatorPermissionKey =
  | 'dashboard'
  | 'ventas'
  | 'productos'
  | 'proveedores'
  | 'clientes_afiliados'
  | 'cierre_de_caja'
  | 'cuentas_de_operadores'
  | 'monedas'
  | 'tasa_de_cambio'
  | 'tipo_de_pago'
  | 'factura'
  | 'gastos_generales'
  | 'categoria_de_productos'
  | 'auditoria_general'
  | 'cuentas_por_cobrar'
  | 'cuentas_por_pagar';

export interface OperatorAccountItem {
  id: string;
  operatorName: string;
  role: OperatorRoleType;
  assignedAccount?: string;
  active: boolean;
  permissions: OperatorPermissionKey[];
  pin?: string;
}

export interface CurrencyItem {
  id: string;
  code: string;
  name: string;
  symbol: string;
  rateToUsd: number;
  isBase?: boolean;
}

export interface PaymentMethodItem {
  id: string;
  name: string;
  channel: string;
  feePercent: number;
  active: boolean;
  accountCategory?: PaymentAccountCategory;
}

export interface InvoiceTemplateConfig {
  businessName: string;
  taxId: string; // RIF / NIT / Identificación fiscal
  phone: string;
  email: string;
  address: string;
  headerNote: string; // Texto / membrete de inicio de factura
  footerNote: string; // Texto / nota final de factura
  bankAccountInfo?: string; // Cuenta bancaria / Pago Móvil / Datos de transferencia
  socialMediaInfo?: string; // Redes sociales / WhatsApp / Web
  paymentTermsInfo?: string; // Condiciones de pago / validez / observaciones
  showTaxId: boolean;
  showAddress: boolean;
  showContact: boolean;
  showExtraFooterOnCarta?: boolean;
  paperWidth: '80mm' | 'carta';
}

export interface GenesisState {
  accounts: Account[];
  categories: Category[];
  transactions: Transaction[];
  pages: DashboardPage[];
  activePageId: string;
  rules: AiRule[];
  darkMode: boolean;
  operationsSection: OperationsSubSection;
  activeRateCurrencyCode: string;
  sales: SaleRecord[];
  products: ProductItem[];
  suppliers: SupplierItem[];
  generalExpenses: GeneralExpenseItem[];
  cashClosings: CashClosingRecord[];
  operatorAccounts: OperatorAccountItem[];
  currencies: CurrencyItem[];
  paymentMethods: PaymentMethodItem[];
  affiliatedCustomers: AffiliatedCustomer[];
  invoiceTemplate: InvoiceTemplateConfig;
  currentOperatorId?: string;
  adminDiscountPin?: string;
  productCategories?: string[];
  auditLog?: AuditEntry[];
  creditNotes?: CreditNoteRecord[];
  receivables?: ReceivableAccountItem[];
  payables?: PayableAccountItem[];
}


export interface AuditEntry {
  id: string;
  correlative: string;
  timestamp: string;
  dateOnly: string; // YYYY-MM-DD
  operatorName: string;
  operatorRole: string;
  module: string;
  actionType: string;
  reference?: string;
  summary: string;
  beforeValue?: string;
  afterValue?: string;
  immutable: true;
}

export interface CreditNoteItem {
  productId: string;
  sku: string;
  name: string;
  quantityReturned: number;
  unitPrice: number;
  lineTotal: number;
  restock: boolean;
}

export interface CreditNoteRecord {
  id: string;
  creditNoteNumber: string;
  originalSaleId: string;
  originalReference: string;
  date: string;
  operatorName: string;
  reason: string;
  currency: string;
  totalAmount: number;
  items: CreditNoteItem[];
}

export interface ReceivablePaymentRecord {
  id: string;
  date: string;
  amount: number;
  paymentMethod: string;
  accountId: string;
  note?: string;
  earlyPayment?: boolean;
}

export interface ReceivableAccountItem {
  id: string;
  createdAt: string;
  dueDate: string;
  customerName: string;
  customerTaxOrId?: string;
  reference: string;
  channelOrAccount: string;
  currency: string;
  totalAmount: number;
  paidAmount: number;
  balanceDue: number;
  status: 'Pendiente' | 'Parcial' | 'Vencida' | 'Pagada';
  notes?: string;
  payments: ReceivablePaymentRecord[];
}

export interface PayablePaymentRecord {
  id: string;
  date: string;
  amount: number;
  paymentMethod: string;
  accountId: string;
  note?: string;
  earlyPayment?: boolean;
}

export interface PayableAccountItem {
  id: string;
  createdAt: string;
  dueDate: string;
  supplierName: string;
  reference: string;
  channelOrAccount: string;
  currency: string;
  totalAmount: number;
  paidAmount: number;
  balanceDue: number;
  status: 'Pendiente' | 'Parcial' | 'Vencida' | 'Pagada';
  notes?: string;
  payments: PayablePaymentRecord[];
}
