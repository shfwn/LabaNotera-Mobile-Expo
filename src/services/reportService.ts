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

  // Total items sold today
  const itemsSoldRes = await db.getFirstAsync<{ today_items: number | null }>(
    `SELECT SUM(ti.qty) as today_items 
     FROM transaction_items ti
     JOIN transactions t ON ti.transaction_id = t.id
     WHERE t.status = 'SUCCESS'
       AND (t.created_at LIKE ? OR date(t.created_at, 'localtime') = date(?))`,
    [`${targetDate}%`, targetDate]
  );
  const todayItemsSold = itemsSoldRes?.today_items || 0;

  // Total consignment (titipan) owed today
  const consignmentRes = await db.getFirstAsync<{ today_consignment: number | null }>(
    `SELECT SUM(ti.qty * ti.buy_price) as today_consignment
     FROM transaction_items ti
     JOIN transactions t ON ti.transaction_id = t.id
     JOIN products p ON ti.product_id = p.id
     WHERE t.status = 'SUCCESS' AND p.is_consignment = 1
       AND (t.created_at LIKE ? OR date(t.created_at, 'localtime') = date(?))`,
    [`${targetDate}%`, targetDate]
  );
  const todayConsignmentOwed = consignmentRes?.today_consignment || 0;

  return {
    todayRevenue,
    todayGrossProfit,
    todayItemsSold,
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

  // Total Belanja Stok Barang dari Laci Kasir
  const restockRes = await db.getFirstAsync<{ total_restock: number | null }>(
    `SELECT SUM(amount) as total_restock FROM prive_expenses WHERE type = 'RESTOCK'`
  );
  const totalRestock = restockRes?.total_restock || 0;

  // Net Profit (Laba Bersih Warung = Laba Kotor - Uang Dapur - Biaya Warung)
  const netProfit = grossProfit - totalPrive - totalExpense;

  // Total items sold from all SUCCESS transactions
  const itemsSoldRes = await db.getFirstAsync<{ total_items: number | null }>(
    `SELECT SUM(ti.qty) as total_items 
     FROM transaction_items ti
     JOIN transactions t ON ti.transaction_id = t.id
     WHERE t.status = 'SUCCESS'`
  );
  const totalItemsSold = itemsSoldRes?.total_items || 0;

  // Total Consignment (Barang Titipan) Owed from all SUCCESS transactions
  const consignmentRes = await db.getFirstAsync<{ total_consignment: number | null }>(
    `SELECT SUM(ti.qty * ti.buy_price) as total_consignment 
     FROM transaction_items ti
     JOIN transactions t ON ti.transaction_id = t.id
     JOIN products p ON ti.product_id = p.id
     WHERE t.status = 'SUCCESS' AND p.is_consignment = 1`
  );
  const totalConsignmentOwed = consignmentRes?.total_consignment || 0;

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
    totalItemsSold,
    totalConsignmentOwed,
    transactionCount,
    totalDebtRemaining,
  };
}

