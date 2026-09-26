import React, { useEffect, useRef } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import { useAppSQLiteContext } from '../db/AppDatabaseProvider';
import {
  checkAndPromptClosingReminder,
  syncClosingTimeSchedule,
} from '../utils/closingReminderHelper';
import { addNotificationClickListener } from '../utils/notificationHelper';

export default function GlobalClosingReminder() {
  const db = useAppSQLiteContext();
  const appStateRef = useRef<AppStateStatus>(AppState.currentState);

  useEffect(() => {
    // 1. Initial check after component tree is fully mounted
    const initialTimer = setTimeout(() => {
      checkAndPromptClosingReminder(db).catch(() => {});
      syncClosingTimeSchedule(db).catch(() => {});
    }, 1500);

    // 2. Periodic check every 30 seconds across the whole app
    const intervalId = setInterval(() => {
      checkAndPromptClosingReminder(db).catch(() => {});
    }, 30000);

    // 3. Check whenever app comes to foreground / becomes active
    const appStateSub = AppState.addEventListener('change', (nextAppState) => {
      if (
        appStateRef.current.match(/inactive|background/) &&
        nextAppState === 'active'
      ) {
        checkAndPromptClosingReminder(db).catch(() => {});
      }
      appStateRef.current = nextAppState;
    });

    // 4. Handle tap on local notification safely
    const notifSub = addNotificationClickListener((action) => {
      if (action === 'daily_report') {
        checkAndPromptClosingReminder(db, true).catch(() => {});
      }
    });

    return () => {
      clearTimeout(initialTimer);
      clearInterval(intervalId);
      appStateSub.remove();
      notifSub.remove();
    };
  }, [db]);

  return null;
}
