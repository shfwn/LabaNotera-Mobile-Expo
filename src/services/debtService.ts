import { SQLiteDatabase } from 'expo-sqlite';
import { Debt, DebtPayment } from '../types';

export async function getDebts(db: SQLiteDatabase): Promise<Debt[]> {
  return await db.getAllAsync<Debt>(
    `SELECT * FROM debts ORDER BY CASE WHEN status = 'UNPAID' THEN 1 WHEN status = 'PARTIAL' THEN 2 ELSE 3 END, id DESC`
  );
}

export async function addDebt(
  db: SQLiteDatabase,
  customerName: string,
  phone: string | null,
  totalAmount: number
): Promise<number> {
  const result = await db.runAsync(
    `INSERT INTO debts (customer_name, phone, total_debt, remaining_debt, status)
     VALUES (?, ?, ?, ?, 'UNPAID')`,
    [customerName.trim(), phone?.trim() || null, totalAmount, totalAmount]
  );
  return result.lastInsertRowId;
}

export async function payDebt(
  db: SQLiteDatabase,
  debtId: number,
  amountPaid: number,
  notes: string = ''
): Promise<void> {
  const debt = await db.getFirstAsync<Debt>(`SELECT * FROM debts WHERE id = ?`, [debtId]);
  if (!debt) throw new Error('Catatan utang tidak ditemukan');

  const newRemaining = Math.max(0, Math.round(debt.remaining_debt - amountPaid));
  let newStatus: 'UNPAID' | 'PARTIAL' | 'PAID' = 'PARTIAL';
  if (newRemaining <= 0) {
    newStatus = 'PAID';
  } else if (newRemaining >= debt.total_debt) {
    newStatus = 'UNPAID';
  }

  // Update debt
  await db.runAsync(
    `UPDATE debts SET remaining_debt = ?, status = ? WHERE id = ?`,
    [newRemaining, newStatus, debtId]
  );

  // Insert payment history
  await db.runAsync(
    `INSERT INTO debt_payments (debt_id, amount_paid, notes) VALUES (?, ?, ?)`,
    [debtId, amountPaid, notes || null]
  );

  // Update transaction history: tambahkan uang yang dibayarkan ke total_amount transaksi pelanggan ini
  try {
    const customerName = debt.customer_name?.trim();
    if (customerName) {
      // Cari transaksi pelanggan yang masih memiliki debt_amount > 0 (urutkan dari yang paling lama/ASC)
      const debtTrxs = await db.getAllAsync<{
        id: number;
        total_amount: number;
        cash_paid: number | null;
        debt_amount: number | null;
        payment_method: string;
      }>(
        `SELECT id, total_amount, cash_paid, debt_amount, payment_method 
         FROM transactions 
         WHERE LOWER(customer_name) = LOWER(?) 
           AND (payment_method = 'CASH+UTANG' OR payment_method = 'UTANG')
           AND debt_amount > 0
         ORDER BY id ASC`,
        [customerName]
      );

      let remainingToApply = amountPaid;
      for (const trx of debtTrxs) {
        if (remainingToApply <= 0) break;
        const currentDebt = trx.debt_amount || 0;
        const applyAmount = Math.min(currentDebt, remainingToApply);
        const newTotalAmount = (trx.total_amount || 0) + applyAmount;
        const newCashPaid = (trx.cash_paid || 0) + applyAmount;
        const newDebtAmount = Math.max(0, currentDebt - applyAmount);
        const newPaymentMethod = newDebtAmount === 0 ? 'CASH' : trx.payment_method;

        await db.runAsync(
          `UPDATE transactions 
           SET total_amount = ?, cash_paid = ?, debt_amount = ?, payment_method = ? 
           WHERE id = ?`,
          [newTotalAmount, newCashPaid, newDebtAmount, newPaymentMethod, trx.id]
        );

        remainingToApply -= applyAmount;
      }
    }
  } catch (err) {
    console.error('Failed to sync transaction debt payment:', err);
  }
}

export async function getDebtPayments(db: SQLiteDatabase, debtId: number): Promise<DebtPayment[]> {
  return await db.getAllAsync<DebtPayment>(
    `SELECT * FROM debt_payments WHERE debt_id = ? ORDER BY id DESC`,
    [debtId]
  );
}

export async function deleteDebt(db: SQLiteDatabase, debtId: number): Promise<void> {
  // First delete all payment history records for this debt to prevent any foreign key violation
  await db.runAsync(`DELETE FROM debt_payments WHERE debt_id = ?`, [debtId]);
  await db.runAsync(`DELETE FROM debts WHERE id = ?`, [debtId]);
}

export async function deleteDebtPayment(db: SQLiteDatabase, paymentId: number, debtId: number): Promise<void> {
  const payment = await db.getFirstAsync<DebtPayment>(`SELECT * FROM debt_payments WHERE id = ?`, [paymentId]);
  if (!payment) return;

  const debt = await db.getFirstAsync<Debt>(`SELECT * FROM debts WHERE id = ?`, [debtId]);
  if (debt) {
    const restoredRemaining = Math.min(debt.total_debt, debt.remaining_debt + payment.amount_paid);
    const newStatus = restoredRemaining >= debt.total_debt ? 'UNPAID' : (restoredRemaining > 0 ? 'PARTIAL' : 'PAID');
    await db.runAsync(`UPDATE debts SET remaining_debt = ?, status = ? WHERE id = ?`, [restoredRemaining, newStatus, debtId]);
  }

  await db.runAsync(`DELETE FROM debt_payments WHERE id = ?`, [paymentId]);
}
