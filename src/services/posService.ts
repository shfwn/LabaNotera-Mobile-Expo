import { SQLiteDatabase } from 'expo-sqlite';
import { CartItem, PaymentMethod, Transaction, TransactionItem } from '../types';
import { generateTrxCode } from '../utils/formatters';

export interface CheckoutResult {
  transactionId: number;
  transactionCode: string;
  totalAmount: number;
  totalCost: number;
}

export async function processCheckout(
  db: SQLiteDatabase,
  cart: CartItem[],
  paymentMethod: PaymentMethod,
  customerName?: string,
  customerPhone?: string,
  cashPaid?: number
): Promise<CheckoutResult> {
  if (cart.length === 0) {
    throw new Error('Keranjang belanja kosong');
  }

  const transactionCode = generateTrxCode();
  let totalAmount = 0;
  let totalCost = 0;

  for (const item of cart) {
    totalAmount += Math.round(item.product.sell_price * item.qty);
    totalCost += Math.round(item.product.buy_price * item.qty);
  }

  // Detect partial payment: CASH with shortfall → treat remaining as UTANG
  const actualCashPaid = cashPaid ?? (paymentMethod === 'CASH' ? totalAmount : 0);
  const shortfall = totalAmount - actualCashPaid;
  const isPartialPayment = paymentMethod === 'CASH' && shortfall > 0;
  const effectivePaymentMethod: PaymentMethod = isPartialPayment ? 'CASH+UTANG' : paymentMethod;

  // Hanya catat uang tunai yang benar-benar diterima pelanggan ke dalam transaksi
  let recordedCashReceived = totalAmount;
  if (isPartialPayment) {
    recordedCashReceived = actualCashPaid; // Contoh: Beli 68rb bayar 50rb -> tercatat 50rb
  } else if (paymentMethod === 'UTANG') {
    recordedCashReceived = 0; // 0 rupiah diterima
  }

  // Record debt: full UTANG method OR partial CASH payment with shortfall
  const shouldRecordDebt = paymentMethod === 'UTANG' || isPartialPayment;
  const debtAmount = paymentMethod === 'UTANG' ? totalAmount : shortfall;
  const effectiveCustomerName = customerName?.trim() || (shouldRecordDebt ? 'Pelanggan Utang' : null);

  // Insert Transaction
  const trxResult = await db.runAsync(
    `INSERT INTO transactions (transaction_code, total_amount, total_cost, payment_method, cash_paid, debt_amount, customer_name, status)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      transactionCode,
      totalAmount,
      totalCost,
      effectivePaymentMethod,
      isPartialPayment || paymentMethod === 'CASH' ? actualCashPaid : 0,
      isPartialPayment ? shortfall : (paymentMethod === 'UTANG' ? totalAmount : 0),
      effectiveCustomerName,
      'SUCCESS',
    ]
  );

  const transactionId = trxResult.lastInsertRowId;

  // Insert Items & Deduct Stock
  for (const item of cart) {
    const subtotal = Math.round(item.product.sell_price * item.qty);
    await db.runAsync(
      `INSERT INTO transaction_items (transaction_id, product_id, product_name, qty, buy_price, sell_price, subtotal)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        transactionId,
        item.product.id,
        item.product.name,
        item.qty,
        item.product.buy_price,
        item.product.sell_price,
        subtotal,
      ]
    );

    // Deduct Stock
    await db.runAsync('UPDATE products SET stock = stock - ? WHERE id = ?', [
      item.qty,
      item.product.id,
    ]);
  }

  if (shouldRecordDebt) {
    const name = effectiveCustomerName || 'Pelanggan Utang';
    // Check if customer already has active debt
    const existingDebt = await db.getFirstAsync<{ id: number; total_debt: number; remaining_debt: number }>(
      `SELECT id, total_debt, remaining_debt FROM debts WHERE LOWER(customer_name) = LOWER(?) AND status != 'PAID'`,
      [name]
    );

    if (existingDebt && existingDebt.id) {
      const newTotal = Number(existingDebt.total_debt || 0) + debtAmount;
      const newRemaining = Number(existingDebt.remaining_debt || 0) + debtAmount;
      await db.runAsync(
        `UPDATE debts SET total_debt = ?, remaining_debt = ?, phone = COALESCE(?, phone), status = ? WHERE id = ?`,
        [newTotal, newRemaining, customerPhone || null, 'UNPAID', existingDebt.id]
      );
    } else {
      await db.runAsync(
        `INSERT INTO debts (customer_name, phone, total_debt, remaining_debt, status)
         VALUES (?, ?, ?, ?, ?)`,
        [name, customerPhone || null, debtAmount, debtAmount, 'UNPAID']
      );
    }
  }

  return {
    transactionId,
    transactionCode,
    totalAmount,
    totalCost,
  };
}

export async function getRecentTransactions(db: SQLiteDatabase, limit: number = 20): Promise<Transaction[]> {
  return await db.getAllAsync<Transaction>(
    `SELECT * FROM transactions ORDER BY id DESC LIMIT ?`,
    [limit]
  );
}

export async function getTransactionDetails(
  db: SQLiteDatabase,
  transactionId: number
): Promise<{ transaction: Transaction; items: TransactionItem[] } | null> {
  const transaction = await db.getFirstAsync<Transaction>(
    `SELECT * FROM transactions WHERE id = ?`,
    [transactionId]
  );

  if (!transaction) return null;

  const items = await db.getAllAsync<TransactionItem>(
    `SELECT * FROM transaction_items WHERE transaction_id = ?`,
    [transactionId]
  );

  return { transaction, items };
}

export async function voidTransaction(
  db: SQLiteDatabase,
  transactionId: number
): Promise<void> {
  const details = await getTransactionDetails(db, transactionId);
  if (!details) {
    throw new Error('Transaksi tidak ditemukan');
  }

  const { transaction, items } = details;

  if (transaction.status === 'CANCELLED') {
    throw new Error('Transaksi ini sudah dibatalkan sebelumnya.');
  }

  // 1. Restore product stock for all items in the transaction
  for (const item of items) {
    if (item.product_id && item.product_id > 0) {
      await db.runAsync('UPDATE products SET stock = stock + ? WHERE id = ?', [
        item.qty,
        item.product_id,
      ]);
    }
  }

  // 2. Adjust or remove customer debt if this transaction created debt
  if (
    (transaction.payment_method === 'UTANG' || transaction.payment_method === 'CASH+UTANG') &&
    transaction.debt_amount &&
    transaction.debt_amount > 0
  ) {
    const custName = transaction.customer_name?.trim() || 'Pelanggan Utang';
    const existingDebt = await db.getFirstAsync<{ id: number; total_debt: number; remaining_debt: number }>(
      `SELECT id, total_debt, remaining_debt FROM debts WHERE LOWER(customer_name) = LOWER(?) AND status != 'PAID'`,
      [custName]
    );

    if (existingDebt && existingDebt.id) {
      const newTotal = Math.max(0, (existingDebt.total_debt || 0) - transaction.debt_amount);
      const newRemaining = Math.max(0, (existingDebt.remaining_debt || 0) - transaction.debt_amount);
      const newStatus = newRemaining <= 0 ? 'PAID' : 'UNPAID';
      await db.runAsync(
        `UPDATE debts SET total_debt = ?, remaining_debt = ?, status = ? WHERE id = ?`,
        [newTotal, newRemaining, newStatus, existingDebt.id]
      );
    }
  }

  // 3. Mark transaction as CANCELLED
  await db.runAsync(`UPDATE transactions SET status = ? WHERE id = ?`, [
    'CANCELLED',
    transactionId,
  ]);
}
