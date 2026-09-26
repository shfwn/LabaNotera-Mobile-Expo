import { Platform } from 'react-native';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system/legacy';
import { DailyFullReportData, FinancialReportSummary, ShopProfile } from '../types';
import { formatRupiah, formatTanggal, formatQty } from './formatters';
import { showAppAlert } from './alertHelper';

export function generateDailyReportHtml(data: DailyFullReportData): string {
  const {
    formattedDate,
    shopProfile,
    todayRevenue,
    todayHPP,
    todayGrossProfit,
    todayPrive,
    todayExpense,
    todayRestock,
    todayConsignmentOwed,
    todayNetProfit,
    todayEstimatedCashDrawer,
    todayTransactionCount,
    todayItemsSold,
    productsSold,
    transactions,
    expenses,
  } = data;

  const shopName = shopProfile.shop_name || 'Warung LabaNotera';
  const shopPhone = shopProfile.phone ? ` • Telp: ${shopProfile.phone}` : '';
  const shopAddress = shopProfile.address ? `${shopProfile.address}` : 'Kasir & Manajemen Stok';
  const closingTime = shopProfile.closing_time || '21:00';

  const productsTableRows =
    productsSold.length > 0
      ? productsSold
          .map((p, idx) => {
            const qtyStr = p.is_kg === 1 ? `${p.qty_sold} kg` : `${p.qty_sold} pcs`;
            const titipanBadge =
              p.is_consignment === 1
                ? `<span style="background: #FEF3C7; color: #92400E; font-size: 10px; font-weight: bold; padding: 2px 6px; border-radius: 4px; margin-left: 4px;">Titipan</span>`
                : '';
            return `
              <tr>
                <td style="text-align: center; color: #64748B;">${idx + 1}</td>
                <td><strong>${p.product_name}</strong> ${titipanBadge}</td>
                <td style="text-align: center;">${qtyStr}</td>
                <td style="text-align: right;">${formatRupiah(p.total_revenue)}</td>
                <td style="text-align: right; color: #16A34A; font-weight: bold;">+${formatRupiah(p.total_profit)}</td>
              </tr>
            `;
          })
          .join('')
      : `<tr><td colspan="5" style="text-align: center; color: #94A3B8; padding: 12px;">Belum ada penjualan produk pada hari ini.</td></tr>`;

  const transactionsTableRows =
    transactions.length > 0
      ? transactions
          .map((t) => {
            const timeStr = t.created_at ? new Date(t.created_at).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) : '-';
            const isCancelled = t.status === 'CANCELLED';
            const rowStyle = isCancelled ? 'background-color: #FEF2F2; color: #94A3B8; text-decoration: line-through;' : '';
            return `
              <tr style="${rowStyle}">
                <td style="text-align: center;">${timeStr}</td>
                <td><strong>${t.transaction_code}</strong></td>
                <td>${t.customer_name || 'Umum'}</td>
                <td style="text-align: center;"><span style="background: #F1F5F9; padding: 2px 6px; border-radius: 4px; font-size: 11px;">${t.payment_method}</span></td>
                <td style="text-align: right; font-weight: bold;">${formatRupiah(t.total_amount)}</td>
                <td style="text-align: right; color: ${isCancelled ? '#94A3B8' : '#16A34A'}; font-weight: bold;">${isCancelled ? 'Dibatalkan' : `+${formatRupiah(t.gross_profit)}`}</td>
              </tr>
            `;
          })
          .join('')
      : `<tr><td colspan="6" style="text-align: center; color: #94A3B8; padding: 12px;">Tidak ada riwayat transaksi kasir pada hari ini.</td></tr>`;

  const expensesTableRows =
    expenses.length > 0
      ? expenses
          .map((e) => {
            let badgeBg = '#F3F4F6';
            let badgeColor = '#374151';
            let label = 'PENGELUARAN';
            if (e.type === 'PRIVE') {
              badgeBg = '#FEF3C7';
              badgeColor = '#92400E';
              label = 'UANG DAPUR (PRIVE)';
            } else if (e.type === 'RESTOCK') {
              badgeBg = '#DBEAFE';
              badgeColor = '#1E40AF';
              label = 'BELANJA STOK KAS';
            } else {
              badgeBg = '#FEE2E2';
              badgeColor = '#991B1B';
              label = 'BIAYA OPERASIONAL';
            }
            return `
              <tr>
                <td><span style="background: ${badgeBg}; color: ${badgeColor}; font-size: 10px; font-weight: bold; padding: 3px 6px; border-radius: 4px;">${label}</span></td>
                <td>${e.note}</td>
                <td style="text-align: right; color: #DC2626; font-weight: bold;">-${formatRupiah(e.amount)}</td>
              </tr>
            `;
          })
          .join('')
      : `<tr><td colspan="3" style="text-align: center; color: #94A3B8; padding: 10px;">Tidak ada pengeluaran kas laci tercatat hari ini.</td></tr>`;

  return `
    <!DOCTYPE html>
    <html lang="id">
      <head>
        <meta charset="utf-8" />
        <title>Laporan_Harian_${formattedDate.replace(/ /g, '_')}</title>
        <style>
          * { box-sizing: border-box; }
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
            color: #1E293B;
            background-color: #FFFFFF;
            padding: 24px;
            margin: 0;
            font-size: 12px;
            line-height: 1.4;
          }
          .header {
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
            border-bottom: 2px solid #236B43;
            padding-bottom: 14px;
            margin-bottom: 16px;
          }
          .shop-title {
            font-size: 20px;
            font-weight: 800;
            color: #236B43;
            margin: 0;
          }
          .shop-subtitle {
            font-size: 11px;
            color: #64748B;
            margin-top: 2px;
          }
          .report-badge {
            text-align: right;
          }
          .report-tag {
            background: #236B43;
            color: #FFFFFF;
            font-weight: 800;
            font-size: 12px;
            padding: 4px 10px;
            border-radius: 4px;
            display: inline-block;
          }
          .report-date {
            font-size: 11px;
            color: #475569;
            margin-top: 4px;
            font-weight: 600;
          }
          .kpi-grid {
            display: grid;
            grid-template-columns: repeat(3, 1fr);
            gap: 10px;
            margin-bottom: 14px;
          }
          .kpi-card {
            background: #F8FAF8;
            border: 1px solid #E2E8F0;
            border-radius: 8px;
            padding: 10px;
          }
          .kpi-card.highlight-profit {
            background: #ECFDF5;
            border-color: #A7F3D0;
          }
          .kpi-card.highlight-drawer {
            background: #EFF6FF;
            border-color: #BFDBFE;
          }
          .kpi-label {
            font-size: 10px;
            color: #64748B;
            font-weight: 700;
            text-transform: uppercase;
          }
          .kpi-value {
            font-size: 16px;
            font-weight: 800;
            color: #0F172A;
            margin-top: 2px;
          }
          .kpi-sub {
            font-size: 10px;
            color: #94A3B8;
            margin-top: 2px;
          }
          .summary-card {
            background: #F8FAF8;
            border: 1px solid #E2E8F0;
            border-radius: 8px;
            padding: 12px;
            margin-bottom: 16px;
          }
          .summary-row {
            display: flex;
            justify-content: space-between;
            padding: 4px 0;
            font-size: 12px;
          }
          .summary-row.total-row {
            border-top: 1px dashed #CBD5E1;
            margin-top: 6px;
            padding-top: 6px;
            font-weight: bold;
            font-size: 13px;
          }
          .section-title {
            font-size: 13px;
            font-weight: 800;
            color: #0F172A;
            margin-top: 14px;
            margin-bottom: 8px;
            display: flex;
            align-items: center;
            border-left: 3px solid #236B43;
            padding-left: 8px;
          }
          table {
            width: 100%;
            border-collapse: collapse;
            font-size: 11px;
            margin-bottom: 12px;
          }
          th {
            background-color: #F1F5F9;
            color: #475569;
            text-align: left;
            padding: 7px 8px;
            font-weight: 700;
            border-bottom: 1px solid #CBD5E1;
          }
          td {
            padding: 7px 8px;
            border-bottom: 1px solid #E2E8F0;
          }
          tr:nth-child(even) {
            background-color: #FAFAFA;
          }
          .footer-sign {
            display: flex;
            justify-content: space-between;
            margin-top: 30px;
            padding-top: 14px;
            border-top: 1px solid #E2E8F0;
          }
          .sign-col {
            width: 45%;
            text-align: center;
          }
          .sign-line {
            margin-top: 50px;
            border-bottom: 1px solid #94A3B8;
            width: 80%;
            margin-left: auto;
            margin-right: auto;
          }
          .app-stamp {
            text-align: center;
            font-size: 10px;
            color: #94A3B8;
            margin-top: 20px;
          }
          @media print {
            body { padding: 0; }
            .no-print { display: none; }
          }
        </style>
      </head>
      <body>
        <!-- Header -->
        <div class="header">
          <div>
            <h1 class="shop-title">${shopName}</h1>
            <div class="shop-subtitle">${shopAddress}${shopPhone}</div>
          </div>
          <div class="report-badge">
            <div class="report-tag">REKAP LABA HARIAN</div>
            <div class="report-date">${formattedDate} (Tutup: ${closingTime} WIB)</div>
          </div>
        </div>

        <!-- 3 Utama KPI -->
        <div class="kpi-grid">
          <div class="kpi-card highlight-profit">
            <div class="kpi-label" style="color: #065F46;">Laba Bersih Hari Ini</div>
            <div class="kpi-value" style="color: #059669;">${formatRupiah(todayNetProfit)}</div>
            <div class="kpi-sub">(Laba Kotor - Prive - Biaya)</div>
          </div>
          <div class="kpi-card highlight-drawer">
            <div class="kpi-label" style="color: #1E40AF;">Sisa Kas Laci Hari Ini</div>
            <div class="kpi-value" style="color: #2563EB;">${formatRupiah(todayEstimatedCashDrawer)}</div>
            <div class="kpi-sub">(Omset - Seluruh Kas Keluar)</div>
          </div>
          <div class="kpi-card">
            <div class="kpi-label">Volume Penjualan</div>
            <div class="kpi-value">${todayItemsSold} item</div>
            <div class="kpi-sub">${todayTransactionCount} transaksi selesai</div>
          </div>
        </div>

        <!-- Rincian Laba Rugi Hari Ini -->
        <div class="summary-card">
          <div class="summary-row">
            <span>Total Omset Penjualan (Kas Masuk Kasir)</span>
            <strong style="color: #16A34A;">${formatRupiah(todayRevenue)}</strong>
          </div>
          <div class="summary-row">
            <span>Total Modal Pokok (HPP Barang Terjual)</span>
            <span style="color: #DC2626;">-${formatRupiah(todayHPP)}</span>
          </div>
          <div class="summary-row total-row">
            <span>LABA KOTOR PENJUALAN (Omset - Modal)</span>
            <span style="color: #236B43;">+${formatRupiah(todayGrossProfit)}</span>
          </div>

          <div style="margin-top: 8px; border-top: 1px solid #E2E8F0; padding-top: 6px;"></div>

          <div class="summary-row">
            <span>Pengeluaran Uang Dapur / Prive Pribadi</span>
            <span style="color: #D97706;">-${formatRupiah(todayPrive)}</span>
          </div>
          <div class="summary-row">
            <span>Biaya Operasional Toko / Warung</span>
            <span style="color: #DC2626;">-${formatRupiah(todayExpense)}</span>
          </div>
          <div class="summary-row">
            <span>Belanja Kulakan Stok (Dari Kas Laci Kasir)</span>
            <span style="color: #2563EB;">-${formatRupiah(todayRestock)}</span>
          </div>

          ${
            todayConsignmentOwed > 0
              ? `
          <div class="summary-row" style="background: #FFFBEB; padding: 4px; border-radius: 4px; margin-top: 4px;">
            <span style="color: #92400E; font-weight: 600;">Bagi Hasil Barang Titipan Terutang (Mitra)</span>
            <span style="color: #D97706; font-weight: bold;">${formatRupiah(todayConsignmentOwed)}</span>
          </div>`
              : ''
          }
        </div>

        <!-- Section 1: Produk Terlaris / Terjual Hari Ini -->
        <div class="section-title">1. Rincian Produk Terjual Hari Ini</div>
        <table>
          <thead>
            <tr>
              <th style="width: 30px; text-align: center;">No</th>
              <th>Nama Produk</th>
              <th style="width: 80px; text-align: center;">Qty Terjual</th>
              <th style="width: 100px; text-align: right;">Total Omset</th>
              <th style="width: 100px; text-align: right;">Laba Keuntungan</th>
            </tr>
          </thead>
          <tbody>
            ${productsTableRows}
          </tbody>
        </table>

        <!-- Section 2: Pengeluaran Kas Laci Hari Ini -->
        <div class="section-title">2. Pengeluaran Uang Kas Laci Hari Ini</div>
        <table>
          <thead>
            <tr>
              <th style="width: 140px;">Kategori</th>
              <th>Keterangan Pengeluaran</th>
              <th style="width: 110px; text-align: right;">Jumlah Uang</th>
            </tr>
          </thead>
          <tbody>
            ${expensesTableRows}
          </tbody>
        </table>

        <!-- Section 3: Riwayat Transaksi Kasir Hari Ini -->
        <div class="section-title">3. Riwayat Transaksi Kasir Hari Ini</div>
        <table>
          <thead>
            <tr>
              <th style="width: 50px; text-align: center;">Jam</th>
              <th>No. Transaksi</th>
              <th>Pelanggan</th>
              <th style="width: 80px; text-align: center;">Metode</th>
              <th style="width: 90px; text-align: right;">Total Belanja</th>
              <th style="width: 80px; text-align: right;">Laba Trx</th>
            </tr>
          </thead>
          <tbody>
            ${transactionsTableRows}
          </tbody>
        </table>

        <!-- Tanda Tangan Laporan -->
        <div class="footer-sign">
          <div class="sign-col">
            <div>Kasir Penjaga Toko,</div>
            <div class="sign-line"></div>
            <div style="font-size: 10px; color: #64748B; margin-top: 4px;">Nama Terang & Paraf</div>
          </div>
          <div class="sign-col">
            <div>Pemilik / Penanggung Jawab,</div>
            <div class="sign-line"></div>
            <div style="font-size: 10px; color: #64748B; margin-top: 4px;">(${shopProfile.owner_name || shopName})</div>
          </div>
        </div>

        <div class="app-stamp">
          Dicetak otomatis oleh Aplikasi LabaNotera • Sistem Kasir & Manajemen Stok Warung
        </div>
      </body>
    </html>
  `;
}

