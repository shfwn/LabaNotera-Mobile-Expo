import { replace } from "expo-router/build/global-state/routing";

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
  return `Halo Kak ${customerName}, salam hangat dari ${warungName} 👋.\n\n` +
    `Mengingatkan mengenai catatan kasbon/utang belanja sebesar *${formatRupiah(remainingDebt)}*.\n\n` +
    `Pembayaran dapat dilakukan tunai atau via QRIS. Terima kasih banyak atas kerjasamanya! 🙏`;
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

export function getProductCategory(product: { name: string; category?: string | null }): 'SNACK' | 'MINUMAN' | 'BARANG_POKOK' {
  if (product.category === 'SNACK' || product.category === 'MINUMAN' || product.category === 'BARANG_POKOK') {
    return product.category;
  }
  const nameLower = product.name.toLowerCase();
  if (
    nameLower.includes('kopi') ||
    nameLower.includes('teh') ||
    nameLower.includes('air') ||
    nameLower.includes('minuman') ||
    nameLower.includes('jus') ||
    nameLower.includes('susu') ||
    nameLower.includes('aqua') ||
    nameLower.includes('pucuk')
  ) {
    return 'MINUMAN';
  }
  if (
    nameLower.includes('gorengan') ||
    nameLower.includes('kue') ||
    nameLower.includes('kerupuk') ||
    nameLower.includes('snack') ||
    nameLower.includes('chitato') ||
    nameLower.includes('wafer') ||
    nameLower.includes('biskuat') ||
    nameLower.includes('roti') ||
    nameLower.includes('kripik') ||
    nameLower.includes('ciki') ||
    nameLower.includes('jajanan')
  ) {
    return 'SNACK';
  }
  return 'BARANG_POKOK';
}
