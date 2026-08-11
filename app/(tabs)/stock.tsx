import React, { useState, useEffect, useCallback } from 'react';
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
  Switch,
  SafeAreaView,
} from 'react-native';
import { useSQLiteContext } from 'expo-sqlite';
import { useLocalSearchParams, useRouter, useFocusEffect } from 'expo-router';
import { Product } from '../../src/types';
import {
  getProducts,
  searchProducts,
  addProduct,
  updateProduct,
  deleteProduct,
  updateProductStock,
} from '../../src/services/productService';
import { formatRupiah } from '../../src/utils/formatters';
import { Colors } from '../../src/constants/theme';
import { Ionicons } from '@expo/vector-icons';

export default function StockScreen() {
  const db = useSQLiteContext();
  const router = useRouter();
  const params = useLocalSearchParams<{ autoBarcode?: string }>();

  const [products, setProducts] = useState<Product[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'ALL' | 'TITIPAN' | 'LOW_STOCK'>('ALL');

  // Modal State
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);

  // Form Fields
  const [barcode, setBarcode] = useState('');
  const [name, setName] = useState('');
  const [buyPrice, setBuyPrice] = useState('');
  const [sellPrice, setSellPrice] = useState('');
  const [stock, setStock] = useState('');
  const [isConsignment, setIsConsignment] = useState(false);
  const [supplierName, setSupplierName] = useState('');

  const loadProducts = useCallback(async () => {
    try {
      const data = searchQuery.trim()
        ? await searchProducts(db, searchQuery)
        : await getProducts(db);
      setProducts(data);
    } catch (err) {
      console.error('Failed to load products in stock:', err);
    }
  }, [db, searchQuery]);

  useFocusEffect(
    useCallback(() => {
      loadProducts();
    }, [loadProducts])
  );

  // Check autoBarcode param from Barcode Scanner
  useEffect(() => {
    if (params?.autoBarcode) {
      openAddModalWithBarcode(params.autoBarcode);
    }
  }, [params?.autoBarcode]);

  const openAddModalWithBarcode = (scannedCode: string) => {
    setEditingProduct(null);
    setBarcode(scannedCode);
    setName('');
    setBuyPrice('');
    setSellPrice('');
    setStock('10');
    setIsConsignment(false);
    setSupplierName('');
    setIsModalVisible(true);
  };

  const openAddModal = () => {
    setEditingProduct(null);
    setBarcode('');
    setName('');
    setBuyPrice('');
    setSellPrice('');
    setStock('10');
    setIsConsignment(false);
    setSupplierName('');
    setIsModalVisible(true);
  };

  const openEditModal = (product: Product) => {
    setEditingProduct(product);
    setBarcode(product.barcode || '');
    setName(product.name);
    setBuyPrice(product.buy_price.toString());
    setSellPrice(product.sell_price.toString());
    setStock(product.stock.toString());
    setIsConsignment(product.is_consignment === 1);
    setSupplierName(product.supplier_name || '');
    setIsModalVisible(true);
  };

  const handleSaveProduct = async () => {
    if (!name.trim()) {
      Alert.alert('Nama Barang Wajib', 'Mohon masukkan nama produk/barang.');
      return;
    }

    const buyPriceNum = parseFloat(buyPrice) || 0;
    const sellPriceNum = parseFloat(sellPrice) || 0;
    const stockNum = parseInt(stock, 10) || 0;

    if (sellPriceNum <= 0) {
      Alert.alert('Harga Jual Harus Valid', 'Harga jual harus lebih dari 0.');
      return;
    }

    try {
      if (editingProduct) {
        await updateProduct(db, {
          ...editingProduct,
          barcode: barcode.trim() || null,
          name: name.trim(),
          buy_price: buyPriceNum,
          sell_price: sellPriceNum,
          stock: stockNum,
          is_consignment: isConsignment ? 1 : 0,
          supplier_name: isConsignment ? supplierName.trim() || null : null,
        });
        Alert.alert('Berhasil', 'Data produk berhasil diperbarui.');
      } else {
        await addProduct(db, {
          barcode: barcode.trim() || null,
          name: name.trim(),
          buy_price: buyPriceNum,
          sell_price: sellPriceNum,
          stock: stockNum,
          is_consignment: isConsignment ? 1 : 0,
          supplier_name: isConsignment ? supplierName.trim() || null : null,
        });
        Alert.alert('Berhasil', 'Produk baru berhasil ditambahkan.');
      }

      setIsModalVisible(false);
      loadProducts();
    } catch (err: any) {
      Alert.alert('Gagal Menyimpan', err.message || 'Terjadi kesalahan saat menyimpan produk.');
    }
  };

  const handleDelete = (product: Product) => {
    Alert.alert(
      'Hapus Produk',
      `Apakah Anda yakin ingin menghapus "${product.name}"?`,
      [
        { text: 'Batal', style: 'cancel' },
        {
          text: 'Hapus',
          style: 'destructive',
          onPress: async () => {
            await deleteProduct(db, product.id);
            loadProducts();
          },
        },
      ]
    );
  };

  const handleQuickStockAdjust = async (id: number, delta: number) => {
    await updateProductStock(db, id, delta);
    loadProducts();
  };

  const displayedProducts = products.filter((p) => {
    if (activeTab === 'TITIPAN') return p.is_consignment === 1;
    if (activeTab === 'LOW_STOCK') return p.stock < 5;
    return true;
  });

  return (
    <SafeAreaView style={styles.container}>
      {/* Top Search & Add Bar */}
      <View style={styles.topBar}>
        <View style={styles.searchBox}>
          <Ionicons name="search-outline" color={Colors.textMuted} size={18} />
          <TextInput
            style={styles.searchInput}
            placeholder="Cari produk / barcode / titipan..."
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholderTextColor={Colors.textMuted}
          />
        </View>

        <TouchableOpacity style={styles.addBtn} onPress={openAddModal}>
          <Ionicons name="add" color="#FFFFFF" size={20} />
          <Text style={styles.addBtnText}>Tambah</Text>
        </TouchableOpacity>
      </View>

      {/* Filter Tabs */}
      <View style={styles.tabContainer}>
        <TouchableOpacity
          style={[styles.tabChip, activeTab === 'ALL' && styles.tabChipActive]}
          onPress={() => setActiveTab('ALL')}
        >
          <Text style={[styles.tabChipText, activeTab === 'ALL' && styles.tabChipTextActive]}>
            Semua ({products.length})
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tabChip, activeTab === 'TITIPAN' && styles.tabChipActive]}
          onPress={() => setActiveTab('TITIPAN')}
        >
          <Text style={[styles.tabChipText, activeTab === 'TITIPAN' && styles.tabChipTextActive]}>
            🤝 Titipan ({products.filter((p) => p.is_consignment === 1).length})
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tabChip, activeTab === 'LOW_STOCK' && styles.tabChipActive]}
          onPress={() => setActiveTab('LOW_STOCK')}
        >
          <Text style={[styles.tabChipText, activeTab === 'LOW_STOCK' && styles.tabChipTextActive]}>
            ⚠️ Stok Menipis ({products.filter((p) => p.stock < 5).length})
          </Text>
        </TouchableOpacity>
      </View>

      {/* Product Stock List */}
      <FlatList
        data={displayedProducts}
        keyExtractor={(item) => item.id.toString()}
        contentContainerStyle={styles.listContent}
        renderItem={({ item }) => {
          const margin = item.sell_price - item.buy_price;
          const marginPercent = item.buy_price > 0 ? ((margin / item.buy_price) * 100).toFixed(0) : '0';

          return (
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <View style={{ flex: 1 }}>
                  <View style={styles.titleRow}>
                    <Text style={styles.productTitle}>{item.name}</Text>
                    {item.is_consignment === 1 ? (
                      <View style={styles.tagConsignment}>
                        <Ionicons name="people-outline" color={Colors.secondary} size={12} />
                        <Text style={styles.tagConsignmentText}>
                          Titipan {item.supplier_name ? `(${item.supplier_name})` : ''}
                        </Text>
                      </View>
                    ) : null}
                  </View>
                  {item.barcode ? (
                    <Text style={styles.barcodeText}>Barcode: {item.barcode}</Text>
                  ) : null}
                </View>

                {/* Edit & Delete Actions */}
                <View style={styles.actionRow}>
                  <TouchableOpacity
                    style={styles.iconBtn}
                    onPress={() => openEditModal(item)}
                  >
                    <Ionicons name="pencil" color={Colors.primaryDark} size={16} />
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.iconBtn, { backgroundColor: Colors.dangerLight }]}
                    onPress={() => handleDelete(item)}
                  >
                    <Ionicons name="trash-outline" color={Colors.danger} size={16} />
                  </TouchableOpacity>
                </View>
              </View>

              <View style={styles.cardDivider} />

              {/* Pricing details */}
              <View style={styles.detailsRow}>
                <View style={styles.detailCol}>
                  <Text style={styles.detailLabel}>Harga Beli (HPP)</Text>
                  <Text style={styles.detailValue}>{formatRupiah(item.buy_price)}</Text>
                </View>

                <View style={styles.detailCol}>
                  <Text style={styles.detailLabel}>Harga Jual</Text>
                  <Text style={[styles.detailValue, { color: Colors.primaryDark, fontWeight: 'bold' }]}>
                    {formatRupiah(item.sell_price)}
                  </Text>
                </View>

                <View style={styles.detailCol}>
                  <Text style={styles.detailLabel}>Laba Untung</Text>
                  <Text style={[styles.detailValue, { color: Colors.success, fontWeight: 'bold' }]}>
                    +{formatRupiah(margin)} ({marginPercent}%)
                  </Text>
                </View>
              </View>

              {/* Stock Stepper */}
              <View style={styles.stockStepperRow}>
                <Text style={styles.stockStepperLabel}>
                  Stok Sisa:{' '}
                  <Text
                    style={[
                      styles.stockCount,
                      item.stock < 5 ? { color: Colors.danger } : { color: Colors.text },
                    ]}
                  >
                    {item.stock} item
                  </Text>
                </Text>

                <View style={styles.stepperContainer}>
                  <TouchableOpacity
                    style={styles.stepperBtn}
                    onPress={() => handleQuickStockAdjust(item.id, -1)}
                  >
                    <Text style={styles.stepperBtnText}>-</Text>
                  </TouchableOpacity>

                  <Text style={styles.stepperValue}>{item.stock}</Text>

                  <TouchableOpacity
                    style={styles.stepperBtn}
                    onPress={() => handleQuickStockAdjust(item.id, 1)}
                  >
                    <Text style={styles.stepperBtnText}>+</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          );
        }}
        ListEmptyComponent={
          <View style={styles.emptyBox}>
            <Ionicons name="cube-outline" color={Colors.textMuted} size={48} />
            <Text style={styles.emptyTitle}>Belum Ada Produk</Text>
            <Text style={styles.emptySub}>Klik tombol "Tambah" untuk mendaftarkan barang baru.</Text>
          </View>
        }
      />

      {/* Add/Edit Product Modal */}
      <Modal
        visible={isModalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setIsModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {editingProduct ? 'Edit Produk Warung' : 'Tambah Produk Baru'}
              </Text>
              <TouchableOpacity onPress={() => setIsModalVisible(false)}>
                <Ionicons name="close" color={Colors.text} size={24} />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalForm}>
              {/* Barcode input with scan shortcut */}
              <Text style={styles.formLabel}>Kode Batang (Barcode / ISBN):</Text>
              <View style={styles.inputScanRow}>
                <TextInput
                  style={[styles.input, { flex: 1 }]}
                  placeholder="Scan atau ketik barcode..."
                  value={barcode}
                  onChangeText={setBarcode}
                />
                <TouchableOpacity
                  style={styles.scanShortcutBtn}
                  onPress={() => {
                    setIsModalVisible(false);
                    router.push('/scanner');
                  }}
                >
                  <Ionicons name="qr-code-outline" color="#FFFFFF" size={18} />
                </TouchableOpacity>
              </View>

              {/* Product Name */}
              <Text style={styles.formLabel}>Nama Barang (Wajib):</Text>
              <TextInput
                style={styles.input}
                placeholder="Contoh: Minyak Goreng Bimoli 1L"
                value={name}
                onChangeText={setName}
              />

              {/* Pricing Inputs */}
              <View style={styles.rowTwoCols}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.formLabel}>Harga Beli / HPP (Rp):</Text>
                  <TextInput
                    style={styles.input}
                    keyboardType="numeric"
                    placeholder="Contoh: 14000"
                    value={buyPrice}
                    onChangeText={setBuyPrice}
                  />
                </View>

                <View style={{ flex: 1 }}>
                  <Text style={styles.formLabel}>Harga Jual (Rp):</Text>
                  <TextInput
                    style={styles.input}
                    keyboardType="numeric"
                    placeholder="Contoh: 17000"
                    value={sellPrice}
                    onChangeText={setSellPrice}
                  />
                </View>
              </View>

              {/* Stock Input */}
              <Text style={styles.formLabel}>Jumlah Stok Awal:</Text>
              <TextInput
                style={styles.input}
                keyboardType="numeric"
                placeholder="Contoh: 24"
                value={stock}
                onChangeText={setStock}
              />

              {/* Consignment Switch */}
              <View style={styles.switchRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.switchTitle}>Barang Titipan / Konsinyasi 🤝</Text>
                  <Text style={styles.switchSub}>
                    Aktifkan jika barang ini titipan dari tetangga/mitra usaha (gorengan, kue, kerupuk).
                  </Text>
                </View>
                <Switch
                  value={isConsignment}
                  onValueChange={setIsConsignment}
                  trackColor={{ false: '#CBD5E1', true: Colors.primaryLight }}
                  thumbColor={isConsignment ? Colors.primary : '#94A3B8'}
                />
              </View>

              {isConsignment ? (
                <View style={styles.consignmentBox}>
                  <Text style={styles.formLabel}>Nama Pemilik / Pemasok Titipan:</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="Contoh: Bu Agus / Pak RT"
                    value={supplierName}
                    onChangeText={setSupplierName}
                  />
                </View>
              ) : null}
            </ScrollView>

            <TouchableOpacity style={styles.saveBtn} onPress={handleSaveProduct}>
              <Text style={styles.saveBtnText}>Simpan Produk</Text>
            </TouchableOpacity>
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
  topBar: {
    flexDirection: 'row',
    padding: 12,
    gap: 8,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  searchBox: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F1F5F9',
    borderRadius: 8,
    paddingHorizontal: 10,
    height: 42,
  },
  searchInput: {
    flex: 1,
    marginLeft: 8,
    fontSize: 14,
    color: Colors.text,
  },
  addBtn: {
    backgroundColor: Colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    borderRadius: 8,
    gap: 4,
  },
  addBtnText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
    fontSize: 14,
  },
  tabContainer: {
    flexDirection: 'row',
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 6,
  },
  tabChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  tabChipActive: {
    backgroundColor: Colors.primaryLight,
    borderColor: Colors.primary,
  },
  tabChipText: {
    fontSize: 12,
    color: Colors.textSecondary,
  },
  tabChipTextActive: {
    color: Colors.primaryDark,
    fontWeight: 'bold',
  },
  listContent: {
    padding: 12,
    paddingBottom: 40,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: Colors.border,
    elevation: 1,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
  },
  productTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: Colors.text,
  },
  tagConsignment: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: Colors.secondaryLight,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  tagConsignmentText: {
    fontSize: 11,
    color: Colors.secondary,
    fontWeight: 'bold',
  },
  barcodeText: {
    fontSize: 11,
    color: Colors.textMuted,
    marginTop: 2,
  },
  actionRow: {
    flexDirection: 'row',
    gap: 6,
  },
  iconBtn: {
    width: 32,
    height: 32,
    borderRadius: 6,
    backgroundColor: Colors.primaryLight,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cardDivider: {
    height: 1,
    backgroundColor: '#F1F5F9',
    marginVertical: 10,
  },
  detailsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  detailCol: {
    flex: 1,
  },
  detailLabel: {
    fontSize: 11,
    color: Colors.textMuted,
  },
  detailValue: {
    fontSize: 13,
    color: Colors.text,
    marginTop: 2,
  },
  stockStepperRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    padding: 8,
    borderRadius: 8,
  },
  stockStepperLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  stockCount: {
    fontWeight: 'bold',
  },
  stepperContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  stepperBtn: {
    width: 30,
    height: 30,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 6,
    justifyContent: 'center',
    alignItems: 'center',
  },
  stepperBtnText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: Colors.text,
  },
  stepperValue: {
    fontSize: 15,
    fontWeight: 'bold',
    minWidth: 24,
    textAlign: 'center',
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
    maxHeight: '90%',
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
  modalForm: {
    marginBottom: 12,
  },
  formLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.textSecondary,
    marginTop: 10,
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
  inputScanRow: {
    flexDirection: 'row',
    gap: 8,
  },
  scanShortcutBtn: {
    backgroundColor: Colors.primaryDark,
    width: 42,
    height: 42,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  rowTwoCols: {
    flexDirection: 'row',
    gap: 10,
  },
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginVertical: 14,
    padding: 10,
    backgroundColor: '#F8FAFC',
    borderRadius: 8,
  },
  switchTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: Colors.text,
  },
  switchSub: {
    fontSize: 11,
    color: Colors.textMuted,
    marginTop: 2,
  },
  consignmentBox: {
    backgroundColor: Colors.secondaryLight,
    padding: 10,
    borderRadius: 8,
    marginBottom: 10,
  },
  saveBtn: {
    backgroundColor: Colors.primary,
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
  },
  saveBtnText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
});
