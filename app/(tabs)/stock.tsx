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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAppSQLiteContext as useSQLiteContext } from '../../src/db/AppDatabaseProvider';
import { useLocalSearchParams, useRouter, useFocusEffect } from 'expo-router';
import { Product, ProductCategory } from '../../src/types';
import { getShadowStyle } from '../../src/utils/styleHelper';
import {
  getProducts,
  searchProducts,
  addProduct,
  updateProduct,
  deleteProduct,
  updateProductStock,
  restockProduct,
} from '../../src/services/productService';
import { formatRupiah, parseRupiahToNumber, isKgProduct, getProductCategory } from '../../src/utils/formatters';
import { showAppAlert } from '../../src/utils/alertHelper';
import { Colors, Radius, Shadows } from '../../src/constants/theme';
import { Ionicons } from '@expo/vector-icons';

export default function StockScreen() {
  const db = useSQLiteContext();
  const router = useRouter();
  const params = useLocalSearchParams<{ autoBarcode?: string }>();

  const [products, setProducts] = useState<Product[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<
    'ALL' | 'SEMBAKO' | 'KONSUMSI' | 'SANITASI' | 'DIGITAL_KOMODITAS' | 'TITIPAN' | 'LOW_STOCK'
  >('ALL');

  // Modal State
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);

  // Restock Modal State
  const [isRestockModalVisible, setIsRestockModalVisible] = useState(false);
  const [restockProductTarget, setRestockProductTarget] = useState<Product | null>(null);
  const [restockQty, setRestockQty] = useState('10');
  const [restockBuyPrice, setRestockBuyPrice] = useState('');
  const [restockPaymentSource, setRestockPaymentSource] = useState<'CASH_DRAWER' | 'CONSIGNMENT' | 'CORRECTION_ONLY'>('CASH_DRAWER');
  const [isSubmittingRestock, setIsSubmittingRestock] = useState(false);

  // Form Fields
  const [barcode, setBarcode] = useState('');
  const [name, setName] = useState('');
  const [buyPrice, setBuyPrice] = useState('');
  const [sellPrice, setSellPrice] = useState('');
  const [stock, setStock] = useState('');
  const [category, setCategory] = useState<ProductCategory>('SEMBAKO');
  const [isConsignment, setIsConsignment] = useState(false);
  const [supplierName, setSupplierName] = useState('');
  const [isKg, setIsKg] = useState(false);

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
    setCategory('SEMBAKO');
    setIsConsignment(false);
    setSupplierName('');
    setIsKg(false);
    setIsModalVisible(true);
  };

  const openAddModal = () => {
    setEditingProduct(null);
    setBarcode('');
    setName('');
    setBuyPrice('');
    setSellPrice('');
    setStock('10');
    setCategory('SEMBAKO');
    setIsConsignment(false);
    setSupplierName('');
    setIsKg(false);
    setIsModalVisible(true);
  };

  const openEditModal = (product: Product) => {
    setEditingProduct(product);
    setBarcode(product.barcode || '');
    setName(product.name);
    setBuyPrice(formatRupiah(product.buy_price));
    setSellPrice(formatRupiah(product.sell_price));
    setStock(product.stock.toString());
    setCategory(getProductCategory(product));
    setIsConsignment(product.is_consignment === 1);
    setSupplierName(product.supplier_name || '');
    setIsKg(isKgProduct(product));
    setIsModalVisible(true);
  };

  const handleSaveProduct = async () => {
    if (!name.trim()) {
      showAppAlert('Nama Barang Wajib', 'Mohon masukkan nama produk/barang.');
      return;
    }

    if (isConsignment && !supplierName.trim()) {
      showAppAlert('Nama Penitip Wajib', 'Mohon masukkan nama penitip / supplier mitra titipan.');
      return;
    }

    const buyPriceNum = parseRupiahToNumber(buyPrice);
    const sellPriceNum = parseRupiahToNumber(sellPrice);
    const stockNum = parseFloat(stock.replace(',', '.')) || 0;

    if (sellPriceNum <= 0) {
      showAppAlert('Harga Jual Harus Valid', 'Harga jual harus lebih dari 0.');
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
          supplier_name: isConsignment ? (supplierName.trim() || 'Titipan Mitra') : null,
          category,
          is_kg: isKg ? 1 : 0,
        });
        setIsModalVisible(false);
        await loadProducts();
        showAppAlert('Berhasil', 'Data produk berhasil diperbarui.');
      } else {
        await addProduct(db, {
          barcode: barcode.trim() || null,
          name: name.trim(),
          buy_price: buyPriceNum,
          sell_price: sellPriceNum,
          stock: stockNum,
          is_consignment: isConsignment ? 1 : 0,
          supplier_name: isConsignment ? (supplierName.trim() || 'Titipan Mitra') : null,
          category,
          is_kg: isKg ? 1 : 0,
        });
        setIsModalVisible(false);
        await loadProducts();
        showAppAlert('Berhasil', 'Produk baru berhasil ditambahkan.');
      }
    } catch (err: any) {
      showAppAlert('Gagal Menyimpan', err.message || 'Terjadi kesalahan saat menyimpan produk.');
    }
  };

  const handleDelete = (product: Product) => {
    showAppAlert(
      'Hapus Produk',
      `Apakah Anda yakin ingin menghapus "${product.name}"?`,
      [
        { text: 'Batal', style: 'cancel' },
        {
          text: 'Hapus',
          style: 'destructive',
          onPress: async () => {
            await deleteProduct(db, product.id);
            await loadProducts();
          },
        },
      ]
    );
  };

  const openRestockModal = (product: Product) => {
    setRestockProductTarget(product);
    setRestockQty('10');
    setRestockBuyPrice(formatRupiah(product.buy_price));
    setRestockPaymentSource(product.is_consignment === 1 ? 'CONSIGNMENT' : 'CASH_DRAWER');
    setIsRestockModalVisible(true);
  };

  const handleConfirmRestock = async () => {
    if (!restockProductTarget) return;

    const qtyNum = parseFloat(restockQty.replace(',', '.')) || 0;
    if (qtyNum <= 0) {
      showAppAlert('Jumlah Tidak Valid', 'Jumlah penambahan stok harus lebih dari 0.');
      return;
    }

    const buyPriceNum = parseRupiahToNumber(restockBuyPrice);
    if (buyPriceNum < 0) {
      showAppAlert('Harga Beli Tidak Valid', 'Harga beli modal tidak boleh minus.');
      return;
    }

    try {
      setIsSubmittingRestock(true);
      await restockProduct(
        db,
        restockProductTarget.id,
        qtyNum,
        buyPriceNum,
        restockPaymentSource,
        restockProductTarget.name,
        restockProductTarget.is_consignment === 1
      );

      const totalCost = Math.round(qtyNum * buyPriceNum);
      let descMsg = `Stok ${restockProductTarget.name} berhasil ditambah +${qtyNum} ${restockProductTarget.is_kg === 1 ? 'kg' : 'item'}.`;
      if (restockPaymentSource === 'CASH_DRAWER' && totalCost > 0) {
        descMsg += `\n\nPengeluaran belanja stok ${formatRupiah(totalCost)} otomatis dicatat dari laci kasir.`;
      } else if (restockPaymentSource === 'CONSIGNMENT') {
        descMsg += `\n\nPenerimaan barang titipan/konsinyasi berhasil dicatat tanpa memotong uang kasir sekarang.`;
      } else {
        descMsg += `\n\nPenyesuaian stok opname fisik selesai (tanpa transaksi uang kasir).`;
      }

      setIsRestockModalVisible(false);
      setRestockProductTarget(null);
      await loadProducts();
      showAppAlert('Stok Berhasil Ditambah', descMsg);
    } catch (err: any) {
      showAppAlert('Gagal Tambah Stok', err.message || 'Terjadi kesalahan saat menambah stok.');
    } finally {
      setIsSubmittingRestock(false);
    }
  };

  const handleQuickStockDecrement = (product: Product) => {
    if (product.stock <= 0) {
      showAppAlert('Stok Sudah 0', `Stok "${product.name}" sudah habis (0).`);
      return;
    }

    const step = 1;
    showAppAlert(
      'Kurangi Stok Fisik',
      `Kurangi stok "${product.name}" sebanyak 1 ${product.is_kg === 1 ? 'kg' : 'item'}?\n\n(Catatan: Pengurangan cepat ini hanya untuk koreksi fisik barang rusak/hilang dan tidak mempengaruhi uang kasir).`,
      [
        { text: 'Batal', style: 'cancel' },
        {
          text: 'Ya, Kurangi',
          style: 'destructive',
          onPress: async () => {
            await updateProductStock(db, product.id, -step);
            loadProducts();
          },
        },
      ]
    );
  };

  const displayedProducts = products.filter((p) => {
    if (activeTab === 'LOW_STOCK') return p.stock < 5;
    if (activeTab === 'TITIPAN') return p.is_consignment === 1;
    if (
      activeTab === 'SEMBAKO' ||
      activeTab === 'KONSUMSI' ||
      activeTab === 'SANITASI' ||
      activeTab === 'DIGITAL_KOMODITAS'
    ) {
      return getProductCategory(p) === activeTab;
    }
    return true;
  });

  return (
    <SafeAreaView style={styles.container}>
      {/* Top Search & Add Bar */}
      <View style={styles.topBar}>
        <View style={styles.searchBox}>
          <Ionicons name="search-outline" color="#64748B" size={18} />
          <TextInput
            style={styles.searchInput}
            placeholder="Cari nama atau barcode produk..."
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholderTextColor="#94A3B8"
          />
        </View>

        <TouchableOpacity style={styles.addBtn} onPress={openAddModal}>
          <Ionicons name="add" color="#FFFFFF" size={20} />
          <Text style={styles.addBtnText}>Tambah</Text>
        </TouchableOpacity>
      </View>

      {/* Filter Tabs */}
      <View style={styles.tabContainer}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.tabScrollContent}
        >
          <TouchableOpacity
            style={[styles.tabChip, activeTab === 'ALL' && styles.tabChipActive]}
            onPress={() => setActiveTab('ALL')}
            activeOpacity={0.7}
          >
            <Text style={[styles.tabChipText, activeTab === 'ALL' && styles.tabChipTextActive]}>
              Semua ({products.length})
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.tabChip, activeTab === 'SEMBAKO' && styles.tabChipActive]}
            onPress={() => setActiveTab((prev) => (prev === 'SEMBAKO' ? 'ALL' : 'SEMBAKO'))}
            activeOpacity={0.7}
          >
            <Text style={[styles.tabChipText, activeTab === 'SEMBAKO' && styles.tabChipTextActive]}>
              Bahan Pokok & Sembako
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.tabChip, activeTab === 'KONSUMSI' && styles.tabChipActive]}
            onPress={() => setActiveTab((prev) => (prev === 'KONSUMSI' ? 'ALL' : 'KONSUMSI'))}
            activeOpacity={0.7}
          >
            <Text style={[styles.tabChipText, activeTab === 'KONSUMSI' && styles.tabChipTextActive]}>
              Makanan & Minuman
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.tabChip, activeTab === 'SANITASI' && styles.tabChipActive]}
            onPress={() => setActiveTab((prev) => (prev === 'SANITASI' ? 'ALL' : 'SANITASI'))}
            activeOpacity={0.7}
          >
            <Text style={[styles.tabChipText, activeTab === 'SANITASI' && styles.tabChipTextActive]}>
              Rumah & Sanitasi
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.tabChip, activeTab === 'DIGITAL_KOMODITAS' && styles.tabChipActive]}
            onPress={() => setActiveTab((prev) => (prev === 'DIGITAL_KOMODITAS' ? 'ALL' : 'DIGITAL_KOMODITAS'))}
            activeOpacity={0.7}
          >
            <Text style={[styles.tabChipText, activeTab === 'DIGITAL_KOMODITAS' && styles.tabChipTextActive]}>
              Komoditas & Digital
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.tabChip, activeTab === 'TITIPAN' && styles.tabChipActive]}
            onPress={() => setActiveTab((prev) => (prev === 'TITIPAN' ? 'ALL' : 'TITIPAN'))}
            activeOpacity={0.7}
          >
            <Text style={[styles.tabChipText, activeTab === 'TITIPAN' && styles.tabChipTextActive]}>
              Barang Titipan ({products.filter((p) => p.is_consignment === 1).length})
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.tabChip, activeTab === 'LOW_STOCK' && styles.tabChipActive]}
            onPress={() => setActiveTab((prev) => (prev === 'LOW_STOCK' ? 'ALL' : 'LOW_STOCK'))}
            activeOpacity={0.7}
          >
            <Text style={[styles.tabChipText, activeTab === 'LOW_STOCK' && styles.tabChipTextActive]}>
              Stok Menipis ({products.filter((p) => p.stock < 5).length})
            </Text>
          </TouchableOpacity>
        </ScrollView>
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
                    {isKgProduct(item) && (
                      <View style={styles.tagKg}>
                        <Ionicons name="scale-outline" size={11} color="#0D9488" />
                        <Text style={styles.tagKgText}>Timbangan (Kg)</Text>
                      </View>
                    )}
                    {item.is_consignment === 1 && (
                      <View style={styles.tagConsignment}>
                        <Ionicons name="people-outline" size={11} color="#D97706" />
                        <Text style={styles.tagConsignmentText}>
                          Titipan: {item.supplier_name || 'Mitra'}
                        </Text>
                      </View>
                    )}
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
                    <Ionicons name="pencil" color={Colors.primary} size={16} />
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.iconBtn, { backgroundColor: '#FEE2E2' }]}
                    onPress={() => handleDelete(item)}
                  >
                    <Ionicons name="trash-outline" color="#DC2626" size={16} />
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
                  <Text style={[styles.detailValue, { color: Colors.primary, fontWeight: 'bold' }]}>
                    {formatRupiah(item.sell_price)}
                  </Text>
                </View>

                <View style={styles.detailCol}>
                  <Text style={styles.detailLabel}>Laba Untung</Text>
                  <Text style={[styles.detailValue, { color: '#16A34A', fontWeight: 'bold' }]}>
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
                      item.stock < 5 ? { color: '#DC2626' } : { color: Colors.text },
                    ]}
                  >
                    {item.stock} {item.is_kg === 1 ? 'kg' : 'item'}
                  </Text>
                </Text>

                <View style={styles.stepperContainer}>
                  <TouchableOpacity
                    style={styles.stepperBtn}
                    onPress={() => handleQuickStockDecrement(item)}
                  >
                    <Text style={styles.stepperBtnText}>-</Text>
                  </TouchableOpacity>

                  <Text style={styles.stepperValue}>{item.stock}</Text>

                  <TouchableOpacity
                    style={[styles.stepperBtn, styles.stepperBtnPlus]}
                    onPress={() => openRestockModal(item)}
                  >
                    <Ionicons name="add" color="#FFFFFF" size={16} />
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          );
        }}
        ListEmptyComponent={
          <View style={styles.emptyBox}>
            <Ionicons name="cube-outline" color="#94A3B8" size={48} />
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
                onChangeText={(text) => {
                  setName(text);
                  if (!editingProduct && text.length > 2) {
                    setCategory(getProductCategory({ name: text }));
                  }
                }}
              />

              {/* Product Category Selector */}
              <Text style={styles.formLabel}>Kategori Barang:</Text>
              <View style={styles.categoryPillsGrid}>
                {[
                  { key: 'SEMBAKO', label: 'Bahan Pokok & Sembako' },
                  { key: 'KONSUMSI', label: 'Makanan & Minuman' },
                  { key: 'SANITASI', label: 'Rumah & Sanitasi' },
                  { key: 'DIGITAL_KOMODITAS', label: 'Komoditas & Digital' },
                ].map((item) => (
                  <TouchableOpacity
                    key={item.key}
                    style={[styles.categoryFormPill, category === item.key && styles.categoryFormPillActive]}
                    onPress={() => setCategory(item.key as ProductCategory)}
                    activeOpacity={0.7}
                  >
                    <Text
                      style={[
                        styles.categoryFormPillText,
                        category === item.key && styles.categoryFormPillTextActive,
                      ]}
                    >
                      {item.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Pricing Inputs */}
              <View style={styles.rowTwoCols}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.formLabel}>Harga Beli / HPP (Rp):</Text>
                  <TextInput
                    style={styles.input}
                    keyboardType="numeric"
                    placeholder="Rp 0"
                    value={buyPrice}
                    onChangeText={(text) => setBuyPrice(formatRupiah(text))}
                  />
                </View>

                <View style={{ flex: 1 }}>
                  <Text style={styles.formLabel}>Harga Jual (Rp):</Text>
                  <TextInput
                    style={styles.input}
                    keyboardType="numeric"
                    placeholder="Rp 0"
                    value={sellPrice}
                    onChangeText={(text) => setSellPrice(formatRupiah(text))}
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

              {/* Kg Toggle */}
              <View style={styles.switchRowCard}>
                <View style={{ flex: 1, paddingRight: 10 }}>
                  <Text style={styles.switchTitle}>Jual Satuan Timbangan (Kg)</Text>
                  <Text style={styles.switchSubtitle}>
                    Aktifkan jika produk ini ditimbang saat dijual (bisa beli 1/4 kg, 1/2 kg, atau nominal Rp di kasir).
                  </Text>
                </View>
                <Switch
                  value={isKg}
                  onValueChange={setIsKg}
                  trackColor={{ false: Colors.border, true: Colors.primary }}
                  thumbColor={isKg ? '#FFFFFF' : '#F4F3F4'}
                />
              </View>

              {/* Consignment Toggle */}
              <View style={styles.switchRowCard}>
                <View style={{ flex: 1, paddingRight: 10 }}>
                  <Text style={styles.switchTitle}>Barang Titipan (Konsinyasi)</Text>
                  <Text style={styles.switchSubtitle}>
                    Aktifkan jika barang titipan milik mitra/penitip (bayar bagi hasil setelah laku terjual).
                  </Text>
                </View>
                <Switch
                  value={isConsignment}
                  onValueChange={setIsConsignment}
                  trackColor={{ false: Colors.border, true: Colors.primary }}
                  thumbColor={isConsignment ? '#FFFFFF' : '#F4F3F4'}
                />
              </View>

              {isConsignment && (
                <View style={styles.consignmentInputBox}>
                  <Text style={styles.formLabel}>Nama Penitip / Supplier Mitra (Wajib):</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="Contoh: Bu Siti (Kue Basah), Pak Joko (Kerupuk)"
                    value={supplierName}
                    onChangeText={setSupplierName}
                  />
                  <Text style={styles.inputHelperText}>
                    * Digunakan untuk mencatat daftar hutang titipan saat barang laku terjual.
                  </Text>
                </View>
              )}
            </ScrollView>

            <TouchableOpacity style={styles.saveBtn} onPress={handleSaveProduct}>
              <Text style={styles.saveBtnText}>Simpan Produk</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Smart Restock Modal */}
      <Modal
        visible={isRestockModalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setIsRestockModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>Tambah Stok Barang</Text>
                <Text style={styles.modalSubTitle}>Kelola stok masuk & pencatatan belanja modal</Text>
              </View>
              <TouchableOpacity onPress={() => setIsRestockModalVisible(false)}>
                <Ionicons name="close" color={Colors.text} size={24} />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalForm} showsVerticalScrollIndicator={false}>
              {restockProductTarget ? (
                <View style={styles.restockProductCard}>
                  <Text style={styles.restockProductName}>{restockProductTarget.name}</Text>
                  <View style={styles.restockMetaRow}>
                    <Text style={styles.restockMetaText}>
                      Stok saat ini: <Text style={{ fontWeight: 'bold', color: Colors.text }}>{restockProductTarget.stock} {restockProductTarget.is_kg === 1 ? 'kg' : 'item'}</Text>
                    </Text>
                    <Text style={styles.restockMetaText}>
                      Harga Jual: <Text style={{ fontWeight: 'bold', color: Colors.primary }}>{formatRupiah(restockProductTarget.sell_price)}</Text>
                    </Text>
                  </View>
                </View>
              ) : null}

              {/* Quantity input & quick chips */}
              <Text style={styles.formLabel}>
                Jumlah Stok Masuk ({restockProductTarget?.is_kg === 1 ? 'Kg' : 'Item/Pcs'}):
              </Text>
              <TextInput
                style={styles.input}
                keyboardType="numeric"
                placeholder="Contoh: 10"
                value={restockQty}
                onChangeText={setRestockQty}
              />

              {/* Quick Qty Chips */}
              <View style={styles.quickQtyRow}>
                {['5', '10', '20', '50', '100'].map((val) => (
                  <TouchableOpacity
                    key={val}
                    style={[
                      styles.quickQtyChip,
                      restockQty === val && styles.quickQtyChipActive,
                    ]}
                    onPress={() => setRestockQty(val)}
                  >
                    <Text
                      style={[
                        styles.quickQtyChipText,
                        restockQty === val && styles.quickQtyChipTextActive,
                      ]}
                    >
                      +{val}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Buy Price / HPP input */}
              <Text style={[styles.formLabel, { marginTop: 12 }]}>
                Harga Beli Satuan / Modal (Rp):
              </Text>
              <TextInput
                style={styles.input}
                keyboardType="numeric"
                placeholder="Rp 0"
                value={restockBuyPrice}
                onChangeText={(t) => setRestockBuyPrice(formatRupiah(t))}
              />
              <Text style={styles.inputHelperText}>
                Harga beli modal per {restockProductTarget?.is_kg === 1 ? 'kg' : 'item'} barang.
              </Text>

              {/* Restock Cost Summary */}
              {(() => {
                const q = parseFloat(restockQty.replace(',', '.')) || 0;
                const p = parseRupiahToNumber(restockBuyPrice);
                const total = Math.round(q * p);
                return (
                  <View style={styles.restockSummaryBox}>
                    <View style={styles.restockSummaryRow}>
                      <Text style={styles.restockSummaryLabel}>Estimasi Total Biaya Belanja Stok:</Text>
                      <Text style={styles.restockSummaryValue}>{formatRupiah(total)}</Text>
                    </View>
                    <Text style={styles.restockSummaryFormula}>
                      ({q} {restockProductTarget?.is_kg === 1 ? 'kg' : 'item'} x {formatRupiah(p)})
                    </Text>
                  </View>
                );
              })()}

              {/* Payment Source Options */}
              <Text style={[styles.formLabel, { marginTop: 14, marginBottom: 8 }]}>
                Sumber Dana / Cara Pembayaran Belanja Stok:
              </Text>

              {/* Option 1: Cash Drawer */}
              <TouchableOpacity
                style={[
                  styles.paymentOptionCard,
                  restockPaymentSource === 'CASH_DRAWER' && styles.paymentOptionCardActive,
                ]}
                onPress={() => setRestockPaymentSource('CASH_DRAWER')}
                activeOpacity={0.8}
              >
                <View style={styles.paymentOptionHeader}>
                  <View style={styles.paymentOptionIconWrap}>
                    <Ionicons
                      name="wallet-outline"
                      size={20}
                      color={restockPaymentSource === 'CASH_DRAWER' ? Colors.primary : '#64748B'}
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text
                      style={[
                        styles.paymentOptionTitle,
                        restockPaymentSource === 'CASH_DRAWER' && styles.paymentOptionTitleActive,
                      ]}
                    >
                      Bayar Pakai Uang Laci Kasir Sekarang
                    </Text>
                    <Text style={styles.paymentOptionSub}>
                      Otomatis mencatat pengeluaran belanja stok dari kas warung & mengurangi sisa uang fisik di laci kasir.
                    </Text>
                  </View>
                  <View
                    style={[
                      styles.radioCircle,
                      restockPaymentSource === 'CASH_DRAWER' && styles.radioCircleSelected,
                    ]}
                  >
                    {restockPaymentSource === 'CASH_DRAWER' ? <View style={styles.radioDot} /> : null}
                  </View>
                </View>
              </TouchableOpacity>

              {/* Option 2: Consignment */}
              <TouchableOpacity
                style={[
                  styles.paymentOptionCard,
                  restockPaymentSource === 'CONSIGNMENT' && styles.paymentOptionCardActive,
                ]}
                onPress={() => setRestockPaymentSource('CONSIGNMENT')}
                activeOpacity={0.8}
              >
                <View style={styles.paymentOptionHeader}>
                  <View style={[styles.paymentOptionIconWrap, { backgroundColor: '#FEF3C7' }]}>
                    <Ionicons
                      name="people-outline"
                      size={20}
                      color={restockPaymentSource === 'CONSIGNMENT' ? '#D97706' : '#92400E'}
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text
                      style={[
                        styles.paymentOptionTitle,
                        restockPaymentSource === 'CONSIGNMENT' && styles.paymentOptionTitleActive,
                      ]}
                    >
                      Barang Titipan / Konsinyasi (Bayar Nanti Saat Laku)
                    </Text>
                    <Text style={styles.paymentOptionSub}>
                      Stok bertambah tanpa memotong uang kasir sekarang. Bagi hasil dihitung otomatis saat barang terjual di kasir.
                    </Text>
                  </View>
                  <View
                    style={[
                      styles.radioCircle,
                      restockPaymentSource === 'CONSIGNMENT' && styles.radioCircleSelected,
                    ]}
                  >
                    {restockPaymentSource === 'CONSIGNMENT' ? <View style={styles.radioDot} /> : null}
                  </View>
                </View>
              </TouchableOpacity>

              {/* Option 3: Correction Only */}
              <TouchableOpacity
                style={[
                  styles.paymentOptionCard,
                  restockPaymentSource === 'CORRECTION_ONLY' && styles.paymentOptionCardActive,
                ]}
                onPress={() => setRestockPaymentSource('CORRECTION_ONLY')}
                activeOpacity={0.8}
              >
                <View style={styles.paymentOptionHeader}>
                  <View style={styles.paymentOptionIconWrap}>
                    <Ionicons
                      name="sync-outline"
                      size={20}
                      color={restockPaymentSource === 'CORRECTION_ONLY' ? Colors.primary : '#64748B'}
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text
                      style={[
                        styles.paymentOptionTitle,
                        restockPaymentSource === 'CORRECTION_ONLY' && styles.paymentOptionTitleActive,
                      ]}
                    >
                      Koreksi Fisik Stok Opname Saja
                    </Text>
                    <Text style={styles.paymentOptionSub}>
                      Hanya menyesuaikan jumlah fisik barang tanpa ada transaksi keuangan kasir.
                    </Text>
                  </View>
                  <View
                    style={[
                      styles.radioCircle,
                      restockPaymentSource === 'CORRECTION_ONLY' && styles.radioCircleSelected,
                    ]}
                  >
                    {restockPaymentSource === 'CORRECTION_ONLY' ? <View style={styles.radioDot} /> : null}
                  </View>
                </View>
              </TouchableOpacity>
            </ScrollView>

            <TouchableOpacity
              style={[styles.saveBtn, isSubmittingRestock && { opacity: 0.6 }]}
              onPress={handleConfirmRestock}
              disabled={isSubmittingRestock}
            >
              <Text style={styles.saveBtnText}>Konfirmasi & Tambah Stok</Text>
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
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 10,
    alignItems: 'center',
  },
  searchBox: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: Radius.full,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: 14,
    height: 46,
    ...Shadows.soft,
  },
  searchInput: {
    flex: 1,
    marginLeft: 8,
    fontSize: 13,
    color: Colors.text,
  },
  addBtn: {
    backgroundColor: Colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    height: 46,
    borderRadius: Radius.full,
    gap: 4,
    ...Shadows.glow(0.2),
  },
  addBtnText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 13,
  },
  tabContainer: {
    paddingVertical: 6,
  },
  tabScrollContent: {
    paddingHorizontal: 16,
    gap: 8,
  },
  tabChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: Radius.full,
    backgroundColor: Colors.categoryInactive,
  },
  tabChipActive: {
    backgroundColor: Colors.categoryActive,
  },
  tabChipText: {
    fontSize: 12,
    color: Colors.categoryInactiveText,
    fontWeight: '600',
  },
  tabChipTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  categoryPillsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 12,
    marginTop: 2,
  },
  categoryFormPill: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: Radius.full,
    backgroundColor: '#F1F5F2',
    borderWidth: 1,
    borderColor: 'transparent',
  },
  categoryFormPillActive: {
    backgroundColor: Colors.primaryLight,
    borderColor: Colors.primary,
  },
  categoryFormPillText: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  categoryFormPillTextActive: {
    color: Colors.primary,
    fontWeight: '800',
  },
  listContent: {
    padding: 16,
    paddingBottom: 40,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: Radius.xl2,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: Colors.borderLight,
    ...Shadows.card,
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
    fontSize: 15,
    fontWeight: '700',
    color: Colors.text,
  },
  tagConsignment: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: Colors.secondaryLight,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: Radius.full,
  },
  tagConsignmentText: {
    fontSize: 10,
    color: Colors.secondary,
    fontWeight: '700',
  },
  tagKg: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: Colors.successLight,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: Radius.full,
  },
  tagKgText: {
    fontSize: 10,
    color: Colors.success,
    fontWeight: '700',
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
    borderRadius: Radius.full,
    backgroundColor: Colors.primaryLight,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cardDivider: {
    height: 1,
    backgroundColor: '#F3F4F6',
    marginVertical: 12,
  },
  detailsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
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
    fontWeight: '600',
  },
  stockStepperRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: Colors.primarySoft,
    padding: 10,
    borderRadius: Radius.lg,
  },
  stockStepperLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  stockCount: {
    fontWeight: '700',
  },
  stepperContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  stepperBtn: {
    width: 32,
    height: 32,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.full,
    justifyContent: 'center',
    alignItems: 'center',
  },
  stepperBtnPlus: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  stepperBtnText: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.text,
  },
  stepperValue: {
    fontSize: 14,
    fontWeight: '700',
    minWidth: 24,
    textAlign: 'center',
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
    maxHeight: '90%',
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
  modalTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: Colors.text,
  },
  modalSubTitle: {
    fontSize: 12,
    color: Colors.textMuted,
    marginTop: 2,
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
  inputHelperText: {
    fontSize: 11,
    color: Colors.textMuted,
    marginTop: 3,
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
  inputScanRow: {
    flexDirection: 'row',
    gap: 8,
  },
  scanShortcutBtn: {
    backgroundColor: Colors.primary,
    width: 44,
    height: 44,
    borderRadius: Radius.lg,
    justifyContent: 'center',
    alignItems: 'center',
    ...Shadows.glow(0.18),
  },
  rowTwoCols: {
    flexDirection: 'row',
    gap: 10,
  },
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginVertical: 8,
    padding: 12,
    backgroundColor: '#F8FAFC',
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.borderLight,
  },
  switchRowCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 10,
    padding: 12,
    backgroundColor: '#F8FAFC',
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.borderLight,
  },
  switchTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.text,
  },
  switchSub: {
    fontSize: 11,
    color: Colors.textMuted,
    marginTop: 2,
  },
  switchSubtitle: {
    fontSize: 11,
    color: Colors.textMuted,
    marginTop: 2,
    lineHeight: 15,
  },
  consignmentBox: {
    backgroundColor: Colors.secondaryLight,
    padding: 12,
    borderRadius: Radius.lg,
    marginBottom: 10,
  },
  consignmentInputBox: {
    backgroundColor: '#FFFBEB',
    padding: 12,
    borderRadius: Radius.lg,
    marginTop: 8,
    borderWidth: 1,
    borderColor: '#FDE68A',
  },
  saveBtn: {
    backgroundColor: Colors.primary,
    paddingVertical: 15,
    borderRadius: Radius.full,
    alignItems: 'center',
    marginTop: 10,
    ...Shadows.glow(0.2),
  },
  saveBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
  },
  restockProductCard: {
    backgroundColor: '#F8FAFC',
    padding: 14,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: 10,
  },
  restockProductName: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.text,
  },
  restockMetaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 6,
  },
  restockMetaText: {
    fontSize: 12,
    color: Colors.textMuted,
  },
  quickQtyRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 8,
  },
  quickQtyChip: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: Radius.full,
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  quickQtyChipActive: {
    backgroundColor: Colors.primaryLight,
    borderColor: Colors.primary,
  },
  quickQtyChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  quickQtyChipTextActive: {
    color: Colors.primaryDark,
    fontWeight: '700',
  },
  restockSummaryBox: {
    backgroundColor: Colors.primarySoft,
    padding: 14,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.primaryLight,
    marginTop: 12,
  },
  restockSummaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  restockSummaryLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.primaryDark,
  },
  restockSummaryValue: {
    fontSize: 16,
    fontWeight: '800',
    color: Colors.primaryDark,
  },
  restockSummaryFormula: {
    fontSize: 11,
    color: Colors.primaryDark,
    marginTop: 2,
  },
  paymentOptionCard: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: Colors.border,
    borderRadius: Radius.lg,
    padding: 12,
    marginBottom: 8,
  },
  paymentOptionCardActive: {
    borderColor: Colors.primary,
    backgroundColor: Colors.primarySoft,
  },
  paymentOptionHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  paymentOptionIconWrap: {
    width: 32,
    height: 32,
    borderRadius: Radius.full,
    backgroundColor: '#F1F5F9',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 2,
  },
  paymentOptionTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.text,
  },
  paymentOptionTitleActive: {
    color: Colors.primaryDark,
  },
  paymentOptionSub: {
    fontSize: 11,
    color: Colors.textMuted,
    lineHeight: 15,
    marginTop: 2,
  },
  radioCircle: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: Colors.border,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 2,
  },
  radioCircleSelected: {
    borderColor: Colors.primary,
  },
  radioDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: Colors.primary,
  },
});

