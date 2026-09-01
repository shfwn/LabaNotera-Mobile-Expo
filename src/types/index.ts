export interface Product {
  id: number;
  barcode?: string | null;
  name: string;
  buy_price: number;
  sell_price: number;
  stock: number;
  is_consignment: number; // 0: Normal product, 1: Consignment (Barang Titipan)
  supplier_name?: string | null;
  category?: string | null; // SNACK, MINUMAN, BARANG_POKOK
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

export type ExpenseType = 'PRIVE' | 'EXPENSE';

export interface PriveExpense {
  id: number;
  type: ExpenseType; // PRIVE: Uang Dapur/Pribadi, EXPENSE: Biaya Operasional Warung
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
  netProfit: number;
  totalConsignmentOwed: number;
  transactionCount: number;
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
  updated_at?: string;
}

