import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { AppSQLiteProvider } from '../src/db/AppDatabaseProvider';
import { Colors } from '../src/constants/theme';

export const unstable_settings = {
  initialRouteName: '(tabs)',
};

export default function RootLayout() {
  return (
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
    </AppSQLiteProvider>
  );
}
