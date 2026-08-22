import React, { useState, useCallback } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  ScrollView,
  SafeAreaView,
} from 'react-native';
import { useAppSQLiteContext as useSQLiteContext } from '../../src/db/AppDatabaseProvider';
import { useRouter, useFocusEffect } from 'expo-router';
import { FinancialReportSummary, Transaction } from '../../src/types';
import { getFinancialSummary } from '../../src/services/reportService';
import { getRecentTransactions } from '../../src/services/posService';
import { formatRupiah, formatTanggal } from '../../src/utils/formatters';
import { getShadowStyle } from '../../src/utils/styleHelper';
import { Colors } from '../../src/constants/theme';
import { Ionicons } from '@expo/vector-icons';

export default function DashboardScreen() {
  const db = useSQLiteContext();
  const router = useRouter();

  const [summary, setSummary] = useState<FinancialReportSummary | null>(null);
  const [recentTransactions, setRecentTransactions] = useState<Transaction[]>([]);

  const loadDashboardData = useCallback(async () => {
    try {
      const summaryData = await getFinancialSummary(db);
      setSummary(summaryData);

      const trxs = await getRecentTransactions(db, 5);
      setRecentTransactions(trxs);
    } catch (err) {
      console.error('Failed to load dashboard data:', err);
    }
  }, [db]);

  useFocusEffect(
    useCallback(() => {
      loadDashboardData();
    }, [loadDashboardData])
  );

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Top Financial Metrics Dashboard Section */}
        <View style={styles.dashboardHero}>
          <Text style={styles.dashboardTitle}>Ringkasan Keuangan</Text>
          <Text style={styles.metricLabel}></Text>

          <View style={styles.metricsContainer}>
            {/* Row 1 */}
            <View style={styles.metricsRow}>
              {/* Total Omset */}
              <View style={styles.metricCard}>
                <View style={styles.metricHeader}>
                  <Text style={styles.metricLabel} numberOfLines={1}>Total Omset</Text>
                  <Ionicons name="arrow-up-circle-outline" color={Colors.success} size={18} />
                </View>
                <Text style={styles.metricValue} numberOfLines={1}>
                  {formatRupiah(summary?.totalRevenue || 0)}
                </Text>
                <Text style={styles.metricSub}>{summary?.transactionCount || 0} Transaksi</Text>
              </View>

              {/* Modal HPP Barang */}
              <View style={styles.metricCard}>
                <View style={styles.metricHeader}>
                  <Text style={styles.metricLabel} numberOfLines={1}>Modal HPP Barang</Text>
                  <Ionicons name="arrow-down-circle-outline" color={Colors.danger} size={18} />
                </View>
                <Text style={[styles.metricValue, { color: Colors.danger }]} numberOfLines={1}>
                  {formatRupiah(summary?.totalHPP || 0)}
                </Text>
                <Text style={styles.metricSub}>Modal Pokok</Text>
              </View>
            </View>

            {/* Row 2 */}
            <View style={styles.metricsRow}>
              {/* Laba Kotor */}
              <View style={styles.metricCard}>
                <View style={styles.metricHeader}>
                  <Text style={styles.metricLabel} numberOfLines={1}>Laba Kotor</Text>
                  <Ionicons name="trending-up-outline" color={Colors.primary} size={18} />
                </View>
                <Text style={[styles.metricValue, { color: Colors.primaryDark }]} numberOfLines={1}>
                  {formatRupiah(summary?.grossProfit || 0)}
                </Text>
                <Text style={styles.metricSub}>Omset - HPP</Text>
              </View>

              {/* Utang Titipan Laku */}
              <View style={styles.metricCard}>  
                <View style={styles.metricHeader}>
                  <Text style={styles.metricLabel} numberOfLines={1}>Total Uang Titipan</Text>
                  <Ionicons name="people-outline" color={Colors.secondary} size={18} />
                </View>
                <Text style={[styles.metricValue, { color: Colors.secondary }]} numberOfLines={1}>
                  {formatRupiah(summary?.totalConsignmentOwed || 0)}
                </Text>
                <Text style={styles.metricSub}>Bagi Hasil Titipan</Text>
              </View>
            </View>
          </View>
        </View>

        {/* Middle Shortcuts Section */}
        <View style={styles.shortcutsSection}>
          <Text style={styles.sectionHeaderTitle}>Fitur Utama</Text>

          <View style={styles.shortcutsGrid}>
            {/* Shortcut 1: Kasir */}
            <TouchableOpacity
              style={styles.shortcutCard}
              onPress={() => router.push('/(tabs)/pos')}
              activeOpacity={0.8}
            >
              <View style={[styles.shortcutIconBg, { backgroundColor: Colors.primary }]}>
                <Ionicons name="cart-outline" color="#FFFFFF" size={28} />
              </View>
              <View style={styles.shortcutTextCol}>
                <Text style={styles.shortcutName}>Kasir Warung</Text>
                <Text style={styles.shortcutDesc}>Transaksi penjualan</Text>
              </View>
              <Ionicons name="chevron-forward" color={Colors.textMuted} size={18} />
            </TouchableOpacity>

            {/* Shortcut 2: Stok & Titipan */}
            <TouchableOpacity
              style={styles.shortcutCard}
              onPress={() => router.push('/(tabs)/stock')}
              activeOpacity={0.8}
            >
              <View style={[styles.shortcutIconBg, { backgroundColor: Colors.primaryDark }]}>
                <Ionicons name="cube-outline" color="#FFFFFF" size={26} />
              </View>
              <View style={styles.shortcutTextCol}>
                <Text style={styles.shortcutName}>Stok Warung</Text>
                <Text style={styles.shortcutDesc}>Stok & Persediaan</Text>
              </View>
              <Ionicons name="chevron-forward" color={Colors.textMuted} size={18} />
            </TouchableOpacity>

            {/* Shortcut 3: Buku Utang */}
            <TouchableOpacity
              style={styles.shortcutCard}
              onPress={() => router.push('/(tabs)/debt')}
              activeOpacity={0.8}
            >
              <View style={[styles.shortcutIconBg, { backgroundColor: Colors.secondary }]}>
                <Ionicons name="book-outline" color="#FFFFFF" size={26} />
              </View>
              <View style={styles.shortcutTextCol}>
                <Text style={styles.shortcutName}>Buku Utang</Text>
                <Text style={styles.shortcutDesc}>Catat utang & kasbon</Text>
              </View>
              <Ionicons name="chevron-forward" color={Colors.textMuted} size={18} />
            </TouchableOpacity>

            {/* Shortcut 4: Laporan */}
            <TouchableOpacity
              style={styles.shortcutCard}
              onPress={() => router.push('/(tabs)/report')}
              activeOpacity={0.8}
            >
              <View style={[styles.shortcutIconBg, { backgroundColor: Colors.accent }]}>
                <Ionicons name="stats-chart-outline" color="#FFFFFF" size={26} />
              </View>
              <View style={styles.shortcutTextCol}>
                <Text style={styles.shortcutName}>Riwayat Transaksi</Text>
                <Text style={styles.shortcutDesc}>Rekam transaksi & struk</Text>
              </View>
              <Ionicons name="chevron-forward" color={Colors.textMuted} size={18} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Recent Transactions Track Section */}
        <View style={styles.recentSection}>
          <View style={styles.recentHeaderRow}>
            <Text style={styles.sectionHeaderTitle}>Transaksi Terbaru Kasir</Text>
            <TouchableOpacity onPress={() => router.push('/(tabs)/report')}>
              <Text style={styles.seeAllText}>Lihat Semua &gt;</Text>
            </TouchableOpacity>
          </View>

          {recentTransactions.length > 0 ? (
            recentTransactions.map((trx) => (
              <TouchableOpacity
                key={trx.id}
                style={styles.trxItemCard}
                onPress={() => router.push(`/receipt/${trx.id}`)}
              >
                <View style={{ flex: 1 }}>
                  <Text style={styles.trxCode}>{trx.transaction_code}</Text>
                  <Text style={styles.trxMeta}>
                    {formatTanggal(trx.created_at)} • {trx.payment_method}
                    {trx.customer_name ? ` • ${trx.customer_name}` : ''}
                  </Text>
                </View>
                <View style={styles.trxAmountCol}>
                  <Text style={styles.trxAmount}>{formatRupiah(trx.total_amount)}</Text>
                  <Ionicons name="chevron-forward" color={Colors.textMuted} size={16} />
                </View>
              </TouchableOpacity>
            ))
          ) : (
            <View style={styles.emptyCard}>
              <Ionicons name="receipt-outline" color={Colors.textMuted} size={36} />
              <Text style={styles.emptyText}>Belum ada transaksi hari ini</Text>
            </View>
          )}
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
    paddingBottom: 40,
  },
  dashboardHero: {
    backgroundColor: Colors.primaryDark,
    padding: 16,
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
  },
  dashboardTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: 'bold',
  },
  dashboardSub: {
    color: '#E2E8F0',
    fontSize: 12,
    marginTop: 2,
    marginBottom: 14,
  },
  metricsContainer: {
    gap: 10,
  },
  metricsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  metricCard: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 12,
    ...getShadowStyle(2),
  },
  metricHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  metricLabel: {
    fontSize: 12,
    color: Colors.textMuted,
    fontWeight: '600',
  },
  metricValue: {
    fontSize: 17,
    fontWeight: 'bold',
    color: Colors.text,
    marginTop: 6,
  },
  metricSub: {
    fontSize: 10,
    color: Colors.textMuted,
    marginTop: 2,
  },
  shortcutsSection: {
    paddingHorizontal: 14,
    marginTop: 16,
  },
  sectionHeaderTitle: {
    fontSize: 15,
    fontWeight: 'bold',
    color: Colors.text,
    marginBottom: 10,
  },
  shortcutsGrid: {
    gap: 10,
  },
  shortcutCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    ...getShadowStyle(1),
  },
  shortcutIconBg: {
    width: 46,
    height: 46,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  shortcutTextCol: {
    flex: 1,
  },
  shortcutName: {
    fontSize: 15,
    fontWeight: 'bold',
    color: Colors.text,
  },
  shortcutDesc: {
    fontSize: 11,
    color: Colors.textMuted,
    marginTop: 2,
  },
  recentSection: {
    paddingHorizontal: 14,
    marginTop: 20,
  },
  recentHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  seeAllText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: Colors.primary,
  },
  trxItemCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    padding: 12,
    marginBottom: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
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
  trxAmountCol: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  trxAmount: {
    fontSize: 14,
    fontWeight: 'bold',
    color: Colors.primaryDark,
  },
  emptyCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 24,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  emptyText: {
    fontSize: 13,
    color: Colors.textMuted,
    marginTop: 8,
  },
});
