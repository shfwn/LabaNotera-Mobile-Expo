import { SQLiteDatabase } from 'expo-sqlite';
import { FinancialReportSummary } from '../types';

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

  // Total Prive (Uang Dapur / Pribadi)
  const priveRes = await db.getFirstAsync<{ total_prive: number | null }>(
    `SELECT SUM(amount) as total_prive FROM prive_expenses WHERE type = 'PRIVE'`
  );
  const totalPrive = priveRes?.total_prive || 0;

  // Total Operational Expense (Biaya Warung)
  const expenseRes = await db.getFirstAsync<{ total_expense: number | null }>(
    `SELECT SUM(amount) as total_expense FROM prive_expenses WHERE type = 'EXPENSE'`
  );
  const totalExpense = expenseRes?.total_expense || 0;

  // Net Profit
  const netProfit = grossProfit - totalPrive - totalExpense;

  // Consignment Owed calculation (Barang Titipan yang sudah laku terjual)
  const consignmentRes = await db.getFirstAsync<{ total_owed: number | null }>(
    `SELECT SUM(ti.qty * ti.buy_price) as total_owed 
     FROM transaction_items ti
     JOIN products p ON ti.product_id = p.id
     WHERE p.is_consignment = 1`
  );
  const totalConsignmentOwed = consignmentRes?.total_owed || 0;

  return {
    totalRevenue,
    totalHPP,
    grossProfit,
    totalPrive,
    totalExpense,
    netProfit,
    totalConsignmentOwed,
    transactionCount,
  };
}
