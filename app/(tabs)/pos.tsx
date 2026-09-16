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
  SafeAreaView,
  Image,
} from 'react-native';
import { useAppSQLiteContext as useSQLiteContext } from '../../src/db/AppDatabaseProvider';
import { useRouter, useFocusEffect } from 'expo-router';
import { Product, CartItem, PaymentMethod, ShopProfile } from '../../src/types';
import { getProducts, searchProducts } from '../../src/services/productService';
import { processCheckout } from '../../src/services/posService';
import { getShopProfile } from '../../src/services/profileService';
import ProfileModal from '../../src/components/ProfileModal';
import { formatRupiah, parseRupiahToNumber, getProductCategory, isKgProduct, formatQty } from '../../src/utils/formatters';
import { getShadowStyle } from '../../src/utils/styleHelper';
import { Colors } from '../../src/constants/theme';
import { Ionicons } from '@expo/vector-icons';

export default function PosScreen() {
  const db = useSQLiteContext();
  const router = useRouter();

  const [products, setProducts] = useState<Product[]>([]);
  const [filteredProducts, setFilteredProducts] = useState<Product[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFilter, setSelectedFilter] = useState<
    'ALL' | 'SNACK' | 'MINUMAN' | 'BARANG_POKOK' | 'TITIPAN' | 'LOW_STOCK'
  >('ALL');

  // Cart state
  const [cart, setCart] = useState<CartItem[]>([]);
  const [isCheckoutModalVisible, setIsCheckoutModalVisible] = useState(false);

  // Weight picker modal state for items sold by kg / weight
  const [selectedKgProduct, setSelectedKgProduct] = useState<Product | null>(null);
  const [isWeightModalVisible, setIsWeightModalVisible] = useState(false);
  const [customWeightInput, setCustomWeightInput] = useState('');
  const [customMoneyInput, setCustomMoneyInput] = useState('');
  const [selectedWeight, setSelectedWeight] = useState<number>(1);

  // Shop Profile state (QRIS and Bank Account)
  const [shopProfile, setShopProfile] = useState<ShopProfile | null>(null);
  const [isProfileModalVisible, setIsProfileModalVisible] = useState(false);

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
    } else if (selectedFilter === 'LOW_STOCK') {
      result = result.filter((p) => p.stock < 5);
    } else if (
      selectedFilter === 'SNACK' ||
      selectedFilter === 'MINUMAN' ||
      selectedFilter === 'BARANG_POKOK'
    ) {
      result = result.filter((p) => getProductCategory(p) === selectedFilter);
    }
    setFilteredProducts(result);
  }, [products, selectedFilter]);

  // Cart operations
  const addToCart = (product: Product, qtyToAdd: number = 1) => {
    if (product.stock <= 0) {
      Alert.alert('Stok Habis', `Stok ${product.name} telah habis!`);
      return;
    }

    setCart((prev) => {
      const existing = prev.find((item) => item.product.id === product.id);
      if (existing) {
        const newTotal = existing.qty + qtyToAdd;
        if (newTotal > product.stock) {
          Alert.alert('Batas Stok', `Jumlah di keranjang melebihi stok yang ada (${product.stock}).`);
          return prev;
        }
        return prev.map((item) =>
          item.product.id === product.id ? { ...item, qty: newTotal } : item
        );
      }
      return [...prev, { product, qty: qtyToAdd }];
    });
  };

  const openWeightModal = (product: Product, initialQty?: number) => {
    if (product.stock <= 0) {
      Alert.alert('Stok Habis', `Stok ${product.name} telah habis!`);
      return;
    }
    const existing = cart.find((item) => item.product.id === product.id);
    const currentQty = initialQty !== undefined ? initialQty : (existing ? existing.qty : 1);
    setSelectedKgProduct(product);
    setSelectedWeight(currentQty);
    setCustomWeightInput(String(currentQty));
    setCustomMoneyInput(formatRupiah(Math.round(product.sell_price * currentQty)));
    setIsWeightModalVisible(true);
  };

  const handleProductPress = (product: Product) => {
    if (product.stock <= 0) {
      Alert.alert('Stok Habis', `Stok ${product.name} telah habis!`);
      return;
    }

    if (isKgProduct(product)) {
      openWeightModal(product);
    } else {
      addToCart(product);
    }
  };

  const handleSelectWeightPreset = (presetWeight: number) => {
    if (!selectedKgProduct) return;
    setSelectedWeight(presetWeight);
    setCustomWeightInput(String(presetWeight));
    setCustomMoneyInput(formatRupiah(Math.round(selectedKgProduct.sell_price * presetWeight)));
  };

  const handleCustomWeightChange = (text: string) => {
    setCustomWeightInput(text);
    const parsed = parseFloat(text.replace(',', '.'));
    if (!isNaN(parsed) && parsed > 0) {
      setSelectedWeight(parsed);
      if (selectedKgProduct) {
        setCustomMoneyInput(formatRupiah(Math.round(selectedKgProduct.sell_price * parsed)));
      }
    } else {
      setSelectedWeight(0);
      setCustomMoneyInput('');
    }
  };

  const handleCustomMoneyChange = (text: string) => {
    const formatted = formatRupiah(text);
    setCustomMoneyInput(formatted);
    const num = parseRupiahToNumber(formatted);
    if (selectedKgProduct && num > 0) {
      const calculatedKg = Number((num / selectedKgProduct.sell_price).toFixed(3));
      setSelectedWeight(calculatedKg);
      setCustomWeightInput(String(calculatedKg));
    } else {
      setSelectedWeight(0);
      setCustomWeightInput('');
    }
  };

  const handleSaveWeightToCart = () => {
    if (!selectedKgProduct || selectedWeight <= 0) {
      Alert.alert('Jumlah Tidak Valid', 'Mohon pilih atau masukkan berat / nominal pembelian yang valid.');
      return;
    }
    if (selectedWeight > selectedKgProduct.stock) {
      Alert.alert(
        'Batas Stok',
        `Jumlah pembelian (${formatQty(selectedWeight, true)}) melebihi stok yang tersedia (${selectedKgProduct.stock} kg).`
      );
      return;
    }

    setCart((prev) => {
      const existingIndex = prev.findIndex((item) => item.product.id === selectedKgProduct.id);
      if (existingIndex >= 0) {
        const updated = [...prev];
        updated[existingIndex] = {
          ...updated[existingIndex],
          qty: selectedWeight,
        };
        return updated;
      } else {
        return [...prev, { product: selectedKgProduct, qty: selectedWeight }];
      }
    });

    setIsWeightModalVisible(false);
    setSelectedKgProduct(null);
  };

  const updateCartQty = (productId: number, delta: number) => {
    setCart((prev) =>
      prev
        .map((item) => {
          if (item.product.id === productId) {
            const isKg = isKgProduct(item.product);
            let step = delta;
            if (isKg) {
              if (delta > 0) {
                step = item.qty < 1 ? 0.25 : (item.qty % 1 !== 0 ? 0.25 : 1);
              } else {
                step = item.qty <= 1 ? -0.25 : (item.qty % 1 !== 0 ? -0.25 : -1);
              }
            }
            const newQty = Number((item.qty + step).toFixed(2));
            if (newQty > item.product.stock) {
              Alert.alert('Batas Stok', `Stok maksimum ${item.product.stock}`);
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
  const totalCartItems = cart.reduce((sum, item) => sum + (item.qty < 1 ? 1 : Math.round(item.qty)), 0);
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
        Alert.alert(
          'Nama Pelanggan Wajib Diisi',
          'Mohon masukkan nama pelanggan untuk mencatat transaksi utang / kasbon.'
        );
        return;
      }
      if (!customerPhone.trim()) {
        Alert.alert(
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
      Alert.alert('Gagal Transaksi', err.message || 'Terjadi kesalahan saat memproses checkout.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleFilterPress = (
    filter: 'ALL' | 'SNACK' | 'MINUMAN' | 'BARANG_POKOK' | 'TITIPAN'
  ) => {
    if (filter === 'ALL') {
      setSelectedFilter('ALL');
    } else {
      setSelectedFilter((prev) => (prev === filter ? 'ALL' : filter));
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header Search & Scanner Bar */}
      <View style={styles.searchHeader}>
        <View style={styles.searchInputContainer}>
          <Ionicons name="search-outline" color={Colors.textMuted} size={20} />
          <TextInput
            style={styles.searchInput}
            placeholder="Cari barang warung / scan barcode..."
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholderTextColor={Colors.textMuted}
          />
          {searchQuery ? (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <Ionicons name="close-circle-outline" color={Colors.textMuted} size={18} />
            </TouchableOpacity>
          ) : null}
        </View>

        <TouchableOpacity
          style={styles.scanButton}
          onPress={() => router.push('/scanner')}
        >
          <Ionicons name="qr-code-outline" color="#FFFFFF" size={22} />
        </TouchableOpacity>
      </View>

      {/* Categories Filter Horizontal Bar */}
      <View style={styles.categoriesBar}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterScrollContent}
        >
          <TouchableOpacity
            style={[styles.filterChip, selectedFilter === 'ALL' && styles.filterChipActive]}
            onPress={() => handleFilterPress('ALL')}
            activeOpacity={0.7}
          >
            <Text style={[styles.filterChipText, selectedFilter === 'ALL' && styles.filterChipTextActive]}>
              Semua Produk
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.filterChip, selectedFilter === 'SNACK' && styles.filterChipActive]}
            onPress={() => handleFilterPress('SNACK')}
            activeOpacity={0.7}
          >
            <Text style={[styles.filterChipText, selectedFilter === 'SNACK' && styles.filterChipTextActive]}>
              Snack / Jajanan
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.filterChip, selectedFilter === 'MINUMAN' && styles.filterChipActive]}
            onPress={() => handleFilterPress('MINUMAN')}
            activeOpacity={0.7}
          >
            <Text style={[styles.filterChipText, selectedFilter === 'MINUMAN' && styles.filterChipTextActive]}>
              Minuman
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.filterChip, selectedFilter === 'BARANG_POKOK' && styles.filterChipActive]}
            onPress={() => handleFilterPress('BARANG_POKOK')}
            activeOpacity={0.7}
          >
            <Text style={[styles.filterChipText, selectedFilter === 'BARANG_POKOK' && styles.filterChipTextActive]}>
              Barang Pokok
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.filterChip, selectedFilter === 'TITIPAN' && styles.filterChipActive]}
            onPress={() => handleFilterPress('TITIPAN')}
            activeOpacity={0.7}
          >
            <Text style={[styles.filterChipText, selectedFilter === 'TITIPAN' && styles.filterChipTextActive]}>
              Barang Titipan
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
              activeOpacity={0.8}
            >
              <View style={styles.badgeContainerRow}>
                {item.is_consignment === 1 ? (
                  <View style={styles.badgeTitipan}>
                    <Text style={styles.badgeTitipanText}>Titipan ({item.supplier_name || 'Tetangga'})</Text>
                  </View>
                ) : null}

                {isKg ? (
                  <View style={styles.badgeKg}>
                    <Ionicons name="scale-outline" size={11} color="#047857" />
                    <Text style={styles.badgeKgText}>Bisa 1/4 kg / Custom</Text>
                  </View>
                ) : null}
              </View>

              {item.stock < 5 ? (
                <View style={styles.badgeLowStock}>
                  <Text style={styles.badgeLowStockText}>Stok: {item.stock}</Text>
                </View>
              ) : null}

              <Text style={styles.productName} numberOfLines={2}>
                {item.name}
              </Text>

              <View style={styles.priceRow}>
                <Text style={styles.productPrice}>
                  {formatRupiah(item.sell_price)} {isKg ? '/ kg' : ''}
                </Text>
                <Text style={styles.productStock}>Stok: {item.stock} {isKg ? 'kg' : ''}</Text>
              </View>

              {inCartQty > 0 ? (
                <View style={styles.inCartBadge}>
                  <Text style={styles.inCartBadgeText}>{formatQty(inCartQty, isKg)} di keranjang</Text>
                </View>
              ) : (
                <View style={[styles.addButton, isKg && styles.addButtonKg]}>
                  <Ionicons name={isKg ? "scale-outline" : "add"} color="#FFFFFF" size={16} />
                  <Text style={styles.addButtonText}>{isKg ? "Beli Kg / Porsi" : "Tambah"}</Text>
                </View>  
              )}
            </TouchableOpacity>
          );
        }}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="alert-circle-outline" color={Colors.textMuted} size={48} />
            <Text style={styles.emptyText}>Belum ada barang di kategori ini</Text>
          </View>
        }
      />

      {/* Floating Cart Bar */}
      {cart.length > 0 ? (
        <View style={styles.cartFloatingBar}>
          <TouchableOpacity
            style={styles.cartInfoSection}
            onPress={() => setIsCheckoutModalVisible(true)}
          >
            <View style={styles.cartBadge}>
              <Ionicons name="cart-outline" color="#FFFFFF" size={20} />
              <View style={styles.cartCountBadge}>
                <Text style={styles.cartCountText}>{totalCartItems}</Text>
              </View>
            </View>
            <View style={styles.cartTotalTextContainer}>
              <Text style={styles.cartTotalLabel}>Total Belanja</Text>
              <Text style={styles.cartTotalValue}>{formatRupiah(totalCartPrice)}</Text>
            </View>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.checkoutButton}
            onPress={() => setIsCheckoutModalVisible(true)}
          >
            <Text style={styles.checkoutButtonText}>Bayar &gt;</Text>
          </TouchableOpacity>
        </View>
      ) : null}

      {/* Checkout Modal */}
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
              <Text style={styles.modalTitle}>Rincian Pembayaran Kasir</Text>
              <TouchableOpacity onPress={() => setIsCheckoutModalVisible(false)}>
                <Ionicons name="close" color={Colors.text} size={24} />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalBody}>
              {/* Cart Items List */}
              <Text style={styles.sectionTitle}>Daftar Belanja</Text>
              {cart.map((item) => {
                const itemIsKg = isKgProduct(item.product);
                return (
                  <View key={item.product.id} style={styles.cartRow}>
                    <TouchableOpacity
                      style={{ flex: 1 }}
                      onPress={() => {
                        if (itemIsKg) {
                          openWeightModal(item.product, item.qty);
                        }
                      }}
                      activeOpacity={itemIsKg ? 0.7 : 1}
                    >
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                        <Text style={styles.cartRowTitle}>{item.product.name}</Text>
                        {itemIsKg ? (
                          <Ionicons name="create-outline" color={Colors.primary} size={14} />
                        ) : null}
                      </View>
                      <Text style={styles.cartRowSub}>
                        {formatRupiah(item.product.sell_price)} x {formatQty(item.qty, itemIsKg)} = {formatRupiah(Math.round(item.product.sell_price * item.qty))}
                      </Text>
                    </TouchableOpacity>

                    <View style={styles.qtyController}>
                      <TouchableOpacity
                        style={styles.qtyBtn}
                        onPress={() => updateCartQty(item.product.id, -1)}
                      >
                        <Ionicons name="remove" color={Colors.text} size={14} />
                      </TouchableOpacity>
                      <TouchableOpacity
                        onPress={() => {
                          if (itemIsKg) {
                            openWeightModal(item.product, item.qty);
                          }
                        }}
                      >
                        <Text style={styles.qtyText}>{formatQty(item.qty, itemIsKg)}</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={styles.qtyBtn}
                        onPress={() => updateCartQty(item.product.id, 1)}
                      >
                        <Ionicons name="add" color={Colors.text} size={14} />
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.qtyBtn, { backgroundColor: Colors.dangerLight, marginLeft: 6 }]}
                        onPress={() => removeFromCart(item.product.id)}
                      >
                        <Ionicons name="trash-outline" color={Colors.danger} size={14} />
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
                        // Otomatis ter-format saat diketik
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

                  {/* Change / Shortfall — plain neutral display */}
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

                  {/* Info text when short — plain, no banner color */}
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
                    <TouchableOpacity onPress={() => setIsProfileModalVisible(true)}>
                      <Text style={styles.editProfileLinkText}>Ubah di Profil &gt;</Text>
                    </TouchableOpacity>
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
                      {shopProfile.bank_account_holder ? (
                        <Text style={styles.bankAccountHolder}>a.n. {shopProfile.bank_account_holder}</Text>
                      ) : null}
                    </View>
                  ) : null}

                  {!shopProfile?.qris_image_uri && !shopProfile?.bank_account_number ? (
                    <View style={styles.qrisEmptyBox}>
                      <Ionicons name="qr-code-outline" color={Colors.textMuted} size={32} />
                      <Text style={styles.qrisEmptyTitle}>QRIS & Rekening Belum Diisi</Text>
                      <Text style={styles.qrisEmptySub}>
                        Upload foto barcode QRIS atau isi nomor rekening di Profil Warung agar tampil otomatis di sini.
                      </Text>
                      <TouchableOpacity
                        style={styles.qrisSetupBtn}
                        onPress={() => setIsProfileModalVisible(true)}
                      >
                        <Ionicons name="settings-outline" color="#FFFFFF" size={16} />
                        <Text style={styles.qrisSetupBtnText}>Atur Profil Pembayaran</Text>
                      </TouchableOpacity>
                    </View>
                  ) : null}
                </View>
              ) : null}

              {/* Customer Name & Phone Form — MANDATORY when UTANG or when cash is short */}
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

            {/* Modal Footer Submit — single consistent color */}
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

      {/* Weight Picker Modal for Kg / Custom Weight Products */}
      <Modal
        visible={isWeightModalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setIsWeightModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.weightModalContent}>
            <View style={styles.modalHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Ionicons name="scale-outline" color={Colors.primaryDark} size={22} />
                <Text style={styles.modalTitle}>Beli Timbangan / Custom</Text>
              </View>
              <TouchableOpacity onPress={() => setIsWeightModalVisible(false)}>
                <Ionicons name="close" color={Colors.text} size={24} />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalBody}>
              {selectedKgProduct ? (
                <View style={styles.weightProductHeader}>
                  <Text style={styles.weightProductName}>{selectedKgProduct.name}</Text>
                  <View style={styles.weightProductMeta}>
                    <Text style={styles.weightProductPrice}>
                      {formatRupiah(selectedKgProduct.sell_price)} / kg
                    </Text>
                    <Text style={styles.weightProductStock}>
                      Stok: {selectedKgProduct.stock} kg
                    </Text>
                  </View>
                </View>
              ) : null}

              {/* Quick Fraction Buttons */}
              <Text style={styles.sectionTitle}>Pilih Porsi Timbangan Cepat:</Text>
              <View style={styles.fractionGrid}>
                <TouchableOpacity
                  style={[styles.fractionBtn, selectedWeight === 0.25 && styles.fractionBtnActive]}
                  onPress={() => handleSelectWeightPreset(0.25)}
                >
                  <Text style={[styles.fractionBtnText, selectedWeight === 0.25 && styles.fractionBtnTextActive]}>
                    1/4 kg
                  </Text>
                  <Text style={[styles.fractionBtnSub, selectedWeight === 0.25 && styles.fractionBtnSubActive]}>
                    0.25 kg
                  </Text>
                  {selectedKgProduct ? (
                    <Text style={[styles.fractionBtnPrice, selectedWeight === 0.25 && styles.fractionBtnPriceActive]}>
                      {formatRupiah(Math.round(selectedKgProduct.sell_price * 0.25))}
                    </Text>
                  ) : null}
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.fractionBtn, selectedWeight === 0.5 && styles.fractionBtnActive]}
                  onPress={() => handleSelectWeightPreset(0.5)}
                >
                  <Text style={[styles.fractionBtnText, selectedWeight === 0.5 && styles.fractionBtnTextActive]}>
                    1/2 kg
                  </Text>
                  <Text style={[styles.fractionBtnSub, selectedWeight === 0.5 && styles.fractionBtnSubActive]}>
                    0.5 kg
                  </Text>
                  {selectedKgProduct ? (
                    <Text style={[styles.fractionBtnPrice, selectedWeight === 0.5 && styles.fractionBtnPriceActive]}>
                      {formatRupiah(Math.round(selectedKgProduct.sell_price * 0.5))}
                    </Text>
                  ) : null}
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.fractionBtn, selectedWeight === 0.75 && styles.fractionBtnActive]}
                  onPress={() => handleSelectWeightPreset(0.75)}
                >
                  <Text style={[styles.fractionBtnText, selectedWeight === 0.75 && styles.fractionBtnTextActive]}>
                    3/4 kg
                  </Text>
                  <Text style={[styles.fractionBtnSub, selectedWeight === 0.75 && styles.fractionBtnSubActive]}>
                    0.75 kg
                  </Text>
                  {selectedKgProduct ? (
                    <Text style={[styles.fractionBtnPrice, selectedWeight === 0.75 && styles.fractionBtnPriceActive]}>
                      {formatRupiah(Math.round(selectedKgProduct.sell_price * 0.75))}
                    </Text>
                  ) : null}
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.fractionBtn, selectedWeight === 1 && styles.fractionBtnActive]}
                  onPress={() => handleSelectWeightPreset(1)}
                >
                  <Text style={[styles.fractionBtnText, selectedWeight === 1 && styles.fractionBtnTextActive]}>
                    1 kg
                  </Text>
                  <Text style={[styles.fractionBtnSub, selectedWeight === 1 && styles.fractionBtnSubActive]}>
                    1.0 kg
                  </Text>
                  {selectedKgProduct ? (
                    <Text style={[styles.fractionBtnPrice, selectedWeight === 1 && styles.fractionBtnPriceActive]}>
                      {formatRupiah(selectedKgProduct.sell_price)}
                    </Text>
                  ) : null}
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.fractionBtn, selectedWeight === 2 && styles.fractionBtnActive]}
                  onPress={() => handleSelectWeightPreset(2)}
                >
                  <Text style={[styles.fractionBtnText, selectedWeight === 2 && styles.fractionBtnTextActive]}>
                    2 kg
                  </Text>
                  <Text style={[styles.fractionBtnSub, selectedWeight === 2 && styles.fractionBtnSubActive]}>
                    2.0 kg
                  </Text>
                  {selectedKgProduct ? (
                    <Text style={[styles.fractionBtnPrice, selectedWeight === 2 && styles.fractionBtnPriceActive]}>
                      {formatRupiah(selectedKgProduct.sell_price * 2)}
                    </Text>
                  ) : null}
                </TouchableOpacity>
              </View>

              {/* Custom Weight / Nominal Inputs */}
              <Text style={styles.sectionTitle}>Atau Masukkan Sesuai Keinginan Pembeli:</Text>
              
              <View style={styles.customInputCard}>
                <Text style={styles.inputLabel}>1. Masukkan Berat Bebas (kg):</Text>
                <View style={styles.inputWithIcon}>
                  <Ionicons name="scale-outline" color={Colors.textMuted} size={18} />
                  <TextInput
                    style={styles.iconInput}
                    keyboardType="numeric"
                    placeholder="Contoh: 0.3 atau 1.5"
                    value={customWeightInput}
                    onChangeText={handleCustomWeightChange}
                  />
                  <Text style={styles.inputUnit}>kg</Text>
                </View>

                <Text style={[styles.inputLabel, { marginTop: 12 }]}>2. Atau Beli Seharga (Nominal Rp):</Text>
                <View style={styles.inputWithIcon}>
                  <Ionicons name="cash-outline" color={Colors.textMuted} size={18} />
                  <TextInput
                    style={styles.iconInput}
                    keyboardType="numeric"
                    placeholder="Contoh: Rp 10.000"
                    value={customMoneyInput}
                    onChangeText={handleCustomMoneyChange}
                  />
                </View>
                <Text style={styles.inputHintSub}>
                  * Masukkan jika pembeli bilang misal: &quot;Beli beras Rp 10.000&quot;
                </Text>
              </View>

              {/* Calculation Result Preview */}
              {selectedKgProduct && selectedWeight > 0 ? (
                <View style={styles.weightSummaryCard}>
                  <View style={styles.summaryRow}>
                    <Text style={styles.summaryLabel}>Total Berat:</Text>
                    <Text style={styles.summaryValue}>{formatQty(selectedWeight, true)}</Text>
                  </View>
                  <View style={styles.summaryRow}>
                    <Text style={styles.summaryLabel}>Harga / kg:</Text>
                    <Text style={styles.summaryValue}>{formatRupiah(selectedKgProduct.sell_price)}</Text>
                  </View>
                  <View style={styles.divider} />
                  <View style={styles.summaryRow}>
                    <Text style={[styles.summaryLabel, { fontWeight: 'bold', color: Colors.primaryDark }]}>
                      Total Tagihan:
                    </Text>
                    <Text style={[styles.summaryValue, { fontSize: 18, fontWeight: 'bold', color: Colors.primaryDark }]}>
                      {formatRupiah(Math.round(selectedKgProduct.sell_price * selectedWeight))}
                    </Text>
                  </View>
                </View>
              ) : null}
            </ScrollView>

            <View style={styles.modalFooter}>
              <TouchableOpacity
                style={[styles.submitButton, styles.submitButtonPrimary, (!selectedWeight || selectedWeight <= 0) && styles.submitButtonDisabled]}
                onPress={handleSaveWeightToCart}
                disabled={!selectedWeight || selectedWeight <= 0}
              >
                <Ionicons name="cart-outline" color="#FFFFFF" size={20} />
                <Text style={styles.submitButtonText}>
                  Simpan ke Keranjang ({selectedWeight > 0 && selectedKgProduct ? formatRupiah(Math.round(selectedKgProduct.sell_price * selectedWeight)) : 'Pilih Berat'})
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Warung Profile Modal */}
      <ProfileModal
        visible={isProfileModalVisible}
        onClose={() => setIsProfileModalVisible(false)}
        onProfileUpdated={(updated) => setShopProfile(updated)}
      />
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
    padding: 12,
    backgroundColor: Colors.background,
    gap: 10,
    alignItems: 'center',
  },
  searchInputContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F1F5F9',
    borderRadius: 10,
    paddingHorizontal: 12,
    height: 44,
  },
  searchInput: {
    flex: 1,
    marginLeft: 8,
    fontSize: 14,
    color: Colors.text,
  },
  scanButton: {
    width: 44,
    height: 44,
    backgroundColor: Colors.primary,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  categoriesBar: {
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    paddingVertical: 8,
  },
  filterScrollContent: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 12,
  },
  filterChip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  filterChipActive: {
    backgroundColor: Colors.primaryDark,
    borderColor: Colors.primaryDark,
  },
  filterChipText: {
    fontSize: 12,
    color: Colors.textSecondary,
    fontWeight: '500',
  },
  filterChipTextActive: {
    color: '#FFFFFF',
    fontWeight: 'bold',
  },
  listContent: {
    padding: 8,
    paddingBottom: 100,
  },
  productCard: {
    flex: 1,
    margin: 4,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    justifyContent: 'space-between',
    minHeight: 130,
    ...getShadowStyle(2),
  },
  productCardDisabled: {
    opacity: 0.5,
    backgroundColor: '#F1F5F9',
  },
  badgeTitipan: {
    alignSelf: 'flex-start',
    backgroundColor: Colors.secondaryLight,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    marginBottom: 4,
  },
  badgeTitipanText: {
    fontSize: 10,
    color: Colors.secondary,
    fontWeight: 'bold',
  },
  badgeLowStock: {
    alignSelf: 'flex-start',
    backgroundColor: Colors.dangerLight,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    marginBottom: 4,
  },
  badgeLowStockText: {
    fontSize: 10,
    color: Colors.danger,
    fontWeight: 'bold',
  },
  productName: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: 6,
  },
  priceRow: {
    marginBottom: 8,
  },
  productPrice: {
    fontSize: 15,
    fontWeight: 'bold',
    color: Colors.primaryDark,
  },
  productStock: {
    fontSize: 11,
    color: Colors.textMuted,
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.primary,
    borderRadius: 6,
    paddingVertical: 6,
    gap: 4,
  },
  addButtonText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: 'bold',
  },
  inCartBadge: {
    backgroundColor: Colors.primaryLight,
    borderRadius: 6,
    paddingVertical: 6,
    alignItems: 'center',
  },
  inCartBadgeText: {
    color: Colors.primaryDark,
    fontSize: 12,
    fontWeight: 'bold',
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
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: Colors.primaryDark,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    ...getShadowStyle(8),
  },
  cartInfoSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  cartBadge: {
    width: 44,
    height: 44,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cartCountBadge: {
    position: 'absolute',
    top: -2,
    right: -2,
    backgroundColor: Colors.secondary,
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  cartCountText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: 'bold',
  },
  cartTotalTextContainer: {},
  cartTotalLabel: {
    color: '#E2E8F0',
    fontSize: 11,
  },
  cartTotalValue: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: 'bold',
  },
  checkoutButton: {
    backgroundColor: Colors.accent,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  checkoutButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: 'bold',
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
  modalBody: {
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: Colors.textSecondary,
    marginTop: 10,
    marginBottom: 8,
  },
  cartRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  cartRowTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.text,
  },
  cartRowSub: {
    fontSize: 12,
    color: Colors.textMuted,
    marginTop: 2,
  },
  qtyController: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  qtyBtn: {
    width: 28,
    height: 28,
    backgroundColor: '#F1F5F9',
    borderRadius: 6,
    justifyContent: 'center',
    alignItems: 'center',
  },
  qtyText: {
    fontSize: 14,
    fontWeight: 'bold',
    marginHorizontal: 6,
  },
  divider: {
    height: 1,
    backgroundColor: '#F1F5F9',
    marginVertical: 12,
  },
  totalDisplayBox: {
    backgroundColor: Colors.primaryLight,
    padding: 14,
    borderRadius: 10,
    alignItems: 'center',
    marginBottom: 12,
  },
  totalDisplayLabel: {
    fontSize: 11,
    fontWeight: 'bold',
    color: Colors.primaryDark,
  },
  totalDisplayValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: Colors.primaryDark,
    marginTop: 2,
  },
  methodContainer: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  methodCard: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
    backgroundColor: '#FAFAFA',
  },
  methodCardActive: {
    backgroundColor: Colors.primaryDark,
    borderColor: Colors.primaryDark,
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
    fontWeight: 'bold',
  },
  methodTextUtangActive: {
    color: '#FFFFFF',
    fontWeight: 'bold',
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
    borderRadius: 8,
    paddingHorizontal: 12,
    height: 42,
    fontSize: 16,
    fontWeight: 'bold',
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
    backgroundColor: '#F1F5F9',
    paddingVertical: 6,
    borderRadius: 6,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  quickCashBtnText: {
    fontSize: 11,
    fontWeight: 'bold',
    color: Colors.textSecondary,
  },
  changeBox: {
    padding: 10,
    borderRadius: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#F1F5F9',
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
    fontWeight: 'bold',
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
  modalFooter: {
    marginTop: 10,
  },
  submitButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 15,
    borderRadius: 12,
    gap: 8,
  },
  submitButtonPrimary: {
    backgroundColor: Colors.primaryDark,
  },
  submitButtonGreen: {
    backgroundColor: Colors.primaryDark,
  },
  submitButtonWarning: {
    backgroundColor: Colors.primaryDark,
  },
  submitButtonUtang: {
    backgroundColor: Colors.primaryDark,
  },
  submitButtonDisabled: {
    opacity: 0.45,
  },
  submitButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: 'bold',
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
    borderRadius: 8,
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
    padding: 12,
    backgroundColor: '#FAFAFA',
    borderRadius: 10,
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
    fontWeight: 'bold',
    color: Colors.primary,
  },
  qrisImageCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: 10,
  },
  qrisDisplayImage: {
    width: 220,
    height: 220,
    borderRadius: 8,
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
    borderRadius: 12,
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
    borderRadius: 6,
  },
  bankBadgeText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: 'bold',
  },
  bankTransferLabel: {
    fontSize: 12,
    color: Colors.textMuted,
    fontWeight: '600',
  },
  bankAccountNumber: {
    fontSize: 18,
    fontWeight: 'bold',
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
    borderRadius: 12,
    padding: 20,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  qrisEmptyTitle: {
    fontSize: 14,
    fontWeight: 'bold',
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
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
    gap: 6,
  },
  qrisSetupBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: 'bold',
  },
  badgeContainerRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
    marginBottom: 4,
  },
  badgeKg: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ECFDF5',
    borderWidth: 1,
    borderColor: '#A7F3D0',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    gap: 3,
  },
  badgeKgText: {
    fontSize: 9,
    color: '#047857',
    fontWeight: 'bold',
  },
  addButtonKg: {
    backgroundColor: '#047857',
  },
  weightModalContent: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '92%',
    padding: 16,
  },
  weightProductHeader: {
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: 10,
  },
  weightProductName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: Colors.text,
  },
  weightProductMeta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 6,
  },
  weightProductPrice: {
    fontSize: 14,
    fontWeight: 'bold',
    color: Colors.primaryDark,
  },
  weightProductStock: {
    fontSize: 12,
    color: Colors.textMuted,
  },
  fractionGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 12,
  },
  fractionBtn: {
    width: '30.5%',
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: Colors.border,
    paddingVertical: 8,
    paddingHorizontal: 4,
    alignItems: 'center',
  },
  fractionBtnActive: {
    backgroundColor: '#ECFDF5',
    borderColor: '#059669',
  },
  fractionBtnText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: Colors.text,
  },
  fractionBtnTextActive: {
    color: '#047857',
  },
  fractionBtnSub: {
    fontSize: 10,
    color: Colors.textMuted,
    marginTop: 1,
  },
  fractionBtnSubActive: {
    color: '#059669',
    fontWeight: '600',
  },
  fractionBtnPrice: {
    fontSize: 11,
    fontWeight: 'bold',
    color: Colors.primaryDark,
    marginTop: 3,
  },
  fractionBtnPriceActive: {
    color: '#047857',
  },
  customInputCard: {
    backgroundColor: '#FAFAFA',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 12,
    marginBottom: 12,
  },
  inputUnit: {
    fontSize: 14,
    fontWeight: 'bold',
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
    borderRadius: 10,
    padding: 12,
    marginBottom: 10,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 2,
  },
  summaryLabel: {
    fontSize: 12,
    color: Colors.textSecondary,
  },
  summaryValue: {
    fontSize: 13,
    fontWeight: '600',
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
    fontWeight: 'bold',
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
