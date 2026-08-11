import React, { useState } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, Alert } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useSQLiteContext } from 'expo-sqlite';
import { useRouter } from 'expo-router';
import { getProductByBarcode } from '../src/services/productService';
import { formatRupiah } from '../src/utils/formatters';
import { Colors } from '../src/constants/theme';
import { Ionicons } from '@expo/vector-icons';

export default function ScannerScreen() {
  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);
  const db = useSQLiteContext();
  const router = useRouter();

  if (!permission) {
    return <View style={styles.container} />;
  }

  if (!permission.granted) {
    return (
      <View style={styles.permissionContainer}>
        <Text style={styles.permissionTitle}>Akses Kamera Diperlukan</Text>
        <Text style={styles.permissionSub}>
          LabaNotera membutuhkan izin kamera untuk memindai kode batang (barcode) produk warung.
        </Text>
        <TouchableOpacity style={styles.permissionBtn} onPress={requestPermission}>
          <Text style={styles.permissionBtnText}>Izinkan Kamera</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const handleBarcodeScanned = async ({ data }: { type: string; data: string }) => {
    if (scanned) return;
    setScanned(true);

    try {
      const product = await getProductByBarcode(db, data);

      if (product) {
        Alert.alert(
          'Produk Ditemukan! 📦',
          `Nama: ${product.name}\nHarga Jual: ${formatRupiah(product.sell_price)}\nStok: ${product.stock}\nBarcode: ${data}`,
          [
            {
              text: 'Kembali Ke Kasir',
              onPress: () => router.back(),
            },
            {
              text: 'Scan Lagi',
              onPress: () => setScanned(false),
            },
          ]
        );
      } else {
        Alert.alert(
          'Produk Baru 🆕',
          `Barcode "${data}" belum terdaftar di database warung. Apakah Anda ingin mendaftarkan produk ini?`,
          [
            {
              text: 'Batal',
              onPress: () => setScanned(false),
              style: 'cancel',
            },
            {
              text: 'Tambah Ke Stok',
              onPress: () => {
                router.replace({
                  pathname: '/(tabs)/stock',
                  params: { autoBarcode: data },
                });
              },
            },
          ]
        );
      }
    } catch (err) {
      console.error('Error on barcode scan:', err);
      setScanned(false);
    }
  };

  return (
    <View style={styles.container}>
      <CameraView
        style={StyleSheet.absoluteFill}
        facing="back"
        onBarcodeScanned={scanned ? undefined : handleBarcodeScanned}
        barcodeScannerSettings={{
          barcodeTypes: ['ean13', 'ean8', 'code128', 'qr', 'upc_a', 'upc_e'],
        }}
      >
        <View style={styles.overlay}>
          {/* Top Header */}
          <View style={styles.topHeader}>
            <TouchableOpacity style={styles.closeBtn} onPress={() => router.back()}>
              <Ionicons name="close" color="#FFFFFF" size={24} />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Scan Barcode Barang</Text>
          </View>

          {/* Scanner Target Box */}
          <View style={styles.scanTargetContainer}>
            <View style={styles.scanBox} />
            <Text style={styles.instructionText}>
              Arahkan kamera ke kode batang pada kemasan barang
            </Text>
          </View>

          {/* Bottom Controls */}
          {scanned ? (
            <View style={styles.bottomControls}>
              <TouchableOpacity
                style={styles.rescanBtn}
                onPress={() => setScanned(false)}
              >
                <Ionicons name="refresh" color="#FFFFFF" size={20} />
                <Text style={styles.rescanText}>Scan Ulang</Text>
              </TouchableOpacity>
            </View>
          ) : null}
        </View>
      </CameraView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  permissionContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
    backgroundColor: Colors.background,
  },
  permissionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: Colors.text,
    marginBottom: 8,
  },
  permissionSub: {
    fontSize: 14,
    color: Colors.textSecondary,
    textAlign: 'center',
    marginBottom: 20,
  },
  permissionBtn: {
    backgroundColor: Colors.primary,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 10,
  },
  permissionBtnText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
    fontSize: 15,
  },
  overlay: {
    flex: 1,
    justifyContent: 'space-between',
    backgroundColor: 'rgba(0,0,0,0.3)',
  },
  topHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 50,
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  closeBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: 'bold',
    marginLeft: 16,
  },
  scanTargetContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  scanBox: {
    width: 260,
    height: 200,
    borderWidth: 2,
    borderColor: Colors.accent,
    borderRadius: 16,
    backgroundColor: 'transparent',
  },
  instructionText: {
    color: '#FFFFFF',
    fontSize: 13,
    marginTop: 16,
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  bottomControls: {
    padding: 24,
    alignItems: 'center',
  },
  rescanBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.primary,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 30,
    gap: 8,
  },
  rescanText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: 'bold',
  },
});
