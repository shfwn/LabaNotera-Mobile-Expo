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
import { useAppSQLiteContext as useSQLiteContext } from '../../src/db/AppDatabaseProvider';
import { useLocalSearchParams, useRouter, useFocusEffect } from 'expo-router';
import { Transaction, TransactionItem, ShopProfile } from '../../src/types';
import { getTransactionDetails } from '../../src/services/posService';
import { getShopProfile } from '../../src/services/profileService';
import { printReceipt, shareReceiptPdf } from '../../src/utils/printHelper';
import { formatRupiah, formatTanggal } from '../../src/utils/formatters';
import { getShadowStyle } from '../../src/utils/styleHelper';
import { Colors } from '../../src/constants/theme';
import { Ionicons } from '@expo/vector-icons';

export default function ReceiptScreen() {
  const db = useSQLiteContext();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();

  const [transaction, setTransaction] = useState<Transaction | null>(null);
  const [items, setItems] = useState<TransactionItem[]>([]);
  const [shopProfile, setShopProfile] = useState<ShopProfile | null>(null);
  const [loading, setLoading] = useState(true);

  const loadReceipt = useCallback(async () => {
    if (!id) return;
    try {
      const data = await getTransactionDetails(db, parseInt(id, 10));
      if (data) {
        setTransaction(data.transaction);
        setItems(data.items);
      }
      const profile = await getShopProfile(db);
      setShopProfile(profile);
    } catch (err) {
      console.error('Failed to load transaction details:', err);
    } finally {
      setLoading(false);
    }
  }, [db, id]);

  useFocusEffect(
    useCallback(() => {
      loadReceipt();
    }, [loadReceipt])
  );

  const handlePrint = async () => {
    if (!transaction) return;
    try {
      await printReceipt(transaction, items, shopProfile?.shop_name);
    } catch (err: any) {
      Alert.alert('Gagal Cetak', err.message || 'Terjadi kesalahan saat mencetak.');
    }
  };

  const handleSharePdf = async () => {
    if (!transaction) return;
    try {
      await shareReceiptPdf(transaction, items, shopProfile?.shop_name);
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

  const displayName = shopProfile?.shop_name?.toUpperCase() || 'WARUNG LABANOTERA';

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
            <Text style={styles.storeTitle}>{displayName}</Text>
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
            <Text style={styles.totalLabel}>TOTAL BELANJA</Text>
            <Text style={styles.totalValue}>
              {formatRupiah(
                items.length > 0
                  ? items.reduce((sum, item) => sum + item.subtotal, 0)
                  : transaction.total_amount + (transaction.debt_amount || 0)
              )}
            </Text>
          </View>

          {/* Payment detail rows */}
          <View style={styles.detailSection}>
            {/* Payment method label */}
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Metode Pembayaran</Text>
              <Text style={styles.detailValue}>
                {transaction.payment_method === 'CASH+UTANG'
                  ? 'Tunai + Sisanya Hutang'
                  : transaction.payment_method === 'CASH'
                  ? 'Tunai (Cash)'
                  : transaction.payment_method === 'QRIS'
                  ? 'QRIS / Transfer'
                  : 'Hutang / Kasbon'}
              </Text>
            </View>

            {/* Cash paid / Uang Diterima */}
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Uang Diterima</Text>
              <Text style={styles.detailValue}>
                {formatRupiah(
                  transaction.payment_method === 'UTANG' && (!transaction.cash_paid || transaction.cash_paid === 0)
                    ? 0
                    : transaction.cash_paid != null
                    ? transaction.cash_paid
                    : transaction.total_amount
                )}
              </Text>
            </View>

            {/* Change — full CASH payment */}
            {transaction.payment_method === 'CASH' && transaction.cash_paid != null && transaction.cash_paid > transaction.total_amount ? (
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Kembalian</Text>
                <Text style={[styles.detailValue, { color: Colors.success }]}>
                  {formatRupiah(transaction.cash_paid - transaction.total_amount)}
                </Text>
              </View>
            ) : null}

            {/* Shortfall — CASH+UTANG (only if debt_amount > 0) */}
            {transaction.payment_method === 'CASH+UTANG' && transaction.debt_amount != null && transaction.debt_amount > 0 ? (
              <View style={[styles.detailRow, styles.detailRowHighlight]}>
                <Text style={[styles.detailLabel, { color: Colors.danger }]}>Kurang / Dicatat Hutang</Text>
                <Text style={[styles.detailValue, { color: Colors.danger, fontWeight: 'bold' }]}>
                  {formatRupiah(transaction.debt_amount)}
                </Text>
              </View>
            ) : null}

            {/* Full UTANG (only if debt_amount > 0) */}
            {transaction.payment_method === 'UTANG' && transaction.debt_amount != null && transaction.debt_amount > 0 ? (
              <View style={[styles.detailRow, styles.detailRowHighlight]}>
                <Text style={[styles.detailLabel, { color: Colors.danger }]}>Total Hutang</Text>
                <Text style={[styles.detailValue, { color: Colors.danger, fontWeight: 'bold' }]}>
                  {formatRupiah(transaction.debt_amount)}
                </Text>
              </View>
            ) : null}

            {/* Status Lunas jika sebelumnya utang lalu sudah lunas */}
            {((transaction.payment_method === 'CASH+UTANG' || transaction.payment_method === 'UTANG') && (transaction.debt_amount == null || transaction.debt_amount <= 0)) ||
             (transaction.payment_method === 'CASH' && transaction.customer_name) ? (
              <View style={[styles.detailRow, { backgroundColor: '#f0fdf4', padding: 6, borderRadius: 6, marginTop: 4 }]}>
                <Text style={[styles.detailLabel, { color: Colors.success, fontWeight: 'bold' }]}>Status Pembayaran</Text>
                <Text style={[styles.detailValue, { color: Colors.success, fontWeight: 'bold' }]}>LUNAS (Utang Selesai)</Text>
              </View>
            ) : null}

            {/* Customer for debt transactions */}
            {transaction.customer_name ? (
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Nama Pelanggan</Text>
                <Text style={styles.detailValue}>{transaction.customer_name}</Text>
              </View>
            ) : null}
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
    ...getShadowStyle(3),
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
  detailSection: {
    marginTop: 8,
    gap: 6,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    paddingTop: 8,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 3,
  },
  detailRowHighlight: {
    backgroundColor: '#FFF5F5',
    paddingHorizontal: 6,
    borderRadius: 6,
    marginHorizontal: -6,
  },
  detailLabel: {
    fontSize: 12,
    color: Colors.textMuted,
    flex: 1,
  },
  detailValue: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.text,
    textAlign: 'right',
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
