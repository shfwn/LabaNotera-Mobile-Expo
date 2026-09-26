import { SQLiteDatabase } from 'expo-sqlite';
import { Product } from '../types';

export async function getProducts(db: SQLiteDatabase): Promise<Product[]> {
  return await db.getAllAsync<Product>('SELECT * FROM products ORDER BY name ASC');
}

export async function searchProducts(db: SQLiteDatabase, query: string): Promise<Product[]> {
  const searchTerm = `%${query}%`;
  return await db.getAllAsync<Product>(
    'SELECT * FROM products WHERE name LIKE ? OR barcode LIKE ? OR supplier_name LIKE ? ORDER BY name ASC',
    [searchTerm, searchTerm, searchTerm]
  );
}

export async function getProductByBarcode(db: SQLiteDatabase, barcode: string): Promise<Product | null> {
  return await db.getFirstAsync<Product>('SELECT * FROM products WHERE barcode = ?', [barcode]);
}

export async function addProduct(
  db: SQLiteDatabase,
  product: Omit<Product, 'id' | 'created_at'>
): Promise<number> {
  const result = await db.runAsync(
    `INSERT INTO products (barcode, name, buy_price, sell_price, stock, is_consignment, supplier_name, category, is_kg)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      product.barcode || null,
      product.name,
      product.buy_price,
      product.sell_price,
      product.stock,
      product.is_consignment ? 1 : 0,
      product.supplier_name || null,
      product.category || 'BARANG_POKOK',
      product.is_kg ? 1 : 0,
    ]
  );
  return result.lastInsertRowId;
}

export async function updateProduct(
  db: SQLiteDatabase,
  product: Product
): Promise<void> {
  await db.runAsync(
    `UPDATE products 
     SET barcode = ?, name = ?, buy_price = ?, sell_price = ?, stock = ?, is_consignment = ?, supplier_name = ?, category = ?, is_kg = ?
     WHERE id = ?`,
    [
      product.barcode || null,
      product.name,
      product.buy_price,
      product.sell_price,
      product.stock,
      product.is_consignment ? 1 : 0,
      product.supplier_name || null,
      product.category || 'BARANG_POKOK',
      product.is_kg ? 1 : 0,
      product.id,
    ]
  );
}

export async function deleteProduct(db: SQLiteDatabase, id: number): Promise<void> {
  await db.runAsync('DELETE FROM products WHERE id = ?', [id]);
}

export async function updateProductStock(
  db: SQLiteDatabase,
  id: number,
  delta: number
): Promise<void> {
  await db.runAsync('UPDATE products SET stock = stock + ? WHERE id = ?', [delta, id]);
}

export async function restockProduct(
  db: SQLiteDatabase,
  productId: number,
  qtyToAdd: number,
  buyPrice: number,
  paymentSource: 'CASH_DRAWER' | 'CONSIGNMENT' | 'CORRECTION_ONLY',
  productName: string,
  isKg: boolean = false
): Promise<void> {
  await db.runAsync(
    'UPDATE products SET stock = stock + ?, buy_price = ? WHERE id = ?',
    [Number(qtyToAdd), Number(buyPrice), Number(productId)]
  );
  if (paymentSource === 'CASH_DRAWER') {
    const totalCost = Math.round(Number(qtyToAdd) * Number(buyPrice));
    if (totalCost > 0) {
      const note = `Belanja Stok: ${productName} (${qtyToAdd} ${isKg ? 'kg' : 'item'} @ Rp ${buyPrice.toLocaleString('id-ID')})`;
      try {
        await db.runAsync(
          `INSERT INTO prive_expenses (type, amount, note) VALUES (?, ?, ?)`,
          ['RESTOCK', totalCost, note]
        );
      } catch (err) {
        console.warn('RESTOCK insert in prive_expenses failed, falling back to EXPENSE:', err);
        try {
          await db.runAsync(
            `INSERT INTO prive_expenses (type, amount, note) VALUES (?, ?, ?)`,
            ['EXPENSE', totalCost, `[BELANJA STOK] ${note}`]
          );
        } catch (err2) {
          console.error('Fallback insert failed:', err2);
        }
      }
    }
  }
}


