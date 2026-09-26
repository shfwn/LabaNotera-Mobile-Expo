import React, { useState } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, TextInput, Platform } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useAppSQLiteContext as useSQLiteContext } from '../src/db/AppDatabaseProvider';
import { useRouter } from 'expo-router';
import { getProductByBarcode } from '../src/services/productService';
import { formatRupiah } from '../src/utils/formatters';
import { Colors } from '../src/constants/theme';
import { Ionicons } from '@expo/vector-icons';
import { showAppAlert } from '../src/utils/alertHelper';

export default function ScannerScreen() {
  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);
  const [manualBarcode, setManualBarcode] = useState('');
  const db = useSQLiteContext();
  const router = useRouter();

  const handleBarcodeScanned = async ({ data }: { type: string; data: string }) => {
    if (scanned) return;
    setScanned(true);

    try {
      const product = await getProductByBarcode(db, data);

      if (product) {
        showAppAlert(
          'Produk Ditemukan',
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
        showAppAlert(
          'Produk Baru',
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

  const handleManualSubmit = () => {
    if (!manualBarcode.trim()) return;
    handleBarcodeScanned({ type: 'manual', data: manualBarcode.trim() });
  };

  if (Platform.OS === 'web') {
    return (
      <View style={styles.webContainer}>
        <View style={styles.topHeader}>
          <TouchableOpacity style={styles.closeBtn} onPress={() => router.back()}>
            <Ionicons name="close" color="#FFFFFF" size={24} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Scan / Input Barcode (Web)</Text>
        </View>

        <View style={styles.webBox}>
          <Ionicons name="qr-code-outline" color={Colors.primary} size={64} style={{ marginBottom: 16 }} />
          <Text style={styles.webTitle}>Input Kode Barcode Barang</Text>
          <Text style={styles.webSub}>
            Ketik nomor barcode atau gunakan alat scanner USB/Bluetooth.
          </Text>

          <View style={styles.manualRow}>
            <TextInput
              style={styles.webInput}
              placeholder="Contoh: 899999900001 / 089686010018"
              value={manualBarcode}
              onChangeText={setManualBarcode}
              onSubmitEditing={handleManualSubmit}
              autoFocus
            />
            <TouchableOpacity style={styles.webSubmitBtn} onPress={handleManualSubmit}>
              <Text style={styles.webSubmitBtnText}>Cari</Text>
            </TouchableOpacity>
          </View>

          <Text style={styles.sampleTitle}>Contoh Barcode Sampel:</Text>
          <View style={styles.samplesRow}>
            <TouchableOpacity
              style={styles.sampleChip}
              onPress={() => {
                setManualBarcode('899999900001');
                handleBarcodeScanned({ type: 'manual', data: '899999900001' });
              }}
            >
              <Text style={styles.sampleChipText}>Bimoli (899999900001)</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.sampleChip}
              onPress={() => {
                setManualBarcode('089686010018');
                handleBarcodeScanned({ type: 'manual', data: '089686010018' });
              }}
            >
              <Text style={styles.sampleChipText}>Indomie (089686010018)</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    );
  }

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
  webContainer: {
    flex: 1,
    backgroundColor: Colors.primaryDark,
  },
  webBox: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    margin: 20,
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  webTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: Colors.text,
    marginBottom: 6,
  },
  webSub: {
    fontSize: 13,
    color: Colors.textMuted,
    textAlign: 'center',
    marginBottom: 20,
  },
  manualRow: {
    flexDirection: 'row',
    width: '100%',
    maxWidth: 420,
    gap: 8,
    marginBottom: 20,
  },
  webInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 8,
    paddingHorizontal: 12,
    height: 44,
    fontSize: 14,
  },
  webSubmitBtn: {
    backgroundColor: Colors.primary,
    paddingHorizontal: 20,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  webSubmitBtnText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
  },
  sampleTitle: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginBottom: 8,
  },
  samplesRow: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
    justifyContent: 'center',
  },
  sampleChip: {
    backgroundColor: Colors.primaryLight,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  sampleChipText: {
    color: Colors.primaryDark,
    fontSize: 12,
    fontWeight: '600',
  },
});
