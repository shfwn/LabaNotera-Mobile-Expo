import React, { useState, useEffect, useCallback } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  FlatList,
  TextInput,
  Modal,
  ScrollView,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAppSQLiteContext as useSQLiteContext } from '../../src/db/AppDatabaseProvider';
import { useRouter, useFocusEffect } from 'expo-router';
import { Product, CartItem, PaymentMethod, ShopProfile } from '../../src/types';
import { getProducts, searchProducts } from '../../src/services/productService';
import { processCheckout } from '../../src/services/posService';
import { getShopProfile } from '../../src/services/profileService';
import { formatRupiah, parseRupiahToNumber, getProductCategory, isKgProduct, formatQty } from '../../src/utils/formatters';
import { showAppAlert } from '../../src/utils/alertHelper';
import { getShadowStyle } from '../../src/utils/styleHelper';
import { Colors, Radius, Shadows } from '../../src/constants/theme';
import { Ionicons } from '@expo/vector-icons';

export default function PosScreen() {
  const db = useSQLiteContext();
  const router = useRouter();

  const [products, setProducts] = useState<Product[]>([]);
  const [filteredProducts, setFilteredProducts] = useState<Product[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFilter, setSelectedFilter] = useState<
    'ALL' | 'SEMBAKO' | 'KONSUMSI' | 'SANITASI' | 'DIGITAL_KOMODITAS' | 'TITIPAN'
  >('ALL');

  // Cart state
  const [cart, setCart] = useState<CartItem[]>([]);
  const [isCheckoutModalVisible, setIsCheckoutModalVisible] = useState(false);

  // Weight Picker Modal state (Timbangan / Kiloan)
  const [isWeightModalVisible, setIsWeightModalVisible] = useState(false);
  const [selectedKgProduct, setSelectedKgProduct] = useState<Product | null>(null);
  const [selectedWeightPreset, setSelectedWeightPreset] = useState<number | null>(1);
  const [customWeightInput, setCustomWeightInput] = useState('');
  const [customMoneyInput, setCustomMoneyInput] = useState('');

  // Shop Profile state (QRIS and Bank Account for Checkout)
  const [shopProfile, setShopProfile] = useState<ShopProfile | null>(null);

  // Checkout payment state
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('CASH');
  const [cashAmountInput, setCashAmountInput] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const loadProducts = useCallback(async () => {
    try {
      const data = searchQuery.trim()
        ? await searchProducts(db, searchQuery)
        : await getProducts(db);
      setProducts(data);

      const profile = await getShopProfile(db);
      setShopProfile(profile);
    } catch (err) {
      console.error('Failed to load products in POS:', err);
    }
  }, [db, searchQuery]);

  useFocusEffect(
    useCallback(() => {
      loadProducts();
    }, [loadProducts])
  );

  useEffect(() => {
    let result = products;
    if (selectedFilter === 'TITIPAN') {
      result = result.filter((p) => p.is_consignment === 1);
    } else if (
      selectedFilter === 'SEMBAKO' ||
      selectedFilter === 'KONSUMSI' ||
      selectedFilter === 'SANITASI' ||
      selectedFilter === 'DIGITAL_KOMODITAS'
    ) {
      result = result.filter((p) => getProductCategory(p) === selectedFilter);
    }
    setFilteredProducts(result);
  }, [products, selectedFilter]);

  // Cart operations
  const addToCart = (product: Product, qtyToAdd: number = 1) => {
    if (product.stock <= 0) {
      showAppAlert('Stok Habis', `Stok ${product.name} telah habis!`);
      return;
    }

    setCart((prev) => {
      const existing = prev.find((item) => item.product.id === product.id);
      if (existing) {
        const newTotal = existing.qty + qtyToAdd;
        if (newTotal > product.stock) {
          showAppAlert('Batas Stok', `Jumlah di keranjang melebihi stok yang ada (${product.stock}).`);
          return prev;
        }
        return prev.map((item) =>
          item.product.id === product.id ? { ...item, qty: newTotal } : item
        );
      }
      return [...prev, { product, qty: qtyToAdd }];
    });
  };

  const openWeightModal = (product: Product) => {
    setSelectedKgProduct(product);
    setSelectedWeightPreset(1);
    setCustomWeightInput('');
    setCustomMoneyInput('');
    setIsWeightModalVisible(true);
  };

  const handleProductPress = (product: Product) => {
    if (product.stock <= 0) {
      showAppAlert('Stok Habis', `Stok ${product.name} telah habis!`);
      return;
    }

    if (isKgProduct(product)) {
      openWeightModal(product);
    } else {
      addToCart(product, 1);
    }
  };

  const handleConfirmWeight = () => {
    if (!selectedKgProduct) return;

    let finalQty = 1;
    if (customMoneyInput.trim()) {
      const nominal = parseRupiahToNumber(customMoneyInput);
      if (nominal > 0 && selectedKgProduct.sell_price > 0) {
        finalQty = Number((nominal / selectedKgProduct.sell_price).toFixed(3));
      }
    } else if (customWeightInput.trim()) {
      const parsed = parseFloat(customWeightInput.replace(',', '.'));
      if (!isNaN(parsed) && parsed > 0) {
        finalQty = parsed;
      }
    } else if (selectedWeightPreset !== null) {
      finalQty = selectedWeightPreset;
    }

    if (finalQty <= 0) {
      showAppAlert('Takaran Tidak Valid', 'Mohon masukkan takaran atau nominal pembelian.');
      return;
    }

    addToCart(selectedKgProduct, finalQty);
    setIsWeightModalVisible(false);
    setSelectedKgProduct(null);
  };

  const updateCartQty = (productId: number, delta: number) => {
    setCart((prev) =>
      prev
        .map((item) => {
          if (item.product.id === productId) {
            const step = isKgProduct(item.product) ? 0.25 * (delta > 0 ? 1 : -1) : delta;
            const newQty = Number((item.qty + step).toFixed(3));
            if (newQty > item.product.stock) {
              showAppAlert('Batas Stok', `Stok maksimum ${item.product.stock}`);
              return item;
            }
            return newQty > 0 ? { ...item, qty: newQty } : null;
          }
          return item;
        })
        .filter(Boolean) as CartItem[]
    );
  };

  const removeFromCart = (productId: number) => {
    setCart((prev) => prev.filter((item) => item.product.id !== productId));
  };

  // Calculations
  const totalCartPrice = cart.reduce((sum, item) => sum + Math.round(item.product.sell_price * item.qty), 0);
  const totalCartItems = cart.reduce((sum, item) => sum + (isKgProduct(item.product) ? 1 : item.qty), 0);
  // Parse formatted string "Rp 20.000" → 20000
  const numericCashPaid = parseRupiahToNumber(cashAmountInput);
  const changeAmount = numericCashPaid - totalCartPrice;

  // Smart detection: is this a partial/short payment?
  const isCashShort = paymentMethod === 'CASH' && numericCashPaid > 0 && changeAmount < 0;
  const shortfallAmount = isCashShort ? Math.abs(changeAmount) : 0;

  // Button & label states
  const isCashInputEmpty = paymentMethod === 'CASH' && numericCashPaid <= 0;
  const isCustomerNameRequired = paymentMethod === 'UTANG' || isCashShort;

  const submitButtonLabel = isSubmitting
    ? 'Memproses...'
    : isCashShort
    ? `CATAT UTANG (Rp ${shortfallAmount.toLocaleString('id-ID')})`
    : paymentMethod === 'UTANG'
    ? 'CATAT SEBAGAI UTANG'
    : 'BAYAR LUNAS';

  const submitButtonStyle = isCashShort
    ? styles.submitButtonWarning
    : paymentMethod === 'UTANG'
    ? styles.submitButtonUtang
    : styles.submitButtonGreen;

  // Process payment
  const handleFinalCheckout = async () => {
    if (cart.length === 0) return;

    // Strict validation for debt transactions: BOTH Name AND Phone are mandatory
    if (isCustomerNameRequired) {
      if (!customerName.trim()) {
        showAppAlert(
          'Nama Pelanggan Wajib Diisi',
          'Mohon masukkan nama pelanggan untuk mencatat transaksi utang / kasbon.'
        );
        return;
      }
      if (!customerPhone.trim()) {
        showAppAlert(
          'Nomor HP Wajib Diisi',
          'Mohon masukkan nomor HP / WhatsApp pelanggan untuk catatan utang agar dapat dihubungi atau diingatkan via WA.'
        );
        return;
      }
    }

    try {
      setIsSubmitting(true);
      const res = await processCheckout(
        db,
        cart,
        paymentMethod,
        customerName.trim() || undefined,
        customerPhone.trim() || undefined,
        paymentMethod === 'CASH' ? numericCashPaid : undefined
      );

      setIsCheckoutModalVisible(false);
      setCart([]);
      setCashAmountInput('');
      setCustomerName('');
      setCustomerPhone('');
      await loadProducts();

      // Navigate to receipt
      router.push(`/receipt/${res.transactionId}`);
    } catch (err: any) {
      showAppAlert('Gagal Transaksi', err.message || 'Terjadi kesalahan saat memproses checkout.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleFilterPress = (
    filter: 'ALL' | 'SEMBAKO' | 'KONSUMSI' | 'SANITASI' | 'DIGITAL_KOMODITAS' | 'TITIPAN'
  ) => {
    if (filter === 'ALL') {
      setSelectedFilter('ALL');
    } else {
      setSelectedFilter((prev) => (prev === filter ? 'ALL' : filter));
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Clean Search & Barcode Scanner Pill */}
      <View style={styles.searchHeader}>
        <View style={styles.searchInputContainer}>
          <Ionicons name="search-outline" color={Colors.textMuted} size={18} />
          <TextInput
            style={styles.searchInput}
            placeholder="Cari barang / scan barcode..."
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholderTextColor={Colors.textMuted}
          />
          {searchQuery ? (
            <TouchableOpacity onPress={() => setSearchQuery('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Ionicons name="close-circle" color={Colors.textMuted} size={16} />
            </TouchableOpacity>
          ) : null}
        </View>

        <TouchableOpacity
          style={styles.scanButton}
          activeOpacity={0.8}
          onPress={() => router.push('/scanner')}
        >
          <Ionicons name="qr-code-outline" color="#FFFFFF" size={20} />
        </TouchableOpacity>
      </View>

      {/* Categories Pill Carousel */}
      <View style={styles.categoriesBar}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterScrollContent}
        >
          <TouchableOpacity
            style={[styles.filterChip, selectedFilter === 'ALL' && styles.filterChipActive]}
            onPress={() => handleFilterPress('ALL')}
            activeOpacity={0.75}
          >
            <Text style={[styles.filterChipText, selectedFilter === 'ALL' && styles.filterChipTextActive]}>
              Semua ({products.length})
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.filterChip, selectedFilter === 'SEMBAKO' && styles.filterChipActive]}
            onPress={() => handleFilterPress('SEMBAKO')}
            activeOpacity={0.75}
          >
            <Text style={[styles.filterChipText, selectedFilter === 'SEMBAKO' && styles.filterChipTextActive]}>
              Bahan Pokok & Sembako
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.filterChip, selectedFilter === 'KONSUMSI' && styles.filterChipActive]}
            onPress={() => handleFilterPress('KONSUMSI')}
            activeOpacity={0.75}
          >
            <Text style={[styles.filterChipText, selectedFilter === 'KONSUMSI' && styles.filterChipTextActive]}>
              Makanan & Minuman
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.filterChip, selectedFilter === 'SANITASI' && styles.filterChipActive]}
            onPress={() => handleFilterPress('SANITASI')}
            activeOpacity={0.75}
          >
            <Text style={[styles.filterChipText, selectedFilter === 'SANITASI' && styles.filterChipTextActive]}>
              Rumah & Sanitasi
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.filterChip, selectedFilter === 'DIGITAL_KOMODITAS' && styles.filterChipActive]}
            onPress={() => handleFilterPress('DIGITAL_KOMODITAS')}
            activeOpacity={0.75}
          >
            <Text style={[styles.filterChipText, selectedFilter === 'DIGITAL_KOMODITAS' && styles.filterChipTextActive]}>
              Komoditas & Digital
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.filterChip, selectedFilter === 'TITIPAN' && styles.filterChipActive]}
            onPress={() => handleFilterPress('TITIPAN')}
            activeOpacity={0.75}
          >
            <Text style={[styles.filterChipText, selectedFilter === 'TITIPAN' && styles.filterChipTextActive]}>
              Barang Titipan ({products.filter((p) => p.is_consignment === 1).length})
            </Text>
          </TouchableOpacity>
        </ScrollView>
      </View>

      {/* Product List */}
      <FlatList
        data={filteredProducts}
        keyExtractor={(item) => item.id.toString()}
        contentContainerStyle={styles.listContent}
        numColumns={2}
        renderItem={({ item }) => {
          const cartItem = cart.find((c) => c.product.id === item.id);
          const inCartQty = cartItem ? cartItem.qty : 0;
          const isKg = isKgProduct(item);

          return (
            <TouchableOpacity
              style={[styles.productCard, item.stock <= 0 && styles.productCardDisabled]}
              onPress={() => handleProductPress(item)}
              activeOpacity={0.85}
            >
              <View style={styles.cardHeaderArea}>
                <View style={styles.badgeContainerRow}>
                  {isKg ? (
                    <View style={styles.badgeKg}>
                      <Ionicons name="scale-outline" size={11} color="#047857" />
                      <Text style={styles.badgeKgText}>Timbangan</Text>
                    </View>
                  ) : null}
                  {item.is_consignment === 1 ? (
                    <View style={styles.badgeTitipan}>
                      <Ionicons name="people-outline" size={11} color={Colors.secondary} />
                      <Text style={styles.badgeTitipanText}>
                        Titipan{item.supplier_name ? ` (${item.supplier_name})` : ''}
                      </Text>
                    </View>
                  ) : null}
                  {item.stock < 5 ? (
                    <View style={styles.badgeLowStock}>
                      <Text style={styles.badgeLowStockText}>Stok: {item.stock}</Text>
                    </View>
                  ) : null}
                </View>
              </View>

              <Text style={styles.productName} numberOfLines={2}>
                {item.name}
              </Text>

              <View style={styles.priceRow}>
                <Text style={styles.productPrice}>
                  {formatRupiah(item.sell_price)} {isKg ? '/ kg' : ''}
                </Text>
                <Text style={styles.productStock}>Stok: {item.stock}</Text>
              </View>

              {inCartQty > 0 ? (
                <View style={styles.inCartStepper}>
                  <TouchableOpacity
                    style={styles.stepperBtn}
                    onPress={() => updateCartQty(item.id, -1)}
                  >
                    <Ionicons name="remove" size={14} color="#FFFFFF" />
                  </TouchableOpacity>
                  <Text style={styles.stepperQtyText}>
                    {formatQty(inCartQty, isKg)}
                  </Text>
                  <TouchableOpacity
                    style={styles.stepperBtn}
                    onPress={() => updateCartQty(item.id, 1)}
                  >
                    <Ionicons name="add" size={14} color="#FFFFFF" />
                  </TouchableOpacity>
                </View>
              ) : (
                <View style={styles.addButton}>
                  <Ionicons name={isKg ? "scale-outline" : "add-circle"} color="#FFFFFF" size={15} />
                  <Text style={styles.addButtonText}>{isKg ? "Timbang" : "Tambah"}</Text>
                </View>  
              )}
            </TouchableOpacity>
          );
        }}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="fast-food-outline" color={Colors.textMuted} size={48} />
            <Text style={styles.emptyText}>Belum ada barang di kategori ini</Text>
          </View>
        }
      />

      {/* Floating Cart Bar (Capsule Rounded-Full with Soft Glow) */}
      {cart.length > 0 ? (
        <TouchableOpacity
          style={styles.cartFloatingBar}
          activeOpacity={0.88}
          onPress={() => setIsCheckoutModalVisible(true)}
        >
          {/* Left item count circle */}
          <View style={styles.cartCountCircle}>
            <Text style={styles.cartCountCircleText}>{totalCartItems}</Text>
          </View>

          {/* Center view cart label */}
          <Text style={styles.cartViewCartText}>Lihat Keranjang</Text>

          {/* Right subtotal value */}
          <Text style={styles.cartTotalValue}>{formatRupiah(totalCartPrice)}</Text>
        </TouchableOpacity>
      ) : null}

      {/* Weight Picker Modal (Timbangan / Kiloan) */}
      <Modal
        visible={isWeightModalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setIsWeightModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.weightModalContent}>
            {/* Modal Header with Icon */}
            <View style={styles.modalHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <View style={styles.weightHeaderIconBg}>
                  <Ionicons name="scale" color="#FFFFFF" size={18} />
                </View>
                <View>
                  <Text style={styles.modalTitle}>Takaran & Timbangan</Text>
                  <Text style={styles.modalSubtitle}>Hitung pecahan kg atau beli nominal uang</Text>
                </View>
              </View>
              <TouchableOpacity
                style={styles.modalCloseBtn}
                onPress={() => setIsWeightModalVisible(false)}
              >
                <Ionicons name="close" color={Colors.text} size={20} />
              </TouchableOpacity>
            </View>

            {selectedKgProduct ? (
              <>
                {/* Fixed Product Header Card (Always visible at top) */}
                <View style={styles.weightProductHeader}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.weightProductName} numberOfLines={1}>{selectedKgProduct.name}</Text>
                    <View style={styles.weightProductMeta}>
                      <Text style={styles.weightProductPrice}>
                        {formatRupiah(selectedKgProduct.sell_price)} <Text style={{ fontSize: 11, fontWeight: 'normal', color: Colors.textMuted }}>/ kg</Text>
                      </Text>
                      <View style={styles.weightStockBadge}>
                        <Text style={styles.weightStockBadgeText}>Stok: {selectedKgProduct.stock} kg</Text>
                      </View>
                    </View>
                  </View>
                </View>

                {/* Scrollable Body Options */}
                <ScrollView
                  showsVerticalScrollIndicator={false}
                  contentContainerStyle={styles.weightScrollBody}
                  keyboardShouldPersistTaps="handled"
                >
                  {/* Section 1: Presets Berat (Pecahan Kg Standar) */}
                  <Text style={styles.weightSectionTitle}>
                    <Ionicons name="apps-outline" size={13} color={Colors.primary} /> Pilih Takaran Pecahan Cepat:
                  </Text>
                  <View style={styles.fractionGrid}>
                    {[
                      { label: '1/4 kg', sub: '250 gr', val: 0.25 },
                      { label: '1/2 kg', sub: '500 gr', val: 0.5 },
                      { label: '3/4 kg', sub: '750 gr', val: 0.75 },
                      { label: '1 kg', sub: '1.000 gr', val: 1 },
                      { label: '1.5 kg', sub: '1.500 gr', val: 1.5 },
                      { label: '2 kg', sub: '2.000 gr', val: 2 },
                    ].map((p) => {
                      const isSelected = selectedWeightPreset === p.val && !customWeightInput && !customMoneyInput;
                      const price = Math.round(selectedKgProduct.sell_price * p.val);
                      return (
                        <TouchableOpacity
                          key={p.val}
                          style={[styles.fractionBtn, isSelected && styles.fractionBtnActive]}
                          onPress={() => {
                            setSelectedWeightPreset(p.val);
                            setCustomWeightInput('');
                            setCustomMoneyInput('');
                          }}
                          activeOpacity={0.7}
                        >
                          <Text style={[styles.fractionBtnText, isSelected && styles.fractionBtnTextActive]}>
                            {p.label}
                          </Text>
                          <Text style={[styles.fractionBtnSub, isSelected && styles.fractionBtnSubActive]}>
                            {p.sub}
                          </Text>
                          <Text style={[styles.fractionBtnPrice, isSelected && styles.fractionBtnPriceActive]}>
                            {formatRupiah(price)}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>

                  {/* Section 2: Pembelian Berdasarkan Nominal Uang (Sering di Warung) */}
                  <Text style={styles.weightSectionTitle}>
                    <Ionicons name="cash-outline" size={13} color={Colors.secondary} /> Atau Beli Berdasarkan Nominal Uang (Rp):
                  </Text>
                  <View style={styles.customInputCard}>
                    {/* Quick Money Chips */}
                    <View style={styles.quickNominalRow}>
                      {[
                        { label: '2rb', val: 2000 },
                        { label: '5rb', val: 5000 },
                        { label: '10rb', val: 10000 },
                        { label: '15rb', val: 15000 },
                        { label: '20rb', val: 20000 },
                        { label: '50rb', val: 50000 },
                      ].map((chip) => {
                        const isChipActive = parseRupiahToNumber(customMoneyInput) === chip.val;
                        return (
                          <TouchableOpacity
                            key={chip.val}
                            style={[styles.quickNominalChip, isChipActive && styles.quickNominalChipActive]}
                            onPress={() => {
                              setCustomMoneyInput(formatRupiah(chip.val));
                              setCustomWeightInput('');
                              setSelectedWeightPreset(null);
                            }}
                            activeOpacity={0.7}
                          >
                            <Text style={[styles.quickNominalChipText, isChipActive && styles.quickNominalChipTextActive]}>
                              {chip.label}
                            </Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>

                    <TextInput
                      style={styles.input}
                      placeholder="Ketik nominal, misal: Rp 5.000"
                      placeholderTextColor={Colors.textMuted}
                      keyboardType="numeric"
                      value={customMoneyInput}
                      onChangeText={(text) => {
                        setCustomMoneyInput(formatRupiah(text));
                        setCustomWeightInput('');
                        setSelectedWeightPreset(null);
                      }}
                    />
                    <Text style={styles.inputHintSub}>
                      * Ketik jumlah uang pembeli, takaran berat kg otomatis dihitung presisi.
                    </Text>
                  </View>

                  {/* Section 3: Input Angka Timbangan Manual (kg) */}
                  <Text style={styles.weightSectionTitle}>
                    <Ionicons name="speedometer-outline" size={13} color={Colors.primaryDark} /> Atau Masukkan Angka Timbangan (Kg):
                  </Text>
                  <View style={styles.customInputCard}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <TouchableOpacity
                        style={styles.weightStepperBtn}
                        onPress={() => {
                          const cur = parseFloat(customWeightInput.replace(',', '.')) || (selectedWeightPreset || 1);
                          const next = Math.max(0.05, Number((cur - 0.1).toFixed(2)));
                          setCustomWeightInput(next.toString());
                          setCustomMoneyInput('');
                          setSelectedWeightPreset(null);
                        }}
                      >
                        <Text style={styles.weightStepperBtnText}>-0.1</Text>
                      </TouchableOpacity>

                      <TextInput
                        style={[styles.input, { flex: 1, textAlign: 'center', fontSize: 16, fontWeight: '700' }]}
                        placeholder="Misal: 0.5"
                        placeholderTextColor={Colors.textMuted}
                        keyboardType="numeric"
                        value={customWeightInput}
                        onChangeText={(text) => {
                          setCustomWeightInput(text);
                          setCustomMoneyInput('');
                          setSelectedWeightPreset(null);
                        }}
                      />

                      <TouchableOpacity
                        style={styles.weightStepperBtn}
                        onPress={() => {
                          const cur = parseFloat(customWeightInput.replace(',', '.')) || (selectedWeightPreset || 1);
                          const next = Number((cur + 0.1).toFixed(2));
                          setCustomWeightInput(next.toString());
                          setCustomMoneyInput('');
                          setSelectedWeightPreset(null);
                        }}
                      >
                        <Text style={styles.weightStepperBtnText}>+0.1</Text>
                      </TouchableOpacity>

                      <View style={styles.unitBadge}>
                        <Text style={styles.unitBadgeText}>kg</Text>
                      </View>
                    </View>
                  </View>
                </ScrollView>

                {/* Fixed Sticky Bottom Summary & Button (Always visible at bottom) */}
                <View style={styles.weightBottomStickyContainer}>
                  {(() => {
                    let calcQty = 1;
                    let calcPrice = selectedKgProduct.sell_price;
                    if (customMoneyInput.trim()) {
                      const nominal = parseRupiahToNumber(customMoneyInput);
                      if (nominal > 0 && selectedKgProduct.sell_price > 0) {
                        calcQty = Number((nominal / selectedKgProduct.sell_price).toFixed(3));
                        calcPrice = nominal;
                      }
                    } else if (customWeightInput.trim()) {
                      const parsed = parseFloat(customWeightInput.replace(',', '.'));
                      if (!isNaN(parsed) && parsed > 0) {
                        calcQty = parsed;
                        calcPrice = Math.round(selectedKgProduct.sell_price * calcQty);
                      }
                    } else if (selectedWeightPreset !== null) {
                      calcQty = selectedWeightPreset;
                      calcPrice = Math.round(selectedKgProduct.sell_price * calcQty);
                    }

                    return (
                      <View style={styles.weightSummaryCard}>
                        <View style={styles.summaryRow}>
                          <Text style={styles.summaryLabel}>Estimasi Takaran Berat:</Text>
                          <Text style={styles.summaryValue}>
                            {formatQty(calcQty, true)} ({Math.round(calcQty * 1000)} gr)
                          </Text>
                        </View>
                        <View style={styles.summaryRow}>
                          <Text style={styles.summaryLabel}>Total Harga Barang:</Text>
                          <Text style={[styles.summaryValue, { color: Colors.primaryDark, fontWeight: '800', fontSize: 16 }]}>
                            {formatRupiah(calcPrice)}
                          </Text>
                        </View>
                      </View>
                    );
                  })()}

                  <TouchableOpacity
                    style={[styles.submitButton, styles.submitButtonGreen]}
                    onPress={handleConfirmWeight}
                    activeOpacity={0.85}
                  >
                    <Ionicons name="cart" color="#FFFFFF" size={18} />
                    <Text style={styles.submitButtonText}>Masukkan Ke Keranjang</Text>
                  </TouchableOpacity>
                </View>
              </>
            ) : null}
          </View>
        </View>
      </Modal>

      {/* Checkout Modal (Curved Rounded-t-3xl Presentation) */}
      <Modal
        visible={isCheckoutModalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setIsCheckoutModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            {/* Modal Header */}
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>Keranjang Belanja</Text>
                <Text style={styles.modalSubtitle}>{shopProfile?.shop_name || 'Kasir Warung'}</Text>
              </View>
              <TouchableOpacity
                style={styles.modalCloseBtn}
                onPress={() => setIsCheckoutModalVisible(false)}
              >
                <Ionicons name="close" color={Colors.text} size={20} />
              </TouchableOpacity>
            </View>

            {/* Delivery / Order Estimate Banner (Low-opacity Theme Background) */}
            <View style={styles.deliveryEstimateBanner}>
              <View style={styles.deliveryIconCircle}>
                <Ionicons name="cart" size={20} color={Colors.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.deliveryEstimateTitle}>{shopProfile?.shop_name || 'LabaNotera POS'}</Text>
                <Text style={styles.deliveryEstimateSub}>{cart.length} jenis barang di keranjang</Text>
              </View>
              <TouchableOpacity onPress={() => setIsCheckoutModalVisible(false)}>
                <Text style={styles.changeEstimateText}>+ Tambah Lagi</Text>
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalBody} showsVerticalScrollIndicator={false}>
              {/* Cart Items List */}
              <Text style={styles.sectionTitle}>Daftar Belanja</Text>
              {cart.map((item) => {
                const isKg = isKgProduct(item.product);
                return (
                  <View key={item.product.id} style={styles.cartRow}>
                    {/* Multiplier in Theme Color */}
                    <Text style={styles.itemMultiplierText}>
                      {formatQty(item.qty, isKg)} x
                    </Text>

                    <View style={{ flex: 1, paddingHorizontal: 8 }}>
                      <Text style={styles.cartRowTitle}>{item.product.name}</Text>
                      <Text style={styles.cartRowSub}>
                        {formatRupiah(item.product.sell_price)} {isKg ? '/ kg' : ''}
                      </Text>
                    </View>

                    <Text style={styles.cartItemTotalPrice}>
                      {formatRupiah(Math.round(item.product.sell_price * item.qty))}
                    </Text>

                    <View style={styles.qtyController}>
                      <TouchableOpacity
                        style={styles.qtyBtn}
                        onPress={() => updateCartQty(item.product.id, -1)}
                      >
                        <Ionicons name="remove" color={Colors.text} size={13} />
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={styles.qtyBtn}
                        onPress={() => updateCartQty(item.product.id, 1)}
                      >
                        <Ionicons name="add" color={Colors.text} size={13} />
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.qtyBtn, { backgroundColor: Colors.dangerLight, marginLeft: 4 }]}
                        onPress={() => removeFromCart(item.product.id)}
                      >
                        <Ionicons name="trash-outline" color={Colors.danger} size={13} />
                      </TouchableOpacity>
                    </View>
                  </View>
                );
              })}

              <View style={styles.divider} />

              {/* Total Display */}
              <View style={styles.totalDisplayBox}>
                <Text style={styles.totalDisplayLabel}>TOTAL TAGIHAN</Text>
                <Text style={styles.totalDisplayValue}>{formatRupiah(totalCartPrice)}</Text>
              </View>

              {/* Payment Method Selector */}
              <Text style={styles.sectionTitle}>Metode Pembayaran</Text>
              <View style={styles.methodContainer}>
                <TouchableOpacity
                  style={[styles.methodCard, paymentMethod === 'CASH' && styles.methodCardActive]}
                  onPress={() => setPaymentMethod('CASH')}
                >
                  <Text style={[styles.methodText, paymentMethod === 'CASH' && styles.methodTextActive]}>
                    Tunai/Cash
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.methodCard, paymentMethod === 'QRIS' && styles.methodCardActive]}
                  onPress={() => setPaymentMethod('QRIS')}
                >
                  <Text style={[styles.methodText, paymentMethod === 'QRIS' && styles.methodTextActive]}>
                    QRIS
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.methodCard, paymentMethod === 'UTANG' && styles.methodCardUtangActive]}
                  onPress={() => setPaymentMethod('UTANG')}
                >
                  <Text style={[styles.methodText, paymentMethod === 'UTANG' && styles.methodTextUtangActive]}>
                    Utang
                  </Text>
                </TouchableOpacity>
              </View>

              {/* CASH Payment Quick Buttons & Calculator */}
              {paymentMethod === 'CASH' ? (
                <View style={styles.cashCalculatorContainer}>
                  <Text style={styles.inputLabel}>Uang Tunai Diterima:</Text>
                  <TextInput
                      style={styles.cashInput}
                      keyboardType="numeric"
                      placeholder="Rp 0"
                      value={cashAmountInput}
                      onChangeText={(text) => {
                        setCashAmountInput(formatRupiah(text));
                      }}
                    />

                  {/* Quick Cash Buttons */}
                  <View style={styles.quickCashRow}>
                    <TouchableOpacity
                      style={styles.quickCashBtn}
                      onPress={() => setCashAmountInput(formatRupiah(totalCartPrice))}
                    >
                      <Text style={styles.quickCashBtnText}>Uang Pas</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.quickCashBtn}
                      onPress={() => setCashAmountInput(formatRupiah(10000))}
                    >
                      <Text style={styles.quickCashBtnText}>10rb</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.quickCashBtn}
                      onPress={() => setCashAmountInput(formatRupiah(20000))}
                    >
                      <Text style={styles.quickCashBtnText}>20rb</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.quickCashBtn}
                      onPress={() => setCashAmountInput(formatRupiah(50000))}
                    >
                      <Text style={styles.quickCashBtnText}>50rb</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.quickCashBtn}
                      onPress={() => setCashAmountInput(formatRupiah(100000))}
                    >
                      <Text style={styles.quickCashBtnText}>100rb</Text>
                    </TouchableOpacity>
                  </View>

                  {/* Change / Shortfall */}
                  {numericCashPaid > 0 ? (
                    <View style={styles.changeBox}>
                      <Text style={styles.changeLabel}>
                        {changeAmount < 0 ? 'Kurang:' : 'Uang Kembalian:'}
                      </Text>
                      <Text style={styles.changeValue}>
                        {formatRupiah(Math.abs(changeAmount))}
                      </Text>
                    </View>
                  ) : null}

                  {/* Info text when short */}
                  {isCashShort ? (
                    <Text style={styles.shortfallInfoText}>
                      Uang kurang Rp {shortfallAmount.toLocaleString('id-ID')} akan otomatis dicatat ke Buku Utang.
                    </Text>
                  ) : null}
                </View>
              ) : null}

              {/* QRIS & Transfer Bank Details Section */}
              {paymentMethod === 'QRIS' ? (
                <View style={styles.qrisSectionContainer}>
                  <View style={styles.qrisSectionHeader}>
                    <Text style={styles.inputLabel}>Pembayaran QRIS & Transfer Bank</Text>
                  </View>

                  {/* QRIS Image if configured */}
                  {shopProfile?.qris_image_uri ? (
                    <View style={styles.qrisImageCard}>
                      <Image
                        source={{ uri: shopProfile.qris_image_uri }}
                        style={styles.qrisDisplayImage}
                        resizeMode="contain"
                      />
                      <Text style={styles.qrisScanHint}>Scan barcode QRIS di atas untuk membayar</Text>
                    </View>
                  ) : null}

                  {/* Bank Account Transfer Details if configured */}
                  {shopProfile?.bank_account_number ? (
                    <View style={styles.bankAccountCard}>
                      <View style={styles.bankAccountHeader}>
                        <View style={styles.bankBadge}>
                          <Text style={styles.bankBadgeText}>{shopProfile.bank_name || 'BANK'}</Text>
                        </View>
                        <Text style={styles.bankTransferLabel}>Transfer Rekening</Text>
                      </View>
                      <Text style={styles.bankAccountNumber}>{shopProfile.bank_account_number}</Text>
                      {shopProfile?.bank_account_holder ? (
                        <Text style={styles.bankAccountHolder}>a.n. {shopProfile.bank_account_holder}</Text>
                      ) : null}
                    </View>
                  ) : null}

                  {!shopProfile?.qris_image_uri && !shopProfile?.bank_account_number ? (
                    <View style={styles.qrisEmptyBox}>
                      <Ionicons name="qr-code-outline" color={Colors.textMuted} size={32} />
                      <Text style={styles.qrisEmptyTitle}>QRIS & Rekening Belum Diatur</Text>
                      <Text style={styles.qrisEmptySub}>
                        Upload foto barcode QRIS atau isi nomor rekening di menu Profil (layar Beranda) agar tampil otomatis di sini.
                      </Text>
                    </View>
                  ) : null}
                </View>
              ) : null}

              {/* Customer Name & Phone Form */}
              {isCustomerNameRequired ? (
                <View style={styles.utangFormContainer}>
                  <View style={styles.utangRequiredHeader}>
                    <Ionicons name="alert-circle" color={Colors.danger} size={18} />
                    <Text style={styles.utangRequiredTitle}>Wajib Diisi Untuk Catatan Kasbon / Utang</Text>
                  </View>

                  <Text style={styles.inputLabel}>
                    Nama Pelanggan (Wajib): <Text style={{ color: Colors.danger }}>*</Text>
                  </Text>
                  <View style={[styles.inputWithIcon, !customerName.trim() && styles.inputRequiredBorder]}>
                    <Ionicons name="person-outline" color={Colors.textMuted} size={18} />
                    <TextInput
                      style={styles.iconInput}
                      placeholder="Masukkan nama pelanggan..."
                      value={customerName}
                      onChangeText={setCustomerName}
                    />
                  </View>

                  <Text style={[styles.inputLabel, { marginTop: 10 }]}>
                    No. HP / WhatsApp (Wajib): <Text style={{ color: Colors.danger }}>*</Text>
                  </Text>
                  <View style={[styles.inputWithIcon, !customerPhone.trim() && styles.inputRequiredBorder]}>
                    <Ionicons name="call-outline" color={Colors.textMuted} size={18} />
                    <TextInput
                      style={styles.iconInput}
                      keyboardType="phone-pad"
                      placeholder="Contoh: 08123456789"
                      value={customerPhone}
                      onChangeText={setCustomerPhone}
                    />
                  </View>
                  <Text style={styles.utangHelperText}>
                    * Nomor HP/WA wajib diisi agar tagihan tercatat dan dapat dikirimi pengingat WhatsApp.
                  </Text>
                </View>
              ) : null}
            </ScrollView>

            {/* Modal Footer Submit */}
            <View style={styles.modalFooter}>
              {isCashInputEmpty ? (
                <Text style={styles.submitHintText}>Masukkan nominal uang yang diterima terlebih dahulu</Text>
              ) : null}
              <TouchableOpacity
                style={[
                  styles.submitButton,
                  styles.submitButtonPrimary,
                  (isSubmitting || isCashInputEmpty) && styles.submitButtonDisabled,
                ]}
                onPress={handleFinalCheckout}
                disabled={isSubmitting || isCashInputEmpty}
              >
                <Ionicons name="checkmark-circle-outline" color="#FFFFFF" size={22} />
                <Text style={styles.submitButtonText}>{submitButtonLabel}</Text>
              </TouchableOpacity>
            </View>
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
  searchHeader: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 8,
    gap: 10,
    alignItems: 'center',
  },
  searchInputContainer: {
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
  scanButton: {
    width: 46,
    height: 46,
    backgroundColor: Colors.primary,
    borderRadius: Radius.full,
    justifyContent: 'center',
    alignItems: 'center',
    ...Shadows.glow(0.2),
  },
  categoriesBar: {
    backgroundColor: 'transparent',
    paddingVertical: 6,
  },
  filterScrollContent: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 16,
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
    fontSize: 13,
    color: Colors.categoryInactiveText,
    fontWeight: '600',
  },
  filterChipTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  listContent: {
    padding: 10,
    paddingBottom: 110,
  },
  productCard: {
    flex: 1,
    margin: 6,
    backgroundColor: '#FFFFFF',
    borderRadius: Radius.xl3,
    padding: 14,
    borderWidth: 1,
    borderColor: '#F3F4F6',
    justifyContent: 'space-between',
    minHeight: 155,
    ...Shadows.card,
  },
  productCardDisabled: {
    opacity: 0.5,
    backgroundColor: '#F3F4F6',
  },
  cardHeaderArea: {
    marginBottom: 4,
  },
  badgeContainerRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
    marginBottom: 4,
  },
  badgeTitipan: {
    backgroundColor: Colors.secondaryLight,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: Radius.full,
  },
  badgeTitipanText: {
    fontSize: 9,
    color: Colors.secondary,
    fontWeight: '700',
  },
  badgeKg: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.successLight,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: Radius.full,
    gap: 3,
  },
  badgeKgText: {
    fontSize: 9,
    color: Colors.success,
    fontWeight: '700',
  },
  badgeLowStock: {
    backgroundColor: Colors.dangerLight,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: Radius.full,
  },
  badgeLowStockText: {
    fontSize: 9,
    color: Colors.danger,
    fontWeight: '700',
  },
  productName: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.text,
    marginBottom: 6,
    lineHeight: 18,
  },
  priceRow: {
    marginBottom: 10,
  },
  productPrice: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.primary,
  },
  productStock: {
    fontSize: 11,
    color: Colors.textMuted,
    marginTop: 2,
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.primary,
    borderRadius: Radius.full,
    paddingVertical: 8,
    paddingHorizontal: 12,
    gap: 5,
    ...Shadows.glow(0.2),
  },
  addButtonKg: {
    backgroundColor: Colors.success,
  },
  addButtonText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  inCartStepper: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.primaryLight,
    borderRadius: Radius.full,
    paddingHorizontal: 4,
    paddingVertical: 4,
  },
  stepperBtn: {
    width: 26,
    height: 26,
    borderRadius: Radius.full,
    backgroundColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  stepperQtyText: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.primaryDark,
    paddingHorizontal: 4,
  },
  emptyContainer: {
    padding: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    marginTop: 12,
    fontSize: 14,
    color: Colors.textMuted,
  },
  cartFloatingBar: {
    position: 'absolute',
    bottom: 14,
    left: 16,
    right: 16,
    backgroundColor: Colors.primary,
    borderRadius: Radius.full,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    ...Shadows.glow(0.35),
  },
  cartCountCircle: {
    width: 32,
    height: 32,
    borderRadius: Radius.full,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  cartCountCircleText: {
    color: Colors.primary,
    fontSize: 13,
    fontWeight: '800',
  },
  cartViewCartText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  cartTotalValue: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
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
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: Colors.text,
  },
  modalSubtitle: {
    fontSize: 12,
    color: Colors.textMuted,
    marginTop: 2,
  },
  modalCloseBtn: {
    width: 34,
    height: 34,
    borderRadius: Radius.full,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  deliveryEstimateBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.primaryLight,
    borderRadius: Radius.xl,
    padding: 12,
    marginBottom: 14,
    gap: 10,
  },
  deliveryIconCircle: {
    width: 38,
    height: 38,
    borderRadius: Radius.full,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  deliveryEstimateTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.text,
  },
  deliveryEstimateSub: {
    fontSize: 11,
    color: Colors.textSecondary,
  },
  changeEstimateText: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.primary,
  },
  modalBody: {
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.textSecondary,
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  cartRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  itemMultiplierText: {
    fontSize: 13,
    fontWeight: '800',
    color: Colors.primary,
    minWidth: 32,
  },
  cartRowTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.text,
  },
  cartRowSub: {
    fontSize: 11,
    color: Colors.textMuted,
    marginTop: 2,
  },
  cartItemTotalPrice: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.text,
    marginRight: 8,
  },
  qtyController: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  qtyBtn: {
    width: 26,
    height: 26,
    backgroundColor: '#F3F4F6',
    borderRadius: Radius.full,
    justifyContent: 'center',
    alignItems: 'center',
  },
  divider: {
    height: 1,
    backgroundColor: '#F3F4F6',
    marginVertical: 12,
  },
  totalDisplayBox: {
    backgroundColor: Colors.primarySoft,
    borderWidth: 1,
    borderColor: '#FED7AA',
    padding: 16,
    borderRadius: Radius.xl2,
    alignItems: 'center',
    marginBottom: 14,
  },
  totalDisplayLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.primaryDark,
    letterSpacing: 0.5,
  },
  totalDisplayValue: {
    fontSize: 24,
    fontWeight: '800',
    color: Colors.primaryDark,
    marginTop: 2,
  },
  methodContainer: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 14,
  },
  methodCard: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
    backgroundColor: '#FAFAFA',
  },
  methodCardActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  methodCardUtangActive: {
    backgroundColor: Colors.danger,
    borderColor: Colors.danger,
  },
  methodText: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.textSecondary,
    textAlign: 'center',
  },
  methodTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  methodTextUtangActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  cashCalculatorContainer: {
    marginBottom: 12,
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.textSecondary,
    marginBottom: 4,
  },
  cashInput: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.lg,
    paddingHorizontal: 12,
    height: 44,
    fontSize: 16,
    fontWeight: '700',
    color: Colors.text,
    backgroundColor: '#FAFAFA',
  },
  quickCashRow: {
    flexDirection: 'row',
    gap: 6,
    marginTop: 8,
    marginBottom: 10,
  },
  quickCashBtn: {
    flex: 1,
    backgroundColor: '#F3F4F6',
    paddingVertical: 7,
    borderRadius: Radius.full,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  quickCashBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.textSecondary,
  },
  changeBox: {
    padding: 12,
    borderRadius: Radius.lg,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  changeLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.text,
  },
  changeValue: {
    fontSize: 16,
    fontWeight: '800',
    color: Colors.text,
  },
  shortfallInfoText: {
    fontSize: 11,
    color: Colors.textSecondary,
    marginTop: 6,
    lineHeight: 16,
  },
  inputWithIcon: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.lg,
    paddingHorizontal: 10,
    height: 44,
    backgroundColor: '#FAFAFA',
  },
  iconInput: {
    flex: 1,
    marginLeft: 8,
    fontSize: 14,
    color: Colors.text,
  },
  modalFooter: {
    marginTop: 6,
  },
  submitButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 15,
    borderRadius: Radius.full,
    gap: 8,
    ...Shadows.glow(0.25),
  },
  submitButtonPrimary: {
    backgroundColor: Colors.primary,
  },
  submitButtonGreen: {
    backgroundColor: Colors.primary,
  },
  submitButtonWarning: {
    backgroundColor: Colors.primary,
  },
  submitButtonUtang: {
    backgroundColor: Colors.danger,
  },
  submitButtonDisabled: {
    opacity: 0.45,
  },
  submitButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
    textAlign: 'center',
  },
  submitHintText: {
    fontSize: 11,
    color: Colors.textMuted,
    textAlign: 'center',
    marginBottom: 6,
  },
  shortfallBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
    backgroundColor: '#FEF3C7',
    borderWidth: 1,
    borderColor: '#FDE68A',
    borderRadius: Radius.lg,
    padding: 10,
    marginTop: 8,
  },
  shortfallBannerText: {
    flex: 1,
    fontSize: 12,
    color: '#92400E',
    lineHeight: 17,
  },
  utangFormContainer: {
    marginBottom: 12,
    padding: 14,
    backgroundColor: '#FAFAFA',
    borderRadius: Radius.xl,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  utangFormHighlight: {
    backgroundColor: '#FFFBEB',
    borderColor: '#FDE68A',
  },
  inputHighlightBorder: {
    borderColor: Colors.warning,
    borderWidth: 1.5,
  },
  qrisSectionContainer: {
    marginBottom: 14,
  },
  qrisSectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  editProfileLinkText: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.primary,
  },
  qrisImageCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: Radius.xl,
    padding: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: 10,
  },
  qrisDisplayImage: {
    width: 220,
    height: 220,
    borderRadius: Radius.lg,
    backgroundColor: '#FFFFFF',
  },
  qrisScanHint: {
    fontSize: 11,
    color: Colors.textMuted,
    marginTop: 8,
    textAlign: 'center',
  },
  bankAccountCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: Radius.xl,
    padding: 14,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: 8,
  },
  bankAccountHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
  },
  bankBadge: {
    backgroundColor: Colors.primaryDark,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: Radius.full,
  },
  bankBadgeText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
  },
  bankTransferLabel: {
    fontSize: 12,
    color: Colors.textMuted,
    fontWeight: '600',
  },
  bankAccountNumber: {
    fontSize: 18,
    fontWeight: '800',
    color: Colors.text,
    letterSpacing: 1,
  },
  bankAccountHolder: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  qrisEmptyBox: {
    backgroundColor: '#FFFFFF',
    borderRadius: Radius.xl,
    padding: 20,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  qrisEmptyTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.text,
    marginTop: 8,
  },
  qrisEmptySub: {
    fontSize: 11,
    color: Colors.textMuted,
    textAlign: 'center',
    marginTop: 4,
    marginBottom: 12,
    lineHeight: 16,
  },
  qrisSetupBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.primary,
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: Radius.full,
    gap: 6,
    ...Shadows.glow(0.2),
  },
  qrisSetupBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  weightModalContent: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    maxHeight: '92%',
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 24,
    display: 'flex',
    flexDirection: 'column',
  },
  weightScrollBody: {
    paddingVertical: 6,
    paddingBottom: 16,
  },
  weightBottomStickyContainer: {
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F2',
  },
  weightHeaderIconBg: {
    width: 36,
    height: 36,
    borderRadius: Radius.full,
    backgroundColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  weightProductHeader: {
    backgroundColor: '#F8FAF8',
    borderRadius: Radius.xl,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E5E9E6',
    marginTop: 4,
    marginBottom: 6,
  },
  weightProductName: {
    fontSize: 16,
    fontWeight: '800',
    color: Colors.text,
  },
  weightProductMeta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 6,
  },
  weightProductPrice: {
    fontSize: 15,
    fontWeight: '800',
    color: Colors.primaryDark,
  },
  weightStockBadge: {
    backgroundColor: '#ECFDF5',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: Radius.full,
    borderWidth: 1,
    borderColor: '#A7F3D0',
  },
  weightStockBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.primaryDark,
  },
  weightSectionTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.textSecondary,
    marginTop: 8,
    marginBottom: 6,
  },
  fractionGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 10,
  },
  fractionBtn: {
    width: '31.3%',
    backgroundColor: '#FFFFFF',
    borderRadius: Radius.lg,
    borderWidth: 1.5,
    borderColor: Colors.border,
    paddingVertical: 8,
    paddingHorizontal: 4,
    alignItems: 'center',
    ...Shadows.soft,
  },
  fractionBtnActive: {
    backgroundColor: '#ECFDF5',
    borderColor: Colors.primary,
    ...Shadows.glow(0.12),
  },
  fractionBtnText: {
    fontSize: 13,
    fontWeight: '800',
    color: Colors.text,
  },
  fractionBtnTextActive: {
    color: Colors.primaryDark,
  },
  fractionBtnSub: {
    fontSize: 10,
    color: Colors.textMuted,
    marginTop: 1,
  },
  fractionBtnSubActive: {
    color: Colors.primaryDark,
    fontWeight: '600',
  },
  fractionBtnPrice: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.primaryDark,
    marginTop: 3,
  },
  fractionBtnPriceActive: {
    color: Colors.primary,
    fontWeight: '800',
  },
  quickNominalRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 8,
  },
  quickNominalChip: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: Radius.full,
    backgroundColor: '#F1F5F2',
    borderWidth: 1,
    borderColor: '#E5E9E6',
  },
  quickNominalChipActive: {
    backgroundColor: Colors.secondaryLight,
    borderColor: Colors.secondary,
  },
  quickNominalChipText: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.textSecondary,
  },
  quickNominalChipTextActive: {
    color: Colors.secondary,
  },
  weightStepperBtn: {
    backgroundColor: '#F1F5F2',
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.md,
    paddingHorizontal: 10,
    paddingVertical: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  weightStepperBtnText: {
    fontSize: 12,
    fontWeight: '800',
    color: Colors.text,
  },
  unitBadge: {
    backgroundColor: '#F1F5F2',
    paddingHorizontal: 10,
    paddingVertical: 10,
    borderRadius: Radius.md,
  },
  unitBadgeText: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.textSecondary,
  },
  formLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.textSecondary,
    marginBottom: 6,
  },
  input: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.md,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: Colors.text,
  },
  customInputCard: {
    backgroundColor: '#FAFAF9',
    borderRadius: Radius.xl,
    borderWidth: 1,
    borderColor: Colors.borderLight,
    padding: 12,
    marginBottom: 10,
  },
  inputUnit: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.textSecondary,
    marginRight: 8,
  },
  inputHintSub: {
    fontSize: 10,
    color: Colors.textMuted,
    marginTop: 4,
    fontStyle: 'italic',
  },
  weightSummaryCard: {
    backgroundColor: '#F0FDF4',
    borderWidth: 1,
    borderColor: '#BBF7D0',
    borderRadius: Radius.xl,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginBottom: 10,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 3,
  },
  summaryLabel: {
    fontSize: 12,
    color: Colors.textSecondary,
    fontWeight: '600',
  },
  summaryValue: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.text,
  },
  utangRequiredHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 10,
    paddingBottom: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#FEE2E2',
  },
  utangRequiredTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.danger,
  },
  inputRequiredBorder: {
    borderColor: '#FECACA',
    backgroundColor: '#FFF5F5',
  },
  utangHelperText: {
    fontSize: 10,
    color: Colors.textMuted,
    marginTop: 6,
    lineHeight: 14,
  },
});
