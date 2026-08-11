import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { Transaction, TransactionItem } from '../types';
import { formatRupiah, formatTanggal } from './formatters';

export function generateReceiptHtml(
  transaction: Transaction,
  items: TransactionItem[],
  storeName: string = 'WARUNG LABANOTERA'
): string {
  const itemsHtml = items
    .map(
      (item) => `
    <tr>
      <td style="padding: 4px 0;">
        <div style="font-weight: bold; font-size: 13px;">${item.product_name}</div>
        <div style="font-size: 11px; color: #555;">${item.qty} x ${formatRupiah(item.sell_price)}</div>
      </td>
      <td style="text-align: right; vertical-align: top; padding: 4px 0; font-size: 13px; font-weight: bold;">
        ${formatRupiah(item.subtotal)}
      </td>
    </tr>
  `
    )
    .join('');

  return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <style>
          body {
            font-family: 'Courier New', Courier, monospace, sans-serif;
            width: 280px;
            margin: 0 auto;
            padding: 10px;
            color: #000;
            background-color: #fff;
          }
          .header {
            text-align: center;
            margin-bottom: 12px;
            border-bottom: 1px dashed #000;
            padding-bottom: 8px;
          }
          .store-name {
            font-size: 18px;
            font-weight: bold;
            letter-spacing: 1px;
          }
          .meta {
            font-size: 11px;
            margin-top: 4px;
          }
          table {
            width: 100%;
            border-collapse: collapse;
          }
          .divider {
            border-top: 1px dashed #000;
            margin: 8px 0;
          }
          .total-row {
            font-size: 14px;
            font-weight: bold;
            display: flex;
            justify-content: space-between;
            margin-top: 4px;
          }
          .footer {
            text-align: center;
            font-size: 11px;
            margin-top: 16px;
            border-top: 1px dashed #000;
            padding-top: 8px;
          }
        </style>
      </head>
      <body>
        <div class="header">
          <div class="store-name">${storeName}</div>
          <div class="meta">Nota Pembayaran POS</div>
          <div class="meta">No: ${transaction.transaction_code}</div>
          <div class="meta">Tgl: ${formatTanggal(transaction.created_at)}</div>
          ${transaction.customer_name ? `<div class="meta">Pelanggan: ${transaction.customer_name}</div>` : ''}
        </div>

        <table>
          <tbody>
            ${itemsHtml}
          </tbody>
        </table>

        <div class="divider"></div>

        <div class="total-row" style="font-size: 16px;">
          <span>TOTAL</span>
          <span>${formatRupiah(transaction.total_amount)}</span>
        </div>

        <div class="total-row" style="font-size: 12px; font-weight: normal; margin-top: 6px;">
          <span>Metode Bayar</span>
          <span style="font-weight: bold;">${transaction.payment_method}</span>
        </div>

        <div class="footer">
          <p style="margin: 2px 0;">Terima Kasih Atas Kunjungan Anda!</p>
          <p style="margin: 2px 0; font-size: 10px; color: #666;">Dicetak via LabaNotera App</p>
        </div>
      </body>
    </html>
  `;
}

export async function printReceipt(transaction: Transaction, items: TransactionItem[]) {
  const html = generateReceiptHtml(transaction, items);
  await Print.printAsync({ html });
}

export async function shareReceiptPdf(transaction: Transaction, items: TransactionItem[]) {
  const html = generateReceiptHtml(transaction, items);
  const { uri } = await Print.printToFileAsync({ html });
  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(uri, {
      mimeType: 'application/pdf',
      dialogTitle: `Struk_${transaction.transaction_code}`,
      UTI: 'com.adobe.pdf',
    });
  }
}
