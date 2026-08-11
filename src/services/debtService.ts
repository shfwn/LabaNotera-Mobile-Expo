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

  const newRemaining = Math.max(0, debt.remaining_debt - amountPaid);
  let newStatus: 'UNPAID' | 'PARTIAL' | 'PAID' = 'PARTIAL';
  if (newRemaining === 0) {
    newStatus = 'PAID';
  } else if (newRemaining === debt.total_debt) {
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
}

export async function getDebtPayments(db: SQLiteDatabase, debtId: number): Promise<DebtPayment[]> {
  return await db.getAllAsync<DebtPayment>(
    `SELECT * FROM debt_payments WHERE debt_id = ? ORDER BY id DESC`,
    [debtId]
  );
}

export async function deleteDebt(db: SQLiteDatabase, debtId: number): Promise<void> {
  await db.runAsync(`DELETE FROM debts WHERE id = ?`, [debtId]);
}
