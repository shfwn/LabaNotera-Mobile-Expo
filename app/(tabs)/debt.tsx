import React, { useState, useCallback, useMemo } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  FlatList,
  TextInput,
  Modal,
  ScrollView,
  Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAppSQLiteContext as useSQLiteContext } from '../../src/db/AppDatabaseProvider';
import { useFocusEffect } from 'expo-router';
import { Debt, DebtPayment } from '../../src/types';
import { getShadowStyle } from '../../src/utils/styleHelper';
import {
  getDebts,
  addDebt,
  payDebt,
  getDebtPayments,
  deleteDebt,
  deleteDebtPayment,
} from '../../src/services/debtService';
import {
  formatRupiah,
  formatTanggal,
  generateDebtWaMessage,
  parseRupiahToNumber,
} from '../../src/utils/formatters';
import { showAppAlert } from '../../src/utils/alertHelper';
import { Colors, Radius, Shadows } from '../../src/constants/theme';
import { Ionicons } from '@expo/vector-icons';

export default function DebtScreen() {
  const db = useSQLiteContext();

  const [debts, setDebts] = useState<Debt[]>([]);
  const [activeTabFilter, setActiveTabFilter] = useState<'UNPAID' | 'PAID' | 'ALL'>('UNPAID');
  const [searchQuery, setSearchQuery] = useState('');

  // New Debt Modal
  const [isAddModalVisible, setIsAddModalVisible] = useState(false);
  const [newCustomerName, setNewCustomerName] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [newTotalDebt, setNewTotalDebt] = useState('');

  // Payment Modal
  const [isPayModalVisible, setIsPayModalVisible] = useState(false);
  const [selectedDebt, setSelectedDebt] = useState<Debt | null>(null);
  const [payAmount, setPayAmount] = useState('');
  const [payNotes, setPayNotes] = useState('');

  // History Modal
  const [isHistoryModalVisible, setIsHistoryModalVisible] = useState(false);
  const [paymentHistory, setPaymentHistory] = useState<DebtPayment[]>([]);

  const loadDebts = useCallback(async () => {
    try {
      const data = await getDebts(db);
      setDebts(data);
    } catch (err) {
      console.error('Failed to load debts:', err);
    }
  }, [db]);

  useFocusEffect(
    useCallback(() => {
      loadDebts();
    }, [loadDebts])
  );

  const handleAddDebt = async () => {
    if (!newCustomerName.trim()) {
      showAppAlert('Nama Pelanggan Wajib', 'Mohon isi nama pelanggan utang.');
      return;
    }
    if (!newPhone.trim()) {
      showAppAlert('Nomor HP Wajib', 'Mohon masukkan nomor HP / WhatsApp pelanggan untuk catatan utang agar dapat dihubungi atau diingatkan via WA.');
      return;
    }
    const amount = parseRupiahToNumber(newTotalDebt);
    if (amount <= 0) {
      showAppAlert('Jumlah Utang Wajib', 'Mohon masukkan jumlah utang yang valid.');
      return;
    }

    try {
      await addDebt(db, newCustomerName.trim(), newPhone.trim(), amount);
      setIsAddModalVisible(false);
      setNewCustomerName('');
      setNewPhone('');
      setNewTotalDebt('');
      await loadDebts();
      showAppAlert('Berhasil', 'Catatan utang baru berhasil ditambahkan.');
    } catch (err: any) {
      showAppAlert('Gagal', err.message || 'Gagal menambahkan utang.');
    }
  };

  const handlePayDebtSubmit = async () => {
    if (!selectedDebt) return;
    const amount = parseRupiahToNumber(payAmount);
    if (amount <= 0) {
      showAppAlert('Nominal Pembayaran', 'Masukkan nominal pembayaran cicilan/pelunasan.');
      return;
    }

    try {
      await payDebt(db, selectedDebt.id, amount, payNotes.trim());
      setIsPayModalVisible(false);
      setPayAmount('');
      setPayNotes('');
      await loadDebts();
      showAppAlert('Pembayaran Dicatat', `Pembayaran ${formatRupiah(amount)} berhasil disimpan.`);
    } catch (err: any) {
      showAppAlert('Gagal', err.message || 'Terjadi kesalahan saat memproses pembayaran.');
    }
  };

  const openPaymentHistory = async (debt: Debt) => {
    try {
      const freshDebt = (await db.getFirstAsync<Debt>(`SELECT * FROM debts WHERE id = ?`, [debt.id])) || debt;
      setSelectedDebt(freshDebt);
      const history = await getDebtPayments(db, debt.id);
      setPaymentHistory(history);
      setIsHistoryModalVisible(true);
    } catch (err) {
      console.error('Failed to load payment history:', err);
    }
  };

  const handleDeletePaymentItem = (paymentItem: DebtPayment) => {
    if (!selectedDebt) return;
    showAppAlert(
      'Hapus Riwayat Cicilan',
      `Hapus pembayaran ${formatRupiah(paymentItem.amount_paid)}? Sisa utang pelanggan akan disesuaikan kembali.`,
      [
        { text: 'Batal', style: 'cancel' },
        {
          text: 'Hapus',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteDebtPayment(db, paymentItem.id, selectedDebt.id);
              await loadDebts();
              const freshDebt = await db.getFirstAsync<Debt>(`SELECT * FROM debts WHERE id = ?`, [selectedDebt.id]);
              if (freshDebt) setSelectedDebt(freshDebt);
              const history = await getDebtPayments(db, selectedDebt.id);
              setPaymentHistory(history);
            } catch (err) {
              console.error('Failed to delete payment item:', err);
            }
          },
        },
      ]
    );
  };

  const handleSendWaReminder = (debt: Debt) => {
    let rawPhone = debt.phone ? debt.phone.replace(/[^0-9]/g, '') : '';
    if (rawPhone.startsWith('0')) {
      rawPhone = '62' + rawPhone.slice(1);
    }

    const message = generateDebtWaMessage(debt.customer_name, debt.remaining_debt);
    const encodedMessage = encodeURIComponent(message);
    const waUrl = rawPhone
      ? `https://wa.me/${rawPhone}?text=${encodedMessage}`
      : `https://api.whatsapp.com/send?text=${encodedMessage}`;

    Linking.openURL(waUrl).catch(() => {
      showAppAlert('WhatsApp Tidak Terpasang', 'Aplikasi WhatsApp tidak ditemukan di HP Anda.');
    });
  };

  const handleDeleteDebt = (debt: Debt) => {
    showAppAlert(
      'Hapus Catatan Utang',
      `Apakah Anda yakin ingin menghapus catatan utang "${debt.customer_name}"? Semua riwayat pembayaran terkait juga akan terhapus.`,
      [
        { text: 'Batal', style: 'cancel' },
        {
          text: 'Hapus',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteDebt(db, debt.id);
              await loadDebts();
              if (selectedDebt?.id === debt.id) {
                setIsHistoryModalVisible(false);
                setIsPayModalVisible(false);
                setSelectedDebt(null);
              }
              showAppAlert('Berhasil', 'Catatan utang telah dihapus.');
            } catch (err) {
              console.error('Failed to delete debt:', err);
              showAppAlert('Gagal', 'Terjadi kesalahan saat menghapus catatan utang.');
            }
          },
        },
      ]
    );
  };

  const totalOutstanding = debts.reduce((sum, d) => sum + (d.remaining_debt || 0), 0);
  const unpaidCount = debts.filter((d) => (d.remaining_debt || 0) > 0).length;
  const paidCount = debts.filter((d) => (d.remaining_debt || 0) <= 0).length;

  const filteredDebts = debts.filter((d) => {
    const isDebtPaid = (d.remaining_debt || 0) <= 0;
    if (activeTabFilter === 'UNPAID' && isDebtPaid) return false;
    if (activeTabFilter === 'PAID' && !isDebtPaid) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      const matchName = (d.customer_name || '').toLowerCase().includes(q);
      const matchPhone = d.phone ? d.phone.toLowerCase().includes(q) : false;
      return matchName || matchPhone;
    }
    return true;
  });

  return (
    <SafeAreaView style={styles.container}>
      {/* Total Outstanding Header Banner */}
      <View style={styles.headerCard}>
        <View style={styles.headerRow}>
          <View style={styles.headerTextCol}>
            <Text style={styles.headerLabel}>Total Utang Belum Lunas</Text>
            <Text style={styles.headerTotal} numberOfLines={1}>
              {formatRupiah(totalOutstanding)}
            </Text>
          </View>
          <TouchableOpacity
            style={styles.addDebtBtn}
            onPress={() => setIsAddModalVisible(true)}
            activeOpacity={0.7}
          >
            <Ionicons name="add-circle" color="#FFFFFF" size={18} />
            <Text style={styles.addDebtBtnText}>Catat Utang</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Search & Filter Bar */}
      <View style={styles.filterSection}>
        {/* Search Input */}
        <View style={styles.searchBar}>
          <Ionicons name="search-outline" color={Colors.textMuted} size={18} />
          <TextInput
            style={styles.searchInput}
            placeholder="Cari nama pelanggan / no. HP..."
            placeholderTextColor={Colors.textMuted}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Ionicons name="close-circle" color={Colors.textMuted} size={18} />
            </TouchableOpacity>
          )}
        </View>

        {/* Filter Chips */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterScrollContent}
        >
          <TouchableOpacity
            style={[styles.filterChip, activeTabFilter === 'UNPAID' && styles.filterChipActive]}
            onPress={() => setActiveTabFilter((prev) => (prev === 'UNPAID' ? 'ALL' : 'UNPAID'))}
            activeOpacity={0.7}
          >
            <Text style={[styles.filterChipText, activeTabFilter === 'UNPAID' && styles.filterChipTextActive]}>
              Belum Lunas ({unpaidCount})
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.filterChip, activeTabFilter === 'PAID' && styles.filterChipActive]}
            onPress={() => setActiveTabFilter((prev) => (prev === 'PAID' ? 'ALL' : 'PAID'))}
            activeOpacity={0.7}
          >
            <Text style={[styles.filterChipText, activeTabFilter === 'PAID' && styles.filterChipTextActive]}>
              Lunas ({paidCount})
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.filterChip, activeTabFilter === 'ALL' && styles.filterChipActive]}
            onPress={() => setActiveTabFilter('ALL')}
            activeOpacity={0.7}
          >
            <Text style={[styles.filterChipText, activeTabFilter === 'ALL' && styles.filterChipTextActive]}>
              Semua ({debts.length})
            </Text>
          </TouchableOpacity>
        </ScrollView>
      </View>

      {/* Debt List */}
      <FlatList
        data={filteredDebts}
        keyExtractor={(item) => item.id.toString()}
        contentContainerStyle={styles.listContent}
        renderItem={({ item }) => {
          const isPaid = (item.remaining_debt || 0) <= 0;
          const isPartial = (item.remaining_debt || 0) > 0 && item.remaining_debt < item.total_debt;
          const initial = item.customer_name ? item.customer_name[0].toUpperCase() : '?';

          return (
            <View style={styles.debtCard}>
              {/* Card Top: Customer Info & Status Badge */}
              <View style={styles.cardTop}>
                <View style={styles.customerInfoRow}>
                  <View style={[styles.avatarCircle, isPaid && styles.avatarCirclePaid]}>
                    <Text style={[styles.avatarText, isPaid && styles.avatarTextPaid]}>{initial}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.customerName} numberOfLines={1}>
                      {item.customer_name}
                    </Text>
                    {item.phone ? (
                      <TouchableOpacity
                        onPress={() => handleSendWaReminder(item)}
                        style={styles.phoneClickable}
                        activeOpacity={0.7}
                      >
                        <Ionicons name="call-outline" color={Colors.primary} size={12} />
                        <Text style={styles.phoneText}>{item.phone}</Text>
                      </TouchableOpacity>
                    ) : (
                      <Text style={styles.phoneTextMuted}>Tanpa No. HP</Text>
                    )}
                    <Text style={styles.dateText}>
                      Tgl: {formatTanggal(item.created_at)}
                    </Text>
                  </View>
                </View>

                {/* Status Badge */}
                <View
                  style={[
                    styles.statusBadge,
                    isPaid ? styles.badgePaid : isPartial ? styles.badgePartial : styles.badgeUnpaid,
                  ]}
                >
                  <Text
                    style={[
                      styles.statusBadgeText,
                      isPaid ? styles.badgePaidText : isPartial ? styles.badgePartialText : styles.badgeUnpaidText,
                    ]}
                  >
                    {isPaid ? 'LUNAS' : isPartial ? 'DICICIL' : 'BELUM BAYAR'}
                  </Text>
                </View>
              </View>

              {/* Money Summary */}
              <View style={styles.moneyContainer}>
                <View style={styles.moneyCol}>
                  <Text style={styles.moneyLabel}>Total Kasbon</Text>
                  <Text style={styles.moneyValue} numberOfLines={1}>
                    {formatRupiah(item.total_debt)}
                  </Text>
                </View>

                <View style={styles.moneyDivider} />

                <View style={styles.moneyCol}>
                  <Text style={styles.moneyLabel}>Sisa Utang</Text>
                  <Text
                    style={[
                      styles.moneyValue,
                      { color: isPaid ? Colors.success : Colors.danger, fontWeight: 'bold' },
                    ]}
                    numberOfLines={1}
                  >
                    {formatRupiah(item.remaining_debt)}
                  </Text>
                </View>
              </View>

              {/* Action Buttons */}
              <View style={styles.actionsContainer}>
                {!isPaid ? (
                  <>
                    {/* Row 1: Primary Actions */}
                    <View style={styles.actionsRow}>
                      <TouchableOpacity
                        style={styles.payBtn}
                        onPress={() => {
                          setSelectedDebt(item);
                          setPayAmount(formatRupiah(item.remaining_debt));
                          setIsPayModalVisible(true);
                        }}
                        activeOpacity={0.7}
                      >
                        <Ionicons name="card-outline" color="#FFFFFF" size={15} />
                        <Text style={styles.payBtnText}>Bayar / Cicil</Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={styles.waBtn}
                        onPress={() => handleSendWaReminder(item)}
                        activeOpacity={0.7}
                      >
                        <Ionicons name="logo-whatsapp" color={Colors.success} size={15} />
                        <Text style={styles.waBtnText}>Ingatkan WA</Text>
                      </TouchableOpacity>
                    </View>

                    {/* Row 2: Secondary Actions */}
                    <View style={styles.actionsRow}>
                      <TouchableOpacity
                        style={styles.historyBtn}
                        onPress={() => openPaymentHistory(item)}
                        activeOpacity={0.7}
                      >
                        <Ionicons name="time-outline" color={Colors.primaryDark} size={14} />
                        <Text style={styles.historyBtnText}>Riwayat Cicilan</Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={styles.deleteBtn}
                        onPress={() => handleDeleteDebt(item)}
                        activeOpacity={0.7}
                      >
                        <Ionicons name="trash-outline" color={Colors.danger} size={14} />
                        <Text style={styles.deleteBtnText}>Hapus</Text>
                      </TouchableOpacity>
                    </View>
                  </>
                ) : (
                  /* Paid Debt Actions */
                  <View style={styles.actionsRow}>
                    <TouchableOpacity
                      style={styles.historyBtn}
                      onPress={() => openPaymentHistory(item)}
                      activeOpacity={0.7}
                    >
                      <Ionicons name="time-outline" color={Colors.primaryDark} size={14} />
                      <Text style={styles.historyBtnText}>Riwayat Pembayaran</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={styles.deleteBtn}
                      onPress={() => handleDeleteDebt(item)}
                      activeOpacity={0.7}
                    >
                      <Ionicons name="trash-outline" color={Colors.danger} size={14} />
                      <Text style={styles.deleteBtnText}>Hapus</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            </View>
          );
        }}
        ListEmptyComponent={
          <View style={styles.emptyBox}>
            <Ionicons name="book-outline" color={Colors.textMuted} size={48} />
            <Text style={styles.emptyTitle}>
              {searchQuery ? 'Catatan Kasbon Tidak Ditemukan' : 'Tidak Ada Catatan Kasbon'}
            </Text>
            <Text style={styles.emptySub}>
              {searchQuery
                ? `Tidak ada kasbon yang cocok dengan kata kunci "${searchQuery}".`
                : 'Semua kasbon pelanggan telah lunas atau belum ada catatan utang.'}
            </Text>
          </View>
        }
      />

      {/* Modal Add Debt */}
      <Modal
        visible={isAddModalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setIsAddModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <View style={styles.modalTitleRow}>
                <Ionicons name="person-add-outline" size={20} color={Colors.primary} />
                <Text style={styles.modalTitle}>Catat Kasbon / Utang Baru</Text>
              </View>
              <TouchableOpacity onPress={() => setIsAddModalVisible(false)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                <Ionicons name="close" color={Colors.text} size={24} />
              </TouchableOpacity>
            </View>

            <ScrollView style={{ marginBottom: 16 }}>
              <Text style={styles.formLabel}>Nama Pelanggan (Wajib):</Text>
              <View style={styles.inputWithIcon}>
                <Ionicons name="person-outline" color={Colors.textMuted} size={18} />
                <TextInput
                  style={styles.iconInput}
                  placeholder="Contoh: Pak Budi / Bu Ani"
                  placeholderTextColor={Colors.textMuted}
                  value={newCustomerName}
                  onChangeText={setNewCustomerName}
                />
              </View>

              <Text style={[styles.formLabel, { marginTop: 12 }]}>No. HP / WhatsApp (Wajib):</Text>
              <View style={styles.inputWithIcon}>
                <Ionicons name="logo-whatsapp" color={Colors.success} size={18} />
                <TextInput
                  style={styles.iconInput}
                  keyboardType="phone-pad"
                  placeholder="Contoh: 08123456789"
                  placeholderTextColor={Colors.textMuted}
                  value={newPhone}
                  onChangeText={setNewPhone}
                />
              </View>

              <Text style={[styles.formLabel, { marginTop: 12 }]}>Jumlah Kasbon (Rp):</Text>
              <View style={styles.inputWithIcon}>
                <Ionicons name="cash-outline" color={Colors.textMuted} size={18} />
                <TextInput
                  style={styles.iconInput}
                  keyboardType="numeric"
                  placeholder="Rp 0"
                  placeholderTextColor={Colors.textMuted}
                  value={newTotalDebt}
                  onChangeText={(text) => setNewTotalDebt(formatRupiah(text))}
                />
              </View>
            </ScrollView>

            <TouchableOpacity style={styles.submitModalBtn} onPress={handleAddDebt} activeOpacity={0.7}>
              <Text style={styles.submitModalBtnText}>Simpan Catatan Utang</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Modal Pay Debt */}
      <Modal
        visible={isPayModalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setIsPayModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <View style={styles.modalTitleRow}>
                <Ionicons name="cash-outline" size={20} color={Colors.primary} />
                <Text style={styles.modalTitle}>Bayar Cicilan / Pelunasan</Text>
              </View>
              <TouchableOpacity onPress={() => setIsPayModalVisible(false)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                <Ionicons name="close" color={Colors.text} size={24} />
              </TouchableOpacity>
            </View>

            {selectedDebt ? (
              <ScrollView style={{ marginBottom: 16 }}>
                <View style={styles.debtSummaryBox}>
                  <Text style={styles.debtSummaryName}>{selectedDebt.customer_name}</Text>
                  <Text style={styles.debtSummaryRemaining}>
                    Sisa Utang: <Text style={{ fontWeight: 'bold' }}>{formatRupiah(selectedDebt.remaining_debt)}</Text>
                  </Text>
                </View>

                <Text style={styles.formLabel}>Nominal Pembayaran (Rp):</Text>
                <View style={styles.inputWithIcon}>
                  <Ionicons name="wallet-outline" color={Colors.textMuted} size={18} />
                  <TextInput
                    style={styles.iconInput}
                    keyboardType="numeric"
                    placeholder="Rp 0"
                    placeholderTextColor={Colors.textMuted}
                    value={payAmount}
                    onChangeText={(text) => setPayAmount(formatRupiah(text))}
                  />
                </View>

                {/* Quick amount buttons */}
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.quickAmountRow}>
                  <TouchableOpacity
                    style={styles.quickAmountBtn}
                    onPress={() => setPayAmount(formatRupiah(selectedDebt.remaining_debt))}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.quickAmountText}>Lunas ({formatRupiah(selectedDebt.remaining_debt)})</Text>
                  </TouchableOpacity>

                  {selectedDebt.remaining_debt >= 10000 && (
                    <TouchableOpacity
                      style={styles.quickAmountBtn}
                      onPress={() => setPayAmount(formatRupiah(Math.round(selectedDebt.remaining_debt / 2)))}
                      activeOpacity={0.7}
                    >
                      <Text style={styles.quickAmountText}>50% ({formatRupiah(Math.round(selectedDebt.remaining_debt / 2))})</Text>
                    </TouchableOpacity>
                  )}

                  {selectedDebt.remaining_debt >= 1000 && (
                    <TouchableOpacity
                      style={styles.quickAmountBtn}
                      onPress={() => setPayAmount(formatRupiah(Math.min(1000, selectedDebt.remaining_debt)))}
                      activeOpacity={0.7}
                    >
                      <Text style={styles.quickAmountText}>Rp 1.000</Text>
                    </TouchableOpacity>
                  )}

                  {selectedDebt.remaining_debt >= 2000 && (
                    <TouchableOpacity
                      style={styles.quickAmountBtn}
                      onPress={() => setPayAmount(formatRupiah(Math.min(2000, selectedDebt.remaining_debt)))}
                      activeOpacity={0.7}
                    >
                      <Text style={styles.quickAmountText}>Rp 2.000</Text>
                    </TouchableOpacity>
                  )}

                  {selectedDebt.remaining_debt >= 5000 && (
                    <TouchableOpacity
                      style={styles.quickAmountBtn}
                      onPress={() => setPayAmount(formatRupiah(Math.min(5000, selectedDebt.remaining_debt)))}
                      activeOpacity={0.7}
                    >
                      <Text style={styles.quickAmountText}>Rp 5.000</Text>
                    </TouchableOpacity>
                  )}

                  {selectedDebt.remaining_debt >= 10000 && (
                    <TouchableOpacity
                      style={styles.quickAmountBtn}
                      onPress={() => setPayAmount(formatRupiah(Math.min(10000, selectedDebt.remaining_debt)))}
                      activeOpacity={0.7}
                    >
                      <Text style={styles.quickAmountText}>Rp 10.000</Text>
                    </TouchableOpacity>
                  )}
                </ScrollView>

                <Text style={[styles.formLabel, { marginTop: 12 }]}>Catatan / Keterangan (Opsional):</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Contoh: Bayar via Tunai / Transfer QRIS"
                  placeholderTextColor={Colors.textMuted}
                  value={payNotes}
                  onChangeText={setPayNotes}
                />
              </ScrollView>
            ) : null}

            <TouchableOpacity style={styles.submitModalBtn} onPress={handlePayDebtSubmit} activeOpacity={0.7}>
              <Text style={styles.submitModalBtnText}>Simpan Pembayaran</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Modal History */}
      <Modal
        visible={isHistoryModalVisible}
        animationType="fade"
        transparent={true}
        onRequestClose={() => setIsHistoryModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <View style={styles.modalTitleRow}>
                <Ionicons name="time-outline" size={20} color={Colors.primary} />
                <Text style={styles.modalTitle}>Riwayat Pembayaran</Text>
              </View>
              <TouchableOpacity onPress={() => setIsHistoryModalVisible(false)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                <Ionicons name="close" color={Colors.text} size={24} />
              </TouchableOpacity>
            </View>

            {selectedDebt ? (
              <View style={styles.historyCustomerHeader}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.historyCustomerName}>{selectedDebt.customer_name}</Text>
                  <Text style={styles.historyCustomerMeta}>
                    Total: {formatRupiah(selectedDebt.total_debt)} • Sisa: {formatRupiah(selectedDebt.remaining_debt)}
                  </Text>
                </View>
                <View style={[styles.statusBadge, selectedDebt.remaining_debt <= 0 ? styles.badgePaid : styles.badgeUnpaid]}>
                  <Text style={[styles.statusBadgeText, selectedDebt.remaining_debt <= 0 ? styles.badgePaidText : styles.badgeUnpaidText]}>
                    {selectedDebt.remaining_debt <= 0 ? 'LUNAS' : 'BELUM LUNAS'}
                  </Text>
                </View>
              </View>
            ) : null}

            <FlatList
              data={paymentHistory}
              keyExtractor={(item) => item.id.toString()}
              renderItem={({ item }) => (
                <View style={styles.historyRow}>
                  <View style={styles.historyIconBg}>
                    <Ionicons name="checkmark-circle" color={Colors.success} size={20} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.historyAmount}>{formatRupiah(item.amount_paid)}</Text>
                    <Text style={styles.historyDate}>{formatTanggal(item.payment_date)}</Text>
                    {item.notes ? <Text style={styles.historyNotes}>Catatan: {item.notes}</Text> : null}
                  </View>
                  <TouchableOpacity
                    style={styles.historyDeleteBtn}
                    onPress={() => handleDeletePaymentItem(item)}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <Ionicons name="trash-outline" color={Colors.danger} size={16} />
                  </TouchableOpacity>
                </View>
              )}
              ListEmptyComponent={
                <View style={styles.emptyHistoryBox}>
                  <Ionicons name="receipt-outline" color={Colors.textMuted} size={36} />
                  <Text style={styles.emptyHistoryText}>Belum ada riwayat cicilan/pembayaran.</Text>
                </View>
              }
            />
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  headerCard: {
    backgroundColor: Colors.primary,
    marginHorizontal: 16,
    marginTop: 12,
    marginBottom: 6,
    borderRadius: Radius.xl2,
    padding: 16,
    ...Shadows.glow(0.25),
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 10,
  },
  headerTextCol: {
    flex: 1,
  },
  headerLabel: {
    color: 'rgba(255, 255, 255, 0.85)',
    fontSize: 12,
    fontWeight: '600',
  },
  headerTotal: {
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: '800',
    marginTop: 2,
  },
  addDebtBtn: {
    backgroundColor: Colors.secondary,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: Radius.full,
    gap: 5,
    flexShrink: 0,
    ...Shadows.glow(0.2, Colors.secondary),
  },
  addDebtBtnText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 13,
  },
  filterSection: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 4,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: Radius.full,
    paddingHorizontal: 14,
    height: 46,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: 8,
    ...Shadows.soft,
  },
  searchInput: {
    flex: 1,
    marginLeft: 8,
    fontSize: 13,
    color: Colors.text,
  },
  filterScrollContent: {
    flexDirection: 'row',
    gap: 8,
    paddingVertical: 4,
  },
  filterChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: Radius.full,
    backgroundColor: Colors.categoryInactive,
  },
  filterChipActive: {
    backgroundColor: Colors.categoryActive,
  },
  filterChipText: {
    fontSize: 12,
    color: Colors.categoryInactiveText,
    fontWeight: '600',
  },
  filterChipTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  listContent: {
    padding: 16,
    paddingBottom: 40,
  },
  debtCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: Radius.xl2,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: Colors.borderLight,
    ...Shadows.card,
  },
  cardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 8,
  },
  customerInfoRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    flex: 1,
  },
  avatarCircle: {
    width: 40,
    height: 40,
    borderRadius: Radius.full,
    backgroundColor: Colors.primaryLight,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarCirclePaid: {
    backgroundColor: '#F1F5F9',
  },
  avatarText: {
    fontSize: 16,
    fontWeight: '800',
    color: Colors.primary,
  },
  avatarTextPaid: {
    color: Colors.textMuted,
  },
  customerName: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.text,
  },
  phoneClickable: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
  },
  phoneText: {
    fontSize: 12,
    color: Colors.primary,
    fontWeight: '600',
  },
  phoneTextMuted: {
    fontSize: 12,
    color: Colors.textMuted,
    marginTop: 2,
  },
  dateText: {
    fontSize: 11,
    color: Colors.textMuted,
    marginTop: 3,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: Radius.full,
    alignSelf: 'flex-start',
  },
  statusBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  badgeUnpaid: {
    backgroundColor: Colors.dangerLight,
  },
  badgeUnpaidText: {
    color: Colors.danger,
  },
  badgePartial: {
    backgroundColor: Colors.warningLight,
  },
  badgePartialText: {
    color: Colors.warning,
  },
  badgePaid: {
    backgroundColor: Colors.successLight,
  },
  badgePaidText: {
    color: Colors.success,
  },
  moneyContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.primarySoft,
    borderRadius: Radius.lg,
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginVertical: 12,
    borderWidth: 1,
    borderColor: Colors.borderLight,
  },
  moneyCol: {
    flex: 1,
  },
  moneyDivider: {
    width: 1,
    height: 32,
    backgroundColor: Colors.border,
    marginHorizontal: 8,
  },
  moneyLabel: {
    fontSize: 11,
    color: Colors.textMuted,
  },
  moneyValue: {
    fontSize: 14,
    color: Colors.text,
    fontWeight: '700',
    marginTop: 2,
  },
  actionsContainer: {
    gap: 8,
  },
  actionsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  payBtn: {
    flex: 1,
    backgroundColor: Colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 40,
    borderRadius: Radius.full,
    gap: 6,
    ...Shadows.glow(0.18),
  },
  payBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  waBtn: {
    flex: 1,
    backgroundColor: Colors.primaryLight,
    borderWidth: 1,
    borderColor: Colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 40,
    borderRadius: Radius.full,
    gap: 6,
  },
  waBtnText: {
    color: Colors.primary,
    fontSize: 13,
    fontWeight: '700',
  },
  historyBtn: {
    flex: 1,
    backgroundColor: '#F1F5F9',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 36,
    borderRadius: Radius.full,
    gap: 5,
  },
  historyBtnText: {
    color: Colors.textSecondary,
    fontSize: 12,
    fontWeight: '600',
  },
  deleteBtn: {
    backgroundColor: Colors.dangerLight,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 14,
    height: 36,
    borderRadius: Radius.full,
    gap: 4,
  },
  deleteBtnText: {
    color: Colors.danger,
    fontSize: 12,
    fontWeight: '700',
  },
  emptyBox: {
    alignItems: 'center',
    padding: 40,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.textSecondary,
    marginTop: 12,
  },
  emptySub: {
    fontSize: 12,
    color: Colors.textMuted,
    marginTop: 4,
    textAlign: 'center',
    lineHeight: 18,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: Radius.xl3,
    borderTopRightRadius: Radius.xl3,
    maxHeight: '88%',
    padding: 20,
    paddingBottom: 24,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
    paddingBottom: 12,
  },
  modalTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: Colors.text,
  },
  formLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.textSecondary,
    marginBottom: 5,
  },
  inputWithIcon: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.lg,
    paddingHorizontal: 12,
    height: 44,
    backgroundColor: '#FAFAFA',
  },
  currencyPrefix: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.textSecondary,
    marginRight: 4,
  },
  iconInput: {
    flex: 1,
    fontSize: 14,
    color: Colors.text,
    paddingVertical: 0,
  },
  input: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.lg,
    paddingHorizontal: 12,
    height: 44,
    fontSize: 14,
    color: Colors.text,
    backgroundColor: '#FAFAFA',
  },
  submitModalBtn: {
    backgroundColor: Colors.primary,
    paddingVertical: 14,
    borderRadius: Radius.full,
    alignItems: 'center',
    ...Shadows.glow(0.2),
  },
  submitModalBtnText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 15,
  },
  debtSummaryBox: {
    backgroundColor: Colors.primarySoft,
    padding: 14,
    borderRadius: Radius.lg,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: Colors.primaryLight,
  },
  debtSummaryName: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.primaryDark,
  },
  debtSummaryRemaining: {
    fontSize: 13,
    color: Colors.primaryDark,
    marginTop: 3,
  },
  quickAmountRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 8,
    marginBottom: 4,
  },
  quickAmountBtn: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: Radius.full,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  quickAmountText: {
    fontSize: 11,
    color: Colors.primaryDark,
    fontWeight: '700',
  },
  historyCustomerHeader: {
    backgroundColor: '#F8FAFC',
    padding: 12,
    borderRadius: Radius.lg,
    marginBottom: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  historyCustomerName: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.text,
  },
  historyCustomerMeta: {
    fontSize: 12,
    color: Colors.textMuted,
    marginTop: 2,
  },
  historyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  historyIconBg: {
    marginTop: 2,
  },
  historyAmount: {
    fontSize: 15,
    fontWeight: '800',
    color: Colors.success,
  },
  historyDate: {
    fontSize: 11,
    color: Colors.textMuted,
    marginTop: 2,
  },
  historyNotes: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  historyDeleteBtn: {
    padding: 8,
    backgroundColor: Colors.dangerLight,
    borderRadius: Radius.full,
  },
  emptyHistoryBox: {
    alignItems: 'center',
    paddingVertical: 30,
  },
  emptyHistoryText: {
    fontSize: 13,
    color: Colors.textMuted,
    marginTop: 8,
  },
});
