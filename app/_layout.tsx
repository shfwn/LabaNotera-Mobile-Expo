import { Stack } from 'expo-router';
import { SQLiteProvider } from 'expo-sqlite';
import { StatusBar } from 'expo-status-bar';
import { View, Text, StyleSheet, Platform } from 'react-native';
import { initDatabase } from '../src/db';
import { Colors } from '../src/constants/theme';
import { Ionicons } from '@expo/vector-icons';

export const unstable_settings = {
  initialRouteName: '(tabs)',
};

export default function RootLayout() {
  if (Platform.OS === 'web') {
    return (
      <View style={styles.webContainer}>
        <StatusBar style="dark" />
        <Ionicons name="phone-portrait-outline" color={Colors.primary} size={64} style={{ marginBottom: 16 }} />
        <Text style={styles.webTitle}>Aplikasi Mobile LabaNotera</Text>
        <Text style={styles.webSubtitle}>
          LabaNotera menggunakan basis data lokal SQLite (Offline-First) yang dirancang khusus untuk berjalan di smartphone (Android / iOS) melalui aplikasi **Expo Go**.
        </Text>
        <View style={styles.guideBox}>
          <Text style={styles.guideTitle}>📲 Cara Buka di Smartphone HP Anda:</Text>
          <Text style={styles.guideStep}>1. Buka aplikasi **Expo Go** di HP (Android/iOS).</Text>
          <Text style={styles.guideStep}>2. Scan QR code yang tampil di terminal komputer setelah mengetik `npx expo start`.</Text>
        </View>
      </View>
    );
  }

  return (
    <SQLiteProvider
      databaseName="labanotera.db"
      onInit={initDatabase}
      useSuspense={false}
    >
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
    </SQLiteProvider>
  );
}

const styles = StyleSheet.create({
  webContainer: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  webTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: Colors.text,
    marginBottom: 8,
  },
  webSubtitle: {
    fontSize: 14,
    color: Colors.textSecondary,
    textAlign: 'center',
    maxWidth: 480,
    lineHeight: 22,
    marginBottom: 24,
  },
  guideBox: {
    backgroundColor: '#FFFFFF',
    padding: 20,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    maxWidth: 480,
    width: '100%',
  },
  guideTitle: {
    fontSize: 15,
    fontWeight: 'bold',
    color: Colors.primaryDark,
    marginBottom: 10,
  },
  guideStep: {
    fontSize: 13,
    color: Colors.text,
    marginBottom: 6,
    lineHeight: 18,
  },
});
