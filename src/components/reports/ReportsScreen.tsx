import React, { useState, useEffect } from 'react';
import { 
  Receipt, 
  Printer, 
  Download, 
  Eye, 
  X, 
  Search, 
  Award,
  Calculator
} from 'lucide-react';
import type { Transaction, ReceiptSettings, UserRole, CashierShift } from '../../types';
import { ReceiptView } from '../receipt/ReceiptView';
import { ShiftClosingModal } from '../pos/ShiftClosingModal';
import { PrinterService } from '../../services/printerService';
import { SyncService } from '../../services/syncService';
import { db } from '../../db/db';

interface ReportsScreenProps {
  settings: ReceiptSettings;
  userRole: UserRole;
  ownerPin: string;
  activeShift?: CashierShift;
  activeCashierName?: string;
}

export const ReportsScreen: React.FC<ReportsScreenProps> = ({
  settings,
  userRole,
  activeShift = 'Shift Pagi',
  activeCashierName = 'Kasir'
}) => {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [timeFilter, setTimeFilter] = useState<'today' | '7days' | 'month' | 'all'>('today');
  const [shiftFilter, setShiftFilter] = useState<'ALL' | CashierShift>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTx, setSelectedTx] = useState<Transaction | null>(null);
  const [voidTargetTx, setVoidTargetTx] = useState<Transaction | null>(null);
  const [voidReason, setVoidReason] = useState('');
  const [voidError, setVoidError] = useState<string | null>(null);
  const [isVoiding, setIsVoiding] = useState(false);
  const [isReprinting, setIsReprinting] = useState(false);
  const [reprintFeedback, setReprintFeedback] = useState<string | null>(null);
  const [isShiftClosingOpen, setIsShiftClosingOpen] = useState(false);

  const loadTransactions = async () => {
    try {
      const list = await db.transactions.reverse().toArray();
      setTransactions(list);
    } catch (err) {
      console.error('Error loading transactions:', err);
    }
  };

  useEffect(() => {
    loadTransactions();
    const unsubscribe = SyncService.subscribe(() => {
      loadTransactions();
    });
    return unsubscribe;
  }, []);

  // Filter by date range
  const filteredByDate = transactions.filter((tx) => {
    if (timeFilter === 'all') return true;
    const txDate = new Date(tx.timestamp);
    const now = new Date();

    if (timeFilter === 'today') {
      return (
        txDate.getDate() === now.getDate() &&
        txDate.getMonth() === now.getMonth() &&
        txDate.getFullYear() === now.getFullYear()
      );
    }
    if (timeFilter === '7days') {
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(now.getDate() - 7);
      return txDate >= sevenDaysAgo;
    }
    if (timeFilter === 'month') {
      return (
        txDate.getMonth() === now.getMonth() &&
        txDate.getFullYear() === now.getFullYear()
      );
    }
    return true;
  });

  // Filter by shift (supports inferring legacy tx shift by hour if shift field absent)
  const getTxShift = (tx: Transaction): CashierShift => {
    if (tx.shift) return tx.shift;
    return new Date(tx.timestamp).getHours() < 14 ? 'Shift Pagi' : 'Shift Siang';
  };

  const filteredByShift = filteredByDate.filter((tx) => {
    if (shiftFilter === 'ALL') return true;
    return getTxShift(tx) === shiftFilter;
  });

  // Filter by search query (invoice number or customer name)
  const displayTransactions = filteredByShift.filter((tx) => {
    const q = searchQuery.toLowerCase();
    const matchesInv = tx.invoiceNumber.toLowerCase().includes(q);
    const matchesCustomer = tx.customerName?.toLowerCase().includes(q) ?? false;
    const matchesCashier = tx.cashierName.toLowerCase().includes(q);
    return matchesInv || matchesCustomer || matchesCashier;
  });

  // KPI Calculations (scoped to selected time + shift)
  const completedInScope = filteredByShift.filter((tx) => tx.status === 'COMPLETED');
  const totalRevenue = completedInScope.reduce((acc, tx) => acc + tx.total, 0);
  const cashTotal = completedInScope.filter((t) => t.paymentMethod === 'CASH').reduce((acc, t) => acc + t.total, 0);
  const nonCashTotal = totalRevenue - cashTotal;

  const avgOrderValue = completedInScope.length > 0 ? Math.round(totalRevenue / completedInScope.length) : 0;

  // Best Selling Items calculation
  const productSalesMap: { [name: string]: { qty: number; revenue: number } } = {};
  for (const tx of completedInScope) {
    if (tx.status === 'COMPLETED') {
      for (const item of tx.items) {
        if (!productSalesMap[item.name]) {
          productSalesMap[item.name] = { qty: 0, revenue: 0 };
        }
        productSalesMap[item.name].qty += item.quantity;
        productSalesMap[item.name].revenue += item.subtotal;
      }
    }
  }
  const topProducts = Object.entries(productSalesMap)
    .map(([name, data]) => ({ name, ...data }))
    .sort((a, b) => b.qty - a.qty)
    .slice(0, 5);

  // Re-print Receipt
  const handleReprint = async (tx: Transaction) => {
    setIsReprinting(true);
    setReprintFeedback('Sedang mencetak ulang struk...');
    try {
      const res = await PrinterService.print('printable-receipt', tx, settings);
      setReprintFeedback(res.message);
    } catch (err: any) {
      setReprintFeedback('Gagal cetak ulang: ' + (err.message || err));
    } finally {
      setIsReprinting(false);
      setTimeout(() => setReprintFeedback(null), 5000);
    }
  };

  // Void/Cancel Transaction (Records reason to Audit Log, no PIN prompt)
  const handleConfirmVoid = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!voidTargetTx?.id) return;
    if (!voidReason.trim()) {
      setVoidError('Alasan pembatalan wajib diisi.');
      return;
    }
    setIsVoiding(true);
    setVoidError(null);
    try {
      const res = await SyncService.voidTransaction(
        voidTargetTx.id,
        '',
        voidReason.trim(),
        userRole === 'OWNER' ? 'Owner' : voidTargetTx.cashierName
      );
      if (!res.ok) {
        setVoidError(res.error || 'Gagal membatalkan transaksi.');
        return;
      }
      setVoidTargetTx(null);
      setVoidReason('');
      setSelectedTx(null);
      loadTransactions();
    } finally {
      setIsVoiding(false);
    }
  };

  // Export to CSV
  const handleExportCSV = () => {
    const headers = ['No Struk', 'Tanggal Waktu', 'Shift', 'Kasir', 'Pelanggan', 'Metode Bayar', 'Subtotal', 'Diskon', 'Total', 'Status'];
    const rows = filteredByShift.map((tx) => [
      `"${tx.invoiceNumber}"`,
      `"${tx.timestamp}"`,
      `"${getTxShift(tx)}"`,
      `"${tx.cashierName}"`,
      `"${tx.customerName || '-'}"`,
      tx.paymentMethod,
      tx.subtotal,
      tx.discount,
      tx.total,
      tx.status
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `laporan_penjualan_${timeFilter}_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="flex-1 overflow-y-auto p-3.5 sm:p-6 bg-[#F6F3EC] text-[#1F1A17] animate-fade-in">
      <div className="max-w-6xl mx-auto">
      {/* Header */}
      <div className="pb-4 sm:pb-5 border-b border-[#E5DDD0] flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-base sm:text-lg font-extrabold text-[#1F1A17] tracking-tight">
            Laporan Penjualan & Riwayat
          </h1>
          <p className="text-xs text-[#7D6F63] mt-0.5">
            Rekap omzet, detail pesanan, dan arsip cetak ulang struk.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setIsShiftClosingOpen(true)}
            className="flex items-center gap-1.5 px-3 py-2 bg-[#2A211B] hover:bg-[#1A1410] active:scale-[0.98] text-[#FAF8F5] text-xs font-bold rounded-lg transition-colors"
          >
            <Calculator className="w-3.5 h-3.5" />
            <span>Rekap Tutup Shift</span>
          </button>

          <button
            type="button"
            onClick={handleExportCSV}
            className="flex items-center gap-1.5 px-3 py-2 bg-[#FAF8F5] hover:bg-[#EFE9DF] active:scale-[0.98] text-[#3D332B] text-xs font-semibold rounded-lg border border-[#E5DDD0] transition-colors"
          >
            <Download className="w-3.5 h-3.5 text-[#6D6055]" />
            <span>Export CSV</span>
          </button>
        </div>
      </div>

      {/* Time & Shift Filter Bar */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-2.5 my-4 sm:my-5">
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1 bg-[#FAF8F5] p-1 rounded-lg border border-[#E5DDD0] overflow-x-auto no-scrollbar">
            {[
              { id: 'today', label: 'Hari Ini' },
              { id: '7days', label: '7 Hari' },
              { id: 'month', label: 'Bulan Ini' },
              { id: 'all', label: 'Semua' }
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setTimeFilter(tab.id as any)}
                className={`px-3 py-1.5 rounded-md text-xs font-semibold whitespace-nowrap transition-colors ${
                  timeFilter === tab.id
                    ? 'bg-[#2A211B] text-[#FAF8F5]'
                    : 'text-[#6D6055] hover:text-[#1F1A17] hover:bg-[#EFE9DF]'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-1 bg-[#FAF8F5] p-1 rounded-lg border border-[#E5DDD0]">
            {([
              { id: 'ALL', label: 'Semua Shift' },
              { id: 'Shift Pagi', label: 'Shift Pagi' },
              { id: 'Shift Siang', label: 'Shift Siang' }
            ] as const).map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => setShiftFilter(s.id)}
                className={`px-2.5 py-1.5 rounded-md text-xs font-semibold whitespace-nowrap transition-colors ${
                  shiftFilter === s.id
                    ? 'bg-[#285A3B] text-[#FAF8F5]'
                    : 'text-[#6D6055] hover:text-[#1F1A17] hover:bg-[#EFE9DF]'
                }`}
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>

        <div className="relative w-full lg:w-64">
          <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-[#9C8E80]" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Cari struk, kasir, atau meja..."
            className="w-full pl-8 pr-3 py-2 sm:py-1.5 bg-[#FAF8F5] border border-[#E5DDD0] rounded-lg text-xs text-[#1F1A17] placeholder-[#9C8E80] focus:outline-none focus:border-[#2A211B] transition-colors"
          />
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-3 mb-4 sm:mb-5">
        <div className="p-3.5 sm:p-4 bg-[#FAF8F5] border border-[#E5DDD0] rounded-xl">
          <span className="text-[11px] sm:text-xs font-medium text-[#7D6F63]">
            Omzet {shiftFilter !== 'ALL' ? `(${shiftFilter})` : ''}
          </span>
          <div className="text-base sm:text-2xl font-extrabold text-[#1F1A17] mt-1 tabular-nums tracking-tight truncate">
            {PrinterService.formatRupiah(totalRevenue)}
          </div>
          <div className="text-[10px] sm:text-[11px] text-[#7D6F63] mt-1 tabular-nums truncate">
            Rata-rata: {PrinterService.formatRupiah(avgOrderValue)} / struk
          </div>
        </div>

        <div className="p-3.5 sm:p-4 bg-[#FAF8F5] border border-[#E5DDD0] rounded-xl">
          <span className="text-[11px] sm:text-xs font-medium text-[#7D6F63]">Pembayaran Tunai</span>
          <div className="text-base sm:text-2xl font-extrabold text-[#285A3B] mt-1 tabular-nums tracking-tight truncate">
            {PrinterService.formatRupiah(cashTotal)}
          </div>
        </div>

        <div className="p-3.5 sm:p-4 bg-[#FAF8F5] border border-[#E5DDD0] rounded-xl">
          <span className="text-[11px] sm:text-xs font-medium text-[#7D6F63]">Non-Tunai / QRIS</span>
          <div className="text-base sm:text-2xl font-extrabold text-[#1F1A17] mt-1 tabular-nums tracking-tight truncate">
            {PrinterService.formatRupiah(nonCashTotal)}
          </div>
        </div>

        <div className="p-3.5 sm:p-4 bg-[#FAF8F5] border border-[#E5DDD0] rounded-xl">
          <span className="text-[11px] sm:text-xs font-medium text-[#7D6F63]">Transaksi</span>
          <div className="text-base sm:text-2xl font-extrabold text-[#1F1A17] mt-1 tabular-nums tracking-tight">
            {filteredByShift.length} <span className="text-xs font-medium text-[#8C7E71]">struk</span>
          </div>
        </div>
      </div>

      {/* Top 5 Products Bar */}
      {topProducts.length > 0 && (
        <div className="bg-[#FAF8F5] border border-[#E5DDD0] rounded-xl p-4 mb-5">
          <h2 className="text-xs font-bold text-[#1F1A17] mb-3 flex items-center gap-1.5">
            <Award className="w-4 h-4 text-[#874C23]" />
            Menu Terlaris Periode Ini
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-5 gap-2.5">
            {topProducts.map((p, idx) => (
              <div key={idx} className="p-3 bg-[#F2ECE2]/70 rounded-lg border border-[#E5DDD0] text-xs">
                <div className="text-[11px] font-mono text-[#874C23] font-bold">#{idx + 1}</div>
                <div className="font-bold text-[#1F1A17] mt-0.5 line-clamp-1">{p.name}</div>
                <div className="text-[#7D6F63] mt-1.5 flex justify-between text-[11px] tabular-nums">
                  <span>{p.qty} terjual</span>
                  <span className="text-[#285A3B] font-bold">{PrinterService.formatRupiah(p.revenue)}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Transactions List (Mobile Cards + Desktop Table) */}
      <div className="bg-[#FAF8F5] border border-[#E5DDD0] rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-[#E5DDD0] bg-[#EFE9DF]/50">
          <h2 className="text-xs font-bold text-[#1F1A17] flex items-center gap-1.5">
            <Receipt className="w-4 h-4 text-[#7A4B1A]" />
            Riwayat Transaksi ({displayTransactions.length})
          </h2>
        </div>

        {/* Mobile Card View */}
        <div className="md:hidden divide-y divide-[#EFE9DF]">
          {displayTransactions.length === 0 ? (
            <div className="py-10 text-center text-xs text-[#8C7E71]">
              Belum ada riwayat transaksi pada periode ini.
            </div>
          ) : (
            displayTransactions.map((tx) => (
              <div key={tx.id} className="p-3.5 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="font-mono font-bold text-xs text-[#1F1A17] flex items-center gap-2">
                      <span>{tx.invoiceNumber}</span>
                      <span
                        className={`px-1.5 py-0.5 rounded text-[10px] font-sans font-semibold ${
                          tx.status === 'COMPLETED'
                            ? 'bg-[#EAF3EC] text-[#285A3B]'
                            : 'bg-[#FBEAE8] text-[#9A3B3B]'
                        }`}
                      >
                        {tx.status === 'COMPLETED' ? 'Selesai' : 'Batal'}
                      </span>
                    </div>
                    <div className="text-[11px] text-[#7D6F63] mt-0.5 tabular-nums">
                      {PrinterService.formatDate(tx.timestamp)} • {tx.cashierName} ({getTxShift(tx)})
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-extrabold text-sm text-[#1F1A17] tabular-nums">
                      {PrinterService.formatRupiah(tx.total)}
                    </div>
                    <span className="text-[10px] font-semibold text-[#5E5248] bg-[#EFE9DF] px-1.5 py-0.5 rounded">
                      {tx.paymentMethod}
                    </span>
                  </div>
                </div>

                <div className="flex items-center justify-between gap-2 pt-1">
                  <span className="text-[11px] text-[#5E5248] truncate">
                    {tx.customerName ? `Meja/Tamu: ${tx.customerName}` : 'Tanpa keterangan meja'}
                  </span>
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    <button
                      type="button"
                      onClick={() => setSelectedTx(tx)}
                      className="px-2.5 py-1 bg-[#F2ECE2] hover:bg-[#E5DDD0] text-[#3D332B] text-[11px] font-semibold rounded-lg border border-[#E5DDD0] flex items-center gap-1"
                    >
                      <Eye className="w-3 h-3" />
                      <span>Detail</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleReprint(tx)}
                      disabled={isReprinting}
                      className="px-2.5 py-1 bg-[#2A211B] text-[#FAF8F5] text-[11px] font-semibold rounded-lg flex items-center gap-1 disabled:opacity-50"
                    >
                      <Printer className="w-3 h-3" />
                      <span>Cetak</span>
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Desktop Table View */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-[#EFE9DF]/40 border-b border-[#E5DDD0] text-[#6D6055] font-semibold">
              <tr>
                <th className="py-3 px-4">No. Struk</th>
                <th className="py-3 px-4">Waktu</th>
                <th className="py-3 px-4">Kasir</th>
                <th className="py-3 px-4">Meja / Tamu</th>
                <th className="py-3 px-4">Metode</th>
                <th className="py-3 px-4 text-right">Total</th>
                <th className="py-3 px-4 text-center">Status</th>
                <th className="py-3 px-4 text-center">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#EFE9DF] text-[#1F1A17]">
              {displayTransactions.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-10 text-center text-[#8C7E71]">
                    Belum ada riwayat transaksi pada periode ini.
                  </td>
                </tr>
              ) : (
                displayTransactions.map((tx) => (
                  <tr key={tx.id} className="hover:bg-[#F2ECE2]/60 transition-colors">
                    <td className="py-3 px-4 font-mono font-bold text-[#1F1A17]">
                      {tx.invoiceNumber}
                    </td>
                    <td className="py-3 px-4 text-[#7D6F63] tabular-nums">
                      {PrinterService.formatDate(tx.timestamp)}
                    </td>
                    <td className="py-3 px-4 font-medium text-[#1F1A17]">
                      <div>{tx.cashierName}</div>
                      <div className="text-[10px] text-[#7D6F63]">{getTxShift(tx)}</div>
                    </td>
                    <td className="py-3 px-4 text-[#5E5248]">
                      {tx.customerName || '-'}
                    </td>
                    <td className="py-3 px-4">
                      <span className="px-2 py-0.5 rounded-md text-[11px] font-semibold bg-[#EFE9DF] text-[#3D332B]">
                        {tx.paymentMethod}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right font-bold text-[#1F1A17] tabular-nums">
                      {PrinterService.formatRupiah(tx.total)}
                    </td>
                    <td className="py-3 px-4 text-center">
                      <span
                        className={`px-2 py-0.5 rounded-md text-[11px] font-semibold ${
                          tx.status === 'COMPLETED'
                            ? 'bg-[#EAF3EC] text-[#285A3B]'
                            : 'bg-[#FBEAE8] text-[#9A3B3B]'
                        }`}
                      >
                        {tx.status === 'COMPLETED' ? 'Selesai' : 'Batal'}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-center">
                      <div className="flex items-center justify-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => setSelectedTx(tx)}
                          className="p-1.5 bg-[#F2ECE2] hover:bg-[#E5DDD0] text-[#4D423A] rounded-lg border border-[#E5DDD0] transition-colors"
                          title="Lihat Detail Struk"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </button>

                        <button
                          type="button"
                          onClick={() => handleReprint(tx)}
                          disabled={isReprinting}
                          className="p-1.5 bg-[#F2ECE2] hover:bg-[#E5DDD0] text-[#4D423A] rounded-lg border border-[#E5DDD0] transition-colors disabled:opacity-50"
                          title="Cetak Ulang Struk"
                        >
                          <Printer className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Transaction Detail & Reprint Modal */}
      {selectedTx && (
        <div className="fixed inset-0 z-50 bg-[#1F1A17]/50 backdrop-blur-xs flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-[#FAF8F5] border border-[#E5DDD0] rounded-2xl w-full max-w-md shadow-xl overflow-hidden flex flex-col max-h-[90vh] animate-pop-in">
            <div className="px-5 py-3.5 border-b border-[#E5DDD0] flex items-center justify-between bg-[#F2ECE2]/60">
              <span className="font-bold text-xs text-[#1F1A17]">Detail & Cetak Ulang Struk</span>
              <button
                onClick={() => setSelectedTx(null)}
                className="text-[#8C7E71] hover:text-[#1F1A17] p-1 rounded-lg hover:bg-[#E5DDD0]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-4 overflow-y-auto flex-1 flex justify-center bg-[#EAE3D7]/50">
              <ReceiptView transaction={selectedTx} settings={settings} />
            </div>

            {reprintFeedback && (
              <div className="px-4 py-2 bg-[#EFE9DF] text-center text-xs text-[#3D332B] border-t border-[#E5DDD0] font-medium">
                {reprintFeedback}
              </div>
            )}

            {selectedTx.status === 'CANCELLED' && (
              <div className="px-4 py-2.5 bg-[#FBEAE8] border-t border-[#F2C2BD] text-xs text-[#9A3B3B]">
                <div className="font-bold">Transaksi Dibatalkan ({selectedTx.voidBy || 'Owner'})</div>
                {selectedTx.voidReason && <div className="text-[11px] mt-0.5">Alasan: {selectedTx.voidReason}</div>}
              </div>
            )}

            <div className="p-4 border-t border-[#E5DDD0] bg-[#FAF8F5] flex items-center justify-between gap-2.5">
              {selectedTx.status === 'COMPLETED' && (
                <button
                  type="button"
                  onClick={() => {
                    setVoidReason('');
                    setVoidError(null);
                    setVoidTargetTx(selectedTx);
                  }}
                  className="px-3 py-1.5 bg-[#FAF8F5] hover:bg-[#FBEAE8] text-[#9A3B3B] text-xs font-semibold rounded-lg border border-[#F2C2BD] transition-colors"
                >
                  Batalkan Struk
                </button>
              )}

              <div className="flex gap-2 ml-auto">
                <button
                  type="button"
                  onClick={() => setSelectedTx(null)}
                  className="px-3.5 py-1.5 bg-[#FAF8F5] text-[#5E5248] text-xs font-semibold rounded-lg border border-[#E5DDD0] hover:bg-[#EFE9DF] transition-colors"
                >
                  Tutup
                </button>

                <button
                  type="button"
                  onClick={() => handleReprint(selectedTx)}
                  disabled={isReprinting}
                  className="flex items-center gap-1.5 px-4 py-1.5 bg-[#2A211B] hover:bg-[#1A1410] text-[#FAF8F5] text-xs font-bold rounded-lg transition-colors"
                >
                  <Printer className="w-3.5 h-3.5" />
                  Cetak Ulang
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {voidTargetTx && (
        <div className="fixed inset-0 z-[60] bg-[#1F1A17]/60 backdrop-blur-xs flex items-center justify-center p-4 animate-fade-in">
          <form
            onSubmit={handleConfirmVoid}
            className="bg-[#FAF8F5] border border-[#E5DDD0] rounded-2xl w-full max-w-sm shadow-2xl overflow-hidden animate-pop-in"
          >
            <div className="px-5 py-4 border-b border-[#E5DDD0] bg-[#F2ECE2]/70 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-extrabold text-[#1F1A17]">Konfirmasi Pembatalan Struk</h3>
                <p className="text-[11px] text-[#7D6F63] mt-0.5">{voidTargetTx.invoiceNumber}</p>
              </div>
              <button
                type="button"
                onClick={() => setVoidTargetTx(null)}
                className="p-1.5 rounded-lg text-[#8C7E71] hover:text-[#1F1A17] hover:bg-[#E5DDD0]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 space-y-3">
              <p className="text-xs text-[#5E5248] leading-relaxed">
                Data struk tetap tersimpan di riwayat dengan status <strong>Batal</strong> dan tercatat ke Audit Log.
              </p>
              <div>
                <label className="block text-xs font-bold text-[#1F1A17] mb-1">
                  Alasan Pembatalan <span className="text-[#9A3B3B]">*</span>
                </label>
                <input
                  type="text"
                  autoFocus
                  value={voidReason}
                  onChange={(e) => {
                    setVoidReason(e.target.value);
                    setVoidError(null);
                  }}
                  placeholder="Misal: Tamu batal pesan / salah ketik item"
                  className="w-full px-3 py-2 bg-[#F2ECE2] border border-[#D5C9B8] rounded-lg text-xs text-[#1F1A17] focus:outline-none focus:bg-[#FAF8F5] focus:border-[#2A211B]"
                />
              </div>
              {voidError && (
                <div className="text-xs text-[#9A3B3B] font-medium">{voidError}</div>
              )}
              <div className="flex gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setVoidTargetTx(null)}
                  className="flex-1 py-2 bg-[#EFE9DF] hover:bg-[#E5DDD0] text-[#3D332B] text-xs font-bold rounded-lg transition-colors"
                >
                  Kembali
                </button>
                <button
                  type="submit"
                  disabled={isVoiding}
                  className="flex-1 py-2 bg-[#9A3B3B] hover:bg-[#7D2E2E] text-[#FAF8F5] text-xs font-bold rounded-lg transition-colors disabled:opacity-50"
                >
                  {isVoiding ? 'Memproses...' : 'Batalkan Struk'}
                </button>
              </div>
            </div>
          </form>
        </div>
      )}

      <ShiftClosingModal
        isOpen={isShiftClosingOpen}
        onClose={() => setIsShiftClosingOpen(false)}
        activeShift={shiftFilter !== 'ALL' ? shiftFilter : activeShift}
        cashierName={userRole === 'OWNER' ? 'Owner' : activeCashierName}
        settings={settings}
        allowShiftToggle={true}
      />
      </div>
    </div>
  );
};
