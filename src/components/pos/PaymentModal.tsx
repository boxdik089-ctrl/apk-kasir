import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  Printer,
  Check,
  Wallet,
  QrCode,
  CreditCard,
  Building2,
  BookOpen,
  ArrowRight
} from 'lucide-react';
import type { CartItem, PaymentMethod, Transaction, ReceiptSettings, CashierShift } from '../../types';
import { PrinterService } from '../../services/printerService';
import { SyncService } from '../../services/syncService';
import { ReceiptView } from '../receipt/ReceiptView';

interface PaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  items: CartItem[];
  subtotal: number;
  discount: number;
  tax: number;
  total: number;
  cashierName: string;
  activeShift?: CashierShift;
  initialCustomerName?: string;
  settings: ReceiptSettings;
  onTransactionComplete: (transaction: Transaction) => void;
}

export const PaymentModal: React.FC<PaymentModalProps> = ({
  isOpen,
  onClose,
  items,
  subtotal,
  discount,
  tax,
  total,
  cashierName,
  activeShift = 'Shift Pagi',
  initialCustomerName = '',
  settings,
  onTransactionComplete
}) => {
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('CASH');
  const [paidInput, setPaidInput] = useState<string>('');
  const [customerName, setCustomerName] = useState<string>(initialCustomerName);
  const [isCompleted, setIsCompleted] = useState<boolean>(false);
  const [completedTx, setCompletedTx] = useState<Transaction | null>(null);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [isPrinting, setIsPrinting] = useState<boolean>(false);
  const [printFeedback, setPrintFeedback] = useState<string | null>(null);
  const [lockedTotal, setLockedTotal] = useState<number>(total);
  const wasOpenRef = useRef(false);

  // Only reset form state when modal transitions from closed -> open
  useEffect(() => {
    if (isOpen && !wasOpenRef.current) {
      setPaymentMethod('CASH');
      setLockedTotal(total);
      setPaidInput(total > 0 ? String(total) : '');
      setCustomerName(initialCustomerName);
      setIsCompleted(false);
      setCompletedTx(null);
      setIsSaving(false);
      setIsPrinting(false);
      setPrintFeedback(null);
    }
    wasOpenRef.current = isOpen;
  }, [isOpen, total, initialCustomerName]);

  if (!isOpen) return null;

  const activeTotal = isCompleted && completedTx ? completedTx.total : lockedTotal;
  const numericPaid = parseFloat(paidInput.replace(/[^0-9]/g, '')) || 0;
  const changeAmount = Math.max(0, numericPaid - activeTotal);
  const isPayDisabled = isSaving || (paymentMethod === 'CASH' && numericPaid < activeTotal);

  const quickCashOptions = [
    { label: 'Uang Pas', amount: activeTotal },
    { label: 'Rp 20.000', amount: 20000 },
    { label: 'Rp 50.000', amount: 50000 },
    { label: 'Rp 100.000', amount: 100000 },
    { label: 'Rp 150.000', amount: 150000 },
    { label: 'Rp 200.000', amount: 200000 }
  ].filter((opt) => opt.amount >= activeTotal || opt.label === 'Uang Pas');

  const handleProcessPayment = async (shouldPrint: boolean) => {
    if (isSaving) return;
    const finalPaid = paymentMethod === 'CASH' ? numericPaid : activeTotal;
    if (paymentMethod === 'CASH' && finalPaid < activeTotal) {
      alert('Nominal uang diterima masih kurang dari total tagihan.');
      return;
    }

    setIsSaving(true);
    const finalChange = paymentMethod === 'CASH' ? Math.max(0, finalPaid - activeTotal) : 0;
    const now = new Date();
    const invoiceNumber = `INV-${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}-${String(Math.floor(1000 + Math.random() * 9000))}`;

    const newTransaction: Transaction = {
      invoiceNumber,
      timestamp: now.toISOString(),
      cashierName: cashierName || 'Kasir',
      shift: activeShift,
      customerName: customerName.trim() || undefined,
      items: [...items],
      subtotal,
      discount,
      tax,
      total: activeTotal,
      paidAmount: finalPaid,
      changeAmount: finalChange,
      paymentMethod,
      status: 'COMPLETED'
    };

    try {
      const savedTx = await SyncService.addTransaction(newTransaction);

      setCompletedTx(savedTx);
      setIsCompleted(true);
      onTransactionComplete(savedTx);

      // Wait briefly so #printable-receipt mounts into DOM before printing
      if (shouldPrint || settings.autoPrintOnPayment) {
        setIsPrinting(true);
        setTimeout(async () => {
          try {
            const res = await PrinterService.print(
              'printable-receipt',
              savedTx,
              settings
            );
            setPrintFeedback(res.message);
          } catch (printErr: any) {
            setPrintFeedback('Gagal cetak: ' + (printErr?.message || printErr));
          } finally {
            setIsPrinting(false);
          }
        }, 80);
      }
    } catch (err) {
      console.error('Payment processing error:', err);
      alert('Gagal memproses transaksi.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleManualPrint = async () => {
    if (!completedTx) return;
    setIsPrinting(true);
    try {
      const res = await PrinterService.print(
        'printable-receipt',
        completedTx,
        settings
      );
      setPrintFeedback(res.message);
    } catch (err: any) {
      setPrintFeedback('Gagal cetak: ' + (err?.message || err));
    } finally {
      setIsPrinting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-[#26201C]/60 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in">
      <div className="bg-[#FAF8F5] border border-[#E8E1D7] rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col max-h-[92vh] animate-pop-in">
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-[#E8E1D7] flex items-center justify-between bg-[#F5F2EB]/90 flex-shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-[#EDE6DC] text-[#7A4B1A] flex items-center justify-center">
              <Wallet className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-[#26201C]">
                {isCompleted ? 'Pembayaran Berhasil' : 'Kasir Pembayaran'}
              </h2>
              <p className="text-[11px] text-[#786C61]">
                {isCompleted
                  ? 'Transaksi sudah tersimpan ke Riwayat & Laporan'
                  : 'Selesaikan transaksi & simpan ke laporan'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-[#8A7D71] hover:text-[#26201C] p-1.5 rounded-xl hover:bg-[#EDE6DC] transition active:scale-95"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto flex-1">
          {!isCompleted ? (
            <div className="space-y-5">
              {/* Total Display Banner */}
              <div className="p-4 bg-[#EDE6DC]/70 border border-[#DFD5C6] rounded-2xl flex items-center justify-between shadow-2xs">
                <div>
                  <span className="text-[11px] uppercase tracking-wider text-[#786C61] font-bold">
                    Total Tagihan Pesanan
                  </span>
                  <div className="text-2xl font-black text-[#26201C] mt-0.5 tracking-tight tabular-nums">
                    {PrinterService.formatRupiah(activeTotal)}
                  </div>
                </div>
                <div className="text-right text-xs text-[#786C61]">
                  <div className="font-semibold text-[#26201C]">{items.length} Menu Pesanan</div>
                  <div>Kasir: <span className="text-[#26201C] font-semibold">{cashierName}</span></div>
                </div>
              </div>

              {/* Payment Method Tabs */}
              <div>
                <label className="block text-xs font-bold text-[#3D322A] mb-2">
                  Metode Pembayaran:
                </label>
                <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
                  {[
                    { id: 'CASH', label: 'Tunai', icon: Wallet },
                    { id: 'QRIS', label: 'QRIS', icon: QrCode },
                    { id: 'TRANSFER', label: 'Transfer', icon: Building2 },
                    { id: 'DEBIT', label: 'Debit/EDC', icon: CreditCard },
                    { id: 'KASBON', label: 'Member/Tab', icon: BookOpen }
                  ].map((m) => {
                    const Icon = m.icon;
                    const isSelected = paymentMethod === m.id;
                    return (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => {
                          setPaymentMethod(m.id as PaymentMethod);
                          setPaidInput(String(activeTotal));
                        }}
                        className={`flex flex-col items-center gap-1.5 p-3 rounded-2xl border text-xs font-bold transition-all active:scale-95 ${
                          isSelected
                            ? 'bg-[#2D241E] text-[#FDFCFB] border-[#2D241E] shadow-sm scale-[1.02]'
                            : 'bg-[#F5F2EB] text-[#5C4F45] border-[#E8E1D7] hover:bg-[#EDE6DC] hover:text-[#26201C]'
                        }`}
                      >
                        <Icon className="w-4 h-4" />
                        <span>{m.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Cash Input & Quick Presets */}
              {paymentMethod === 'CASH' && (
                <div className="space-y-3">
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="text-xs font-bold text-[#3D322A]">
                        Nominal Uang Diterima:
                      </label>
                      {paidInput && (
                        <button
                          type="button"
                          onClick={() => setPaidInput('')}
                          className="text-[11px] font-semibold text-[#7A4B1A] hover:underline"
                        >
                          Kosongkan
                        </button>
                      )}
                    </div>
                    <div className="relative">
                      <span className="absolute left-4 top-1/2 -translate-y-1/2 text-[#8A7D71] font-bold text-base">
                        Rp
                      </span>
                      <input
                        type="text"
                        autoFocus
                        onFocus={(e) => e.target.select()}
                        value={paidInput ? Number(paidInput).toLocaleString('id-ID') : ''}
                        onChange={(e) => {
                          const raw = e.target.value.replace(/[^0-9]/g, '');
                          setPaidInput(raw);
                        }}
                        placeholder="0"
                        className="w-full pl-12 pr-4 py-3 bg-[#F5F2EB] border border-[#D5C9B8] rounded-2xl text-xl font-bold text-[#26201C] focus:outline-none focus:bg-[#FAF8F5] focus:border-[#2D241E] focus:ring-2 focus:ring-[#2D241E]/10 transition tabular-nums"
                      />
                    </div>
                  </div>

                  {/* Quick Cash Presets */}
                  <div className="flex flex-wrap gap-2 pt-1">
                    {quickCashOptions.map((opt, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => setPaidInput(String(opt.amount))}
                        className={`px-3 py-1.5 text-xs font-semibold rounded-xl border transition-all active:scale-95 ${
                          numericPaid === opt.amount
                            ? 'bg-[#2A211B] text-[#FAF8F5] border-[#2A211B]'
                            : 'bg-[#EDE6DC] hover:bg-[#E2D8C9] text-[#3D322A] border-[#DFD5C6]'
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>

                  {/* Change Calculation Box */}
                  <div className="p-3.5 bg-[#F5F2EB] border border-[#E8E1D7] rounded-2xl flex items-center justify-between">
                    <span className="text-xs font-bold text-[#786C61]">Kembalian:</span>
                    <span
                      className={`text-xl font-black tabular-nums ${
                        changeAmount > 0
                          ? 'text-[#285A3B]'
                          : numericPaid >= activeTotal
                          ? 'text-[#26201C]'
                          : 'text-[#9A3B3B]'
                      }`}
                    >
                      {numericPaid < activeTotal
                        ? `Kurang ${PrinterService.formatRupiah(activeTotal - numericPaid)}`
                        : PrinterService.formatRupiah(changeAmount)}
                    </span>
                  </div>
                </div>
              )}

              {/* Optional Customer Name / Table */}
              <div>
                <label className="block text-xs font-bold text-[#3D322A] mb-1.5">
                  Nomor Meja / Nama Pelanggan (Opsional):
                </label>
                <input
                  type="text"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  placeholder="Contoh: Meja 04 / Kak Sarah (Dine-in)"
                  className="w-full px-4 py-2.5 bg-[#F5F2EB] border border-[#D5C9B8] rounded-2xl text-xs font-medium text-[#26201C] placeholder-[#A09386] focus:outline-none focus:bg-[#FAF8F5] focus:border-[#2D241E] focus:ring-2 focus:ring-[#2D241E]/10 transition"
                />
              </div>
            </div>
          ) : (
            /* Success State */
            <div className="text-center py-3 space-y-4 animate-pop-in">
              <div className="w-14 h-14 bg-[#EAF3EC] text-[#285A3B] rounded-full flex items-center justify-center mx-auto shadow-xs">
                <Check className="w-7 h-7 stroke-[3]" />
              </div>

              <div>
                <h3 className="text-base font-bold text-[#26201C]">
                  Pembayaran Tersimpan di Laporan
                </h3>
                <p className="text-xs text-[#786C61] mt-0.5 font-mono">
                  {completedTx?.invoiceNumber}
                </p>
              </div>

              {completedTx && (
                <div className="p-4 bg-[#F5F2EB] rounded-2xl border border-[#E8E1D7] max-w-sm mx-auto text-xs space-y-2 text-left">
                  <div className="flex justify-between text-[#5C4F45]">
                    <span>Total Tagihan:</span>
                    <span className="text-[#26201C] font-bold tabular-nums">
                      {PrinterService.formatRupiah(completedTx.total)}
                    </span>
                  </div>
                  <div className="flex justify-between text-[#5C4F45]">
                    <span>Bayar ({completedTx.paymentMethod}):</span>
                    <span className="text-[#26201C] font-bold tabular-nums">
                      {PrinterService.formatRupiah(completedTx.paidAmount)}
                    </span>
                  </div>
                  <div className="flex justify-between text-[#5C4F45] pt-2 border-t border-[#E8E1D7]">
                    <span className="font-bold text-[#285A3B]">Kembalian:</span>
                    <span className="text-[#285A3B] font-black text-base tabular-nums">
                      {PrinterService.formatRupiah(completedTx.changeAmount)}
                    </span>
                  </div>
                </div>
              )}

              {printFeedback && (
                <div className="p-2.5 bg-[#EDE6DC] border border-[#DFD5C6] rounded-xl text-xs text-[#3D322A] max-w-sm mx-auto">
                  {printFeedback}
                </div>
              )}

              <div className="flex items-center justify-center gap-2 pt-2">
                <button
                  type="button"
                  onClick={handleManualPrint}
                  disabled={isPrinting}
                  className="inline-flex items-center gap-1.5 px-4 py-2.5 bg-[#EDE6DC] hover:bg-[#E2D8C9] active:scale-95 text-[#3D322A] text-xs font-bold rounded-xl border border-[#DFD5C6] transition-all"
                >
                  <Printer className="w-4 h-4 text-[#7A4B1A]" />
                  {isPrinting ? 'Mencetak...' : 'Cetak Struk Lagi'}
                </button>

                <button
                  type="button"
                  onClick={onClose}
                  className="inline-flex items-center gap-1.5 px-5 py-2.5 bg-[#2D241E] hover:bg-[#1E1713] active:scale-95 text-[#FDFCFB] text-xs font-bold rounded-xl shadow-sm transition-all"
                >
                  <span>Pesanan Baru</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>

              {/* Hidden off-screen receipt for printing */}
              {completedTx && (
                <div className="fixed -left-[9999px] top-0 pointer-events-none print:left-0 print:top-0 print:pointer-events-auto">
                  <ReceiptView transaction={completedTx} settings={settings} />
                </div>
              )}
            </div>
          )}
        </div>

        {/* Modal Footer (When not completed) */}
        {!isCompleted && (
          <div className="px-6 py-4 border-t border-[#E8E1D7] bg-[#F5F2EB]/90 flex flex-wrap items-center justify-end gap-2 flex-shrink-0">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 bg-[#FAF8F5] hover:bg-[#EDE6DC] active:scale-95 text-[#5C4F45] text-xs font-bold rounded-xl border border-[#E8E1D7] transition-all"
            >
              Batal
            </button>

            <button
              type="button"
              disabled={isPayDisabled}
              onClick={() => handleProcessPayment(false)}
              className="px-4 py-2.5 bg-[#EDE6DC] hover:bg-[#E2D8C9] active:scale-95 text-[#3D322A] text-xs font-bold rounded-xl border border-[#DFD5C6] transition-all disabled:opacity-40"
            >
              {isSaving ? 'Menyimpan...' : 'Bayar Tanpa Struk'}
            </button>

            <button
              type="button"
              disabled={isPayDisabled}
              onClick={() => handleProcessPayment(true)}
              className="flex items-center gap-1.5 px-5 py-2.5 bg-[#285A3B] hover:bg-[#1E442C] active:scale-95 text-white text-xs font-bold rounded-xl shadow-sm transition-all disabled:opacity-40"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>{isSaving ? 'Menyimpan...' : 'Bayar & Cetak'}</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
