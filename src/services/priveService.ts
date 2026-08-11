import { SQLiteDatabase } from 'expo-sqlite';
import { ExpenseType, PriveExpense } from '../types';

export async function getPriveExpenses(db: SQLiteDatabase): Promise<PriveExpense[]> {
  return await db.getAllAsync<PriveExpense>(
    `SELECT * FROM prive_expenses ORDER BY id DESC`
  );
}

export async function addPriveExpense(
  db: SQLiteDatabase,
  type: ExpenseType,
  amount: number,
  note: string
): Promise<number> {
  const result = await db.runAsync(
    `INSERT INTO prive_expenses (type, amount, note) VALUES (?, ?, ?)`,
    [type, amount, note]
  );
  return result.lastInsertRowId;
}

export async function deletePriveExpense(db: SQLiteDatabase, id: number): Promise<void> {
  await db.runAsync(`DELETE FROM prive_expenses WHERE id = ?`, [id]);
}
