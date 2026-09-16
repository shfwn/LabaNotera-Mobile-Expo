import { SQLiteDatabase } from 'expo-sqlite';
import { Debt, DebtPayment } from '../types';

export async function getDebts(db: SQLiteDatabase): Promise<Debt[]> {
  return await db.getAllAsync<Debt>(
    `SELECT * FROM debts ORDER BY id DESC`
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
     VALUES (?, ?, ?, ?, ?)`,
    [customerName.trim(), phone?.trim() || null, totalAmount, totalAmount, 'UNPAID']
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

  if (amountPaid > debt.remaining_debt) {
    throw new Error(`Nominal pembayaran (${amountPaid}) melebihi sisa utang (${debt.remaining_debt}).`);
  }

  const newRemaining = Math.max(0, Math.round(debt.remaining_debt - amountPaid));
  let newStatus: 'UNPAID' | 'PARTIAL' | 'PAID' = 'PARTIAL';
  if (newRemaining <= 0) {
    newStatus = 'PAID';
  } else if (newRemaining < debt.total_debt) {
    newStatus = 'PARTIAL';
  } else {
    newStatus = 'UNPAID';
  }

  // 1. Update debt record
  await db.runAsync(
    `UPDATE debts SET remaining_debt = ?, status = ? WHERE id = ?`,
    [newRemaining, newStatus, debtId]
  );

  // 2. Insert payment history
  await db.runAsync(
    `INSERT INTO debt_payments (debt_id, amount_paid, notes) VALUES (?, ?, ?)`,
    [debtId, amountPaid, notes || null]
  );

  const customerName = debt.customer_name?.trim() || 'Pelanggan Utang';
  const isLunas = newRemaining <= 0;
  const paymentTrxCode = `TRX-PAY-${Date.now().toString().slice(-6)}`;
  const paymentLabel = isLunas ? `Pelunasan Utang (${customerName})` : `Cicilan Utang (${customerName})`;

  // 3. Record payment into transactions table so it appears in Riwayat Transaksi & Omset
  try {
    const payTrxResult = await db.runAsync(
      `INSERT INTO transactions (transaction_code, total_amount, total_cost, payment_method, cash_paid, debt_amount, customer_name, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        paymentTrxCode,
        amountPaid,
        0, // HPP = 0
        'CASH',
        amountPaid,
        0,
        paymentLabel,
        'SUCCESS',
      ]
    );

    const payTrxId = payTrxResult.lastInsertRowId;

    await db.runAsync(
      `INSERT INTO transaction_items (transaction_id, product_id, product_name, qty, buy_price, sell_price, subtotal)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        payTrxId,
        0,
        `${paymentLabel}${notes ? ' - ' + notes : ''}`,
        1,
        0,
        amountPaid,
        amountPaid,
      ]
    );
  } catch (err) {
    console.error('Failed to create payment transaction record:', err);
  }

  // 4. Update open credit transactions for this customer to decrement debt_amount
  try {
    const debtTrxs = await db.getAllAsync<{
      id: number;
      total_amount: number;
      cash_paid: number | null;
      debt_amount: number | null;
      payment_method: string;
    }>(
      `SELECT id, total_amount, cash_paid, debt_amount, payment_method 
       FROM transactions 
       WHERE LOWER(COALESCE(customer_name, 'Pelanggan Utang')) = LOWER(?) 
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
      const newDebtAmount = Math.max(0, currentDebt - applyAmount);
      const newPaymentMethod = newDebtAmount === 0 ? 'CASH' : trx.payment_method;

      await db.runAsync(
        `UPDATE transactions 
         SET debt_amount = ?, payment_method = ? 
         WHERE id = ?`,
        [newDebtAmount, newPaymentMethod, trx.id]
      );

      remainingToApply -= applyAmount;
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
  try {
    const debt = await db.getFirstAsync<Debt>(`SELECT * FROM debts WHERE id = ?`, [debtId]);
    if (debt) {
      const custName = debt.customer_name?.trim() || 'Pelanggan Utang';
      await db.runAsync(
        `UPDATE transactions SET debt_amount = 0 WHERE LOWER(COALESCE(customer_name, 'Pelanggan Utang')) = LOWER(?)`,
        [custName]
      );
    }
  } catch (err) {
    console.error('Failed to reset transaction debt amount during debt deletion:', err);
  }

  // Delete all payment history records and debt record
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
