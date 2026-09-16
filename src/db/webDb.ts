import { SQLiteDatabase } from 'expo-sqlite';

class WebSQLiteDatabase {
  private storageKey = 'labanotera_web_db_v1';
  private data: Record<string, any[]> = {
    products: [],
    transactions: [],
    transaction_items: [],
    debts: [],
    debt_payments: [],
    prive_expenses: [],
    shop_profile: [
      {
        id: 1,
        shop_name: 'Warung LabaNotera',
        owner_name: '',
        phone: '',
        address: '',
        bank_name: 'BCA',
        bank_account_number: '',
        bank_account_holder: '',
        qris_image_uri: null,
      },
    ],
  };
  private autoIds: Record<string, number> = {
    products: 1,
    transactions: 1,
    transaction_items: 1,
    debts: 1,
    debt_payments: 1,
    prive_expenses: 1,
    shop_profile: 2,
  };

  constructor() {
    this.loadFromStorage();
  }

  private loadFromStorage() {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        const saved = window.localStorage.getItem(this.storageKey);
        if (saved) {
          const parsed = JSON.parse(saved);
          this.data = parsed.data || this.data;
          this.autoIds = parsed.autoIds || this.autoIds;
          if (!this.data.shop_profile || this.data.shop_profile.length === 0) {
            this.data.shop_profile = [
              {
                id: 1,
                shop_name: 'Warung LabaNotera',
                owner_name: '',
                phone: '',
                address: '',
                bank_name: 'BCA',
                bank_account_number: '',
                bank_account_holder: '',
                qris_image_uri: null,
              },
            ];
          }

          if (this.data.products) {
            this.data.products.forEach((p) => {
              p.buy_price = Number(p.buy_price || 0);
              p.sell_price = Number(p.sell_price || 0);
              p.stock = Number(p.stock || 0);
              p.is_consignment = Number(p.is_consignment || 0);
            });
          }
          if (this.data.transactions) {
            this.data.transactions.forEach((t) => {
              t.total_amount = Number(t.total_amount || 0);
              t.total_cost = Number(t.total_cost || 0);
              if (t.cash_paid != null) t.cash_paid = Number(t.cash_paid);
              if (t.debt_amount != null) t.debt_amount = Number(t.debt_amount);
              if (!t.status) t.status = 'SUCCESS';
            });
          }
          if (!this.data.debts) {
            this.data.debts = [];
          }
          this.data.debts.forEach((d) => {
            d.total_debt = Number(d.total_debt || 0);
            d.remaining_debt = Number(d.remaining_debt || 0);
            if (!d.status) d.status = 'UNPAID';
          });

          // Direct calculation of remaining debt from payment history
          if (this.data.debts) {
            this.data.debts.forEach((d) => {
              const payments = (this.data.debt_payments || []).filter((dp) => dp.debt_id === d.id);
              const totalPaid = payments.reduce((s, dp) => s + Number(dp.amount_paid || 0), 0);

              d.remaining_debt = Math.max(0, d.total_debt - totalPaid);

              if (d.remaining_debt <= 0) {
                d.status = 'PAID';
              } else if (totalPaid > 0) {
                d.status = 'PARTIAL';
              } else {
                d.status = 'UNPAID';
              }
            });
          }
          if (this.data.transaction_items) {
            this.data.transaction_items.forEach((ti) => {
              ti.qty = Number(ti.qty || 0);
              ti.buy_price = Number(ti.buy_price || 0);
              ti.sell_price = Number(ti.sell_price || 0);
              ti.subtotal = Number(ti.subtotal || 0);
            });
          }
        }
      }
    } catch (e) {
      console.warn('Failed to load Web DB from localStorage:', e);
    }
  }

  private saveToStorage() {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.setItem(
          this.storageKey,
          JSON.stringify({ data: this.data, autoIds: this.autoIds })
        );
      }
    } catch (e) {
      console.warn('Failed to save Web DB to localStorage:', e);
    }
  }

  async execAsync(sql: string): Promise<void> {
    const statements = sql.split(';').map((s) => s.trim()).filter(Boolean);
    for (const statement of statements) {
      await this.runSqlStatement(statement);
    }
  }

  async getAllAsync<T>(sql: string, params: any[] = []): Promise<T[]> {
    this.loadFromStorage();
    return this.querySqlStatement<T>(sql, params);
  }

  async getFirstAsync<T>(sql: string, params: any[] = []): Promise<T | null> {
    this.loadFromStorage();
    const results = await this.querySqlStatement<T>(sql, params);
    return results.length > 0 ? results[0] : null;
  }

  async runAsync(sql: string, params: any[] = []): Promise<{ lastInsertRowId: number; changes: number }> {
    return this.executeWriteSql(sql, params);
  }

  private async runSqlStatement(sql: string): Promise<void> {
    const upper = sql.toUpperCase();
    if (upper.startsWith('CREATE TABLE')) {
      const match = sql.match(/CREATE TABLE IF NOT EXISTS (\w+)/i) || sql.match(/CREATE TABLE (\w+)/i);
      if (match) {
        const tableName = match[1].toLowerCase();
        if (!this.data[tableName]) {
          this.data[tableName] = [];
          this.autoIds[tableName] = 1;
        }
      }
    } else if (upper.startsWith('INSERT INTO') || upper.startsWith('UPDATE') || upper.startsWith('DELETE')) {
      this.executeWriteSql(sql, []);
    }
    this.saveToStorage();
  }

  private executeWriteSql(sql: string, params: any[] = []): { lastInsertRowId: number; changes: number } {
    const upper = sql.trim().toUpperCase();

    // INSERT INTO table (...) VALUES (...)
    if (upper.startsWith('INSERT INTO')) {
      const tableMatch = sql.match(/INSERT INTO (\w+)/i);
      if (!tableMatch) return { lastInsertRowId: 0, changes: 0 };
      const tableName = tableMatch[1].toLowerCase();

      if (!this.data[tableName]) {
        this.data[tableName] = [];
        this.autoIds[tableName] = 1;
      }

      // Inline multi-row seed insert
      if (params.length === 0 && sql.includes('VALUES')) {
        const valuesPart = sql.substring(sql.toUpperCase().indexOf('VALUES') + 6);
        const rows = this.parseInsertValuesList(valuesPart);
        const colMatch = sql.match(/\(([^)]+)\)\s*VALUES/i);
        const cols = colMatch ? colMatch[1].split(',').map((c) => c.trim()) : [];

        let lastId = 0;
        for (const rowVal of rows) {
          const rowObj: Record<string, any> = {
            id: this.autoIds[tableName]++,
            created_at: new Date().toISOString(),
          };
          cols.forEach((col, idx) => {
            rowObj[col] = rowVal[idx];
          });
          this.data[tableName].push(rowObj);
          lastId = rowObj.id;
        }
        this.saveToStorage();
        return { lastInsertRowId: lastId, changes: rows.length };
      }

      // Parameterized single insert
      const colMatch = sql.match(/\(([^)]+)\)\s*VALUES/i);
      const cols = colMatch ? colMatch[1].split(',').map((c) => c.trim()) : [];
      const newId = this.autoIds[tableName]++;
      const rowObj: Record<string, any> = {
        id: newId,
        created_at: new Date().toISOString(),
      };
      const numericCols = new Set([
        'buy_price', 'sell_price', 'stock', 'is_consignment', 'is_kg',
        'total_amount', 'total_cost', 'cash_paid', 'debt_amount',
        'total_debt', 'remaining_debt', 'amount_paid', 'amount',
        'qty', 'subtotal', 'transaction_id', 'product_id', 'debt_id'
      ]);

      cols.forEach((col, idx) => {
        let val = params[idx] !== undefined ? params[idx] : null;
        if (col.toLowerCase() === 'status' && (val === null || val === undefined)) {
          val = tableName === 'transactions' ? 'SUCCESS' : (tableName === 'debts' ? 'UNPAID' : 'SUCCESS');
        }
        if (val !== null && val !== undefined && numericCols.has(col.toLowerCase())) {
          val = Number(val);
        }
        rowObj[col] = val;
      });

      this.data[tableName].push(rowObj);
      this.saveToStorage();
      return { lastInsertRowId: newId, changes: 1 };
    }

    // UPDATE
    if (upper.startsWith('UPDATE')) {
      const tableMatch = sql.match(/UPDATE\s+(\w+)/i);
      if (!tableMatch) return { lastInsertRowId: 0, changes: 0 };
      const tableName = tableMatch[1].toLowerCase();
      const items = this.data[tableName] || [];
      let changes = 0;

      if (upper.includes('SET STATUS = ? WHERE ID = ?') || (upper.includes('UPDATE TRANSACTIONS') && upper.includes('STATUS ='))) {
        const [status, id] = params;
        items.forEach((item) => {
          if (item.id === id) {
            item.status = status;
            changes++;
          }
        });
      } else if (upper.includes('SET STOCK = STOCK + ? WHERE ID = ?')) {
        const [delta, id] = params;
        items.forEach((item) => {
          if (item.id === id) {
            item.stock = (item.stock || 0) + Number(delta);
            changes++;
          }
        });
      } else if (upper.includes('SET STOCK = STOCK - ? WHERE ID = ?')) {
        const [delta, id] = params;
        items.forEach((item) => {
          if (item.id === id) {
            item.stock = (item.stock || 0) - Number(delta);
            changes++;
          }
        });
      } else if (upper.includes('SET REMAINING_DEBT = ?, STATUS = ? WHERE ID = ?')) {
        const [remaining_debt, status, id] = params;
        items.forEach((item) => {
          if (item.id === id) {
            item.remaining_debt = Number(remaining_debt);
            item.status = status;
            changes++;
          }
        });
      } else if (upper.includes('SET TOTAL_DEBT =') && upper.includes('REMAINING_DEBT =')) {
        const [total_debt, remaining_debt] = params;
        const status = params.length >= 4 ? params[2] : 'UNPAID';
        const id = params[params.length - 1];
        items.forEach((item) => {
          if (item.id === id) {
            item.total_debt = Number(total_debt);
            item.remaining_debt = Number(remaining_debt);
            item.status = status;
            changes++;
          }
        });
      } else if (upper.includes('SET BARCODE = ?')) {
        const id = params[params.length - 1];
        const [barcode, name, buy_price, sell_price, stock, is_consignment, supplier_name, category] = params;
        const is_kg = params.length >= 10 ? params[8] : 0;
        items.forEach((item) => {
          if (item.id === id) {
            item.barcode = barcode;
            item.name = name;
            item.buy_price = Number(buy_price);
            item.sell_price = Number(sell_price);
            item.stock = Number(stock);
            item.is_consignment = is_consignment;
            item.supplier_name = supplier_name;
            item.category = category;
            item.is_kg = is_kg;
            changes++;
          }
        });
      } else if (upper.includes('DEBT_AMOUNT') && upper.includes('PAYMENT_METHOD') && upper.includes('WHERE ID = ?')) {
        if (upper.includes('TOTAL_AMOUNT')) {
          const [total_amount, cash_paid, debt_amount, payment_method, id] = params;
          items.forEach((item) => {
            if (item.id === id) {
              item.total_amount = Number(total_amount);
              item.cash_paid = Number(cash_paid);
              item.debt_amount = Number(debt_amount);
              item.payment_method = payment_method;
              changes++;
            }
          });
        } else if (upper.includes('CASH_PAID')) {
          const [cash_paid, debt_amount, payment_method, id] = params;
          items.forEach((item) => {
            if (item.id === id) {
              item.cash_paid = Number(cash_paid);
              item.debt_amount = Number(debt_amount);
              item.payment_method = payment_method;
              changes++;
            }
          });
        } else {
          const [debt_amount, payment_method, id] = params;
          items.forEach((item) => {
            if (item.id === id) {
              item.debt_amount = Number(debt_amount);
              item.payment_method = payment_method;
              changes++;
            }
          });
        }
      } else if (upper.includes('SET DEBT_AMOUNT = 0 WHERE')) {
        const name = (params[0] || '').trim().toLowerCase();
        (this.data.transactions || []).forEach((t) => {
          const tName = ((t.customer_name || '').trim() || 'Pelanggan Utang').toLowerCase();
          if (tName === name) {
            t.debt_amount = 0;
          }
        });
        changes++;
      } else if (upper.includes('SET SHOP_NAME = ?')) {
        const [shop_name, owner_name, phone, address, bank_name, bank_account_number, bank_account_holder, qris_image_uri, id] = params;
        items.forEach((item) => {
          if (item.id === id || items.length === 1) {
            item.shop_name = shop_name;
            item.owner_name = owner_name;
            item.phone = phone;
            item.address = address;
            item.bank_name = bank_name;
            item.bank_account_number = bank_account_number;
            item.bank_account_holder = bank_account_holder;
            item.qris_image_uri = qris_image_uri;
            changes++;
          }
        });
      }

      this.saveToStorage();
      return { lastInsertRowId: 0, changes };
    }

    // DELETE
    if (upper.startsWith('DELETE FROM')) {
      const tableMatch = sql.match(/DELETE\s+FROM\s+(\w+)/i);
      if (!tableMatch) return { lastInsertRowId: 0, changes: 0 };
      const tableName = tableMatch[1].toLowerCase();
      const initialLen = (this.data[tableName] || []).length;

      if (upper.includes('WHERE DEBT_ID = ?')) {
        const debtIdParam = Number(params[0]) || params[0];
        this.data[tableName] = (this.data[tableName] || []).filter((item) => Number(item.debt_id) !== Number(debtIdParam));
      } else if (upper.includes('WHERE TRANSACTION_ID = ?')) {
        const trxIdParam = Number(params[0]) || params[0];
        this.data[tableName] = (this.data[tableName] || []).filter((item) => Number(item.transaction_id) !== Number(trxIdParam));
      } else {
        const idParam = Number(params[0]) || params[0];
        this.data[tableName] = (this.data[tableName] || []).filter((item) => Number(item.id) !== Number(idParam));
      }

      const changes = initialLen - this.data[tableName].length;
      this.saveToStorage();
      return { lastInsertRowId: 0, changes };
    }

    return { lastInsertRowId: 0, changes: 0 };
  }

  private querySqlStatement<T>(sql: string, params: any[] = []): T[] {
    const upper = sql.trim().toUpperCase();

    // SELECT COUNT(*) as count FROM products
    if (upper.includes('COUNT(*) AS COUNT FROM PRODUCTS')) {
      const count = (this.data.products || []).length;
      return [{ count } as any];
    }

    // Daily revenue & cost (HPP): SELECT SUM(...) as today_revenue, SUM(total_cost) as today_cost
    if (upper.includes('TODAY_REVENUE')) {
      const dateParam = (params[0] || '').replace(/%/g, '').slice(0, 10);
      const successTrxs = (this.data.transactions || []).filter((t) => {
        if (t.status && t.status !== 'SUCCESS') return false;
        if (!dateParam) return true;
        const trxDate = (t.created_at || '').slice(0, 10);
        return trxDate === dateParam || !t.created_at;
      });
      const today_revenue = successTrxs.reduce((sum, t) => {
        const cashPaid = t.cash_paid != null ? Number(t.cash_paid) : 0;
        const totalAmt = t.total_amount != null ? Number(t.total_amount) : 0;
        if (t.payment_method === 'UTANG' || t.payment_method === 'CASH+UTANG') {
          return sum + cashPaid;
        }
        return sum + totalAmt;
      }, 0);
      const today_cost = successTrxs.reduce((sum, t) => sum + Number(t.total_cost || 0), 0);
      const trx_count = successTrxs.length;
      return [{ today_revenue, today_cost, trx_count } as any];
    }

    // Total revenue & cost (HPP): SELECT SUM(...) as total_revenue
    if (upper.includes('TOTAL_REVENUE') || (upper.includes('FROM TRANSACTIONS') && (upper.includes('TOTAL_COST') || upper.includes('COUNT(*) AS TRX_COUNT')))) {
      const successTrxs = (this.data.transactions || []).filter((t) => !t.status || t.status === 'SUCCESS');
      const total_revenue = successTrxs.reduce((sum, t) => {
        const cashPaid = t.cash_paid != null ? Number(t.cash_paid) : 0;
        const totalAmt = t.total_amount != null ? Number(t.total_amount) : 0;
        if (t.payment_method === 'UTANG' || t.payment_method === 'CASH+UTANG') {
          return sum + cashPaid;
        }
        return sum + totalAmt;
      }, 0);
      const total_cost = successTrxs.reduce((sum, t) => sum + Number(t.total_cost || 0), 0);
      const trx_count = successTrxs.length;
      return [{ total_revenue, total_cost, trx_count } as any];
    }

    // SELECT SUM(amount) as total_prive FROM prive_expenses WHERE type = 'PRIVE'
    if (upper.includes('SUM(AMOUNT) AS TOTAL_PRIVE')) {
      const prives = (this.data.prive_expenses || []).filter((p) => p.type === 'PRIVE');
      const total_prive = prives.reduce((sum, p) => sum + Number(p.amount || 0), 0);
      return [{ total_prive } as any];
    }

    // SELECT SUM(amount) as total_expense FROM prive_expenses WHERE type = 'EXPENSE'
    if (upper.includes('SUM(AMOUNT) AS TOTAL_EXPENSE')) {
      const expenses = (this.data.prive_expenses || []).filter((p) => p.type === 'EXPENSE');
      const total_expense = expenses.reduce((sum, p) => sum + Number(p.amount || 0), 0);
      return [{ total_expense } as any];
    }

    // SELECT SUM(ti.qty * ti.buy_price) as today_owed / total_owed FROM transaction_items
    if (upper.includes('TODAY_OWED') || (upper.includes('TOTAL_OWED') && upper.includes('TRANSACTION_ITEMS'))) {
      const consignmentProducts = new Set((this.data.products || []).filter((p) => p.is_consignment === 1).map((p) => p.id));
      const dateParam = (params[0] || '').replace(/%/g, '').slice(0, 10);
      const successTrxIds = new Set(
        (this.data.transactions || [])
          .filter((t) => {
            if (t.status && t.status !== 'SUCCESS') return false;
            if (upper.includes('TODAY_OWED') && dateParam) {
              const trxDate = (t.created_at || '').slice(0, 10);
              return trxDate === dateParam || !t.created_at;
            }
            return true;
          })
          .map((t) => t.id)
      );

      const consignmentItems = (this.data.transaction_items || []).filter(
        (ti) => consignmentProducts.has(ti.product_id) && successTrxIds.has(ti.transaction_id)
      );
      const owed = consignmentItems.reduce((sum, ti) => sum + (Number(ti.qty || 0) * Number(ti.buy_price || 0)), 0);
      return upper.includes('TODAY_OWED') ? ([{ today_owed: owed } as any]) : ([{ total_owed: owed } as any]);
    }

    // SELECT SUM(remaining_debt) as total_debt FROM debts WHERE status != 'PAID'
    if (upper.includes('SUM(REMAINING_DEBT)') || upper.includes('SUM(REMAINING_DEBT) AS TOTAL_DEBT')) {
      const activeDebts = (this.data.debts || []).filter((d) => d.status !== 'PAID');
      const total_debt = activeDebts.reduce((sum, d) => sum + Number(d.remaining_debt || 0), 0);
      return [{ total_debt } as any];
    }

    // SELECT * FROM products WHERE barcode = ?
    if (upper.includes('FROM PRODUCTS WHERE BARCODE = ?')) {
      const barcode = params[0];
      return (this.data.products || []).filter((p) => p.barcode === barcode) as any[];
    }

    // SELECT * FROM products WHERE name LIKE ? OR barcode LIKE ? OR supplier_name LIKE ?
    if (upper.includes('FROM PRODUCTS WHERE NAME LIKE ?')) {
      const term = (params[0] || '').replace(/%/g, '').toLowerCase();
      return (this.data.products || []).filter((p) => {
        return (
          (p.name && p.name.toLowerCase().includes(term)) ||
          (p.barcode && p.barcode.toLowerCase().includes(term)) ||
          (p.supplier_name && p.supplier_name.toLowerCase().includes(term))
        );
      }).sort((a, b) => a.name.localeCompare(b.name)) as any[];
    }

    // SELECT * FROM products ORDER BY name ASC
    if (upper.includes('FROM PRODUCTS')) {
      return [...(this.data.products || [])].sort((a, b) => a.name.localeCompare(b.name)) as any[];
    }

    // SELECT * FROM debts WHERE LOWER(customer_name) = LOWER(?) AND status != 'PAID'
    if (upper.includes('FROM DEBTS WHERE LOWER(CUSTOMER_NAME) = LOWER(?)')) {
      const name = (params[0] || '').toLowerCase();
      return (this.data.debts || []).filter(
        (d) => (d.customer_name || '').toLowerCase() === name && d.status !== 'PAID'
      ) as any[];
    }

    // SELECT * FROM debts WHERE id = ?
    if (upper.includes('FROM DEBTS WHERE ID = ?')) {
      const id = params[0];
      return (this.data.debts || []).filter((d) => d.id === id) as any[];
    }

    // SELECT * FROM debts ORDER BY... (Strictly by creation order, newest first)
    if (upper.includes('FROM DEBTS')) {
      return [...(this.data.debts || [])].sort((a, b) => b.id - a.id) as any[];
    }

    // SELECT * FROM debt_payments WHERE id = ?
    if (upper.includes('FROM DEBT_PAYMENTS WHERE ID = ?')) {
      const id = params[0];
      return (this.data.debt_payments || []).filter((dp) => dp.id === id) as any[];
    }

    // SELECT * FROM debt_payments WHERE debt_id = ?
    if (upper.includes('FROM DEBT_PAYMENTS WHERE DEBT_ID = ?')) {
      const debtId = params[0];
      return (this.data.debt_payments || [])
        .filter((dp) => dp.debt_id === debtId)
        .sort((a, b) => b.id - a.id) as any[];
    }

    // SELECT * FROM prive_expenses
    if (upper.includes('FROM PRIVE_EXPENSES')) {
      return [...(this.data.prive_expenses || [])].sort((a, b) => b.id - a.id) as any[];
    }

    // SELECT * FROM transactions WHERE id = ?
    if (upper.includes('FROM TRANSACTIONS WHERE ID = ?')) {
      const id = params[0];
      return (this.data.transactions || []).filter((t) => t.id === id) as any[];
    }

    // SELECT * FROM transactions WHERE LOWER(COALESCE(customer_name, 'Pelanggan Utang')) = LOWER(?)
    if (upper.includes('FROM TRANSACTIONS') && (upper.includes('CUSTOMER_NAME') || upper.includes('COALESCE'))) {
      const name = (params[0] || '').toLowerCase().trim();
      return (this.data.transactions || [])
        .filter((t) => {
          const tName = ((t.customer_name || '').trim() || 'Pelanggan Utang').toLowerCase();
          return tName === name && (t.debt_amount || 0) > 0;
        })
        .sort((a, b) => a.id - b.id) as any[];
    }

    // SELECT * FROM transactions ORDER BY id DESC LIMIT ?
    if (upper.includes('FROM TRANSACTIONS')) {
      const limit = params[0] || 20;
      return [...(this.data.transactions || [])].sort((a, b) => b.id - a.id).slice(0, limit) as any[];
    }

    // SELECT * FROM transaction_items WHERE transaction_id = ?
    if (upper.includes('FROM TRANSACTION_ITEMS WHERE TRANSACTION_ID = ?')) {
      const transactionId = params[0];
      return (this.data.transaction_items || []).filter((ti) => ti.transaction_id === transactionId) as any[];
    }

    return [];
  }

  private parseInsertValuesList(valuesStr: string): any[][] {
    const rows: any[][] = [];
    const rawTuples = valuesStr.split(/\),\s*\(/);
    for (const tuple of rawTuples) {
      const clean = tuple.replace(/^\s*\(/, '').replace(/\)\s*;?$/, '');
      const parts: any[] = [];
      let current = '';
      let inQuote = false;

      for (let i = 0; i < clean.length; i++) {
        const char = clean[i];
        if (char === "'" && (i === 0 || clean[i - 1] !== '\\')) {
          inQuote = !inQuote;
        } else if (char === ',' && !inQuote) {
          parts.push(this.castValue(current.trim()));
          current = '';
        } else {
          current += char;
        }
      }
      if (current.trim()) {
        parts.push(this.castValue(current.trim()));
      }
      rows.push(parts);
    }
    return rows;
  }

  private castValue(val: string): any {
    if (val.toUpperCase() === 'NULL') return null;
    if (val.startsWith("'") && val.endsWith("'")) return val.slice(1, -1);
    const num = Number(val);
    if (!isNaN(num)) return num;
    return val;
  }
}

export const webSQLiteDatabase = new WebSQLiteDatabase() as unknown as SQLiteDatabase;
