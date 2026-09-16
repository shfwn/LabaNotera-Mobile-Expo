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
      };

      await updateShopProfile(db, updatedData);

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
    backgroundColor: '#F8FAFC',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '92%',
    paddingBottom: Platform.OS === 'ios' ? 24 : 12,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  headerIconBg: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: Colors.primaryDark,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: Colors.text,
  },
  modalSubtitle: {
    fontSize: 11,
    color: Colors.textMuted,
    marginTop: 1,
  },
  closeBtn: {
    padding: 6,
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
    padding: 14,
  },
  sectionCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: 'bold',
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
    fontWeight: '600',
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
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 8,
    paddingHorizontal: 10,
    height: 42,
  },
  input: {
    flex: 1,
    marginLeft: 8,
    fontSize: 13,
    color: Colors.text,
  },
  bankPillsRow: {
    flexDirection: 'row',
    marginBottom: 10,
  },
  bankPill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: '#F1F5F9',
    marginRight: 6,
    borderWidth: 1,
    borderColor: Colors.border,
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
    color: Colors.primaryDark,
    fontWeight: 'bold',
  },
  qrisUploadBox: {
    borderWidth: 1.5,
    borderColor: Colors.primary,
    borderStyle: 'dashed',
    borderRadius: 12,
    padding: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F0FDFA',
    marginTop: 4,
  },
  uploadIconCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: Colors.primaryLight,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  uploadMainText: {
    fontSize: 13,
    fontWeight: 'bold',
    color: Colors.primaryDark,
  },
  uploadSubText: {
    fontSize: 11,
    color: Colors.textMuted,
    marginTop: 2,
  },
  qrisPreviewContainer: {
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  qrisImagePreview: {
    width: 200,
    height: 200,
    borderRadius: 8,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  qrisActionRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
  },
  qrisChangeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.primary,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
    gap: 4,
  },
  qrisChangeBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: 'bold',
  },
  qrisDeleteBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.dangerLight,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
    gap: 4,
  },
  qrisDeleteBtnText: {
    color: Colors.danger,
    fontSize: 12,
    fontWeight: 'bold',
  },
  modalFooter: {
    paddingHorizontal: 16,
    paddingTop: 10,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  saveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.primaryDark,
    paddingVertical: 13,
    borderRadius: 10,
    gap: 6,
  },
  saveButtonDisabled: {
    opacity: 0.6,
  },
  saveButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: 'bold',
  },
});
