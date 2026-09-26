import { SQLiteDatabase } from 'expo-sqlite';

export async function initDatabase(db: SQLiteDatabase) {
  try {
    await db.execAsync(`
      PRAGMA foreign_keys = ON;

      CREATE TABLE IF NOT EXISTS products (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        barcode TEXT UNIQUE,
        name TEXT NOT NULL,
        buy_price REAL NOT NULL,
        sell_price REAL NOT NULL,
        stock INTEGER NOT NULL DEFAULT 0,
        is_consignment INTEGER DEFAULT 0,
        supplier_name TEXT,
        category TEXT DEFAULT 'BARANG_POKOK',
        is_kg INTEGER DEFAULT 0,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS transactions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        transaction_code TEXT UNIQUE,
        total_amount REAL NOT NULL,
        total_cost REAL NOT NULL,
        payment_method TEXT CHECK(payment_method IN ('CASH', 'QRIS', 'UTANG', 'CASH+UTANG')),
        cash_paid REAL,
        debt_amount REAL,
        customer_name TEXT,
        status TEXT DEFAULT 'SUCCESS',
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS transaction_items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        transaction_id INTEGER,
        product_id INTEGER,
        product_name TEXT,
        qty INTEGER NOT NULL,
        buy_price REAL NOT NULL,
        sell_price REAL NOT NULL,
        subtotal REAL NOT NULL,
        FOREIGN KEY(transaction_id) REFERENCES transactions(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS debts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        customer_name TEXT NOT NULL,
        phone TEXT,
        total_debt REAL NOT NULL,
        remaining_debt REAL NOT NULL,
        status TEXT DEFAULT 'UNPAID',
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS debt_payments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        debt_id INTEGER,
        amount_paid REAL NOT NULL,
        payment_date TEXT DEFAULT CURRENT_TIMESTAMP,
        notes TEXT,
        FOREIGN KEY(debt_id) REFERENCES debts(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS prive_expenses (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        type TEXT CHECK(type IN ('PRIVE', 'EXPENSE', 'RESTOCK')),
        amount REAL NOT NULL,
        note TEXT NOT NULL,
        date TEXT DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS shop_profile (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        shop_name TEXT NOT NULL DEFAULT 'Warung LabaNotera',
        owner_name TEXT,
        phone TEXT,
        address TEXT,
        bank_name TEXT,
        bank_account_number TEXT,
        bank_account_holder TEXT,
        qris_image_uri TEXT,
        closing_time TEXT DEFAULT '21:00',
        last_report_date TEXT,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Migration: add is_kg column if missing in existing database
    try {
      await db.execAsync(`ALTER TABLE products ADD COLUMN is_kg INTEGER DEFAULT 0;`);
    } catch (e) {
      // Column already exists
    }

    // Migration: add closing_time column if missing in existing shop_profile
    try {
      await db.execAsync(`ALTER TABLE shop_profile ADD COLUMN closing_time TEXT DEFAULT '21:00';`);
    } catch (e) {
      // Column already exists
    }

    // Migration: add last_report_date column if missing in existing shop_profile
    try {
      await db.execAsync(`ALTER TABLE shop_profile ADD COLUMN last_report_date TEXT;`);
    } catch (e) {
      // Column already exists
    }

    // Migration: ensure prive_expenses table supports RESTOCK type
    try {
      await db.execAsync(`
        CREATE TABLE IF NOT EXISTS prive_expenses_new (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          type TEXT CHECK(type IN ('PRIVE', 'EXPENSE', 'RESTOCK')),
          amount REAL NOT NULL,
          note TEXT NOT NULL,
          date TEXT DEFAULT CURRENT_TIMESTAMP
        );
        INSERT OR IGNORE INTO prive_expenses_new (id, type, amount, note, date)
        SELECT id, type, amount, note, date FROM prive_expenses;
        DROP TABLE IF EXISTS prive_expenses;
        ALTER TABLE prive_expenses_new RENAME TO prive_expenses;
      `);
    } catch (e) {
      // Ignore if table doesn't exist yet or already updated
    }

    // Check if shop_profile exists; if not, populate default profile
    const profileCount = await db.getFirstAsync<{ count: number }>('SELECT COUNT(*) as count FROM shop_profile');
    if (profileCount && profileCount.count === 0) {
      await db.execAsync(`
        INSERT INTO shop_profile (shop_name, bank_name, bank_account_number, bank_account_holder, closing_time) VALUES
        ('Warung LabaNotera', 'BCA', '', '', '21:00');
      `);
    }

    // Check if products exist; if not, populate sample products
    const result = await db.getFirstAsync<{ count: number }>('SELECT COUNT(*) as count FROM products');
    if (result && result.count === 0) {
      await db.execAsync(`
        INSERT INTO products (barcode, name, buy_price, sell_price, stock, is_consignment, supplier_name, category) VALUES
        ('899999900001', 'Minyak Goreng Bimoli 1L', 14000, 17000, 24, 0, NULL, 'BARANG_POKOK'),
        ('899999900002', 'Beras Setra Ramos 5kg', 60000, 68000, 10, 0, NULL, 'BARANG_POKOK'),
        ('899999900003', 'Telur Ayam Negeri 1kg', 26000, 29000, 15, 0, NULL, 'BARANG_POKOK'),
        ('899999900004', 'Gorengan Tempe & Tahu (Titipan)', 1000, 1200, 30, 1, 'Bu Agus', 'SNACK'),
        ('899999900005', 'Kue Basah (Titipan)', 2000, 2500, 20, 1, 'Mbak Tri', 'SNACK'),
        ('089686010018', 'Indomie Goreng Original', 2800, 3500, 48, 0, NULL, 'BARANG_POKOK'),
        ('8992696404015', 'Kopi Kapal Api Special 165g', 12500, 14500, 12, 0, NULL, 'MINUMAN'),
        ('899999900006', 'Kerupuk Kaleng (Titipan)', 800, 1000, 40, 1, 'Pak RT', 'SNACK');
      `);
      console.log('Sample products seeded successfully.');
    }
  } catch (error) {
    console.error('Error initializing database:', error);
    throw error;
  }
}
