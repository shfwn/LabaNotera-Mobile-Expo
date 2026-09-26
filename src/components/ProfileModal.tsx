import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  Modal,
  TextInput,
  Image,
  ScrollView,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { useAppSQLiteContext as useSQLiteContext } from '../db/AppDatabaseProvider';
import { ShopProfile } from '../types';
import { getShopProfile, updateShopProfile, DEFAULT_PROFILE } from '../services/profileService';
import { pickImageFromGallery } from '../utils/imageHelper';
import { showAppAlert } from '../utils/alertHelper';
import { syncClosingTimeSchedule } from '../utils/closingReminderHelper';
import { Colors } from '../constants/theme';
import { Ionicons } from '@expo/vector-icons';

interface ProfileModalProps {
  visible: boolean;
  onClose: () => void;
  onProfileUpdated?: (updatedProfile: ShopProfile) => void;
}

const COMMON_BANKS = ['BCA', 'BRI', 'Mandiri', 'BNI', 'BSI', 'Bank Jago', 'SeaBank', 'Dana', 'Gopay', 'OVO'];

export default function ProfileModal({ visible, onClose, onProfileUpdated }: ProfileModalProps) {
  const db = useSQLiteContext();

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const [shopName, setShopName] = useState('');
  const [ownerName, setOwnerName] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [bankName, setBankName] = useState('BCA');
  const [bankAccountNumber, setBankAccountNumber] = useState('');
  const [bankAccountHolder, setBankAccountHolder] = useState('');
  const [qrisImageUri, setQrisImageUri] = useState<string | null>(null);
  const [closingTime, setClosingTime] = useState('21:00');

  useEffect(() => {
    if (visible) {
      loadProfile();
    }
  }, [visible]);

  const loadProfile = async () => {
    try {
      setLoading(true);
      const profile = await getShopProfile(db);
      setShopName(profile.shop_name || 'Warung LabaNotera');
      setOwnerName(profile.owner_name || '');
      setPhone(profile.phone || '');
      setAddress(profile.address || '');
      setBankName(profile.bank_name || 'BCA');
      setBankAccountNumber(profile.bank_account_number || '');
      setBankAccountHolder(profile.bank_account_holder || '');
      setQrisImageUri(profile.qris_image_uri || null);
      setClosingTime(profile.closing_time || '21:00');
    } catch (err) {
      console.error('Failed to load profile:', err);
    } finally {
      setLoading(false);
    }
  };

  const handlePickQrisImage = async () => {
    try {
      const uri = await pickImageFromGallery();
      if (uri) {
        setQrisImageUri(uri);
      }
    } catch (err) {
      showAppAlert('Gagal Memilih Foto', 'Terjadi kesalahan saat memilih gambar.');
    }
  };

  const handleSave = async () => {
    if (!shopName.trim()) {
      showAppAlert('Nama Warung Wajib', 'Mohon masukkan nama warung Anda.');
      return;
    }

    try {
      setSaving(true);
      const updatedData: ShopProfile = {
        shop_name: shopName.trim(),
        owner_name: ownerName.trim() || null,
        phone: phone.trim() || null,
        address: address.trim() || null,
        bank_name: bankName.trim() || 'BCA',
        bank_account_number: bankAccountNumber.trim() || null,
        bank_account_holder: bankAccountHolder.trim() || null,
        qris_image_uri: qrisImageUri || null,
        closing_time: closingTime.trim() || '21:00',
      };

      await updateShopProfile(db, updatedData);
      await syncClosingTimeSchedule(db);

      if (onProfileUpdated) {
        onProfileUpdated(updatedData);
      }

      showAppAlert('Berhasil', 'Profil warung & informasi pembayaran berhasil disimpan!');
      onClose();
    } catch (err: any) {
      showAppAlert('Gagal Menyimpan', err.message || 'Terjadi kesalahan saat menyimpan profil.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          {/* Header */}
          <View style={styles.modalHeader}>
            <View style={styles.headerTitleRow}>
              <View style={styles.headerIconBg}>
                <Ionicons name="storefront-outline" color="#FFFFFF" size={20} />
              </View>
              <View>
                <Text style={styles.modalTitle}>Profil & Pengaturan Warung</Text>
                <Text style={styles.modalSubtitle}>Nama warung, rekening transfer & QRIS</Text>
              </View>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <Ionicons name="close" color={Colors.text} size={22} />
            </TouchableOpacity>
          </View>

          {loading ? (
            <View style={styles.loadingBox}>
              <ActivityIndicator size="large" color={Colors.primary} />
              <Text style={styles.loadingText}>Memuat profil warung...</Text>
            </View>
          ) : (
            <ScrollView style={styles.modalBody} showsVerticalScrollIndicator={false}>
              {/* Section 1: Identitas Warung */}
              <View style={styles.sectionCard}>
                <View style={styles.sectionHeaderRow}>
                  <Ionicons name="business-outline" color={Colors.primary} size={18} />
                  <Text style={styles.sectionTitle}>Identitas Warung</Text>
                </View>
                <Text style={styles.sectionDesc}>
                  Nama warung ini akan tampil di Beranda Dashboard, nota/struk kasir, dan ekspor PDF.
                </Text>

                <Text style={styles.inputLabel}>
                  Nama Warung / Toko <Text style={styles.requiredMark}>*</Text>
                </Text>
                <View style={styles.inputBox}>
                  <Ionicons name="storefront-outline" color={Colors.textMuted} size={18} />
                  <TextInput
                    style={styles.input}
                    placeholder="Contoh: Warung Bu Siti / Toko Berkah"
                    value={shopName}
                    onChangeText={setShopName}
                    placeholderTextColor={Colors.textMuted}
                  />
                </View>

                <Text style={styles.inputLabel}>Nama Pemilik (Opsional)</Text>
                <View style={styles.inputBox}>
                  <Ionicons name="person-outline" color={Colors.textMuted} size={18} />
                  <TextInput
                    style={styles.input}
                    placeholder="Contoh: Ibu Siti Rahayu"
                    value={ownerName}
                    onChangeText={setOwnerName}
                    placeholderTextColor={Colors.textMuted}
                  />
                </View>

                <Text style={styles.inputLabel}>Nomor WhatsApp / Telepon</Text>
                <View style={styles.inputBox}>
                  <Ionicons name="logo-whatsapp" color={Colors.textMuted} size={18} />
                  <TextInput
                    style={styles.input}
                    placeholder="Contoh: 08123456789"
                    value={phone}
                    onChangeText={setPhone}
                    keyboardType="phone-pad"
                    placeholderTextColor={Colors.textMuted}
                  />
                </View>

                {/* Jam Tutup Toko */}
                <Text style={styles.inputLabel}>Jam Tutup Toko (WIB)</Text>
                <View style={styles.inputBox}>
                  <Ionicons name="time-outline" color={Colors.textMuted} size={18} />
                  <TextInput
                    style={styles.input}
                    placeholder="Contoh: 21:00"
                    value={closingTime}
                    onChangeText={setClosingTime}
                    placeholderTextColor={Colors.textMuted}
                  />
                </View>

                {/* Quick Chips */}
                <View style={styles.timeChipsRow}>
                  {['17:00', '20:00', '21:00', '22:00', '23:00'].map((t) => (
                    <TouchableOpacity
                      key={t}
                      style={[styles.timeChip, closingTime === t && styles.timeChipActive]}
                      onPress={() => setClosingTime(t)}
                      activeOpacity={0.7}
                    >
                      <Text style={[styles.timeChipText, closingTime === t && styles.timeChipTextActive]}>
                        {t}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
                <Text style={styles.inputHelperText}>
                  * Menjadi patokan pengingat otomatis tutup kasir & ekspor laporan harian.
                </Text>
              </View>

              {/* Section 2: Rekening Bank & Transfer */}
              <View style={styles.sectionCard}>
                <View style={styles.sectionHeaderRow}>
                  <Ionicons name="card-outline" color={Colors.primaryDark} size={18} />
                  <Text style={styles.sectionTitle}>Rekening Pembayaran Bank / Transfer</Text>
                </View>
                <Text style={styles.sectionDesc}>
                  Nomor rekening ini akan otomatis tampil di layar kasir saat pelanggan memilih pembayaran non-tunai / transfer.
                </Text>

                <Text style={styles.inputLabel}>Pilih Bank / E-Wallet</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.bankPillsRow}>
                  {COMMON_BANKS.map((b) => (
                    <TouchableOpacity
                      key={b}
                      style={[styles.bankPill, bankName === b && styles.bankPillActive]}
                      onPress={() => setBankName(b)}
                    >
                      <Text style={[styles.bankPillText, bankName === b && styles.bankPillTextActive]}>
                        {b}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>

                <View style={styles.inputBox}>
                  <Ionicons name="wallet-outline" color={Colors.textMuted} size={18} />
                  <TextInput
                    style={styles.input}
                    placeholder="Nama Bank / E-Wallet (misal: BCA / Mandiri / Dana)"
                    value={bankName}
                    onChangeText={setBankName}
                    placeholderTextColor={Colors.textMuted}
                  />
                </View>

                <Text style={styles.inputLabel}>Nomor Rekening / No. HP E-Wallet</Text>
                <View style={styles.inputBox}>
                  <Ionicons name="keypad-outline" color={Colors.textMuted} size={18} />
                  <TextInput
                    style={styles.input}
                    placeholder="Contoh: 5395012345678"
                    value={bankAccountNumber}
                    onChangeText={setBankAccountNumber}
                    keyboardType="numeric"
                    placeholderTextColor={Colors.textMuted}
                  />
                </View>

                <Text style={styles.inputLabel}>Atas Nama (Nama Pemilik Rekening)</Text>
                <View style={styles.inputBox}>
                  <Ionicons name="person-circle-outline" color={Colors.textMuted} size={18} />
                  <TextInput
                    style={styles.input}
                    placeholder="Contoh: Siti Rahayu"
                    value={bankAccountHolder}
                    onChangeText={setBankAccountHolder}
                    placeholderTextColor={Colors.textMuted}
                  />
                </View>
              </View>

              {/* Section 3: Foto Barcode QRIS */}
              <View style={styles.sectionCard}>
                <View style={styles.sectionHeaderRow}>
                  <Ionicons name="qr-code-outline" color={Colors.accent} size={18} />
                  <Text style={styles.sectionTitle}>Foto Barcode QRIS Warung</Text>
                </View>
                <Text style={styles.sectionDesc}>
                  Upload foto barcode QRIS Anda. Gambar QRIS akan langsung muncul di kasir saat kasir memproses pembayaran QRIS.
                </Text>

                {qrisImageUri ? (
                  <View style={styles.qrisPreviewContainer}>
                    <Image
                      source={{ uri: qrisImageUri }}
                      style={styles.qrisImagePreview}
                      resizeMode="contain"
                    />
                    <View style={styles.qrisActionRow}>
                      <TouchableOpacity style={styles.qrisChangeBtn} onPress={handlePickQrisImage}>
                        <Ionicons name="image-outline" color="#FFFFFF" size={16} />
                        <Text style={styles.qrisChangeBtnText}>Ganti Foto QRIS</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={styles.qrisDeleteBtn}
                        onPress={() => setQrisImageUri(null)}
                      >
                        <Ionicons name="trash-outline" color={Colors.danger} size={16} />
                        <Text style={styles.qrisDeleteBtnText}>Hapus</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                ) : (
                  <TouchableOpacity style={styles.qrisUploadBox} onPress={handlePickQrisImage}>
                    <View style={styles.uploadIconCircle}>
                      <Ionicons name="cloud-upload-outline" color={Colors.primary} size={28} />
                    </View>
                    <Text style={styles.uploadMainText}>Upload Foto Barcode QRIS</Text>
                    <Text style={styles.uploadSubText}>Pilih dari galeri foto (JPG/PNG)</Text>
                  </TouchableOpacity>
                )}
              </View>
            </ScrollView>
          )}

          {/* Footer Submit */}
          <View style={styles.modalFooter}>
            <TouchableOpacity
              style={[styles.saveButton, saving && styles.saveButtonDisabled]}
              onPress={handleSave}
              disabled={saving || loading}
            >
              {saving ? (
                <ActivityIndicator color="#FFFFFF" size="small" />
              ) : (
                <Ionicons name="checkmark-circle-outline" color="#FFFFFF" size={20} />
              )}
              <Text style={styles.saveButtonText}>
                {saving ? 'Menyimpan Profil...' : 'Simpan Profil Warung'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#F8FAF8',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    maxHeight: '92%',
    paddingBottom: Platform.OS === 'ios' ? 24 : 12,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 18,
    paddingVertical: 16,
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F3F1',
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  headerIconBg: {
    width: 40,
    height: 40,
    borderRadius: 9999,
    backgroundColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: Colors.text,
  },
  modalSubtitle: {
    fontSize: 11,
    color: Colors.textMuted,
    marginTop: 1,
  },
  closeBtn: {
    padding: 6,
    backgroundColor: '#F3F4F6',
    borderRadius: 9999,
  },
  loadingBox: {
    padding: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    marginTop: 10,
    fontSize: 13,
    color: Colors.textMuted,
  },
  modalBody: {
    padding: 16,
  },
  sectionCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 16,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#F0F3F1',
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.text,
  },
  sectionDesc: {
    fontSize: 11,
    color: Colors.textMuted,
    marginBottom: 12,
    lineHeight: 16,
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.textSecondary,
    marginBottom: 6,
    marginTop: 8,
  },
  requiredMark: {
    color: Colors.danger,
    fontWeight: 'bold',
  },
  inputBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAF8',
    borderWidth: 1,
    borderColor: '#E5E9E6',
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 44,
  },
  input: {
    flex: 1,
    marginLeft: 8,
    fontSize: 13,
    color: Colors.text,
  },
  timeChipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 8,
    marginBottom: 4,
  },
  timeChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 9999,
    backgroundColor: '#F1F5F2',
    borderWidth: 1,
    borderColor: '#E5E9E6',
  },
  timeChipActive: {
    backgroundColor: Colors.primaryLight,
    borderColor: Colors.primary,
  },
  timeChipText: {
    fontSize: 11,
    color: Colors.textSecondary,
    fontWeight: '600',
  },
  timeChipTextActive: {
    color: Colors.primaryDark,
    fontWeight: '800',
  },
  inputHelperText: {
    fontSize: 10,
    color: Colors.textMuted,
    fontStyle: 'italic',
    marginTop: 4,
    lineHeight: 14,
  },
  bankPillsRow: {
    flexDirection: 'row',
    marginBottom: 10,
  },
  bankPill: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 9999,
    backgroundColor: '#F1F5F2',
    marginRight: 8,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  bankPillActive: {
    backgroundColor: Colors.primaryLight,
    borderColor: Colors.primary,
  },
  bankPillText: {
    fontSize: 11,
    color: Colors.textSecondary,
    fontWeight: '600',
  },
  bankPillTextActive: {
    color: Colors.primary,
    fontWeight: '800',
  },
  qrisUploadBox: {
    borderWidth: 1.5,
    borderColor: Colors.primary,
    borderStyle: 'dashed',
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F8FAF8',
    marginTop: 6,
  },
  uploadIconCircle: {
    width: 48,
    height: 48,
    borderRadius: 9999,
    backgroundColor: Colors.primaryLight,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  uploadMainText: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.primary,
  },
  uploadSubText: {
    fontSize: 11,
    color: Colors.textMuted,
    marginTop: 2,
  },
  qrisPreviewContainer: {
    alignItems: 'center',
    backgroundColor: '#F8FAF8',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E5E9E6',
  },
  qrisImagePreview: {
    width: 200,
    height: 200,
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  qrisActionRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 14,
  },
  qrisChangeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.primary,
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 9999,
    gap: 6,
  },
  qrisChangeBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  qrisDeleteBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.dangerLight,
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 9999,
    gap: 6,
  },
  qrisDeleteBtnText: {
    color: Colors.danger,
    fontSize: 12,
    fontWeight: '700',
  },
  modalFooter: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 8,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#F0F3F1',
  },
  saveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.primary,
    paddingVertical: 14,
    borderRadius: 9999,
    gap: 8,
  },
  saveButtonDisabled: {
    opacity: 0.6,
  },
  saveButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
  },
});
