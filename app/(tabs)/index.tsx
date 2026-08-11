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
} from 'react-native';
import { useSQLiteContext } from 'expo-sqlite';
import { useRouter, useFocusEffect } from 'expo-router';
import { Product, CartItem, PaymentMethod } from '../../src/types';
import { getProducts, searchProducts } from '../../src/services/productService';
import { processCheckout } from '../../src/services/posService';
import { formatRupiah } from '../../src/utils/formatters';
import { Colors } from '../../src/constants/theme';
import { Ionicons } from '@expo/vector-icons';

export default function PosScreen() {
  const db = useSQLiteContext();
  const router = useRouter();

  const [products, setProducts] = useState<Product[]>([]);
  const [filteredProducts, setFilteredProducts] = useState<Product[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFilter, setSelectedFilter] = useState<'ALL' | 'TITIPAN' | 'LOW_STOCK'>('ALL');
  
  // Cart state
  const [cart, setCart] = useState<CartItem[]>([]);
  const [isCheckoutModalVisible, setIsCheckoutModalVisible] = useState(false);
  
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
    } catch (err) {
      console.error('Failed to load products:', err);
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
    }
    setFilteredProducts(result);
  }, [products, selectedFilter]);

  // Cart operations
  const addToCart = (product: Product) => {
    if (product.stock <= 0) {
      Alert.alert('Stok Habis', `Stok ${product.name} telah habis!`);
      return;
    }

    setCart((prev) => {
      const existing = prev.find((item) => item.product.id === product.id);
      if (existing) {
        if (existing.qty >= product.stock) {
          Alert.alert('Batas Stok', `Jumlah di keranjang melebihi stok yang ada (${product.stock}).`);
          return prev;
        }
        return prev.map((item) =>
          item.product.id === product.id ? { ...item, qty: item.qty + 1 } : item
        );
      }
      return [...prev, { product, qty: 1 }];
    });
  };

  const updateCartQty = (productId: number, delta: number) => {
    setCart((prev) =>
      prev
        .map((item) => {
          if (item.product.id === productId) {
            const newQty = item.qty + delta;
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
  const totalCartPrice = cart.reduce((sum, item) => sum + item.product.sell_price * item.qty, 0);
  const totalCartItems = cart.reduce((sum, item) => sum + item.qty, 0);
  const numericCashPaid = parseFloat(cashAmountInput) || 0;
  const changeAmount = numericCashPaid - totalCartPrice;

  // Process payment
  const handleFinalCheckout = async () => {
    if (cart.length === 0) return;

    if (paymentMethod === 'CASH' && numericCashPaid < totalCartPrice) {
      Alert.alert('Uang Kurang', 'Jumlah uang tunai yang dibayarkan kurang dari total belanja.');
      return;
    }

    if (paymentMethod === 'UTANG' && !customerName.trim()) {
      Alert.alert('Nama Pelanggan Wajib', 'Mohon isi nama pelanggan untuk mencatat transaksi kasbon/utang.');
      return;
    }

    try {
      setIsSubmitting(true);
      const res = await processCheckout(
        db,
        cart,
        paymentMethod,
        customerName.trim() || undefined,
        customerPhone.trim() || undefined
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

  return (
    <SafeAreaView style={styles.container}>
      {/* Search Header */}
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

      {/* Filter Tabs */}
      <View style={styles.filterContainer}>
        <TouchableOpacity
          style={[styles.filterChip, selectedFilter === 'ALL' && styles.filterChipActive]}
          onPress={() => setSelectedFilter('ALL')}
        >
          <Text style={[styles.filterChipText, selectedFilter === 'ALL' && styles.filterChipTextActive]}>
            Semua Produk
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.filterChip, selectedFilter === 'TITIPAN' && styles.filterChipActive]}
          onPress={() => setSelectedFilter('TITIPAN')}
        >
          <Text style={[styles.filterChipText, selectedFilter === 'TITIPAN' && styles.filterChipTextActive]}>
            🤝 Barang Titipan
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.filterChip, selectedFilter === 'LOW_STOCK' && styles.filterChipActive]}
          onPress={() => setSelectedFilter('LOW_STOCK')}
        >
          <Text style={[styles.filterChipText, selectedFilter === 'LOW_STOCK' && styles.filterChipTextActive]}>
            ⚠️ Stok Menipis
          </Text>
        </TouchableOpacity>
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

          return (
            <TouchableOpacity
              style={[styles.productCard, item.stock <= 0 && styles.productCardDisabled]}
              onPress={() => addToCart(item)}
              activeOpacity={0.8}
            >
              {item.is_consignment === 1 ? (
                <View style={styles.badgeTitipan}>
                  <Text style={styles.badgeTitipanText}>Titipan ({item.supplier_name || 'Tetangga'})</Text>
                </View>
              ) : null}

              {item.stock < 5 ? (
                <View style={styles.badgeLowStock}>
                  <Text style={styles.badgeLowStockText}>Stok: {item.stock}</Text>
                </View>
              ) : null}

              <Text style={styles.productName} numberOfLines={2}>
                {item.name}
              </Text>

              <View style={styles.priceRow}>
                <Text style={styles.productPrice}>{formatRupiah(item.sell_price)}</Text>
                <Text style={styles.productStock}>Stok: {item.stock}</Text>
              </View>

              {inCartQty > 0 ? (
                <View style={styles.inCartBadge}>
                  <Text style={styles.inCartBadgeText}>{inCartQty} di keranjang</Text>
                </View>
              ) : (
                <View style={styles.addButton}>
                  <Ionicons name="add" color="#FFFFFF" size={16} />
                  <Text style={styles.addButtonText}>Tambah</Text>
                </View>
              )}
            </TouchableOpacity>
          );
        }}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="alert-circle-outline" color={Colors.textMuted} size={48} />
            <Text style={styles.emptyText}>Tidak ada barang yang cocok</Text>
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
              {cart.map((item) => (
                <View key={item.product.id} style={styles.cartRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.cartRowTitle}>{item.product.name}</Text>
                    <Text style={styles.cartRowSub}>
                      {formatRupiah(item.product.sell_price)} x {item.qty} = {formatRupiah(item.product.sell_price * item.qty)}
                    </Text>
                  </View>

                  <View style={styles.qtyController}>
                    <TouchableOpacity
                      style={styles.qtyBtn}
                      onPress={() => updateCartQty(item.product.id, -1)}
                    >
                      <Ionicons name="remove" color={Colors.text} size={14} />
                    </TouchableOpacity>
                    <Text style={styles.qtyText}>{item.qty}</Text>
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
              ))}

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
                    💵 Tunai (Cash)
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.methodCard, paymentMethod === 'QRIS' && styles.methodCardActive]}
                  onPress={() => setPaymentMethod('QRIS')}
                >
                  <Text style={[styles.methodText, paymentMethod === 'QRIS' && styles.methodTextActive]}>
                    📲 QRIS Statis
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.methodCard, paymentMethod === 'UTANG' && styles.methodCardUtangActive]}
                  onPress={() => setPaymentMethod('UTANG')}
                >
                  <Text style={[styles.methodText, paymentMethod === 'UTANG' && styles.methodTextUtangActive]}>
                    📝 Buku Utang
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
                    placeholder="Contoh: 50000"
                    value={cashAmountInput}
                    onChangeText={setCashAmountInput}
                  />

                  {/* Quick Cash Buttons */}
                  <View style={styles.quickCashRow}>
                    <TouchableOpacity
                      style={styles.quickCashBtn}
                      onPress={() => setCashAmountInput(totalCartPrice.toString())}
                    >
                      <Text style={styles.quickCashBtnText}>Uang Pas</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.quickCashBtn}
                      onPress={() => setCashAmountInput('10000')}
                    >
                      <Text style={styles.quickCashBtnText}>10rb</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.quickCashBtn}
                      onPress={() => setCashAmountInput('20000')}
                    >
                      <Text style={styles.quickCashBtnText}>20rb</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.quickCashBtn}
                      onPress={() => setCashAmountInput('50000')}
                    >
                      <Text style={styles.quickCashBtnText}>50rb</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.quickCashBtn}
                      onPress={() => setCashAmountInput('100000')}
                    >
                      <Text style={styles.quickCashBtnText}>100rb</Text>
                    </TouchableOpacity>
                  </View>

                  {/* Change Calculation */}
                  {numericCashPaid > 0 ? (
                    <View
                      style={[
                        styles.changeBox,
                        changeAmount < 0 ? styles.changeBoxNegative : styles.changeBoxPositive,
                      ]}
                    >
                      <Text style={styles.changeLabel}>
                        {changeAmount < 0 ? 'Uang Kurang:' : 'Uang Kembalian:'}
                      </Text>
                      <Text style={styles.changeValue}>
                        {formatRupiah(Math.abs(changeAmount))}
                      </Text>
                    </View>
                  ) : null}
                </View>
              ) : null}

              {/* UTANG Payment Details */}
              {paymentMethod === 'UTANG' ? (
                <View style={styles.utangFormContainer}>
                  <Text style={styles.inputLabel}>Nama Pelanggan Utang (Wajib):</Text>
                  <View style={styles.inputWithIcon}>
                    <Ionicons name="person-outline" color={Colors.textMuted} size={18} />
                    <TextInput
                      style={styles.iconInput}
                      placeholder="Contoh: Pak Budi / Bu Ani"
                      value={customerName}
                      onChangeText={setCustomerName}
                    />
                  </View>

                  <Text style={[styles.inputLabel, { marginTop: 10 }]}>No. HP WhatsApp (Opsional):</Text>
                  <View style={styles.inputWithIcon}>
                    <Ionicons name="call-outline" color={Colors.textMuted} size={18} />
                    <TextInput
                      style={styles.iconInput}
                      keyboardType="phone-pad"
                      placeholder="Contoh: 08123456789"
                      value={customerPhone}
                      onChangeText={setCustomerPhone}
                    />
                  </View>
                </View>
              ) : null}
            </ScrollView>

            {/* Modal Footer Submit */}
            <View style={styles.modalFooter}>
              <TouchableOpacity
                style={[styles.submitButton, isSubmitting && styles.submitButtonDisabled]}
                onPress={handleFinalCheckout}
                disabled={isSubmitting}
              >
                <Ionicons name="checkmark-circle-outline" color="#FFFFFF" size={22} />
                <Text style={styles.submitButtonText}>
                  {isSubmitting ? 'Memproses...' : 'Selesaikan Transaksi'}
                </Text>
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
    padding: 12,
    backgroundColor: Colors.primaryDark,
    gap: 10,
    alignItems: 'center',
  },
  searchInputContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
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
  filterContainer: {
    flexDirection: 'row',
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 8,
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
    elevation: 2,
    shadowColor: Colors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
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
    elevation: 8,
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
    paddingHorizontal: 8,
  },
  divider: {
    height: 1,
    backgroundColor: Colors.border,
    marginVertical: 12,
  },
  totalDisplayBox: {
    backgroundColor: Colors.primaryLight,
    borderRadius: 10,
    padding: 14,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  totalDisplayLabel: {
    fontSize: 13,
    fontWeight: 'bold',
    color: Colors.primaryDark,
  },
  totalDisplayValue: {
    fontSize: 22,
    fontWeight: 'bold',
    color: Colors.primaryDark,
  },
  methodContainer: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  methodCard: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
  },
  methodCardActive: {
    backgroundColor: Colors.primaryLight,
    borderColor: Colors.primary,
  },
  methodCardUtangActive: {
    backgroundColor: Colors.secondaryLight,
    borderColor: Colors.secondary,
  },
  methodText: {
    fontSize: 12,
    color: Colors.textSecondary,
    fontWeight: '500',
  },
  methodTextActive: {
    color: Colors.primaryDark,
    fontWeight: 'bold',
  },
  methodTextUtangActive: {
    color: Colors.secondary,
    fontWeight: 'bold',
  },
  cashCalculatorContainer: {
    marginTop: 6,
  },
  inputLabel: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginBottom: 4,
  },
  cashInput: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 8,
    padding: 10,
    fontSize: 16,
    fontWeight: 'bold',
    color: Colors.text,
    backgroundColor: '#FAFAFA',
  },
  quickCashRow: {
    flexDirection: 'row',
    gap: 6,
    marginTop: 8,
  },
  quickCashBtn: {
    flex: 1,
    backgroundColor: '#F1F5F9',
    paddingVertical: 8,
    borderRadius: 6,
    alignItems: 'center',
  },
  quickCashBtnText: {
    fontSize: 11,
    fontWeight: '600',
    color: Colors.text,
  },
  changeBox: {
    marginTop: 12,
    padding: 12,
    borderRadius: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  changeBoxPositive: {
    backgroundColor: Colors.successLight,
  },
  changeBoxNegative: {
    backgroundColor: Colors.dangerLight,
  },
  changeLabel: {
    fontSize: 13,
    fontWeight: 'bold',
    color: Colors.text,
  },
  changeValue: {
    fontSize: 16,
    fontWeight: 'bold',
    color: Colors.text,
  },
  utangFormContainer: {
    marginTop: 6,
  },
  inputWithIcon: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 8,
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
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  submitButton: {
    backgroundColor: Colors.primary,
    paddingVertical: 14,
    borderRadius: 10,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  submitButtonDisabled: {
    opacity: 0.5,
  },
  submitButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
});
