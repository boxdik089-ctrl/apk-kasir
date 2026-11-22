import React from 'react';
import type { ShiftClosing, ReceiptSettings } from '../../types';
import { PrinterService } from '../../services/printerService';

interface ShiftReceiptViewProps {
  closing: ShiftClosing;
  settings: ReceiptSettings;
  className?: string;
}

export const ShiftReceiptView: React.FC<ShiftReceiptViewProps> = ({
  closing,
  settings,
  className = ''
}) => {
  const is80mm = settings.paperWidth === '80mm';
  const widthClass = is80mm ? 'w-[360px]' : 'w-[280px]';
  const sepChar = settings.separatorChar || '-';
  const separatorText = sepChar.repeat(is80mm ? 42 : 32);

  const hasDiff = closing.actualCashInDrawer !== undefined;
  const diff = closing.cashDifference || 0;

  return (
    <div
      id="printable-shift-receipt"
      className={`${widthClass} bg-white text-black p-4 mx-auto rounded shadow-sm text-xs select-none ${
        settings.fontFamily === 'monospace' ? 'font-mono' : 'font-sans'
      } ${className}`}
      style={{
        lineHeight: '1.35',
        filter: 'contrast(120%)'
      }}
    >
      {/* Store Header */}
      <div className="text-center">
        <h2 className="text-base font-bold tracking-tight uppercase">
          {settings.storeName || 'SENJA COFFEE & EATERY'}
        </h2>
        {settings.address && (
          <p className="text-[10px] text-gray-700 whitespace-pre-line mt-0.5">
            {settings.address}
          </p>
        )}
        <div className="mt-1.5 text-xs font-extrabold tracking-wide uppercase">
          REKAP TUTUP SHIFT
        </div>
      </div>

      <div className="text-center text-gray-400 overflow-hidden my-1.5 text-[10px]">
        {separatorText}
      </div>

      {/* Shift Meta */}
      <div className="space-y-0.5 text-[11px]">
        <div className="flex justify-between">
          <span className="text-gray-600">Waktu Tutup</span>
          <span>{PrinterService.formatDate(closing.closedAt)}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-600">Shift</span>
          <span className="font-bold">{closing.shift}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-600">Kasir</span>
          <span className="font-semibold">{closing.cashierName || 'Kasir'}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-600">Transaksi Selesai</span>
          <span className="tabular-nums">{closing.transactionCount} struk</span>
        </div>
        {closing.voidCount > 0 && (
          <div className="flex justify-between">
            <span className="text-gray-600">Transaksi Batal</span>
            <span className="tabular-nums">{closing.voidCount} struk</span>
          </div>
        )}
      </div>

      <div className="text-center text-gray-400 overflow-hidden my-1.5 text-[10px]">
        {separatorText}
      </div>

      {/* Payment Breakdown */}
      <div className="space-y-0.5 text-[11px]">
        <div className="font-bold uppercase text-[10px] text-gray-700 mb-0.5">
          Rincian Penjualan
        </div>
        <div className="flex justify-between">
          <span>Tunai</span>
          <span className="tabular-nums">{PrinterService.formatRupiah(closing.cashSales)}</span>
        </div>
        <div className="flex justify-between">
          <span>QRIS</span>
          <span className="tabular-nums">{PrinterService.formatRupiah(closing.qrisSales)}</span>
        </div>
        <div className="flex justify-between">
          <span>Transfer</span>
          <span className="tabular-nums">{PrinterService.formatRupiah(closing.transferSales)}</span>
        </div>
        <div className="flex justify-between">
          <span>Debit / EDC</span>
          <span className="tabular-nums">{PrinterService.formatRupiah(closing.debitSales)}</span>
        </div>
        {closing.kasbonSales > 0 && (
          <div className="flex justify-between">
            <span>Member / Tab</span>
            <span className="tabular-nums">{PrinterService.formatRupiah(closing.kasbonSales)}</span>
          </div>
        )}
        <div className="flex justify-between font-bold pt-1 border-t border-dashed border-gray-300 text-xs">
          <span>TOTAL OMZET SHIFT</span>
          <span className="tabular-nums">{PrinterService.formatRupiah(closing.totalSales)}</span>
        </div>
      </div>

      <div className="text-center text-gray-400 overflow-hidden my-1.5 text-[10px]">
        {separatorText}
      </div>

      {/* Cash Drawer Calculation */}
      <div className="space-y-0.5 text-[11px]">
        <div className="font-bold uppercase text-[10px] text-gray-700 mb-0.5">
          Perhitungan Uang Laci
        </div>
        <div className="flex justify-between">
          <span>Modal Awal Laci</span>
          <span className="tabular-nums">{PrinterService.formatRupiah(closing.openingCash)}</span>
        </div>
        <div className="flex justify-between">
          <span>+ Penjualan Tunai</span>
          <span className="tabular-nums">{PrinterService.formatRupiah(closing.cashSales)}</span>
        </div>
        <div className="flex justify-between font-extrabold pt-1 border-t border-dashed border-gray-300 text-xs">
          <span>SEHARUSNYA DI LACI</span>
          <span className="tabular-nums">{PrinterService.formatRupiah(closing.expectedCashInDrawer)}</span>
        </div>

        {hasDiff && (
          <>
            <div className="flex justify-between pt-1">
              <span>Uang Fisik Di Laci</span>
              <span className="font-bold tabular-nums">
                {PrinterService.formatRupiah(closing.actualCashInDrawer!)}
              </span>
            </div>
            <div className="flex justify-between font-bold">
              <span>Selisih Kas</span>
              <span className="tabular-nums">
                {diff === 0
                  ? 'PAS (Rp 0)'
                  : diff > 0
                  ? `Lebih +${PrinterService.formatRupiah(diff)}`
                  : `Kurang -${PrinterService.formatRupiah(Math.abs(diff))}`}
              </span>
            </div>
          </>
        )}
      </div>

      {closing.notes && (
        <>
          <div className="text-center text-gray-400 overflow-hidden my-1.5 text-[10px]">
            {separatorText}
          </div>
          <div className="text-[10px] text-gray-800 whitespace-pre-line">
            <span className="font-bold">Catatan:</span> {closing.notes}
          </div>
        </>
      )}

      <div className="text-center text-gray-400 overflow-hidden my-2 text-[10px]">
        {separatorText}
      </div>

      <div className="grid grid-cols-2 gap-4 pt-1 text-center text-[10px] text-gray-700">
        <div>
          <div className="mb-7">Kasir Shift</div>
          <div className="border-t border-gray-400 pt-0.5 font-semibold">
            {closing.cashierName || 'Kasir'}
          </div>
        </div>
        <div>
          <div className="mb-7">Penerima / Owner</div>
          <div className="border-t border-gray-400 pt-0.5 font-semibold">
            ........................
          </div>
        </div>
      </div>
    </div>
  );
};
