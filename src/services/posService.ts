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
  customerPhone?: string
): Promise<CheckoutResult> {
  if (cart.length === 0) {
    throw new Error('Keranjang belanja kosong');
  }

  const transactionCode = generateTrxCode();
  let totalAmount = 0;
  let totalCost = 0;

  for (const item of cart) {
    totalAmount += item.product.sell_price * item.qty;
    totalCost += item.product.buy_price * item.qty;
  }

  // Insert Transaction
  const trxResult = await db.runAsync(
    `INSERT INTO transactions (transaction_code, total_amount, total_cost, payment_method, customer_name, status)
     VALUES (?, ?, ?, ?, ?, 'SUCCESS')`,
    [transactionCode, totalAmount, totalCost, paymentMethod, customerName || null]
  );

  const transactionId = trxResult.lastInsertRowId;

  // Insert Items & Deduct Stock
  for (const item of cart) {
    const subtotal = item.product.sell_price * item.qty;
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

  // If Payment is UTANG, record in debts table
  if (paymentMethod === 'UTANG') {
    const name = customerName?.trim() || 'Pelanggan Utang';
    // Check if customer already has active debt
    const existingDebt = await db.getFirstAsync<{ id: number; total_debt: number; remaining_debt: number }>(
      `SELECT id, total_debt, remaining_debt FROM debts WHERE LOWER(customer_name) = LOWER(?) AND status != 'PAID'`,
      [name]
    );

    if (existingDebt) {
      const newTotal = existingDebt.total_debt + totalAmount;
      const newRemaining = existingDebt.remaining_debt + totalAmount;
      const newStatus = 'UNPAID';
      await db.runAsync(
        `UPDATE debts SET total_debt = ?, remaining_debt = ?, status = ? WHERE id = ?`,
        [newTotal, newRemaining, newStatus, existingDebt.id]
      );
    } else {
      await db.runAsync(
        `INSERT INTO debts (customer_name, phone, total_debt, remaining_debt, status)
         VALUES (?, ?, ?, ?, 'UNPAID')`,
        [name, customerPhone || null, totalAmount, totalAmount]
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
