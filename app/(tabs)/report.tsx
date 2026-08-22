import React, { useState, useCallback } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  ScrollView,
  Alert,
  SafeAreaView,
} from 'react-native';
import { Platform } from 'react-native';
import { useAppSQLiteContext as useSQLiteContext } from '../../src/db/AppDatabaseProvider';
import { useRouter, useFocusEffect } from 'expo-router';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { FinancialReportSummary, Transaction } from '../../src/types';
import { getFinancialSummary } from '../../src/services/reportService';
import { getRecentTransactions } from '../../src/services/posService';
import { formatRupiah, formatTanggal } from '../../src/utils/formatters';
import { getShadowStyle } from '../../src/utils/styleHelper';
import { Colors } from '../../src/constants/theme';
import { Ionicons } from '@expo/vector-icons';

export default function ReportScreen() {
  const db = useSQLiteContext();
  const router = useRouter();

  const [summary, setSummary] = useState<FinancialReportSummary | null>(null);
  const [recentTransactions, setRecentTransactions] = useState<Transaction[]>([]);

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
    if (!summary) return;

    const htmlContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8" />
          <style>
            body { font-family: Arial, sans-serif; padding: 20px; color: #0f172a; }
            h1 { color: #0d9488; text-align: center; font-size: 22px; }
            .header-info { text-align: center; margin-bottom: 20px; color: #475569; font-size: 12px; }
            .card { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px; margin-bottom: 12px; }
            .row { display: flex; justify-content: space-between; margin-bottom: 8px; }
            .label { color: #475569; font-size: 14px; }
            .value { font-weight: bold; font-size: 15px; }
            .highlight { background: #dcfce7; border: 1px solid #16a34a; border-radius: 8px; padding: 16px; margin-top: 16px; }
            .highlight-title { font-size: 14px; color: #166534; font-weight: bold; }
            .highlight-val { font-size: 24px; color: #15803d; font-weight: bold; margin-top: 4px; }
            .footer { text-align: center; margin-top: 30px; font-size: 11px; color: #94a3b8; }
          </style>
        </head>
        <body>
          <h1>LAPORAN KEUANGAN LABA-RUGI</h1>
          <div class="header-info">Aplikasi LabaNotera • Dicetak pada ${formatTanggal(new Date())}</div>

          <div class="card">
            <div class="row">
              <span class="label">Total Penjualan (Omset)</span>
              <span class="value">${formatRupiah(summary.totalRevenue)}</span>
            </div>
            <div class="row">
              <span class="label">Total Modal HPP Barang Terjual</span>
              <span class="value" style="color: #dc2626;">-${formatRupiah(summary.totalHPP)}</span>
            </div>
            <hr style="border: 0.5px dashed #cbd5e1;" />
            <div class="row" style="margin-top: 8px;">
              <span class="label" style="font-weight: bold;">Laba Kotor (Gross Profit)</span>
              <span class="value" style="color: #0d9488;">${formatRupiah(summary.grossProfit)}</span>
            </div>
          </div>

          <div class="card">
            <div class="row">
              <span class="label">Pengeluaran Prive (Uang Dapur Pribadi)</span>
              <span class="value" style="color: #d97706;">-${formatRupiah(summary.totalPrive)}</span>
            </div>
            <div class="row">
              <span class="label">Biaya Operasional Warung</span>
              <span class="value" style="color: #dc2626;">-${formatRupiah(summary.totalExpense)}</span>
            </div>
          </div>

          <div class="highlight">
            <div class="highlight-title">ESTIMASI LABA BERSIH WARUNG</div>
            <div class="highlight-val">${formatRupiah(summary.netProfit)}</div>
          </div>

          <div class="card" style="margin-top: 16px;">
            <div class="row">
              <span class="label">🤝 Bagi Hasil Barang Titipan Terutang</span>
              <span class="value" style="color: #d97706;">${formatRupiah(summary.totalConsignmentOwed)}</span>
            </div>
            <div class="row" style="margin-top: 6px;">
              <span class="label">Total Transaksi Selesai</span>
              <span class="value">${summary.transactionCount} Transaksi</span>
            </div>
          </div>

          <div class="footer">
            Dibuat secara otomatis oleh LabaNotera App (Kasir & Manajemen Stok Offline-First)
          </div>
        </body>
      </html>
    `;

    try {
      if (Platform.OS === 'web') {
        await Print.printAsync({ html: htmlContent });
      } else {
        const { uri } = await Print.printToFileAsync({ html: htmlContent });
        if (await Sharing.isAvailableAsync()) {
          await Sharing.shareAsync(uri, {
            mimeType: 'application/pdf',
            dialogTitle: 'Laporan_Keuangan_LabaNotera',
          });
        } else {
          await Print.printAsync({ html: htmlContent });
        }
      }
    } catch (err: any) {
      Alert.alert('Gagal Ekspor PDF', err.message || 'Gagal mengekspor laporan PDF.');
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
          >
            <Ionicons name="wallet-outline" color="#FFFFFF" size={18} />
            <Text style={styles.priveBtnText}>Catat Uang Dapur / Prive</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.pdfBtn} onPress={handleExportPdfReport}>
            <Ionicons name="document-text-outline" color={Colors.primaryDark} size={18} />
            <Text style={styles.pdfBtnText}>Ekspor PDF</Text>
          </TouchableOpacity>
        </View>


        {/* Recent Transactions List */}
        <Text style={[styles.sectionHeader, { marginTop: 16 }]}>Transaksi Terakhir</Text>

        {recentTransactions.map((trx) => (
          <TouchableOpacity
            key={trx.id}
            style={styles.trxRowCard}
            onPress={() => router.push(`/receipt/${trx.id}`)}
          >
            <View style={{ flex: 1 }}>
              <Text style={styles.trxCode}>{trx.transaction_code}</Text>
              <Text style={styles.trxMeta}>
                {formatTanggal(trx.created_at)} • {trx.payment_method}
                {trx.customer_name ? ` • ${trx.customer_name}` : ''}
              </Text>
            </View>

            <View style={styles.trxRight}>
              <Text style={styles.trxAmount}>{formatRupiah(trx.total_amount)}</Text>
              <Ionicons name="chevron-forward" color={Colors.textMuted} size={18} />
            </View>
          </TouchableOpacity>
        ))}
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
    padding: 14,
    paddingBottom: 40,
  },
  actionButtonsRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  priveBtn: {
    flex: 1,
    backgroundColor: Colors.secondary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 10,
    gap: 6,
  },
  priveBtnText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
    fontSize: 13,
  },
  pdfBtn: {
    backgroundColor: Colors.primaryLight,
    borderWidth: 1,
    borderColor: Colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 10,
    gap: 6,
  },
  pdfBtnText: {
    color: Colors.primaryDark,
    fontWeight: 'bold',
    fontSize: 13,
  },
  heroCard: {
    backgroundColor: Colors.primaryDark,
    borderRadius: 14,
    padding: 18,
    marginBottom: 16,
    ...getShadowStyle(3),
  },
  heroLabel: {
    color: Colors.primaryLight,
    fontSize: 13,
    fontWeight: '600',
  },
  heroValue: {
    color: '#FFFFFF',
    fontSize: 28,
    fontWeight: 'bold',
    marginVertical: 4,
  },
  heroSub: {
    color: '#E2E8F0',
    fontSize: 11,
    lineHeight: 16,
  },
  sectionHeader: {
    fontSize: 15,
    fontWeight: 'bold',
    color: Colors.text,
    marginBottom: 10,
  },
  gridContainer: {
    gap: 8,
    marginBottom: 12,
  },
  metricsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  metricCard: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  metricHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  metricTitle: {
    fontSize: 12,
    color: Colors.textMuted,
  },
  metricValue: {
    fontSize: 16,
    fontWeight: 'bold',
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
    borderRadius: 10,
    padding: 14,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: 12,
  },
  expenseSummaryTitle: {
    fontSize: 13,
    fontWeight: 'bold',
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
    fontWeight: 'bold',
    color: Colors.danger,
  },
  trxRowCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    padding: 12,
    marginBottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  trxCode: {
    fontSize: 14,
    fontWeight: 'bold',
    color: Colors.text,
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
    fontSize: 15,
    fontWeight: 'bold',
    color: Colors.primaryDark,
  },
});
