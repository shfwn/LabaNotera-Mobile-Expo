import { Platform } from 'react-native';
import { isRunningInExpoGo } from 'expo';

// Safe subpath imports from expo-notifications to avoid DevicePushTokenAutoRegistration.fx in Expo Go
import { setNotificationHandler } from 'expo-notifications/build/NotificationsHandler';
import {
  getPermissionsAsync,
  requestPermissionsAsync,
} from 'expo-notifications/build/NotificationPermissions';
import { setNotificationChannelAsync } from 'expo-notifications/build/setNotificationChannelAsync';
import { scheduleNotificationAsync } from 'expo-notifications/build/scheduleNotificationAsync';
import { cancelScheduledNotificationAsync } from 'expo-notifications/build/cancelScheduledNotificationAsync';
import { addNotificationResponseReceivedListener } from 'expo-notifications/build/NotificationsEmitter';
import { AndroidImportance } from 'expo-notifications/build/NotificationChannelManager.types';
import { SchedulableTriggerInputTypes } from 'expo-notifications/build/Notifications.types';

// Configure how notifications appear when app is in foreground
try {
  setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
      shouldShowBanner: true,
      shouldShowList: true,
    }),
  });
} catch {
  // ignore in unsupported environments
}

export async function initNotificationChannel(): Promise<void> {
  // Expo Go on Android does not support native notification channels
  if (Platform.OS === 'android' && !isRunningInExpoGo()) {
    try {
      await setNotificationChannelAsync('closing_reminders', {
        name: 'Pengingat Jam Tutup Toko',
        importance: AndroidImportance.HIGH,
        sound: 'default',
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#236B43',
      });
    } catch {
      // ignore
    }
  }
}

export async function requestNotificationPermission(): Promise<boolean> {
  if (Platform.OS === 'web' || isRunningInExpoGo()) return false;
  try {
    const { status: existingStatus } = await getPermissionsAsync();
    let finalStatus = existingStatus;
    if (existingStatus !== 'granted') {
      const { status } = await requestPermissionsAsync();
      finalStatus = status;
    }
    return finalStatus === 'granted';
  } catch {
    return false;
  }
}

export async function scheduleDailyClosingNotification(
  closingTimeStr: string,
  shopName?: string
): Promise<void> {
  if (Platform.OS === 'web' || isRunningInExpoGo()) return;

  try {
    await initNotificationChannel();
    const hasPermission = await requestNotificationPermission();
    if (!hasPermission) return;

    // Cancel existing daily closing reminder if any
    await cancelClosingNotification();

    const [closeH, closeM] = (closingTimeStr || '21:00')
      .split(':')
      .map((v) => parseInt(v, 10) || 0);

    await scheduleNotificationAsync({
      identifier: 'daily_closing_reminder',
      content: {
        title: `⏰ Waktu Tutup Toko (${closingTimeStr} WIB)`,
        body: `Warung ${shopName || 'Anda'} telah memasuki jam tutup. Buka aplikasi untuk Buat Laporan Keuangan Harian (PDF).`,
        data: { action: 'daily_report' },
        ...(Platform.OS === 'android' ? { channelId: 'closing_reminders' } : {}),
      },
      trigger: {
        type: SchedulableTriggerInputTypes.DAILY,
        hour: closeH,
        minute: closeM,
        ...(Platform.OS === 'android' ? { channelId: 'closing_reminders' } : {}),
      } as any,
    });
  } catch {
    // ignore
  }
}

export async function scheduleSnoozeNotification(
  minutes: number = 15,
  shopName?: string
): Promise<void> {
  if (Platform.OS === 'web' || isRunningInExpoGo()) return;

  try {
    await initNotificationChannel();
    const hasPermission = await requestNotificationPermission();
    if (!hasPermission) return;

    // Cancel previous snooze notification if any
    try {
      await cancelScheduledNotificationAsync('snooze_closing_reminder');
    } catch {
      // ignore
    }

    await scheduleNotificationAsync({
      identifier: 'snooze_closing_reminder',
      content: {
        title: '⏰ Pengingat Laporan Tutup Toko (15 Menit)',
        body: `Waktu tunda telah selesai. Yuk Buat Laporan Keuangan Harian (PDF) sekarang.`,
        data: { action: 'daily_report' },
        ...(Platform.OS === 'android' ? { channelId: 'closing_reminders' } : {}),
      },
      trigger: {
        type: SchedulableTriggerInputTypes.TIME_INTERVAL,
        seconds: Math.max(10, minutes * 60),
        repeats: false,
        ...(Platform.OS === 'android' ? { channelId: 'closing_reminders' } : {}),
      } as any,
    });
  } catch {
    // ignore
  }
}

export async function cancelClosingNotification(): Promise<void> {
  if (Platform.OS === 'web' || isRunningInExpoGo()) return;
  try {
    await cancelScheduledNotificationAsync('daily_closing_reminder');
  } catch {
    // ignore
  }
}

export function addNotificationClickListener(
  callback: (action: string) => void
): { remove: () => void } {
  if (Platform.OS === 'web' || isRunningInExpoGo()) {
    return { remove: () => {} };
  }
  try {
    const sub = addNotificationResponseReceivedListener((response) => {
      const data = response?.notification?.request?.content?.data as Record<string, any> | undefined;
      const action = data?.action;
      if (typeof action === 'string') {
        callback(action);
      }
    });
    return {
      remove: () => {
        try {
          sub.remove();
        } catch {
          // ignore
        }
      },
    };
  } catch {
    return { remove: () => {} };
  }
}