export async function exportDailyReportPdf(reportData: DailyFullReportData): Promise<void> {
  const html = generateDailyReportHtml(reportData);

  try {
    if (Platform.OS === 'web') {
      await Print.printAsync({ html });
      return;
    }

    // Generate PDF with base64 data to write directly into app-private documentDirectory
    const { base64, uri } = await Print.printToFileAsync({ html, base64: true });
    const cleanDate = reportData.formattedDate.replace(/[^a-zA-Z0-9]/g, '_');
    const filename = `Laporan_Harian_${cleanDate}.pdf`;
    const targetUri = `${FileSystem.documentDirectory || FileSystem.cacheDirectory}${filename}`;

    let shareTargetUri = uri;
    if (base64) {
      await FileSystem.writeAsStringAsync(targetUri, base64, {
        encoding: FileSystem.EncodingType.Base64,
      });
      shareTargetUri = targetUri;
    }

    if (await Sharing.isAvailableAsync()) {
      await Sharing.shareAsync(shareTargetUri, {
        mimeType: 'application/pdf',
        dialogTitle: `Laporan Keuangan Harian (${reportData.formattedDate})`,
        UTI: 'com.adobe.pdf',
      });
    } else {
      await Print.printAsync({ html });
    }
  } catch (err: any) {
    console.error('Error exportDailyReportPdf:', err);
    // If sharing failed or was cancelled, open direct system print sheet as graceful fallback
    try {
      if (Platform.OS !== 'web') {
        await Print.printAsync({ html });
        return;
      }
    } catch {
      // ignore secondary fallback error
    }
    showAppAlert('Gagal Ekspor PDF', err?.message || 'Gagal membuat dokumen laporan PDF.');
  }
}
