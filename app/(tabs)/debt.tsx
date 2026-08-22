import React, { useState, useCallback } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  FlatList,
  TextInput,
  Modal,
  Alert,
  ScrollView,
  Linking,
  SafeAreaView,
} from 'react-native';
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
} from '../../src/services/debtService';
import { formatRupiah, formatTanggal, generateDebtWaMessage } from '../../src/utils/formatters';
import { Colors } from '../../src/constants/theme';
import { Ionicons } from '@expo/vector-icons';

export default function DebtScreen() {
  const db = useSQLiteContext();

  const [debts, setDebts] = useState<Debt[]>([]);
  const [activeTabFilter, setActiveTabFilter] = useState<'UNPAID' | 'PAID' | 'ALL'>('UNPAID');

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
      Alert.alert('Nama Pelanggan Wajib', 'Mohon isi nama pelanggan utang.');
      return;
    }
    const amount = parseFloat(newTotalDebt) || 0;
    if (amount <= 0) {
      Alert.alert('Jumlah Utang Wajib', 'Mohon masukkan jumlah utang yang valid.');
      return;
    }

    try {
      await addDebt(db, newCustomerName.trim(), newPhone.trim() || null, amount);
      setIsAddModalVisible(false);
      setNewCustomerName('');
      setNewPhone('');
      setNewTotalDebt('');
      loadDebts();
      Alert.alert('Berhasil', 'Catatan utang baru berhasil ditambahkan.');
    } catch (err: any) {
      Alert.alert('Gagal', err.message || 'Gagal menambahkan utang.');
    }
  };

  const handlePayDebtSubmit = async () => {
    if (!selectedDebt) return;
    const amount = parseFloat(payAmount) || 0;
    if (amount <= 0) {
      Alert.alert('Nominal Pembayaran', 'Masukkan nominal pembayaran cicilan/pelunasan.');
      return;
    }

    try {
      await payDebt(db, selectedDebt.id, amount, payNotes.trim());
      setIsPayModalVisible(false);
      setPayAmount('');
      setPayNotes('');
      loadDebts();
      Alert.alert('Pembayaran Dicatat', 'Pembayaran utang telah berhasil diperbarui.');
    } catch (err: any) {
      Alert.alert('Gagal', err.message || 'Terjadi kesalahan saat memproses pembayaran.');
    }
  };

  const openPaymentHistory = async (debt: Debt) => {
    setSelectedDebt(debt);
    const history = await getDebtPayments(db, debt.id);
    setPaymentHistory(history);
    setIsHistoryModalVisible(true);
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
      Alert.alert('WhatsApp Tidak Terpasang', 'Aplikasi WhatsApp tidak ditemukan di HP Anda.');
    });
  };

  const handleDeleteDebt = (debt: Debt) => {
    Alert.alert(
      'Hapus Utang',
      `Apakah Anda yakin ingin menghapus catatan utang "${debt.customer_name}"?`,
      [
        { text: 'Batal', style: 'cancel' },
        {
          text: 'Hapus',
          style: 'destructive',
          onPress: async () => {
            await deleteDebt(db, debt.id);
            loadDebts();
          },
        },
      ]
    );
  };

  const totalOutstanding = debts.reduce((sum, d) => sum + d.remaining_debt, 0);
  const filteredDebts = debts.filter((d) => {
    if (activeTabFilter === 'UNPAID') return d.status !== 'PAID';
    if (activeTabFilter === 'PAID') return d.status === 'PAID';
    return true;
  });

  return (
    <SafeAreaView style={styles.container}>
      {/* Total Outstanding Header */}
      <View style={styles.headerCard}>
        <View style={styles.headerRow}>
          <View>
            <Text style={styles.headerLabel}>Total Utang Pelanggan Belum Lunas</Text>
            <Text style={styles.headerTotal}>{formatRupiah(totalOutstanding)}</Text>
          </View>
          <TouchableOpacity style={styles.addDebtBtn} onPress={() => setIsAddModalVisible(true)}>
            <Ionicons name="add" color="#FFFFFF" size={18} />
            <Text style={styles.addDebtBtnText}>Catat Utang</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Filter Tabs */}
      <View style={styles.filterBar}>
        <TouchableOpacity
          style={[styles.filterChip, activeTabFilter === 'UNPAID' && styles.filterChipActive]}
          onPress={() => setActiveTabFilter('UNPAID')}
        >
          <Text style={[styles.filterChipText, activeTabFilter === 'UNPAID' && styles.filterChipTextActive]}>
            Belum Lunas ({debts.filter((d) => d.status !== 'PAID').length})
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.filterChip, activeTabFilter === 'PAID' && styles.filterChipActive]}
          onPress={() => setActiveTabFilter('PAID')}
        >
          <Text style={[styles.filterChipText, activeTabFilter === 'PAID' && styles.filterChipTextActive]}>
            Lunas ({debts.filter((d) => d.status === 'PAID').length})
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.filterChip, activeTabFilter === 'ALL' && styles.filterChipActive]}
          onPress={() => setActiveTabFilter('ALL')}
        >
          <Text style={[styles.filterChipText, activeTabFilter === 'ALL' && styles.filterChipTextActive]}>
            Semua ({debts.length})
          </Text>
        </TouchableOpacity>
      </View>

      {/* Debt List */}
      <FlatList
        data={filteredDebts}
        keyExtractor={(item) => item.id.toString()}
        contentContainerStyle={styles.listContent}
        renderItem={({ item }) => (
          <View style={styles.debtCard}>
            <View style={styles.cardTop}>
              <View style={{ flex: 1 }}>
                <Text style={styles.customerName}>{item.customer_name}</Text>
                {item.phone ? (
                  <Text style={styles.phoneText}>📱 {item.phone}</Text>
                ) : (
                  <Text style={styles.phoneTextMuted}>Tidak ada No. HP</Text>
                )}
                <Text style={styles.dateText}>Tgl: {formatTanggal(item.created_at)}</Text>
              </View>

              {/* Status Badge */}
              <View
                style={[
                  styles.statusBadge,
                  item.status === 'PAID'
                    ? styles.badgePaid
                    : item.status === 'PARTIAL'
                    ? styles.badgePartial
                    : styles.badgeUnpaid,
                ]}
              >
                <Text
                  style={[
                    styles.statusBadgeText,
                    item.status === 'PAID'
                      ? styles.badgePaidText
                      : item.status === 'PARTIAL'
                      ? styles.badgePartialText
                      : styles.badgeUnpaidText,
                  ]}
                >
                  {item.status === 'PAID' ? 'LUNAS' : item.status === 'PARTIAL' ? 'DICICIL' : 'BELUM BAYAR'}
                </Text>
              </View>
            </View>

            <View style={styles.divider} />

            {/* Money Metrics */}
            <View style={styles.moneyRow}>
              <View style={styles.moneyCol}>
                <Text style={styles.moneyLabel}>Total Kasbon</Text>
                <Text style={styles.moneyValue}>{formatRupiah(item.total_debt)}</Text>
              </View>

              <View style={styles.moneyCol}>
                <Text style={styles.moneyLabel}>Sisa Utang</Text>
                <Text
                  style={[
                    styles.moneyValue,
                    { color: item.remaining_debt > 0 ? Colors.danger : Colors.success, fontWeight: 'bold' },
                  ]}
                >
                  {formatRupiah(item.remaining_debt)}
                </Text>
              </View>
            </View>

            {/* Actions Bar */}
            <View style={styles.actionsContainer}>
              {item.remaining_debt > 0 ? (
                <>
                  <TouchableOpacity
                    style={styles.payBtn}
                    onPress={() => {
                      setSelectedDebt(item);
                      setPayAmount(item.remaining_debt.toString());
                      setIsPayModalVisible(true);
                    }}
                  >
                    <Ionicons name="card-outline" color="#FFFFFF" size={14} />
                    <Text style={styles.payBtnText}>Bayar Utang</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.waBtn}
                    onPress={() => handleSendWaReminder(item)}
                  >
                    <Ionicons name="logo-whatsapp" color={Colors.success} size={14} />
                    <Text style={styles.waBtnText}>Ingatkan WA</Text>
                  </TouchableOpacity>
                </>
              ) : null}

              <TouchableOpacity
                style={styles.historyBtn}
                onPress={() => openPaymentHistory(item)}
              >
                <Ionicons name="time-outline" color={Colors.primaryDark} size={14} />
                <Text style={styles.historyBtnText}>Riwayat</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.deleteBtn}
                onPress={() => handleDeleteDebt(item)}
              >
                <Ionicons name="trash-outline" color={Colors.danger} size={14} />
              </TouchableOpacity>
            </View>
          </View>
        )}
        ListEmptyComponent={
          <View style={styles.emptyBox}>
            <Ionicons name="book-outline" color={Colors.textMuted} size={48} />
            <Text style={styles.emptyTitle}>Tidak Ada Catatan Kasbon</Text>
            <Text style={styles.emptySub}>Semua kasbon pelanggan telah lunas atau belum ada data.</Text>
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
              <Text style={styles.modalTitle}>Catat Utang / Kasbon Baru</Text>
              <TouchableOpacity onPress={() => setIsAddModalVisible(false)}>
                <Ionicons name="close" color={Colors.text} size={24} />
              </TouchableOpacity>
            </View>

            <ScrollView style={{ marginBottom: 12 }}>
              <Text style={styles.formLabel}>Nama Pelanggan (Wajib):</Text>
              <View style={styles.inputWithIcon}>
                <Ionicons name="person-outline" color={Colors.textMuted} size={18} />
                <TextInput
                  style={styles.iconInput}
                  placeholder="Contoh: Pak Budi / Bu Ani"
                  value={newCustomerName}
                  onChangeText={setNewCustomerName}
                />
              </View>

              <Text style={[styles.formLabel, { marginTop: 10 }]}>No. HP WhatsApp (Opsional):</Text>
              <View style={styles.inputWithIcon}>
                <Ionicons name="call-outline" color={Colors.textMuted} size={18} />
                <TextInput
                  style={styles.iconInput}
                  keyboardType="phone-pad"
                  placeholder="Contoh: 08123456789"
                  value={newPhone}
                  onChangeText={setNewPhone}
                />
              </View>

              <Text style={[styles.formLabel, { marginTop: 10 }]}>Jumlah Utang / Kasbon (Rp):</Text>
              <TextInput
                style={styles.input}
                keyboardType="numeric"
                placeholder="Contoh: 50000"
                value={newTotalDebt}
                onChangeText={setNewTotalDebt}
              />
            </ScrollView>

            <TouchableOpacity style={styles.submitModalBtn} onPress={handleAddDebt}>
              <Text style={styles.submitModalBtnText}>Simpan Utang</Text>
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
              <Text style={styles.modalTitle}>Bayar Cicilan / Pelunasan</Text>
              <TouchableOpacity onPress={() => setIsPayModalVisible(false)}>
                <Ionicons name="close" color={Colors.text} size={24} />
              </TouchableOpacity>
            </View>

            {selectedDebt ? (
              <ScrollView style={{ marginBottom: 12 }}>
                <View style={styles.debtSummaryBox}>
                  <Text style={styles.debtSummaryName}>{selectedDebt.customer_name}</Text>
                  <Text style={styles.debtSummaryRemaining}>
                    Sisa Utang: {formatRupiah(selectedDebt.remaining_debt)}
                  </Text>
                </View>

                <Text style={styles.formLabel}>Nominal Dibayarkan (Rp):</Text>
                <TextInput
                  style={styles.input}
                  keyboardType="numeric"
                  placeholder="Masukkan nominal bayar..."
                  value={payAmount}
                  onChangeText={setPayAmount}
                />

                <Text style={[styles.formLabel, { marginTop: 10 }]}>Catatan / Keterangan (Opsional):</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Contoh: Bayar lunas via Transfer QRIS"
                  value={payNotes}
                  onChangeText={setPayNotes}
                />
              </ScrollView>
            ) : null}

            <TouchableOpacity style={styles.submitModalBtn} onPress={handlePayDebtSubmit}>
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
              <Text style={styles.modalTitle}>Riwayat Cicilan Pembayaran</Text>
              <TouchableOpacity onPress={() => setIsHistoryModalVisible(false)}>
                <Ionicons name="close" color={Colors.text} size={24} />
              </TouchableOpacity>
            </View>

            <FlatList
              data={paymentHistory}
              keyExtractor={(item) => item.id.toString()}
              renderItem={({ item }) => (
                <View style={styles.historyRow}>
                  <View>
                    <Text style={styles.historyAmount}>{formatRupiah(item.amount_paid)}</Text>
                    <Text style={styles.historyDate}>{formatTanggal(item.payment_date)}</Text>
                    {item.notes ? <Text style={styles.historyNotes}>Catatan: {item.notes}</Text> : null}
                  </View>
                </View>
              )}
              ListEmptyComponent={
                <Text style={{ textAlign: 'center', marginVertical: 20, color: Colors.textMuted }}>
                  Belum ada riwayat cicilan.
                </Text>
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
    backgroundColor: Colors.primaryDark,
    padding: 16,
    borderBottomLeftRadius: 16,
    borderBottomRightRadius: 16,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerLabel: {
    color: '#E2E8F0',
    fontSize: 12,
  },
  headerTotal: {
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: 'bold',
    marginTop: 2,
  },
  addDebtBtn: {
    backgroundColor: Colors.secondary,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    gap: 4,
  },
  addDebtBtnText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
    fontSize: 13,
  },
  filterBar: {
    flexDirection: 'row',
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 6,
  },
  filterChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  filterChipActive: {
    backgroundColor: Colors.primaryLight,
    borderColor: Colors.primary,
  },
  filterChipText: {
    fontSize: 12,
    color: Colors.textSecondary,
  },
  filterChipTextActive: {
    color: Colors.primaryDark,
    fontWeight: 'bold',
  },
  listContent: {
    padding: 12,
    paddingBottom: 40,
  },
  debtCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: Colors.border,
    ...getShadowStyle(1),
  },
  cardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  customerName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: Colors.text,
  },
  phoneText: {
    fontSize: 12,
    color: Colors.primaryDark,
    marginTop: 2,
  },
  phoneTextMuted: {
    fontSize: 12,
    color: Colors.textMuted,
    marginTop: 2,
  },
  dateText: {
    fontSize: 10,
    color: Colors.textMuted,
    marginTop: 2,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  statusBadgeText: {
    fontSize: 11,
    fontWeight: 'bold',
  },
  badgeUnpaid: {
    backgroundColor: Colors.dangerLight,
  },
  badgeUnpaidText: {
    color: Colors.danger,
    fontSize: 11,
    fontWeight: 'bold',
  },
  badgePartial: {
    backgroundColor: Colors.secondaryLight,
  },
  badgePartialText: {
    color: Colors.secondary,
    fontSize: 11,
    fontWeight: 'bold',
  },
  badgePaid: {
    backgroundColor: Colors.successLight,
  },
  badgePaidText: {
    color: Colors.success,
    fontSize: 11,
    fontWeight: 'bold',
  },
  divider: {
    height: 1,
    backgroundColor: '#F1F5F9',
    marginVertical: 10,
  },
  moneyRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  moneyCol: {},
  moneyLabel: {
    fontSize: 11,
    color: Colors.textMuted,
  },
  moneyValue: {
    fontSize: 14,
    color: Colors.text,
    marginTop: 2,
  },
  actionsContainer: {
    flexDirection: 'row',
    gap: 6,
  },
  payBtn: {
    flex: 1,
    backgroundColor: Colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    borderRadius: 6,
    gap: 4,
  },
  payBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: 'bold',
  },
  waBtn: {
    backgroundColor: Colors.successLight,
    borderWidth: 1,
    borderColor: Colors.success,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 6,
    gap: 4,
  },
  waBtnText: {
    color: Colors.success,
    fontSize: 12,
    fontWeight: 'bold',
  },
  historyBtn: {
    backgroundColor: '#F1F5F9',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 6,
    gap: 4,
  },
  historyBtnText: {
    color: Colors.primaryDark,
    fontSize: 12,
  },
  deleteBtn: {
    backgroundColor: Colors.dangerLight,
    width: 34,
    height: 34,
    borderRadius: 6,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyBox: {
    alignItems: 'center',
    padding: 40,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: Colors.textSecondary,
    marginTop: 12,
  },
  emptySub: {
    fontSize: 12,
    color: Colors.textMuted,
    marginTop: 4,
    textAlign: 'center',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '85%',
    padding: 16,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    paddingBottom: 12,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: Colors.text,
  },
  formLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.textSecondary,
    marginBottom: 4,
  },
  inputWithIcon: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 8,
    paddingHorizontal: 10,
    height: 42,
    backgroundColor: '#FAFAFA',
  },
  iconInput: {
    flex: 1,
    marginLeft: 8,
    fontSize: 14,
    color: Colors.text,
  },
  input: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 8,
    paddingHorizontal: 12,
    height: 42,
    fontSize: 14,
    color: Colors.text,
    backgroundColor: '#FAFAFA',
  },
  submitModalBtn: {
    backgroundColor: Colors.primary,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  submitModalBtnText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
    fontSize: 15,
  },
  debtSummaryBox: {
    backgroundColor: Colors.dangerLight,
    padding: 12,
    borderRadius: 8,
    marginBottom: 12,
  },
  debtSummaryName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: Colors.danger,
  },
  debtSummaryRemaining: {
    fontSize: 13,
    color: Colors.danger,
    marginTop: 2,
  },
  historyRow: {
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  historyAmount: {
    fontSize: 15,
    fontWeight: 'bold',
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
});
