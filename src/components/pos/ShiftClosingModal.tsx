import React, { useState, useEffect } from 'react';
import {
  X,
  Printer,
  Check,
  Calculator,
  Sun,
  Sunset,
  History,
  LogOut,
  Wallet
} from 'lucide-react';
import type { CashierShift, ReceiptSettings, ShiftClosing, Transaction } from '../../types';
import { db } from '../../db/db';
import { PrinterService } from '../../services/printerService';
import { SyncService } from '../../services/syncService';
import { ShiftReceiptView } from '../receipt/ShiftReceiptView';

interface ShiftClosingModalProps {
  isOpen: boolean;
  onClose: () => void;
  activeShift: CashierShift;
  cashierName: string;
  settings: ReceiptSettings;
  allowShiftToggle?: boolean;
  onSwitchShift?: () => void;
}

const OPENING_CASH_PRESETS = [0, 100000, 200000, 300000, 500000];

export const ShiftClosingModal: React.FC<ShiftClosingModalProps> = ({
  isOpen,
  onClose,
  activeShift,
  cashierName,
  settings,
  allowShiftToggle = true,
  onSwitchShift
}) => {
  const [selectedShift, setSelectedShift] = useState<CashierShift>(activeShift);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [recentClosings, setRecentClosings] = useState<ShiftClosing[]>([]);
  const [activeTab, setActiveTab] = useState<'REKAP' | 'RIWAYAT'>('REKAP');

  const [openingCashInput, setOpeningCashInput] = useState<string>('');
  const [actualCashInput, setActualCashInput] = useState<string>('');
  const [notes, setNotes] = useState('');

  const [savedClosing, setSavedClosing] = useState<ShiftClosing | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isPrinting, setIsPrinting] = useState(false);
  const [printFeedback, setPrintFeedback] = useState<string | null>(null);

  const loadData = async () => {
    const [txList, closings] = await Promise.all([
      db.transactions.toArray(),
      db.shiftClosings.reverse().toArray()
    ]);
    setTransactions(txList);
    setRecentClosings(closings.slice(0, 15));
  };

  useEffect(() => {
    if (!isOpen) return;
    setSelectedShift(activeShift);
    setActiveTab('REKAP');
    setSavedClosing(null);
    setPrintFeedback(null);
    setNotes('');
    setActualCashInput('');

    const storedOpening = localStorage.getItem(`senja_opening_cash_${activeShift}`);
    setOpeningCashInput(storedOpening || '');
    loadData();
  }, [isOpen, activeShift]);

  const handleSelectShift = (shift: CashierShift) => {
    setSelectedShift(shift);
    const storedOpening = localStorage.getItem(`senja_opening_cash_${shift}`);
    setOpeningCashInput(storedOpening || '');
  };

  if (!isOpen) return null;

  // Filter today's transactions for selected shift
  const now = new Date();
  const getTxShift = (tx: Transaction): CashierShift =>
    tx.shift || (new Date(tx.timestamp).getHours() < 14 ? 'Shift Pagi' : 'Shift Siang');

  const todayShiftTx = transactions.filter((tx) => {
    const d = new Date(tx.timestamp);
    const isSameDay =
      d.getDate() === now.getDate() &&
      d.getMonth() === now.getMonth() &&
      d.getFullYear() === now.getFullYear();
    return isSameDay && getTxShift(tx) === selectedShift;
  });

  const completedTx = todayShiftTx.filter((tx) => tx.status === 'COMPLETED');
  const voidTx = todayShiftTx.filter((tx) => tx.status === 'CANCELLED');

  const sumByMethod = (method: Transaction['paymentMethod']) =>
    completedTx.filter((t) => t.paymentMethod === method).reduce((acc, t) => acc + t.total, 0);

  const cashSales = sumByMethod('CASH');
  const qrisSales = sumByMethod('QRIS');
  const transferSales = sumByMethod('TRANSFER');
  const debitSales = sumByMethod('DEBIT');
  const kasbonSales = sumByMethod('KASBON');
  const nonCashSales = qrisSales + transferSales + debitSales + kasbonSales;
  const totalSales = cashSales + nonCashSales;

  const openingCash = parseInt(openingCashInput.replace(/[^0-9]/g, ''), 10) || 0;
  const expectedCashInDrawer = openingCash + cashSales;
  const hasActualCash = actualCashInput.trim().length > 0;
  const actualCashInDrawer = hasActualCash
    ? parseInt(actualCashInput.replace(/[^0-9]/g, ''), 10) || 0
    : undefined;
  const cashDifference =
    actualCashInDrawer !== undefined ? actualCashInDrawer - expectedCashInDrawer : undefined;

  const handleSaveAndPrint = async (shouldPrint: boolean) => {
    setIsSaving(true);
    setPrintFeedback(null);
    try {
      localStorage.setItem(`senja_opening_cash_${selectedShift}`, String(openingCash));

      const record: ShiftClosing = {
        closedAt: new Date().toISOString(),
        shift: selectedShift,
        cashierName: cashierName || 'Kasir',
        openingCash,
        cashSales,
        qrisSales,
        transferSales,
        debitSales,
        kasbonSales,
        nonCashSales,
        totalSales,
        transactionCount: completedTx.length,
        voidCount: voidTx.length,
        expectedCashInDrawer,
        ...(actualCashInDrawer !== undefined
          ? { actualCashInDrawer, cashDifference }
          : {}),
        notes: notes.trim() || undefined
      };

      const saved = await SyncService.addShiftClosing(record);
      setSavedClosing(saved);
      await loadData();

      if (shouldPrint) {
        setTimeout(async () => {
          setIsPrinting(true);
          try {
            const res = await PrinterService.printShiftClosing(
              'printable-shift-receipt',
              saved,
              settings
            );
            setPrintFeedback(res.message);
          } catch (err: any) {
            setPrintFeedback('Gagal mencetak: ' + (err?.message || err));
          } finally {
            setIsPrinting(false);
          }
        }, 120);
      }
    } catch (err) {
      console.error('Shift closing error:', err);
      alert('Gagal menyimpan rekap shift.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleReprintClosing = async (closing: ShiftClosing) => {
    setSavedClosing(closing);
    setTimeout(async () => {
      setIsPrinting(true);
      try {
        const res = await PrinterService.printShiftClosing(
          'printable-shift-receipt',
          closing,
          settings
        );
        setPrintFeedback(res.message);
      } catch (err: any) {
        setPrintFeedback('Gagal cetak ulang: ' + (err?.message || err));
      } finally {
        setIsPrinting(false);
      }
    }, 120);
  };

  return (
    <div className="fixed inset-0 z-50 bg-[#26201C]/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 animate-fade-in">
      <div className="bg-[#FAF8F5] border border-[#E5DDD0] rounded-3xl w-full max-w-xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh] animate-pop-in">
        {/* Header */}
        <div className="px-5 py-4 border-b border-[#E5DDD0] flex items-center justify-between bg-[#F2ECE2]/80 flex-shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-[#2A211B] text-[#FAF8F5] flex items-center justify-center">
              <Calculator className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-extrabold text-[#1F1A17]">
                {savedClosing ? 'Struk Serah-Terima Shift' : 'Tutup Kasir & Rekap Shift'}
              </h2>
              <p className="text-[11px] text-[#7D6F63]">
                {savedClosing
                  ? `${savedClosing.shift} • ${savedClosing.cashierName}`
                  : `Hitung uang laci & cetak rekap ${selectedShift}`}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="text-[#8C7E71] hover:text-[#1F1A17] p-1.5 rounded-xl hover:bg-[#E5DDD0] transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Sub Tabs when not in Receipt Preview */}
        {!savedClosing && (
          <div className="px-5 pt-3 flex items-center justify-between gap-2 flex-wrap border-b border-[#EFE9DF] pb-3 bg-[#FAF8F5]">
            <div className="flex gap-1 p-1 bg-[#EAE3D7] rounded-xl">
              <button
                type="button"
                onClick={() => setActiveTab('REKAP')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                  activeTab === 'REKAP'
                    ? 'bg-[#FAF8F5] text-[#1F1A17] shadow-2xs'
                    : 'text-[#6D6055]'
                }`}
              >
                Rekap Hari Ini
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('RIWAYAT')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1 transition-colors ${
                  activeTab === 'RIWAYAT'
                    ? 'bg-[#FAF8F5] text-[#1F1A17] shadow-2xs'
                    : 'text-[#6D6055]'
                }`}
              >
                <History className="w-3.5 h-3.5" />
                <span>Riwayat ({recentClosings.length})</span>
              </button>
            </div>

            {activeTab === 'REKAP' && allowShiftToggle && (
              <div className="flex gap-1 p-1 bg-[#F2ECE2] border border-[#E2D9CC] rounded-xl">
                {(['Shift Pagi', 'Shift Siang'] as const).map((s) => {
                  const Icon = s === 'Shift Pagi' ? Sun : Sunset;
                  const active = selectedShift === s;
                  return (
                    <button
                      key={s}
                      type="button"
                      onClick={() => handleSelectShift(s)}
                      className={`px-2.5 py-1 rounded-lg text-[11px] font-bold flex items-center gap-1 transition-colors ${
                        active
                          ? 'bg-[#285A3B] text-[#FAF8F5]'
                          : 'text-[#5E5248] hover:text-[#1F1A17]'
                      }`}
                    >
                      <Icon className="w-3 h-3" />
                      <span>{s === 'Shift Pagi' ? 'Pagi' : 'Siang'}</span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Body */}
        <div className="p-5 overflow-y-auto flex-1 space-y-4">
          {savedClosing ? (
            <div className="space-y-4">
              <div className="p-3 bg-[#EAF3EC] border border-[#C5E0CE] rounded-xl flex items-center gap-2.5 text-xs text-[#285A3B] font-semibold">
                <Check className="w-4 h-4 flex-shrink-0" />
                <span>Rekap {savedClosing.shift} tersimpan dan masuk ke laporan Owner.</span>
              </div>

              {printFeedback && (
                <div className="p-2.5 bg-[#EFE9DF] border border-[#DFD5C6] rounded-xl text-xs text-[#3D332B] text-center font-medium">
                  {printFeedback}
                </div>
              )}

              <div className="bg-[#EAE3D7]/50 border border-[#E5DDD0] rounded-2xl p-4 flex justify-center overflow-x-auto">
                <ShiftReceiptView closing={savedClosing} settings={settings} />
              </div>

              <div className="flex flex-wrap gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setSavedClosing(null)}
                  className="px-3.5 py-2.5 bg-[#EFE9DF] hover:bg-[#E5DDD0] text-[#3D332B] text-xs font-bold rounded-xl transition-colors"
                >
                  ← Kembali
                </button>
                <button
                  type="button"
                  disabled={isPrinting}
                  onClick={() => handleReprintClosing(savedClosing)}
                  className="flex-1 py-2.5 px-4 bg-[#2A211B] hover:bg-[#1A1410] text-[#FAF8F5] text-xs font-bold rounded-xl flex items-center justify-center gap-1.5 disabled:opacity-50"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>{isPrinting ? 'Mencetak...' : 'Cetak Struk Shift'}</span>
                </button>
                {onSwitchShift && (
                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      onSwitchShift();
                    }}
                    className="py-2.5 px-4 bg-[#285A3B] hover:bg-[#1E462D] text-[#FAF8F5] text-xs font-bold rounded-xl flex items-center justify-center gap-1.5"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    <span>Ganti Shift</span>
                  </button>
                )}
              </div>
            </div>
          ) : activeTab === 'RIWAYAT' ? (
            <div className="space-y-2.5">
              {recentClosings.length === 0 ? (
                <div className="py-12 text-center text-xs text-[#8C7E71]">
                  Belum ada riwayat tutup shift yang tersimpan.
                </div>
              ) : (
                recentClosings.map((item, idx) => (
                  <div
                    key={item.id || idx}
                    className="p-3.5 bg-[#F2ECE2]/60 border border-[#E5DDD0] rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-2.5"
                  >
                    <div className="space-y-0.5 text-xs">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            item.shift === 'Shift Pagi'
                              ? 'bg-[#EFE2D2] text-[#7A4B1A]'
                              : 'bg-[#DFECF4] text-[#255478]'
                          }`}
                        >
                          {item.shift}
                        </span>
                        <span className="font-bold text-[#1F1A17]">{item.cashierName}</span>
                        <span className="text-[11px] text-[#7D6F63] tabular-nums">
                          {PrinterService.formatDate(item.closedAt)}
                        </span>
                      </div>
                      <div className="text-[11px] text-[#5E5248] tabular-nums">
                        Laci: <strong className="text-[#1F1A17]">{PrinterService.formatRupiah(item.expectedCashInDrawer)}</strong>
                        {' • '}
                        Non-Tunai: <strong className="text-[#1F1A17]">{PrinterService.formatRupiah(item.nonCashSales)}</strong>
                        {typeof item.cashDifference === 'number' && item.actualCashInDrawer !== undefined && (
                          <span
                            className={`ml-1.5 font-bold ${
                              item.cashDifference === 0
                                ? 'text-[#285A3B]'
                                : 'text-[#9A3B3B]'
                            }`}
                          >
                            ({item.cashDifference === 0
                              ? 'Laci Pas'
                              : item.cashDifference > 0
                              ? `+${PrinterService.formatRupiah(item.cashDifference)}`
                              : `-${PrinterService.formatRupiah(Math.abs(item.cashDifference))}`})
                          </span>
                        )}
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleReprintClosing(item)}
                      className="px-3 py-1.5 bg-[#FAF8F5] hover:bg-[#EFE9DF] text-[#1F1A17] text-[11px] font-bold rounded-lg border border-[#D5C9B8] flex items-center gap-1 self-start sm:self-center flex-shrink-0"
                    >
                      <Printer className="w-3.5 h-3.5" />
                      <span>Lihat / Cetak</span>
                    </button>
                  </div>
                ))
              )}
            </div>
          ) : (
            <div className="space-y-4">
              {/* Opening Cash Input */}
              <div className="p-4 bg-[#F2ECE2]/70 border border-[#E5DDD0] rounded-2xl space-y-2.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-[#1F1A17] flex items-center gap-1.5">
                    <Wallet className="w-3.5 h-3.5 text-[#7A4B1A]" />
                    <span>Modal Awal Uang Laci (Kembalian)</span>
                  </label>
                  <span className="text-[11px] text-[#7D6F63]">{selectedShift}</span>
                </div>

                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-xs font-bold text-[#8A7D71]">
                    Rp
                  </span>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={openingCash > 0 ? openingCash.toLocaleString('id-ID') : ''}
                    onChange={(e) => setOpeningCashInput(e.target.value.replace(/[^0-9]/g, ''))}
                    placeholder="0 (contoh: 200.000)"
                    className="w-full pl-10 pr-4 py-2.5 bg-[#FAF8F5] border border-[#D5C9B8] rounded-xl text-sm font-extrabold text-[#1F1A17] focus:outline-none focus:border-[#2A211B] tabular-nums"
                  />
                </div>

                <div className="flex flex-wrap gap-1.5">
                  {OPENING_CASH_PRESETS.map((val) => (
                    <button
                      key={val}
                      type="button"
                      onClick={() => setOpeningCashInput(String(val))}
                      className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold border transition-colors ${
                        openingCash === val
                          ? 'bg-[#2A211B] text-[#FAF8F5] border-[#2A211B]'
                          : 'bg-[#FAF8F5] text-[#5E5248] border-[#DFD5C6] hover:bg-[#EFE9DF]'
                      }`}
                    >
                      {val === 0 ? 'Rp 0' : `Rp ${(val / 1000).toLocaleString('id-ID')}rb`}
                    </button>
                  ))}
                </div>
              </div>

              {/* Payment Summary Grid */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-[#1F1A17]">
                    Rincian Penjualan {selectedShift} (Hari Ini)
                  </span>
                  <span className="text-[11px] text-[#7D6F63] tabular-nums">
                    {completedTx.length} struk selesai
                    {voidTx.length > 0 ? ` • ${voidTx.length} batal` : ''}
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {[
                    { label: 'Tunai', amount: cashSales, accent: 'text-[#285A3B]' },
                    { label: 'QRIS', amount: qrisSales, accent: 'text-[#1F1A17]' },
                    { label: 'Transfer', amount: transferSales, accent: 'text-[#1F1A17]' },
                    { label: 'Debit / EDC', amount: debitSales, accent: 'text-[#1F1A17]' }
                  ].map((row) => (
                    <div
                      key={row.label}
                      className="p-2.5 bg-[#F5F2EB] border border-[#E5DDD0] rounded-xl"
                    >
                      <div className="text-[10px] font-semibold text-[#7D6F63]">{row.label}</div>
                      <div className={`text-xs font-extrabold mt-0.5 tabular-nums truncate ${row.accent}`}>
                        {PrinterService.formatRupiah(row.amount)}
                      </div>
                    </div>
                  ))}
                </div>

                {kasbonSales > 0 && (
                  <div className="px-3 py-2 bg-[#FDF6EC] border border-[#EED7B8] rounded-xl flex items-center justify-between text-xs">
                    <span className="font-semibold text-[#7A4B1A]">Member / Tab</span>
                    <span className="font-extrabold text-[#7A4B1A] tabular-nums">
                      {PrinterService.formatRupiah(kasbonSales)}
                    </span>
                  </div>
                )}

                <div className="px-3.5 py-2.5 bg-[#EFE9DF] border border-[#DFD5C6] rounded-xl flex items-center justify-between text-xs">
                  <span className="font-bold text-[#4D423A]">Total Omzet {selectedShift}</span>
                  <span className="text-sm font-black text-[#1F1A17] tabular-nums">
                    {PrinterService.formatRupiah(totalSales)}
                  </span>
                </div>
              </div>

              {/* Expected Drawer Cash Highlight */}
              <div className="p-4 bg-[#EAF3EC] border border-[#C5E0CE] rounded-2xl space-y-1.5">
                <div className="flex items-center justify-between text-[11px] text-[#285A3B] font-semibold">
                  <span>Uang Tunai Seharusnya di Laci</span>
                  <span className="tabular-nums">
                    {PrinterService.formatRupiah(openingCash)} + {PrinterService.formatRupiah(cashSales)}
                  </span>
                </div>
                <div className="text-2xl font-black text-[#1E462D] tabular-nums tracking-tight">
                  {PrinterService.formatRupiah(expectedCashInDrawer)}
                </div>
              </div>

              {/* Optional Physical Cash Verification */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-[#3D332B]">
                    Hitung Uang Fisik di Laci (Opsional)
                  </label>
                  <button
                    type="button"
                    onClick={() => setActualCashInput(String(expectedCashInDrawer))}
                    className="text-[11px] font-bold text-[#285A3B] hover:underline"
                  >
                    Isi Sesuai Seharusnya (Pas)
                  </button>
                </div>

                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-xs font-bold text-[#8A7D71]">
                    Rp
                  </span>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={hasActualCash ? Number(actualCashInDrawer).toLocaleString('id-ID') : ''}
                    onChange={(e) => setActualCashInput(e.target.value.replace(/[^0-9]/g, ''))}
                    placeholder="Masukkan total uang fisik di laci..."
                    className="w-full pl-10 pr-4 py-2 bg-[#F2ECE2] border border-[#D5C9B8] rounded-xl text-xs font-bold text-[#1F1A17] focus:outline-none focus:bg-[#FAF8F5] focus:border-[#2A211B] tabular-nums"
                  />
                </div>

                {hasActualCash && cashDifference !== undefined && (
                  <div
                    className={`px-3 py-2 rounded-xl border text-xs font-bold flex items-center justify-between ${
                      cashDifference === 0
                        ? 'bg-[#EAF3EC] border-[#C5E0CE] text-[#285A3B]'
                        : cashDifference > 0
                        ? 'bg-[#EEF4F8] border-[#C3D8E6] text-[#255478]'
                        : 'bg-[#FBEAE8] border-[#F2C2BD] text-[#9A3B3B]'
                    }`}
                  >
                    <span>Selisih Uang Laci:</span>
                    <span className="tabular-nums">
                      {cashDifference === 0
                        ? 'Pas (Rp 0)'
                        : cashDifference > 0
                        ? `Lebih +${PrinterService.formatRupiah(cashDifference)}`
                        : `Kurang -${PrinterService.formatRupiah(Math.abs(cashDifference))}`}
                    </span>
                  </div>
                )}
              </div>

              {/* Handover Notes */}
              <div>
                <label className="block text-xs font-bold text-[#3D332B] mb-1">
                  Catatan Serah-Terima (Opsional)
                </label>
                <input
                  type="text"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Misal: Diserahkan ke kasir siang / uang pecahan siap"
                  className="w-full px-3.5 py-2 bg-[#F2ECE2] border border-[#D5C9B8] rounded-xl text-xs text-[#1F1A17] focus:outline-none focus:bg-[#FAF8F5] focus:border-[#2A211B]"
                />
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        {!savedClosing && activeTab === 'REKAP' && (
          <div className="px-5 py-4 border-t border-[#E5DDD0] bg-[#FAF8F5] flex flex-wrap items-center gap-2 flex-shrink-0">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 bg-[#EFE9DF] hover:bg-[#E5DDD0] text-[#3D332B] text-xs font-bold rounded-xl transition-colors"
            >
              Batal
            </button>
            <button
              type="button"
              disabled={isSaving}
              onClick={() => handleSaveAndPrint(false)}
              className="px-4 py-2.5 bg-[#FAF8F5] hover:bg-[#F2ECE2] text-[#1F1A17] border border-[#D5C9B8] text-xs font-bold rounded-xl transition-colors disabled:opacity-50"
            >
              Simpan Saja
            </button>
            <button
              type="button"
              disabled={isSaving}
              onClick={() => handleSaveAndPrint(true)}
              className="flex-1 py-2.5 px-4 bg-[#2A211B] hover:bg-[#1A1410] text-[#FAF8F5] text-xs font-bold rounded-xl flex items-center justify-center gap-1.5 transition-colors disabled:opacity-50"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>{isSaving ? 'Menyimpan...' : 'Simpan & Cetak Struk Shift'}</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
