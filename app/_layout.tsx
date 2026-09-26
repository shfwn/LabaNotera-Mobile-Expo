import React, { useEffect } from 'react';
import { Platform } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useFonts } from 'expo-font';
import Ionicons from '@expo/vector-icons/Ionicons';
import * as SplashScreen from 'expo-splash-screen';
import { AppSQLiteProvider } from '../src/db/AppDatabaseProvider';
import { Colors } from '../src/constants/theme';
import CustomAlertModal from '../src/components/CustomAlertModal';
import GlobalClosingReminder from '../src/components/GlobalClosingReminder';

// Prevent splash screen from auto-hiding before asset loading is complete
SplashScreen.preventAutoHideAsync().catch(() => {});

// Prevent fontfaceobserver 6000ms timeout from crashing web/mobile browser
if (Platform.OS === 'web' && typeof window !== 'undefined') {
  window.addEventListener('unhandledrejection', (event) => {
    if (
      event.reason?.message?.includes('6000ms timeout exceeded') ||
      event.reason?.message?.includes('fontfaceobserver')
    ) {
      event.preventDefault();
    }
  });
}

export const unstable_settings = {
  initialRouteName: '(tabs)',
};

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    ...Ionicons.font,
  });

  useEffect(() => {
    if (fontsLoaded || fontError) {
      SplashScreen.hideAsync().catch(() => {});
    }
  }, [fontsLoaded, fontError]);

  return (
    <SafeAreaProvider>
      <AppSQLiteProvider>
        <StatusBar style="light" />
        <Stack
          screenOptions={{
            headerStyle: {
              backgroundColor: Colors.primaryDark,
            },
            headerTintColor: '#FFFFFF',
            headerTitleStyle: {
              fontWeight: 'bold',
            },
          }}
        >
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen
            name="scanner"
            options={{
              presentation: 'modal',
              title: 'Scan Barcode Produk',
              headerBackTitle: 'Batal',
            }}
          />
          <Stack.Screen
            name="prive-modal"
            options={{
              presentation: 'modal',
              title: 'Catat Uang Dapur & Biaya',
              headerBackTitle: 'Tutup',
            }}
          />
          <Stack.Screen
            name="receipt/[id]"
            options={{
              title: 'Struk Transaksi',
              headerBackTitle: 'Kembali',
            }}
          />
        </Stack>
        <GlobalClosingReminder />
        <CustomAlertModal />
      </AppSQLiteProvider>
    </SafeAreaProvider>
  );
}
