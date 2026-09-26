import React, { useState, useCallback } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAppSQLiteContext as useSQLiteContext } from '../../src/db/AppDatabaseProvider';
import { Tabs, useRouter, useFocusEffect } from 'expo-router';
import { DailyFinancialSummary, Transaction, ShopProfile } from '../../src/types';
import { getDailyFinancialSummary } from '../../src/services/reportService';
import { getRecentTransactions } from '../../src/services/posService';
import { getShopProfile } from '../../src/services/profileService';
import ProfileModal from '../../src/components/ProfileModal';
import { formatRupiah, formatTanggal, getTransactionReceivedAmount } from '../../src/utils/formatters';
import { checkAndPromptClosingReminder } from '../../src/utils/closingReminderHelper';
import { getShadowStyle } from '../../src/utils/styleHelper';
import { Colors } from '../../src/constants/theme';
import { Ionicons } from '@expo/vector-icons';

export default function DashboardScreen() {
  const db = useSQLiteContext();
  const router = useRouter();

  const [dailySummary, setDailySummary] = useState<DailyFinancialSummary | null>(null);
  const [recentTransactions, setRecentTransactions] = useState<Transaction[]>([]);
  const [profile, setProfile] = useState<ShopProfile | null>(null);
  const [isProfileModalVisible, setIsProfileModalVisible] = useState(false);

  const loadDashboardData = useCallback(async () => {
    try {
      const summaryData = await getDailyFinancialSummary(db);
      setDailySummary(summaryData);

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
              <Ionicons name="storefront-outline" color="#C8E6C9" size={20} />
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
        {/* Top Financial Metrics Dashboard Section (Daily Summary) */}
        <View style={styles.dashboardHero}>
          {/* Header with Beranda Title & Subtitle */}
          <View style={styles.dashboardHeaderRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.dashboardTitle}>Beranda</Text>
              <Text style={styles.dashboardSub}>Ringkasan Keuangan & Usaha Warung</Text>
            </View>
            <View style={styles.todayBadge}>
              <Ionicons name="today-outline" color={Colors.primary} size={12} />
              <Text style={styles.todayBadgeText}>Hari Ini</Text>
            </View>
          </View>

          <View style={styles.metricsContainer}>
            {/* Row 1 */}
            <View style={styles.metricsRow}>
              {/* Total Omset Hari Ini */}
              <View style={styles.metricCard}>
                <View style={styles.metricHeader}>
                  <Text style={styles.metricLabel} numberOfLines={1}>Total Omset</Text>
                  <Ionicons name="arrow-up-circle-outline" color={Colors.success} size={18} />
                </View>
                <Text style={styles.metricValue} numberOfLines={1}>
                  {formatRupiah(dailySummary?.todayRevenue || 0)}
                </Text>
                <Text style={styles.metricSub}>Uang Masuk Hari Ini</Text>
              </View>

              {/* Laba Kotor Hari Ini */}
              <View style={styles.metricCard}>
                <View style={styles.metricHeader}>
                  <Text style={styles.metricLabel} numberOfLines={1}>Laba Kotor</Text>
                  <Ionicons name="trending-up-outline" color={Colors.primary} size={18} />
                </View>
                <Text style={[styles.metricValue, { color: Colors.primaryDark }]} numberOfLines={1}>
                  {formatRupiah(dailySummary?.todayGrossProfit || 0)}
                </Text>
                <Text style={styles.metricSub}>Omset - Modal HPP</Text>
              </View>
            </View>

            {/* Row 2 */}
            <View style={styles.metricsRow}>
              {/* Total Transaksi Hari Ini */}
              <View style={styles.metricCard}>
                <View style={styles.metricHeader}>
                  <Text style={styles.metricLabel} numberOfLines={1}>Total Transaksi</Text>
                  <Ionicons name="receipt-outline" color={Colors.primary} size={18} />
                </View>
                <Text style={[styles.metricValue, { color: Colors.primary }]} numberOfLines={1}>
                  {dailySummary?.todayTransactionCount || 0}
                </Text>
                <Text style={styles.metricSub}>Struk Hari Ini</Text>
              </View>

              {/* Produk Terjual Hari Ini */}
              <View style={styles.metricCard}>  
                <View style={styles.metricHeader}>
                  <Text style={styles.metricLabel} numberOfLines={1}>Barang Terjual</Text>
                  <Ionicons name="bag-handle-outline" color={Colors.secondary} size={18} />
                </View>
                <Text style={[styles.metricValue, { color: Colors.secondary }]} numberOfLines={1}>
                  {dailySummary?.todayItemsSold || 0} Item
                </Text>
                <Text style={styles.metricSub}>Total Item Terjual</Text>
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

              {/* Shortcut 2: Stok Warung */}
              <TouchableOpacity
                style={styles.shortcutCard}
                onPress={() => router.push('/(tabs)/stock')}
                activeOpacity={0.7}
              >
                <View style={[styles.shortcutIconBg, { backgroundColor: '#059669' }]}>
                  <Ionicons name="cube-outline" color="#FFFFFF" size={26} />
                </View>
                <Text style={styles.shortcutName} numberOfLines={1}>
                  Stok Warung
                </Text>
                <Text style={styles.shortcutDesc} numberOfLines={1}>
                  Persediaan Barang
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

              {/* Shortcut 4: Riwayat Transaksi */}
              <TouchableOpacity
                style={styles.shortcutCard}
                onPress={() => router.push('/(tabs)/report')}
                activeOpacity={0.7}
              >
                <View style={[styles.shortcutIconBg, { backgroundColor: '#2563EB' }]}>
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
              const isCancelled = trx.status === 'CANCELLED';
              const hasDebt = trx.payment_method === 'CASH+UTANG' || trx.payment_method === 'UTANG';
              const debtVal = trx.debt_amount || (trx.total_amount - receivedAmount);

              return (
                <TouchableOpacity
                  key={trx.id}
                  style={[styles.trxItemCard, isCancelled && { backgroundColor: '#FAFAFA', opacity: 0.85 }]}
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
                  <View style={styles.trxAmountCol}>
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
    backgroundColor: Colors.primary,
    padding: 18,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
  },
  dashboardHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  headerShopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerShopName: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
    maxWidth: 220,
  },
  dashboardTitle: {
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  dashboardSub: {
    color: '#E8F5E9',
    fontSize: 12,
    marginTop: 2,
    opacity: 0.9,
  },
  todayBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 9999,
    gap: 4,
    ...getShadowStyle(1),
  },
  todayBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.primary,
  },
  profileHeaderBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 9999,
    gap: 5,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
    marginRight: 16,
  },
  profileHeaderBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
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
    borderRadius: 16,
    padding: 14,
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
    fontWeight: '800',
    color: Colors.text,
    marginTop: 6,
    letterSpacing: -0.3,
  },
  metricSub: {
    fontSize: 10,
    color: Colors.textMuted,
    marginTop: 2,
  },
  shortcutsSection: {
    paddingHorizontal: 16,
    marginTop: 18,
  },
  sectionHeaderTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: Colors.text,
    marginBottom: 12,
    letterSpacing: -0.3,
  },
  shortcutsContainer: {
    gap: 12,
  },
  shortcutsRow: {
    flexDirection: 'row',
    gap: 12,
  },
  shortcutCard: {
    flex: 1,
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    paddingVertical: 16,
    paddingHorizontal: 10,
    borderWidth: 1,
    borderColor: '#F0F3F1',
    ...getShadowStyle(1),
  },
  shortcutIconBg: {
    width: 50,
    height: 50,
    borderRadius: 9999,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10,
  },
  shortcutName: {
    fontSize: 13,
    fontWeight: '700',
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
    paddingHorizontal: 16,
    marginTop: 22,
  },
  recentHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  seeAllText: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.primary,
  },
  trxItemCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 14,
    marginBottom: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#F0F3F1',
    ...getShadowStyle(1),
  },
  trxCode: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.text,
  },
  badgeCancelled: {
    backgroundColor: '#FEE2E2',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 9999,
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  badgeCancelledText: {
    fontSize: 10,
    fontWeight: '700',
    color: Colors.danger,
  },
  trxMeta: {
    fontSize: 11,
    color: Colors.textMuted,
    marginTop: 3,
  },
  trxAmountCol: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  trxAmount: {
    fontSize: 14,
    fontWeight: '800',
    color: Colors.primary,
  },
  trxDebtSub: {
    fontSize: 10,
    color: Colors.danger,
    fontWeight: '700',
    marginTop: 1,
  },
  emptyCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 28,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#F0F3F1',
    ...getShadowStyle(1),
  },
  emptyText: {
    fontSize: 13,
    color: Colors.textMuted,
    marginTop: 8,
    fontWeight: '500',
  },
});
