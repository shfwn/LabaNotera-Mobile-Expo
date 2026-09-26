import React, { useState, useCallback } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  ScrollView,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Platform } from 'react-native';
import { useAppSQLiteContext as useSQLiteContext } from '../../src/db/AppDatabaseProvider';
import { useRouter, useFocusEffect } from 'expo-router';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { FinancialReportSummary, Transaction } from '../../src/types';
import { getFinancialSummary, getDailyFullReportData } from '../../src/services/reportService';
import { getRecentTransactions } from '../../src/services/posService';
import { exportDailyReportPdf } from '../../src/utils/pdfReportHelper';
import {
  formatRupiah,
  formatTanggal,
  getTransactionReceivedAmount,
} from '../../src/utils/formatters';
import { showAppAlert } from '../../src/utils/alertHelper';
import { getShadowStyle } from '../../src/utils/styleHelper';
import { Colors, Radius, Shadows } from '../../src/constants/theme';
import { Ionicons } from '@expo/vector-icons';

export default function ReportScreen() {
  const db = useSQLiteContext();
  const router = useRouter();

  const [summary, setSummary] = useState<FinancialReportSummary | null>(null);
  const [recentTransactions, setRecentTransactions] = useState<Transaction[]>([]);
  const [isExporting, setIsExporting] = useState(false);

  const loadReportData = useCallback(async () => {
    try {
      const reportData = await getFinancialSummary(db);
      setSummary(reportData);

      const trxs = await getRecentTransactions(db, 15);
      setRecentTransactions(trxs);
    } catch (err) {
      console.error('Failed to load report data:', err);
    }
  }, [db]);

  useFocusEffect(
    useCallback(() => {
      loadReportData();
    }, [loadReportData])
  );

  const handleExportPdfReport = async () => {
    try {
      setIsExporting(true);
      const dailyData = await getDailyFullReportData(db);
      await exportDailyReportPdf(dailyData);
    } catch (err: any) {
      showAppAlert('Gagal Ekspor PDF', err.message || 'Gagal membuat dokumen laporan PDF.');
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Top Buttons Bar */}
        <View style={styles.actionButtonsRow}>
          <TouchableOpacity
            style={styles.priveBtn}
            onPress={() => router.push('/prive-modal')}
            activeOpacity={0.8}
          >
            <Ionicons name="wallet-outline" color="#FFFFFF" size={16} />
            <Text style={styles.priveBtnText} numberOfLines={1}>Catat Biaya / Prive</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.pdfBtn, isExporting && { opacity: 0.6 }]}
            onPress={handleExportPdfReport}
            disabled={isExporting}
            activeOpacity={0.8}
          >
            <Ionicons name="document-text-outline" color="#FFFFFF" size={16} />
            <Text style={styles.pdfBtnText} numberOfLines={1}>
              {isExporting ? 'Memproses...' : 'Ekspor PDF Harian'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Hero Card: Estimasi Laba Bersih Warung */}
        <View style={styles.heroCard}>
          <Text style={styles.heroLabel}>Laba Bersih</Text>
          <Text style={styles.heroValue}>{formatRupiah(summary?.netProfit || 0)}</Text>
        </View>

        {/* Financial Metrics Row: Modal HPP & Total Omset */}
        <View style={styles.gridContainer}>
          <View style={styles.metricsRow}>
            {/* Modal HPP Barang */}
            <View style={styles.metricCard}>
              <View style={styles.metricHeader}>
                <Text style={styles.metricTitle} numberOfLines={1}>Modal HPP Barang</Text>
                <Ionicons name="arrow-down-circle-outline" color={Colors.danger} size={18} />
              </View>
              <Text style={[styles.metricValue, { color: Colors.danger }]} numberOfLines={1}>
                {formatRupiah(summary?.totalHPP || 0)}
              </Text>
              <Text style={styles.metricSub}>Modal Pokok Terjual</Text>
            </View>

            {/* Total Omset */}
            <View style={styles.metricCard}>
              <View style={styles.metricHeader}>
                <Text style={styles.metricTitle} numberOfLines={1}>Total Omset</Text>
                <Ionicons name="arrow-up-circle-outline" color={Colors.success} size={18} />
              </View>
              <Text style={[styles.metricValue, { color: Colors.success }]} numberOfLines={1}>
                {formatRupiah(summary?.totalRevenue || 0)}
              </Text>
              <Text style={styles.metricSub}>Total Uang Masuk</Text>
            </View>
          </View>
        </View>

        {/* Breakdown Box: Uang Dapur & Biaya Operasional */}
        <View style={styles.expenseSummaryBox}>
          <Text style={styles.expenseSummaryTitle}>Pengeluaran Kas Laci (Belanja Stok, Prive & Biaya)</Text>
          
          <View style={styles.expenseRow}>
            <Text style={styles.expenseLabel}>Belanja Stok Barang (Kas Laci)</Text>
            <Text style={[styles.expenseVal, { color: Colors.primaryDark }]}>
              -{formatRupiah(summary?.totalRestock || 0)}
            </Text>
          </View>

          <View style={styles.expenseRow}>
            <Text style={styles.expenseLabel}>Uang Dapur / Prive Pribadi</Text>
            <Text style={[styles.expenseVal, { color: Colors.secondary }]}>
              -{formatRupiah(summary?.totalPrive || 0)}
            </Text>
          </View>

          <View style={styles.expenseRow}>
            <Text style={styles.expenseLabel}>Biaya Operasional Warung</Text>
            <Text style={styles.expenseVal}>
              -{formatRupiah(summary?.totalExpense || 0)}
            </Text>
          </View>

          {(summary?.totalConsignmentOwed || 0) > 0 ? (
            <View style={styles.expenseRow}>
              <Text style={styles.expenseLabel}>Bagi Hasil Barang Titipan (Terutang)</Text>
              <Text style={[styles.expenseVal, { color: Colors.secondary }]}>
                {formatRupiah(summary?.totalConsignmentOwed || 0)}
              </Text>
            </View>
          ) : null}

          <View style={[styles.expenseRow, { borderTopWidth: 1, borderTopColor: '#F1F5F9', marginTop: 6, paddingTop: 6 }]}>
            <Text style={[styles.expenseLabel, { fontWeight: 'bold' }]}>Laba Kotor (Omset - HPP)</Text>
            <Text style={[styles.expenseVal, { color: Colors.primaryDark }]}>
              +{formatRupiah(summary?.grossProfit || 0)}
            </Text>
          </View>
        </View>

        {/* Recent Transactions List */}
        <Text style={[styles.sectionHeader, { marginTop: 16 }]}>Riwayat Transaksi Kasir</Text>

        {recentTransactions.length > 0 ? (
          recentTransactions.map((trx) => {
            const receivedAmount = getTransactionReceivedAmount(trx);
            const isCancelled = trx.status === 'CANCELLED';
            const hasDebt = trx.payment_method === 'CASH+UTANG' || trx.payment_method === 'UTANG';
            const debtVal = trx.debt_amount || (trx.total_amount - receivedAmount);

            return (
              <TouchableOpacity
                key={trx.id}
                style={[styles.trxRowCard, isCancelled && { backgroundColor: '#FAFAFA', opacity: 0.85 }]}
                onPress={() => router.push(`/receipt/${trx.id}`)}
                activeOpacity={0.7}
              >
                <View style={{ flex: 1, marginRight: 8 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                    <Text style={[styles.trxCode, isCancelled && { color: Colors.textMuted, textDecorationLine: 'line-through' }]}>
                      {trx.transaction_code}
                    </Text>
                    {isCancelled ? (
                      <View style={styles.badgeCancelled}>
                        <Text style={styles.badgeCancelledText}>Dibatalkan</Text>
                      </View>
                    ) : null}
                  </View>
                  <Text style={styles.trxMeta}>
                    {formatTanggal(trx.created_at)} • {trx.payment_method}
                    {trx.customer_name ? ` • ${trx.customer_name}` : ''}
                  </Text>
                </View>

                <View style={styles.trxRight}>
                  <View style={{ alignItems: 'flex-end' }}>
                    <Text
                      style={[
                        styles.trxAmount,
                        isCancelled
                          ? { color: Colors.textMuted, textDecorationLine: 'line-through' }
                          : { color: Colors.primaryDark },
                      ]}
                    >
                      {formatRupiah(receivedAmount)}
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" color={Colors.textMuted} size={18} />
                </View>
              </TouchableOpacity>
            );
          })
        ) : (
          <View style={styles.emptyBox}>
            <Ionicons name="receipt-outline" color={Colors.textMuted} size={36} />
            <Text style={styles.emptyText}>Belum ada riwayat transaksi</Text>
          </View>
        )}
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
  actionButtonsRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 14,
  },
  priveBtn: {
    flex: 1,
    backgroundColor: Colors.secondary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderRadius: Radius.full,
    gap: 6,
    ...Shadows.glow(0.15, Colors.secondary),
  },
  priveBtnText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 12.5,
    textAlign: 'center',
  },
  pdfBtn: {
    flex: 1,
    backgroundColor: Colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderRadius: Radius.full,
    gap: 6,
    ...Shadows.glow(0.15),
  },
  pdfBtnText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 12.5,
    textAlign: 'center',
  },
  heroCard: {
    backgroundColor: Colors.primary,
    borderRadius: Radius.xl2,
    padding: 18,
    marginBottom: 16,
    ...Shadows.glow(0.25),
  },
  heroLabel: {
    color: 'rgba(255, 255, 255, 0.85)',
    fontSize: 12,
    fontWeight: '600',
  },
  heroValue: {
    color: '#FFFFFF',
    fontSize: 28,
    fontWeight: '800',
    marginVertical: 4,
  },
  heroSub: {
    color: 'rgba(255, 255, 255, 0.8)',
    fontSize: 11,
    lineHeight: 16,
  },
  sectionHeader: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.text,
    marginBottom: 10,
  },
  gridContainer: {
    gap: 8,
    marginBottom: 14,
  },
  metricsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  metricCard: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: Radius.lg,
    padding: 14,
    borderWidth: 1,
    borderColor: Colors.borderLight,
    ...Shadows.card,
  },
  metricHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  metricTitle: {
    fontSize: 11,
    color: Colors.textMuted,
    fontWeight: '600',
  },
  metricValue: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.text,
    marginTop: 6,
  },
  metricSub: {
    fontSize: 10,
    color: Colors.textMuted,
    marginTop: 2,
  },
  expenseSummaryBox: {
    backgroundColor: '#FFFFFF',
    borderRadius: Radius.lg,
    padding: 14,
    borderWidth: 1,
    borderColor: Colors.borderLight,
    marginBottom: 14,
    ...Shadows.card,
  },
  expenseSummaryTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.textSecondary,
    marginBottom: 8,
  },
  expenseRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  expenseLabel: {
    fontSize: 13,
    color: Colors.textSecondary,
  },
  expenseVal: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.danger,
  },
  trxRowCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: Radius.lg,
    padding: 14,
    marginBottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: Colors.borderLight,
    ...Shadows.card,
  },
  trxCode: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.text,
  },
  badgeCancelled: {
    backgroundColor: Colors.dangerLight,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: Radius.full,
  },
  badgeCancelledText: {
    fontSize: 10,
    fontWeight: '700',
    color: Colors.danger,
  },
  trxMeta: {
    fontSize: 11,
    color: Colors.textMuted,
    marginTop: 2,
  },
  trxRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  trxAmount: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.primary,
  },
  trxDebtSub: {
    fontSize: 10,
    color: Colors.danger,
    fontWeight: '700',
    marginTop: 1,
  },
  emptyBox: {
    alignItems: 'center',
    padding: 30,
    backgroundColor: '#FFFFFF',
    borderRadius: Radius.lg,
    marginTop: 8,
    borderWidth: 1,
    borderColor: Colors.borderLight,
  },
  emptyText: {
    fontSize: 13,
    color: Colors.textMuted,
    marginTop: 8,
  },
});
