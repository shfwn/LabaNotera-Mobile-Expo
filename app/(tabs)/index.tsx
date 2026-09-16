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
import { Tabs, useRouter, useFocusEffect } from 'expo-router';
import { FinancialReportSummary, Transaction, ShopProfile } from '../../src/types';
import { getFinancialSummary } from '../../src/services/reportService';
import { getRecentTransactions } from '../../src/services/posService';
import { getShopProfile } from '../../src/services/profileService';
import ProfileModal from '../../src/components/ProfileModal';
import { formatRupiah, formatTanggal, getTransactionReceivedAmount } from '../../src/utils/formatters';
import { getShadowStyle } from '../../src/utils/styleHelper';
import { Colors } from '../../src/constants/theme';
import { Ionicons } from '@expo/vector-icons';

export default function DashboardScreen() {
  const db = useSQLiteContext();
  const router = useRouter();

  const [summary, setSummary] = useState<FinancialReportSummary | null>(null);
  const [recentTransactions, setRecentTransactions] = useState<Transaction[]>([]);
  const [profile, setProfile] = useState<ShopProfile | null>(null);
  const [isProfileModalVisible, setIsProfileModalVisible] = useState(false);

  const loadDashboardData = useCallback(async () => {
    try {
      const summaryData = await getFinancialSummary(db);
      setSummary(summaryData);

      const trxs = await getRecentTransactions(db, 5);
      setRecentTransactions(trxs);

      const profileData = await getShopProfile(db);
      setProfile(profileData);
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
      {/* Configure Top Header Bar with Store Name & Profile Button */}
      <Tabs.Screen
        options={{
          headerTitle: () => (
            <View style={styles.headerShopRow}>
              <Ionicons name="storefront-outline" color="#5EEAD4" size={20} />
              <Text style={styles.headerShopName} numberOfLines={1}>
                {profile?.shop_name || 'Warung LabaNotera'}
              </Text>
            </View>
          ),
          headerRight: () => (
            <TouchableOpacity
              style={styles.profileHeaderBtn}
              onPress={() => setIsProfileModalVisible(true)}
              activeOpacity={0.8}
            >
              <Ionicons name="person-circle-outline" color="#FFFFFF" size={18} />
              <Text style={styles.profileHeaderBtnText}>Profil</Text>
            </TouchableOpacity>
          ),
        }}
      />

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Top Financial Metrics Dashboard Section */}
        <View style={styles.dashboardHero}>
          {/* Header with Beranda Title & Subtitle */}
          <View style={styles.dashboardHeaderRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.dashboardTitle}>Beranda</Text>
              <Text style={styles.dashboardSub}>Ringkasan Keuangan & Usaha Warung</Text>
            </View>
          </View>

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

              {/* Total Uang Titipan */}
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

            {/* Row 3: Laba Bersih & Piutang Pelanggan */}
            <View style={styles.metricsRow}>
              {/* Estimasi Laba Bersih */}
              <View style={[styles.metricCard, { backgroundColor: '#F0FDF4', borderColor: '#BBF7D0', borderWidth: 1 }]}>
                <View style={styles.metricHeader}>
                  <Text style={[styles.metricLabel, { color: '#166534' }]} numberOfLines={1}>Laba Bersih</Text>
                  <Ionicons name="wallet-outline" color={Colors.success} size={18} />
                </View>
                <Text style={[styles.metricValue, { color: '#15803D' }]} numberOfLines={1}>
                  {formatRupiah(summary?.netProfit || 0)}
                </Text>
                <Text style={[styles.metricSub, { color: '#166534' }]}>Setelah Prive & Biaya</Text>
              </View>

              {/* Total Piutang Pelanggan */}
              <View style={[styles.metricCard, { backgroundColor: '#FFFBEB', borderColor: '#FDE68A', borderWidth: 1 }]}>
                <View style={styles.metricHeader}>
                  <Text style={[styles.metricLabel, { color: '#92400E' }]} numberOfLines={1}>Piutang Warung</Text>
                  <Ionicons name="book-outline" color={Colors.warning} size={18} />
                </View>
                <Text style={[styles.metricValue, { color: '#B45309' }]} numberOfLines={1}>
                  {formatRupiah(summary?.totalDebtRemaining || 0)}
                </Text>
                <Text style={[styles.metricSub, { color: '#92400E' }]}>Utang Belum Lunas</Text>
              </View>
            </View>
          </View>
        </View>

        {/* Middle Shortcuts Section */}
        <View style={styles.shortcutsSection}>
          <Text style={styles.sectionHeaderTitle}>Fitur Utama</Text>

          <View style={styles.shortcutsContainer}>
            {/* Row 1 */}
            <View style={styles.shortcutsRow}>
              {/* Shortcut 1: Kasir */}
              <TouchableOpacity
                style={styles.shortcutCard}
                onPress={() => router.push('/(tabs)/pos')}
                activeOpacity={0.7}
              >
                <View style={[styles.shortcutIconBg, { backgroundColor: Colors.primary }]}>
                  <Ionicons name="cart-outline" color="#FFFFFF" size={26} />
                </View>
                <Text style={styles.shortcutName} numberOfLines={1}>
                  Kasir Warung
                </Text>
                <Text style={styles.shortcutDesc} numberOfLines={1}>
                  Transaksi Penjualan
                </Text>
              </TouchableOpacity>

              {/* Shortcut 2: Stok & Titipan */}
              <TouchableOpacity
                style={styles.shortcutCard}
                onPress={() => router.push('/(tabs)/stock')}
                activeOpacity={0.7}
              >
                <View style={[styles.shortcutIconBg, { backgroundColor: Colors.primaryDark }]}>
                  <Ionicons name="cube-outline" color="#FFFFFF" size={26} />
                </View>
                <Text style={styles.shortcutName} numberOfLines={1}>
                  Stok Warung
                </Text>
                <Text style={styles.shortcutDesc} numberOfLines={1}>
                  Stok & Persediaan
                </Text>
              </TouchableOpacity>
            </View>

            {/* Row 2 */}
            <View style={styles.shortcutsRow}>
              {/* Shortcut 3: Buku Utang */}
              <TouchableOpacity
                style={styles.shortcutCard}
                onPress={() => router.push('/(tabs)/debt')}
                activeOpacity={0.7}
              >
                <View style={[styles.shortcutIconBg, { backgroundColor: Colors.secondary }]}>
                  <Ionicons name="book-outline" color="#FFFFFF" size={26} />
                </View>
                <Text style={styles.shortcutName} numberOfLines={1}>
                  Buku Utang
                </Text>
                <Text style={styles.shortcutDesc} numberOfLines={1}>
                  Catat utang & kasbon
                </Text>
              </TouchableOpacity>

              {/* Shortcut 4: Laporan */}
              <TouchableOpacity
                style={styles.shortcutCard}
                onPress={() => router.push('/(tabs)/report')}
                activeOpacity={0.7}
              >
                <View style={[styles.shortcutIconBg, { backgroundColor: Colors.accent }]}>
                  <Ionicons name="stats-chart-outline" color="#FFFFFF" size={26} />
                </View>
                <Text style={styles.shortcutName} numberOfLines={1}>
                  Riwayat Transaksi
                </Text>
                <Text style={styles.shortcutDesc} numberOfLines={1}>
                  Rekam transaksi & struk
                </Text>
              </TouchableOpacity>
            </View>
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
            recentTransactions.slice(0, 5).map((trx) => {
              const receivedAmount = getTransactionReceivedAmount(trx);
              const hasDebt = trx.payment_method === 'CASH+UTANG' || trx.payment_method === 'UTANG';
              const debtVal = trx.debt_amount || (trx.total_amount - receivedAmount);

              return (
                <TouchableOpacity
                  key={trx.id}
                  style={styles.trxItemCard}
                  onPress={() => router.push(`/receipt/${trx.id}`)}
                  activeOpacity={0.7}
                >
                  <View style={{ flex: 1, marginRight: 8 }}>
                    <Text style={styles.trxCode}>{trx.transaction_code}</Text>
                    <Text style={styles.trxMeta}>
                      {formatTanggal(trx.created_at)} • {trx.payment_method}
                      {trx.customer_name ? ` • ${trx.customer_name}` : ''}
                    </Text>
                  </View>
                  <View style={styles.trxAmountCol}>
                    <View style={{ alignItems: 'flex-end' }}>
                      <Text style={styles.trxAmount}>{formatRupiah(receivedAmount)}</Text>
                    </View>
                    <Ionicons name="chevron-forward" color={Colors.textMuted} size={16} />
                  </View>
                </TouchableOpacity>
              );
            })
          ) : (
            <View style={styles.emptyCard}>
              <Ionicons name="receipt-outline" color={Colors.textMuted} size={36} />
              <Text style={styles.emptyText}>Belum ada transaksi hari ini</Text>
            </View>
          )}
        </View>
      </ScrollView>

      {/* Warung Profile & Settings Modal */}
      <ProfileModal
        visible={isProfileModalVisible}
        onClose={() => setIsProfileModalVisible(false)}
        onProfileUpdated={(updated) => setProfile(updated)}
      />
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
  dashboardHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  headerShopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerShopName: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: 'bold',
    maxWidth: 220,
  },
  dashboardTitle: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: 'bold',
  },
  dashboardSub: {
    color: '#CCFBF1',
    fontSize: 12,
    marginTop: 2,
  },
  profileHeaderBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    gap: 5,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
    marginRight: 16,
  },
  profileHeaderBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: 'bold',
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
  shortcutsContainer: {
    gap: 10,
  },
  shortcutsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  shortcutCard: {
    flex: 1,
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 8,
    borderWidth: 1,
    borderColor: Colors.border,
    ...getShadowStyle(1),
  },
  shortcutIconBg: {
    width: 48,
    height: 48,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  shortcutName: {
    fontSize: 13,
    fontWeight: 'bold',
    color: Colors.text,
    textAlign: 'center',
    marginBottom: 2,
  },
  shortcutDesc: {
    fontSize: 10,
    color: Colors.textMuted,
    textAlign: 'center',
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
  trxDebtSub: {
    fontSize: 10,
    color: Colors.danger,
    fontWeight: 'bold',
    marginTop: 1,
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
