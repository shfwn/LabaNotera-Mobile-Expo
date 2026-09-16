import { SQLiteDatabase } from 'expo-sqlite';
import { FinancialReportSummary, DailyFinancialSummary } from '../types';

export function getTodayDateString(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export async function getDailyFinancialSummary(
  db: SQLiteDatabase,
  dateStr?: string
): Promise<DailyFinancialSummary> {
  const targetDate = dateStr || getTodayDateString();

  // Daily Sales & Cost (HPP)
  const salesSummary = await db.getFirstAsync<{
    today_revenue: number | null;
    today_cost: number | null;
    trx_count: number;
  }>(
    `SELECT 
       SUM(CASE 
             WHEN payment_method = 'UTANG' THEN COALESCE(cash_paid, 0)
             WHEN payment_method = 'CASH+UTANG' THEN COALESCE(cash_paid, 0)
             ELSE total_amount 
           END) as today_revenue, 
       SUM(total_cost) as today_cost,
       COUNT(*) as trx_count
     FROM transactions 
     WHERE status = 'SUCCESS' AND (created_at LIKE ? OR date(created_at, 'localtime') = date(?))`,
    [`${targetDate}%`, targetDate]
  );

  const todayRevenue = salesSummary?.today_revenue || 0;
  const todayHPP = salesSummary?.today_cost || 0;
  const todayGrossProfit = todayRevenue - todayHPP;
  const todayTransactionCount = salesSummary?.trx_count || 0;

  // Daily Consignment Owed calculation (Barang Titipan terjual hari ini)
  const consignmentRes = await db.getFirstAsync<{ today_owed: number | null }>(
    `SELECT SUM(ti.qty * ti.buy_price) as today_owed 
     FROM transaction_items ti
     JOIN products p ON ti.product_id = p.id
     JOIN transactions t ON ti.transaction_id = t.id
     WHERE p.is_consignment = 1 
       AND t.status = 'SUCCESS'
       AND (t.created_at LIKE ? OR date(t.created_at, 'localtime') = date(?))`,
    [`${targetDate}%`, targetDate]
  );
  const todayConsignmentOwed = consignmentRes?.today_owed || 0;

  return {
    todayRevenue,
    todayGrossProfit,
    todayConsignmentOwed,
    todayTransactionCount,
  };
}

export async function getFinancialSummary(db: SQLiteDatabase): Promise<FinancialReportSummary> {
  // Total Revenue (Uang Diterima dari Penjualan) & Total Cost (HPP) from SUCCESS transactions
  const salesSummary = await db.getFirstAsync<{
    total_revenue: number | null;
    total_cost: number | null;
    trx_count: number;
  }>(
    `SELECT 
       SUM(CASE 
             WHEN payment_method = 'UTANG' THEN COALESCE(cash_paid, 0)
             WHEN payment_method = 'CASH+UTANG' THEN COALESCE(cash_paid, 0)
             ELSE total_amount 
           END) as total_revenue, 
       SUM(total_cost) as total_cost,
       COUNT(*) as trx_count
     FROM transactions 
     WHERE status = 'SUCCESS'`
  );

  const totalRevenue = salesSummary?.total_revenue || 0;
  const totalHPP = salesSummary?.total_cost || 0;
  const grossProfit = totalRevenue - totalHPP;
  const transactionCount = salesSummary?.trx_count || 0;

  // Total Prive (Uang Dapur / Pengambilan Pribadi)
  const priveRes = await db.getFirstAsync<{ total_prive: number | null }>(
    `SELECT SUM(amount) as total_prive FROM prive_expenses WHERE type = 'PRIVE'`
  );
  const totalPrive = priveRes?.total_prive || 0;

  // Total Operational Expense (Biaya Warung)
  const expenseRes = await db.getFirstAsync<{ total_expense: number | null }>(
    `SELECT SUM(amount) as total_expense FROM prive_expenses WHERE type = 'EXPENSE'`
  );
  const totalExpense = expenseRes?.total_expense || 0;

  // Total Belanja Stok / Kulakan dari Laci Kasir
  const restockRes = await db.getFirstAsync<{ total_restock: number | null }>(
    `SELECT SUM(amount) as total_restock FROM prive_expenses WHERE type = 'RESTOCK'`
  );
  const totalRestock = restockRes?.total_restock || 0;

  // Net Profit (Laba Bersih Warung = Laba Kotor - Uang Dapur - Biaya Warung)
  const netProfit = grossProfit - totalPrive - totalExpense;

  // Consignment Owed calculation (Barang Titipan yang sudah laku terjual dari transaksi SUCCESS)
  const consignmentRes = await db.getFirstAsync<{ total_owed: number | null }>(
    `SELECT SUM(ti.qty * ti.buy_price) as total_owed 
     FROM transaction_items ti
     JOIN products p ON ti.product_id = p.id
     JOIN transactions t ON ti.transaction_id = t.id
     WHERE p.is_consignment = 1 AND t.status = 'SUCCESS'`
  );
  const totalConsignmentOwed = consignmentRes?.total_owed || 0;

  // Total Customer Active Debt (Total Piutang Belum Lunas)
  const debtRes = await db.getFirstAsync<{ total_debt: number | null }>(
    `SELECT SUM(remaining_debt) as total_debt FROM debts WHERE status != 'PAID'`
  );
  const totalDebtRemaining = debtRes?.total_debt || 0;

  return {
    totalRevenue,
    totalHPP,
    grossProfit,
    totalPrive,
    totalExpense,
    totalRestock,
    netProfit,
    totalConsignmentOwed,
    transactionCount,
    totalDebtRemaining,
  };
}

