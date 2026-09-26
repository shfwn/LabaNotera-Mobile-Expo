export function formatRupiah(value: number | string): string {
  if (value === undefined || value === null || value === '') return '';
  
  // Ambil angkanya saja (bersihkan karakter selain 0-9)
  const cleaned = String(value).replace(/[^0-9]/g, '');
  if (!cleaned) return '';

  const num = parseInt(cleaned, 10);
  if (isNaN(num)) return 'Rp 0';

  return 'Rp ' + num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

export function parseRupiahToNumber(formattedText: string): number {
  if (!formattedText) return 0;
  const cleaned = formattedText.replace(/[^0-9]/g, '');
  return cleaned ? parseInt(cleaned, 10) : 0;
}
export function formatTanggal(dateStr?: string | Date): string {
  if (!dateStr) return '';
  const date = typeof dateStr === 'string' ? new Date(dateStr) : dateStr;
  if (isNaN(date.getTime())) return String(dateStr);

  const day = date.getDate().toString().padStart(2, '0');
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
  const month = months[date.getMonth()];
  const year = date.getFullYear();
  const hours = date.getHours().toString().padStart(2, '0');
  const minutes = date.getMinutes().toString().padStart(2, '0');

  return `${day} ${month} ${year}, ${hours}:${minutes}`;
}

export function generateTrxCode(): string {
  const now = new Date();
  const dateStr = now.toISOString().slice(0, 10).replace(/-/g, '');
  const randomSuffix = Math.floor(1000 + Math.random() * 9000);
  return `TRX-${dateStr}-${randomSuffix}`;
}

export function generateDebtWaMessage(customerName: string, remainingDebt: number, warungName: string = 'Warung LabaNotera'): string {
  return `Halo Kak ${customerName}, salam hangat dari ${warungName}.\n\n` +
    `Mengingatkan mengenai catatan kasbon/utang belanja sebesar *${formatRupiah(remainingDebt)}*.\n\n` +
    `Pembayaran dapat dilakukan tunai atau via QRIS. Terima kasih banyak atas kerjasamanya.`;
}

export function getTransactionReceivedAmount(trx: {
  payment_method: string;
  total_amount: number;
  cash_paid?: number | null;
  debt_amount?: number | null;
}): number {
  if (trx.payment_method === 'UTANG') {
    return trx.cash_paid || 0;
  }
  if (trx.payment_method === 'CASH+UTANG') {
    return trx.cash_paid || 0;
  }
  return trx.total_amount;
}

export function getProductCategory(product: { name: string; category?: string | null }): 'SEMBAKO' | 'KONSUMSI' | 'SANITASI' | 'DIGITAL_KOMODITAS' {
  if (
    product.category === 'SEMBAKO' ||
    product.category === 'KONSUMSI' ||
    product.category === 'SANITASI' ||
    product.category === 'DIGITAL_KOMODITAS'
  ) {
    return product.category;
  }
  
  // Legacy category mapping
  if (product.category === 'BARANG_POKOK') return 'SEMBAKO';
  if (product.category === 'SNACK' || product.category === 'MINUMAN') return 'KONSUMSI';

  const nameLower = (product.name || '').toLowerCase();

  // 1. Perlengkapan Rumah & Sanitasi
  const sanitasiKeywords = [
    'sabun', 'sampo', 'shampoo', 'deterjen', 'detergen', 'rinso', 'daia', 'soklin',
    'sunlight', 'mama lemon', 'pasta gigi', 'odol', 'pepsodent', 'ciptadent', 'sikat gigi',
    'pewangi', 'molto', 'downy', 'pembersih', 'lantai', 'wipol', 'superpell', 'tisu',
    'baygon', 'hit', 'autan', 'soffell', 'pembalut', 'sikat', 'spons', 'clink', 'vixal'
  ];
  if (sanitasiKeywords.some((k) => nameLower.includes(k))) {
    return 'SANITASI';
  }

  // 2. Produk Komoditas & Digital
  const komoditasKeywords = [
    'rokok', 'sampoerna', 'djarum', 'gudang garam', 'marlboro', 'surya', 'magnum',
    'la lights', 'esse', 'camel', 'gas', 'elpiji', 'lpg', '3kg', 'obat', 'bodrex',
    'paracetamol', 'panadol', 'tolak angin', 'promag', 'antimo', 'mixagrip', 'konidin',
    'oskadon', 'diatabs', 'pulsa', 'token', 'listrik', 'baterai', 'korek', 'tokai'
  ];
  if (komoditasKeywords.some((k) => nameLower.includes(k))) {
    return 'DIGITAL_KOMODITAS';
  }

  // 3. Bahan Pokok & Sembako
  const sembakoKeywords = [
    'beras', 'minyak', 'gula', 'tepung', 'telur', 'telor', 'kecap', 'garam',
    'bumbu', 'royco', 'masako', 'santan', 'kara', 'saos', 'saus', 'mentega',
    'blue band', 'margarin', 'terigu', 'tapioka', 'bawang', 'cabe', 'cabai',
    'merica', 'ketumbar', 'ajinomoto', 'sasa', 'sarden'
  ];
  if (sembakoKeywords.some((k) => nameLower.includes(k))) {
    return 'SEMBAKO';
  }

  // 4. Makanan & Minuman Konsumsi (default untuk jajanan, mie, kopi, dll)
  return 'KONSUMSI';
}

export function isKgProduct(product: { name?: string; is_kg?: number | null; category?: string | null }): boolean {
  if (!product) return false;
  if (product.is_kg !== undefined && product.is_kg !== null) {
    return product.is_kg === 1;
  }
  const nameLower = (product.name || '').toLowerCase();
  const kgKeywords = [
    'kg', 'kilo', 'gram', 'gr',
    'beras', 'telur', 'telor', 'gula', 'tepung',
    'cabai', 'cabe', 'bawang', 'minyak curah',
    'tomat', 'kentang', 'wortel', 'sayur', 'ikan', 'daging',
    'ayam potong', 'kacang', 'kerupuk mentah', 'garam curah', 'curah'
  ];
  return kgKeywords.some((keyword) => {
    const regex = new RegExp(`(^|\\s|\\(|\\/)${keyword}(\\s|\\)|\\/|$)`, 'i');
    return regex.test(nameLower) || nameLower.includes(keyword);
  });
}

export function formatQty(qty: number, isKg: boolean = false): string {
  if (qty === 0.25) return '1/4 kg';
  if (qty === 0.5) return '1/2 kg';
  if (qty === 0.75) return '3/4 kg';
  if (qty === 1.25) return '1 1/4 kg';
  if (qty === 1.5) return '1 1/2 kg';
  if (qty === 1.75) return '1 3/4 kg';

  if (!Number.isInteger(qty)) {
    const rounded = Number(qty.toFixed(2));
    return isKg ? `${rounded} kg` : `${rounded}`;
  }

  return isKg ? `${qty} kg` : `${qty}`;
}