export async function getDailyFullReportData(
  db: SQLiteDatabase,
  dateStr?: string
): Promise<import('../types').DailyFullReportData> {
  const targetDate = dateStr || getTodayDateString();
  const { getShopProfile } = await import('./profileService');
  const { formatTanggal } = await import('../utils/formatters');
  const shopProfile = await getShopProfile(db);

  // 1. Daily Sales & Cost
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

  // 2. Total items sold today
  const itemsSoldRes = await db.getFirstAsync<{ today_items: number | null }>(
    `SELECT SUM(ti.qty) as today_items 
     FROM transaction_items ti
     JOIN transactions t ON ti.transaction_id = t.id
     WHERE t.status = 'SUCCESS'
       AND (t.created_at LIKE ? OR date(t.created_at, 'localtime') = date(?))`,
    [`${targetDate}%`, targetDate]
  );
  const todayItemsSold = itemsSoldRes?.today_items || 0;

  // 3. Consignment owed today
  const consignmentRes = await db.getFirstAsync<{ today_consignment: number | null }>(
    `SELECT SUM(ti.qty * ti.buy_price) as today_consignment
     FROM transaction_items ti
     JOIN transactions t ON ti.transaction_id = t.id
     JOIN products p ON ti.product_id = p.id
     WHERE t.status = 'SUCCESS' AND p.is_consignment = 1
       AND (t.created_at LIKE ? OR date(t.created_at, 'localtime') = date(?))`,
    [`${targetDate}%`, targetDate]
  );
  const todayConsignmentOwed = consignmentRes?.today_consignment || 0;

  // 4. Daily Prive Expenses (Uang Dapur)
  const priveRes = await db.getFirstAsync<{ today_prive: number | null }>(
    `SELECT SUM(amount) as today_prive 
     FROM prive_expenses 
     WHERE type = 'PRIVE' AND (date LIKE ? OR date(date, 'localtime') = date(?))`,
    [`${targetDate}%`, targetDate]
  );
  const todayPrive = priveRes?.today_prive || 0;

  // 5. Daily Operational Expenses
  const expenseRes = await db.getFirstAsync<{ today_expense: number | null }>(
    `SELECT SUM(amount) as today_expense 
     FROM prive_expenses 
     WHERE type = 'EXPENSE' AND (date LIKE ? OR date(date, 'localtime') = date(?))`,
    [`${targetDate}%`, targetDate]
  );
  const todayExpense = expenseRes?.today_expense || 0;

  // 6. Daily Restock from Drawer
  const restockRes = await db.getFirstAsync<{ today_restock: number | null }>(
    `SELECT SUM(amount) as today_restock 
     FROM prive_expenses 
     WHERE type = 'RESTOCK' AND (date LIKE ? OR date(date, 'localtime') = date(?))`,
    [`${targetDate}%`, targetDate]
  );
  const todayRestock = restockRes?.today_restock || 0;

  // 7. Net Profit & Cash in Drawer Calculation
  const todayNetProfit = todayGrossProfit - todayPrive - todayExpense;
  const todayEstimatedCashDrawer = todayRevenue - todayPrive - todayExpense - todayRestock;

  // 8. Products sold detail
  const productsSold = await db.getAllAsync<import('../types').DailyReportProductItem>(
    `SELECT 
       ti.product_name,
       COALESCE(p.category, 'SEMBAKO') as category,
       SUM(ti.qty) as qty_sold,
       COALESCE(p.is_kg, 0) as is_kg,
       COALESCE(p.is_consignment, 0) as is_consignment,
       SUM(ti.subtotal) as total_revenue,
       SUM(ti.qty * ti.buy_price) as total_hpp,
       SUM(ti.subtotal - (ti.qty * ti.buy_price)) as total_profit
     FROM transaction_items ti
     JOIN transactions t ON ti.transaction_id = t.id
     LEFT JOIN products p ON ti.product_id = p.id
     WHERE t.status = 'SUCCESS'
       AND (t.created_at LIKE ? OR date(t.created_at, 'localtime') = date(?))
     GROUP BY ti.product_name
     ORDER BY total_profit DESC, qty_sold DESC`,
    [`${targetDate}%`, targetDate]
  );

  // 9. Transactions of the day
  const transactions = await db.getAllAsync<import('../types').DailyReportTransactionItem>(
    `SELECT 
       id,
       transaction_code,
       created_at,
       payment_method,
       customer_name,
       total_amount,
       total_cost,
       (total_amount - total_cost) as gross_profit,
       status
     FROM transactions
     WHERE (created_at LIKE ? OR date(created_at, 'localtime') = date(?))
     ORDER BY id ASC`,
    [`${targetDate}%`, targetDate]
  );

  // 10. Expenses of the day
  const expenses = await db.getAllAsync<import('../types').DailyReportExpenseItem>(
    `SELECT id, type, amount, note, date
     FROM prive_expenses
     WHERE (date LIKE ? OR date(date, 'localtime') = date(?))
     ORDER BY id ASC`,
    [`${targetDate}%`, targetDate]
  );

  return {
    targetDate,
    formattedDate: formatTanggal(targetDate),
    shopProfile,
    todayRevenue,
    todayHPP,
    todayGrossProfit,
    todayPrive,
    todayExpense,
    todayRestock,
    todayConsignmentOwed,
    todayNetProfit,
    todayEstimatedCashDrawer,
    todayTransactionCount,
    todayItemsSold,
    productsSold: productsSold || [],
    transactions: transactions || [],
    expenses: expenses || [],
  };
}

