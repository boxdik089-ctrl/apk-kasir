import React from 'react';
import type { Transaction, ReceiptSettings } from '../../types';
import { PrinterService } from '../../services/printerService';

interface ReceiptViewProps {
  transaction: Transaction;
  settings: ReceiptSettings;
  className?: string;
  isThermalStyle?: boolean;
}

export const ReceiptView: React.FC<ReceiptViewProps> = ({
  transaction,
  settings,
  className = '',
  isThermalStyle = true
}) => {
  const is80mm = settings.paperWidth === '80mm';
  const widthClass = is80mm ? 'w-[360px]' : 'w-[280px]';
  const sepChar = settings.separatorChar || '-';
  const separatorText = sepChar.repeat(is80mm ? 42 : 32);

  return (
    <div
      id="printable-receipt"
      className={`${widthClass} bg-white text-black p-4 mx-auto rounded shadow-sm text-xs select-none ${
        settings.fontFamily === 'monospace' ? 'font-mono' : 'font-sans'
      } ${className}`}
      style={{
        lineHeight: '1.35',
        filter: isThermalStyle ? 'contrast(120%)' : 'none'
      }}
    >
      {/* 1. Header Logo */}
      {settings.showLogo && settings.logoBase64 && (
        <div className="flex justify-center mb-2">
          <img
            src={settings.logoBase64}
            alt="Store Logo"
            className="max-h-24 object-contain"
            style={{ width: `${settings.logoWidth || 120}px` }}
          />
        </div>
      )}

      {/* 2. Store Info */}
      <div className="text-center">
        <h2 className="text-base font-bold tracking-tight uppercase">
          {settings.storeName || 'KASIR POS'}
        </h2>
        {settings.tagline && (
          <p className="text-[11px] font-medium text-gray-800">{settings.tagline}</p>
        )}
        {settings.address && (
          <p className="text-[10px] text-gray-700 whitespace-pre-line mt-0.5">
            {settings.address}
          </p>
        )}
        {settings.phone && (
          <p className="text-[10px] text-gray-700 mt-0.5">Telp: {settings.phone}</p>
        )}
      </div>

      <div className="text-center text-gray-400 overflow-hidden my-1 select-none text-[10px]">
        {separatorText}
      </div>

      {/* 3. Transaction Meta */}
      <div className="space-y-0.5 text-[11px]">
        <div className="flex justify-between">
          <span className="text-gray-600">No. Struk</span>
          <span className="font-semibold">{transaction.invoiceNumber}</span>
        </div>
        {settings.showDate && (
          <div className="flex justify-between">
            <span className="text-gray-600">Waktu</span>
            <span>{PrinterService.formatDate(transaction.timestamp)}</span>
          </div>
        )}
        {settings.showCashier && transaction.cashierName && (
          <div className="flex justify-between">
            <span className="text-gray-600">Kasir</span>
            <span>{transaction.cashierName}</span>
          </div>
        )}
        {settings.showCustomer && transaction.customerName && (
          <div className="flex justify-between">
            <span className="text-gray-600">Pelanggan</span>
            <span>{transaction.customerName}</span>
          </div>
        )}
      </div>

      <div className="text-center text-gray-400 overflow-hidden my-1 select-none text-[10px]">
        {separatorText}
      </div>

      {/* 4. Items List */}
      <div className="space-y-1.5 my-1 text-[11px]">
        {transaction.items.map((item, index) => (
          <div key={index} className="space-y-0.5">
            <div className="font-medium text-black break-words leading-tight">
              {item.name}
            </div>
            <div className="flex justify-between text-gray-700">
              <span>
                {item.quantity} x {PrinterService.formatRupiah(item.price)}
              </span>
              <span className="font-semibold text-black">
                {PrinterService.formatRupiah(item.subtotal)}
              </span>
            </div>
            {item.discount > 0 && (
              <div className="flex justify-between text-[10px] text-red-600 italic">
                <span>Diskon Item</span>
                <span>-{PrinterService.formatRupiah(item.discount)}</span>
              </div>
            )}
            {item.note && (
              <div className="text-[10px] text-gray-500 italic pl-2">
                * {item.note}
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="text-center text-gray-400 overflow-hidden my-1 select-none text-[10px]">
        {separatorText}
      </div>

      {/* 5. Totals */}
      <div className="space-y-0.5 text-[11px]">
        <div className="flex justify-between">
          <span className="text-gray-600">Subtotal</span>
          <span>{PrinterService.formatRupiah(transaction.subtotal)}</span>
        </div>
        {transaction.discount > 0 && (
          <div className="flex justify-between text-red-600">
            <span>Diskon Total</span>
            <span>-{PrinterService.formatRupiah(transaction.discount)}</span>
          </div>
        )}
        {settings.showTax && transaction.tax > 0 && (
          <div className="flex justify-between">
            <span className="text-gray-600">PPN ({settings.taxRate}%)</span>
            <span>{PrinterService.formatRupiah(transaction.tax)}</span>
          </div>
        )}
        <div className="flex justify-between text-sm font-bold pt-1 border-t border-dashed border-gray-400 my-1">
          <span>TOTAL</span>
          <span className="text-base">{PrinterService.formatRupiah(transaction.total)}</span>
        </div>
        <div className="flex justify-between pt-0.5">
          <span className="text-gray-600">Metode</span>
          <span className="font-medium">{transaction.paymentMethod}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-600">Bayar</span>
          <span>{PrinterService.formatRupiah(transaction.paidAmount)}</span>
        </div>
        <div className="flex justify-between font-semibold">
          <span className="text-gray-600">Kembalian</span>
          <span>{PrinterService.formatRupiah(transaction.changeAmount)}</span>
        </div>
      </div>

      <div className="text-center text-gray-400 overflow-hidden my-1.5 select-none text-[10px]">
        {separatorText}
      </div>

      {/* 6. Footer Message */}
      {settings.footerMessage && (
        <div className="text-center text-[10px] text-gray-700 whitespace-pre-line leading-relaxed my-2">
          {settings.footerMessage}
        </div>
      )}

      {/* 7. Barcode simulation / footer mark */}
      {settings.showBarcode && (
        <div className="mt-3 pt-1 text-center">
          <div className="inline-block px-3 py-1 bg-gray-100 rounded border border-gray-300">
            <div className="tracking-[4px] font-mono text-[9px] font-bold text-gray-800">
              ||| | |||| | |||||| || | ||
            </div>
            <div className="text-[9px] text-gray-600 font-mono mt-0.5">
              {transaction.invoiceNumber}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
