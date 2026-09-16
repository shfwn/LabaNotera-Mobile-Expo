import React, { useState, useEffect, useCallback } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  TextInput,
  FlatList,
  Alert,
  SafeAreaView,
} from 'react-native';
import { useAppSQLiteContext as useSQLiteContext } from '../src/db/AppDatabaseProvider';
import { useRouter } from 'expo-router';
import { PriveExpense, ExpenseType } from '../src/types';
import {
  getPriveExpenses,
  addPriveExpense,
  deletePriveExpense,
} from '../src/services/priveService';
import { formatRupiah, formatTanggal, parseRupiahToNumber } from '../src/utils/formatters';
import { showAppAlert } from '../src/utils/alertHelper';
import { Colors } from '../src/constants/theme';
import { Ionicons } from '@expo/vector-icons';

export default function PriveModalScreen() {
  const db = useSQLiteContext();
  const router = useRouter();

  const [expenses, setExpenses] = useState<PriveExpense[]>([]);
  const [type, setType] = useState<ExpenseType>('PRIVE');
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const loadExpenses = useCallback(async () => {
    try {
      const data = await getPriveExpenses(db);
      setExpenses(data);
    } catch (err) {
      console.error('Failed to load prive expenses:', err);
    }
  }, [db]);

  useEffect(() => {
    loadExpenses();
  }, [loadExpenses]);

  const handleSubmit = async () => {
    const numAmount = parseRupiahToNumber(amount);
    if (numAmount <= 0) {
      showAppAlert('Nominal Tidak Valid', 'Mohon masukkan nominal uang yang diambil.');
      return;
    }
    if (!note.trim()) {
      showAppAlert('Keterangan Wajib', 'Mohon isi keterangan (contoh: Belanja dapur, Bayar Listrik).');
      return;
    }

    try {
      setIsSubmitting(true);
      await addPriveExpense(db, type, numAmount, note.trim());
      setAmount('');
      setNote('');
      await loadExpenses();
      showAppAlert(
        'Tercatat',
        type === 'PRIVE'
          ? 'Uang Dapur / Pengambilan Pribadi telah dicatat.'
          : 'Pengeluaran Biaya Operasional Warung telah dicatat.'
      );
    } catch (err: any) {
      showAppAlert('Gagal', err.message || 'Gagal menyimpan catatan.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = (id: number) => {
    showAppAlert(
      'Hapus Catatan',
      'Apakah Anda yakin ingin menghapus catatan pengeluaran ini?',
      [
        { text: 'Batal', style: 'cancel' },
        {
          text: 'Hapus',
          style: 'destructive',
          onPress: async () => {
            try {
              await deletePriveExpense(db, id);
              await loadExpenses();
            } catch (err: any) {
              showAppAlert('Gagal', err.message || 'Gagal menghapus catatan.');
            }
          },
        },
      ]
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.formCard}>
        <Text style={styles.sectionTitle}>Pilih Jenis Pengeluaran Laci Kasir</Text>
        
        {/* Selector Tabs */}
        <View style={styles.typeSelector}>
          <TouchableOpacity
            style={[styles.typeBtn, type === 'PRIVE' && styles.typeBtnPriveActive]}
            onPress={() => setType('PRIVE')}
          >
            <Ionicons name="cart-outline" color={type === 'PRIVE' ? '#FFFFFF' : Colors.secondary} size={18} />
            <Text style={[styles.typeBtnText, type === 'PRIVE' && styles.typeBtnTextActive]}>
              Uang Dapur (Prive)
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.typeBtn, type === 'EXPENSE' && styles.typeBtnExpenseActive]}
            onPress={() => setType('EXPENSE')}
          >
            <Ionicons name="flash-outline" color={type === 'EXPENSE' ? '#FFFFFF' : Colors.primaryDark} size={18} />
            <Text style={[styles.typeBtnText, type === 'EXPENSE' && styles.typeBtnTextActive]}>
              Biaya Warung
            </Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.descriptionText}>
          {type === 'PRIVE'
            ? 'Prive: Uang kasir yang diambil pemilik untuk keperluan pribadi/rumah tangga agar Laba Bersih warung tidak tercampur.'
            : 'Biaya Warung: Pengeluaran operasional usaha seperti listrik, isi ulang air galon, atau kantong kresek.'}
        </Text>

        {/* Inputs */}
        <Text style={styles.formLabel}>Nominal Uang (Rp):</Text>
        <TextInput
          style={styles.input}
          keyboardType="numeric"
          placeholder="Rp 0"
          value={amount}
          onChangeText={(text) => setAmount(formatRupiah(text))}
        />

        <Text style={[styles.formLabel, { marginTop: 10 }]}>Keterangan Pengambilan:</Text>
        <TextInput
          style={styles.input}
          placeholder={
            type === 'PRIVE'
              ? 'Contoh: Belanja lauk pauk & sayur dapur'
              : 'Contoh: Bayar token listrik warung'
          }
          value={note}
          onChangeText={setNote}
        />

        <TouchableOpacity
          style={[styles.saveBtn, isSubmitting && { opacity: 0.5 }]}
          onPress={handleSubmit}
          disabled={isSubmitting}
        >
          <Ionicons name="add" color="#FFFFFF" size={18} />
          <Text style={styles.saveBtnText}>Simpan Catatan Laci</Text>
        </TouchableOpacity>
      </View>

      {/* History List */}
      <View style={styles.listHeaderContainer}>
        <Text style={styles.listTitle}>Riwayat Pengeluaran & Prive</Text>
      </View>

      <FlatList
        data={expenses}
        keyExtractor={(item) => item.id.toString()}
        contentContainerStyle={styles.listContent}
        renderItem={({ item }) => (
          <View style={styles.card}>
            <View style={styles.cardLeft}>
              <View
                style={[
                  styles.badge,
                  item.type === 'PRIVE'
                    ? styles.badgePrive
                    : item.type === 'RESTOCK'
                    ? styles.badgeRestock
                    : styles.badgeExpense,
                ]}
              >
                <Text
                  style={[
                    styles.badgeText,
                    item.type === 'RESTOCK' && { color: '#0369A1' },
                  ]}
                >
                  {item.type === 'PRIVE'
                    ? 'PRIVE / DAPUR'
                    : item.type === 'RESTOCK'
                    ? 'KULAKAN / STOK'
                    : 'BIAYA WARUNG'}
                </Text>
              </View>

              <Text style={styles.cardNote}>{item.note}</Text>
              <Text style={styles.cardDate}>{formatTanggal(item.date)}</Text>
            </View>

            <View style={styles.cardRight}>
              <Text style={styles.cardAmount}>{formatRupiah(item.amount)}</Text>
              <TouchableOpacity onPress={() => handleDelete(item.id)}>
                <Ionicons name="trash-outline" color={Colors.danger} size={18} />
              </TouchableOpacity>
            </View>
          </View>
        )}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="wallet-outline" color={Colors.textMuted} size={40} />
            <Text style={styles.emptyText}>Belum ada catatan prive/biaya.</Text>
          </View>
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  formCard: {
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: Colors.textSecondary,
    marginBottom: 10,
  },
  typeSelector: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 8,
  },
  typeBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.border,
    gap: 6,
  },
  typeBtnPriveActive: {
    backgroundColor: Colors.secondary,
    borderColor: Colors.secondary,
  },
  typeBtnExpenseActive: {
    backgroundColor: Colors.primaryDark,
    borderColor: Colors.primaryDark,
  },
  typeBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  typeBtnTextActive: {
    color: '#FFFFFF',
    fontWeight: 'bold',
  },
  descriptionText: {
    fontSize: 11,
    color: Colors.textMuted,
    lineHeight: 16,
    marginBottom: 12,
  },
  formLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.textSecondary,
    marginBottom: 4,
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
  saveBtn: {
    backgroundColor: Colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 8,
    marginTop: 14,
    gap: 6,
  },
  saveBtnText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
    fontSize: 15,
  },
  listHeaderContainer: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 8,
  },
  listTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: Colors.textSecondary,
  },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 30,
  },
  card: {
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
  cardLeft: {
    flex: 1,
  },
  badge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    marginBottom: 4,
  },
  badgePrive: {
    backgroundColor: Colors.secondaryLight,
  },
  badgeExpense: {
    backgroundColor: Colors.primaryLight,
  },
  badgeRestock: {
    backgroundColor: '#E0F2FE',
  },
  badgeText: {
    fontSize: 10,
    fontWeight: 'bold',
    color: Colors.text,
  },
  cardNote: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.text,
  },
  cardDate: {
    fontSize: 11,
    color: Colors.textMuted,
    marginTop: 2,
  },
  cardRight: {
    alignItems: 'flex-end',
    gap: 8,
  },
  cardAmount: {
    fontSize: 15,
    fontWeight: 'bold',
    color: Colors.danger,
  },
  emptyContainer: {
    alignItems: 'center',
    padding: 30,
  },
  emptyText: {
    fontSize: 13,
    color: Colors.textMuted,
    marginTop: 8,
  },
});
