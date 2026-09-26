export type ProductCategory = 'SEMBAKO' | 'KONSUMSI' | 'SANITASI' | 'DIGITAL_KOMODITAS';

export interface Product {
  id: number;
  barcode?: string | null;
  name: string;
  buy_price: number;
  sell_price: number;
  stock: number;
  is_consignment: number; // 0: Normal product, 1: Consignment (Barang Titipan)
  supplier_name?: string | null;
  category?: ProductCategory | string | null;
  is_kg?: number; // 0: Satuan/Pcs biasa, 1: Kiloan/Timbangan (Bisa beli 1/4 kg, dll)
  created_at?: string;
}

export type PaymentMethod = 'CASH' | 'QRIS' | 'UTANG' | 'CASH+UTANG';

export interface Transaction {
  id: number;
  transaction_code: string;
  total_amount: number;
  total_cost: number;
  payment_method: PaymentMethod;
  cash_paid?: number | null;   // Uang tunai yang benar-benar diterima
  debt_amount?: number | null; // Sisa yang dicatat sebagai hutang
  customer_name?: string | null;
  status: 'SUCCESS' | 'CANCELLED';
  created_at: string;
}

export interface TransactionItem {
  id?: number;
  transaction_id?: number;
  product_id: number;
  product_name: string;
  qty: number;
  buy_price: number;
  sell_price: number;
  subtotal: number;
}

export type DebtStatus = 'UNPAID' | 'PARTIAL' | 'PAID';

export interface Debt {
  id: number;
  customer_name: string;
  phone?: string | null;
  total_debt: number;
  remaining_debt: number;
  status: DebtStatus;
  created_at: string;
}

export interface DebtPayment {
  id: number;
  debt_id: number;
  amount_paid: number;
  payment_date: string;
  notes?: string | null;
}

export type ExpenseType = 'PRIVE' | 'EXPENSE' | 'RESTOCK';

export interface PriveExpense {
  id: number;
  type: ExpenseType; // PRIVE: Uang Dapur/Pribadi, EXPENSE: Biaya Operasional, RESTOCK: Belanja Stok Barang
  amount: number;
  note: string;
  date: string;
}

export interface CartItem {
  product: Product;
  qty: number;
}

export interface FinancialReportSummary {
  totalRevenue: number;
  totalHPP: number;
  grossProfit: number;
  totalPrive: number;
  totalExpense: number;
  totalRestock?: number;
  netProfit: number;
  totalItemsSold?: number;
  totalConsignmentOwed?: number;
  transactionCount: number;
  totalDebtRemaining?: number;
}

export interface DailyFinancialSummary {
  todayRevenue: number;
  todayGrossProfit: number;
  todayItemsSold: number;
  todayConsignmentOwed?: number;
  todayTransactionCount: number;
}

export interface ShopProfile {
  id?: number;
  shop_name: string;
  owner_name?: string | null;
  phone?: string | null;
  address?: string | null;
  bank_name?: string | null;
  bank_account_number?: string | null;
  bank_account_holder?: string | null;
  qris_image_uri?: string | null;
  closing_time?: string | null;
  last_report_date?: string | null;
  updated_at?: string;
}

export interface DailyReportProductItem {
  product_name: string;
  category: ProductCategory;
  qty_sold: number;
  is_kg: number;
  is_consignment: number;
  total_revenue: number;
  total_hpp: number;
  total_profit: number;
}

export interface DailyReportTransactionItem {
  id: number;
  transaction_code: string;
  created_at: string;
  payment_method: PaymentMethod;
  customer_name?: string | null;
  total_amount: number;
  total_cost: number;
  gross_profit: number;
  status: 'SUCCESS' | 'CANCELLED';
}

export interface DailyReportExpenseItem {
  id: number;
  type: 'PRIVE' | 'EXPENSE' | 'RESTOCK';
  amount: number;
  note: string;
  date: string;
}

export interface DailyFullReportData {
  targetDate: string;
  formattedDate: string;
  shopProfile: ShopProfile;
  // Financial Overview
  todayRevenue: number;
  todayHPP: number;
  todayGrossProfit: number;
  todayPrive: number;
  todayExpense: number;
  todayRestock: number;
  todayConsignmentOwed: number;
  todayNetProfit: number;
  todayEstimatedCashDrawer: number;
  todayTransactionCount: number;
  todayItemsSold: number;
  // Detail Breakdowns
  productsSold: DailyReportProductItem[];
  transactions: DailyReportTransactionItem[];
  expenses: DailyReportExpenseItem[];
}

