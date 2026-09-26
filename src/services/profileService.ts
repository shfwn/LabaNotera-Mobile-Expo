import { SQLiteDatabase } from 'expo-sqlite';
import { ShopProfile } from '../types';

export const DEFAULT_PROFILE: ShopProfile = {
  id: 1,
  shop_name: 'Warung LabaNotera',
  owner_name: '',
  phone: '',
  address: '',
  bank_name: 'BCA',
  bank_account_number: '',
  bank_account_holder: '',
  qris_image_uri: null,
  closing_time: '21:00',
};

export async function getShopProfile(db: SQLiteDatabase): Promise<ShopProfile> {
  try {
    const profile = await db.getFirstAsync<ShopProfile>('SELECT * FROM shop_profile LIMIT 1');
    if (profile) {
      return {
        ...profile,
        closing_time: profile.closing_time || '21:00',
      };
    }
    // If not found, create one
    await db.runAsync(
      `INSERT INTO shop_profile (shop_name, bank_name, bank_account_number, bank_account_holder, closing_time)
       VALUES (?, ?, ?, ?, ?)`,
      [DEFAULT_PROFILE.shop_name, DEFAULT_PROFILE.bank_name || 'BCA', '', '', '21:00']
    );
    const newProfile = await db.getFirstAsync<ShopProfile>('SELECT * FROM shop_profile LIMIT 1');
    return newProfile || DEFAULT_PROFILE;
  } catch (error) {
    console.error('Error fetching shop profile:', error);
    return DEFAULT_PROFILE;
  }
}

export async function updateShopProfile(
  db: SQLiteDatabase,
  profile: ShopProfile
): Promise<void> {
  const existing = await getShopProfile(db);
  const targetId = existing?.id || 1;

  await db.runAsync(
    `UPDATE shop_profile 
     SET shop_name = ?, owner_name = ?, phone = ?, address = ?, bank_name = ?, bank_account_number = ?, bank_account_holder = ?, qris_image_uri = ?, closing_time = ?, updated_at = CURRENT_TIMESTAMP
     WHERE id = ?`,
    [
      profile.shop_name.trim() || 'Warung LabaNotera',
      profile.owner_name?.trim() || null,
      profile.phone?.trim() || null,
      profile.address?.trim() || null,
      profile.bank_name?.trim() || 'BCA',
      profile.bank_account_number?.trim() || null,
      profile.bank_account_holder?.trim() || null,
      profile.qris_image_uri || null,
      profile.closing_time?.trim() || '21:00',
      targetId,
    ]
  );
}

export async function updateLastReportDate(
  db: SQLiteDatabase,
  dateStr: string
): Promise<void> {
  const existing = await getShopProfile(db);
  const targetId = existing?.id || 1;

  await db.runAsync(
    `UPDATE shop_profile 
     SET last_report_date = ?, updated_at = CURRENT_TIMESTAMP
     WHERE id = ?`,
    [dateStr, targetId]
  );
}
