import React, { useState, useEffect, useCallback } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  ScrollView,
  Alert,
  SafeAreaView,
  ActivityIndicator,
} from 'react-native';
import { useSQLiteContext } from 'expo-sqlite';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Transaction, TransactionItem } from '../../src/types';
import { getTransactionDetails } from '../../src/services/posService';
import { printReceipt, shareReceiptPdf } from '../../src/utils/printHelper';
import { formatRupiah, formatTanggal } from '../../src/utils/formatters';
import { Colors } from '../../src/constants/theme';
import { Ionicons } from '@expo/vector-icons';

export default function ReceiptScreen() {
  const db = useSQLiteContext();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();

  const [transaction, setTransaction] = useState<Transaction | null>(null);
  const [items, setItems] = useState<TransactionItem[]>([]);
  const [loading, setLoading] = useState(true);

  const loadReceipt = useCallback(async () => {
    if (!id) return;
    try {
      const data = await getTransactionDetails(db, parseInt(id, 10));
      if (data) {
        setTransaction(data.transaction);
        setItems(data.items);
      }
    } catch (err) {
      console.error('Failed to load transaction details:', err);
    } finally {
      setLoading(false);
    }
  }, [db, id]);

  useEffect(() => {
    loadReceipt();
  }, [loadReceipt]);

  const handlePrint = async () => {
    if (!transaction) return;
    try {
      await printReceipt(transaction, items);
    } catch (err: any) {
      Alert.alert('Gagal Cetak', err.message || 'Terjadi kesalahan saat mencetak.');
    }
  };

  const handleSharePdf = async () => {
    if (!transaction) return;
    try {
      await shareReceiptPdf(transaction, items);
    } catch (err: any) {
      Alert.alert('Gagal Bagikan Struk', err.message || 'Terjadi kesalahan saat membagikan PDF.');
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={Colors.primary} />
        <Text style={styles.loadingText}>Memuat Struk Belanja...</Text>
      </View>
    );
  }

  if (!transaction) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.errorText}>Transaksi tidak ditemukan.</Text>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Text style={styles.backBtnText}>Kembali</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Success Banner */}
        <View style={styles.successBanner}>
          <Ionicons name="checkmark-circle" color={Colors.success} size={48} />
          <Text style={styles.successTitle}>Transaksi Berhasil!</Text>
          <Text style={styles.successSub}>Struk digital siap dicetak atau dibagikan ke WhatsApp</Text>
        </View>

        {/* Paper Thermal Receipt Mockup */}
        <View style={styles.receiptPaper}>
          <View style={styles.receiptHeader}>
            <Ionicons name="storefront-outline" color={Colors.primaryDark} size={28} />
            <Text style={styles.storeTitle}>WARUNG LABANOTERA</Text>
            <Text style={styles.metaText}>Nota Pembayaran Kasir POS</Text>
            <Text style={styles.metaText}>No: {transaction.transaction_code}</Text>
            <Text style={styles.metaText}>Tgl: {formatTanggal(transaction.created_at)}</Text>
            {transaction.customer_name ? (
              <Text style={styles.metaText}>Pelanggan: {transaction.customer_name}</Text>
            ) : null}
          </View>

          <View style={styles.dashedDivider} />

          {/* Items */}
          <View style={styles.itemList}>
            {items.map((item) => (
              <View key={item.id} style={styles.itemRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.itemName}>{item.product_name}</Text>
                  <Text style={styles.itemSub}>
                    {item.qty} x {formatRupiah(item.sell_price)}
                  </Text>
                </View>
                <Text style={styles.itemSubtotal}>{formatRupiah(item.subtotal)}</Text>
              </View>
            ))}
          </View>

          <View style={styles.dashedDivider} />

          {/* Totals */}
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>TOTAL</Text>
            <Text style={styles.totalValue}>{formatRupiah(transaction.total_amount)}</Text>
          </View>

          <View style={styles.methodRow}>
            <Text style={styles.methodLabel}>Metode Pembayaran</Text>
            <Text style={styles.methodValue}>{transaction.payment_method}</Text>
          </View>

          <View style={styles.receiptFooter}>
            <Text style={styles.footerText}>Terima Kasih Atas Kunjungan Anda! 🙏</Text>
            <Text style={styles.footerSub}>Dicetak via Aplikasi LabaNotera</Text>
          </View>
        </View>

        {/* Action Buttons */}
        <View style={styles.actionsBox}>
          <TouchableOpacity style={styles.printBtn} onPress={handlePrint}>
            <Ionicons name="print-outline" color="#FFFFFF" size={20} />
            <Text style={styles.printBtnText}>Cetak Struk (Bluetooth / Thermal)</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.shareBtn} onPress={handleSharePdf}>
            <Ionicons name="share-social-outline" color={Colors.primaryDark} size={20} />
            <Text style={styles.shareBtnText}>Bagikan PDF / WhatsApp</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.doneBtn} onPress={() => router.navigate('/(tabs)')}>
            <Ionicons name="arrow-back-outline" color={Colors.textSecondary} size={18} />
            <Text style={styles.doneBtnText}>Kembali ke Kasir POS</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    backgroundColor: Colors.background,
  },
  loadingText: {
    marginTop: 12,
    color: Colors.textMuted,
    fontSize: 14,
  },
  errorText: {
    fontSize: 16,
    color: Colors.danger,
    marginBottom: 12,
  },
  backBtn: {
    backgroundColor: Colors.primary,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  backBtnText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
  },
  successBanner: {
    alignItems: 'center',
    marginBottom: 16,
  },
  successTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: Colors.text,
    marginTop: 8,
  },
  successSub: {
    fontSize: 12,
    color: Colors.textMuted,
    marginTop: 2,
    textAlign: 'center',
  },
  receiptPaper: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 20,
    borderWidth: 1,
    borderColor: Colors.border,
    elevation: 3,
    shadowColor: Colors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    marginBottom: 20,
  },
  receiptHeader: {
    alignItems: 'center',
    marginBottom: 12,
  },
  storeTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: Colors.primaryDark,
    marginTop: 6,
    letterSpacing: 1,
  },
  metaText: {
    fontSize: 11,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  dashedDivider: {
    borderBottomWidth: 1,
    borderBottomColor: '#CBD5E1',
    borderStyle: 'dashed',
    marginVertical: 12,
  },
  itemList: {
    gap: 8,
  },
  itemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  itemName: {
    fontSize: 13,
    fontWeight: 'bold',
    color: Colors.text,
  },
  itemSub: {
    fontSize: 11,
    color: Colors.textMuted,
    marginTop: 2,
  },
  itemSubtotal: {
    fontSize: 13,
    fontWeight: 'bold',
    color: Colors.text,
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 4,
  },
  totalLabel: {
    fontSize: 16,
    fontWeight: 'bold',
    color: Colors.text,
  },
  totalValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: Colors.primaryDark,
  },
  methodRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 6,
  },
  methodLabel: {
    fontSize: 12,
    color: Colors.textMuted,
  },
  methodValue: {
    fontSize: 12,
    fontWeight: 'bold',
    color: Colors.text,
  },
  receiptFooter: {
    alignItems: 'center',
    marginTop: 16,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  footerText: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  footerSub: {
    fontSize: 10,
    color: Colors.textMuted,
    marginTop: 2,
  },
  actionsBox: {
    gap: 10,
  },
  printBtn: {
    backgroundColor: Colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 10,
    gap: 8,
  },
  printBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: 'bold',
  },
  shareBtn: {
    backgroundColor: Colors.primaryLight,
    borderWidth: 1,
    borderColor: Colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 10,
    gap: 8,
  },
  shareBtnText: {
    color: Colors.primaryDark,
    fontSize: 15,
    fontWeight: 'bold',
  },
  doneBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    gap: 6,
  },
  doneBtnText: {
    color: Colors.textSecondary,
    fontSize: 14,
    fontWeight: '600',
  },
});
