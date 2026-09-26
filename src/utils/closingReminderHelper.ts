import { SQLiteDatabase } from 'expo-sqlite';
import { getShopProfile, updateLastReportDate } from '../services/profileService';
import { getDailyFullReportData, getTodayDateString } from '../services/reportService';
import { exportDailyReportPdf } from './pdfReportHelper';
import { showAppAlert } from './alertHelper';
import { scheduleSnoozeNotification, scheduleDailyClosingNotification } from './notificationHelper';

let lastCompletedDate: string | null = null;
let snoozeUntilTimestamp: number | null = null;
let isAlertCurrentlyOpen: boolean = false;

export function getSnoozeStatus(): { isSnoozed: boolean; remainingMinutes: number } {
  if (!snoozeUntilTimestamp) return { isSnoozed: false, remainingMinutes: 0 };
  const diffMs = snoozeUntilTimestamp - Date.now();
  if (diffMs <= 0) return { isSnoozed: false, remainingMinutes: 0 };
  return { isSnoozed: true, remainingMinutes: Math.ceil(diffMs / 60000) };
}

export function snoozeClosingReminder(minutes: number = 15, shopName?: string): void {
  snoozeUntilTimestamp = Date.now() + minutes * 60 * 1000;
  scheduleSnoozeNotification(minutes, shopName).catch(() => {});
}

export async function markDailyReportCompleted(db: SQLiteDatabase, dateStr: string): Promise<void> {
  lastCompletedDate = dateStr;
  snoozeUntilTimestamp = null;
  try {
    await updateLastReportDate(db, dateStr);
  } catch (err) {
    console.warn('Failed to persist last_report_date:', err);
  }
}

export async function syncClosingTimeSchedule(db: SQLiteDatabase): Promise<void> {
  try {
    const profile = await getShopProfile(db);
    if (profile?.closing_time) {
      await scheduleDailyClosingNotification(profile.closing_time, profile.shop_name);
    }
  } catch (err) {
    console.warn('syncClosingTimeSchedule error:', err);
  }
}

export async function checkAndPromptClosingReminder(
  db: SQLiteDatabase,
  forcePrompt: boolean = false
): Promise<void> {
  try {
    if (isAlertCurrentlyOpen) {
      return;
    }

    const today = getTodayDateString();
    const profile = await getShopProfile(db);

    // If report has already been created today (in DB or memory) and not forced, do nothing
    if (!forcePrompt && (profile.last_report_date === today || lastCompletedDate === today)) {
      return;
    }

    const closingTimeStr = profile.closing_time || '21:00';
    const [closeH, closeM] = closingTimeStr.split(':').map((v) => parseInt(v, 10) || 0);

    const now = new Date();
    const currentTotalMinutes = now.getHours() * 60 + now.getMinutes();
    const closeTotalMinutes = closeH * 60 + closeM;

    // Check if snooze is currently active
    if (!forcePrompt && snoozeUntilTimestamp !== null) {
      if (Date.now() < snoozeUntilTimestamp) {
        // Still in snooze window
        return;
      } else {
        // Snooze window elapsed, reset snooze and proceed to prompt
        snoozeUntilTimestamp = null;
      }
    } else if (!forcePrompt && currentTotalMinutes < closeTotalMinutes) {
      // Not yet reached closing time
      return;
    }

    isAlertCurrentlyOpen = true;

    showAppAlert(
      `⏰ Waktu Tutup Toko (${closingTimeStr} WIB)`,
      `Warung ${profile.shop_name || 'Anda'} telah memasuki jam tutup toko.\n\nApakah Anda ingin membuat Laporan Keuangan Laba-Rugi Hari Ini sekarang?`,
      [
        {
          text: 'Nanti Saja',
          style: 'cancel',
          onPress: () => {
            isAlertCurrentlyOpen = false;
            snoozeClosingReminder(15, profile.shop_name);
          },
        },
        {
          text: 'Buat Laporan',
          onPress: async () => {
            isAlertCurrentlyOpen = false;
            try {
              await markDailyReportCompleted(db, today);
              const reportData = await getDailyFullReportData(db, today);
              await exportDailyReportPdf(reportData);
            } catch (err: any) {
              showAppAlert('Gagal Buat Laporan', err?.message || 'Terjadi kesalahan saat mengekspor laporan.');
            }
          },
        },
      ]
    );
  } catch (err) {
    isAlertCurrentlyOpen = false;
    console.error('Error in checkAndPromptClosingReminder:', err);
  }
}
