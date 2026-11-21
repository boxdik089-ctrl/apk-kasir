import React, { useState, useEffect } from 'react';
import { 
  Bluetooth, 
  Usb, 
  RefreshCw, 
  CheckCircle2, 
  AlertCircle, 
  Zap, 
  Sliders, 
  Info, 
  Layers, 
  Archive, 
  Download, 
  UploadCloud 
} from 'lucide-react';
import type { ReceiptSettings, ElectronPrinterInfo, Transaction, UserRole } from '../../types';
import { PrinterService } from '../../services/printerService';
import { SyncService } from '../../services/syncService';
import { ReceiptView } from '../receipt/ReceiptView';
import { OwnerPinModal } from '../auth/OwnerPinModal';
import { db } from '../../db/db';

interface PrinterSettingsProps {
  settings: ReceiptSettings;
  userRole: UserRole;
  ownerPin: string;
  onUpdateSettings: (newSettings: ReceiptSettings) => void;
}

const testTransaction: Transaction = {
  invoiceNumber: 'TES-KONEKSI-001',
  timestamp: new Date().toISOString(),
  cashierName: 'Admin Kasir',
  customerName: 'Uji Coba Printer',
  items: [
    {
      productId: 0,
      barcode: '00000000',
      name: 'Tes Cetak Thermal Printer',
      buyPrice: 0,
      price: 1000,
      quantity: 1,
      discount: 0,
      subtotal: 1000
    }
  ],
  subtotal: 1000,
  discount: 0,
  tax: 0,
  total: 1000,
  paidAmount: 1000,
  changeAmount: 0,
  paymentMethod: 'CASH',
  status: 'COMPLETED'
};

export const PrinterSettingsScreen: React.FC<PrinterSettingsProps> = ({
  settings,
  userRole,
  ownerPin,
  onUpdateSettings
}) => {
  const [printers, setPrinters] = useState<ElectronPrinterInfo[]>([]);
  const [isScanning, setIsScanning] = useState(false);
  const [testStatus, setTestStatus] = useState<string | null>(null);
  const [isTesting, setIsTesting] = useState(false);
  const [backupStatus, setBackupStatus] = useState<string | null>(null);
  const [pendingRestorePayload, setPendingRestorePayload] = useState<any>(null);

  const refreshPrinters = async () => {
    setIsScanning(true);
    try {
      const list = await PrinterService.getInstalledPrinters();
      setPrinters(list);
      if (!settings.selectedPrinterName && list.length > 0) {
        const def = list.find((p) => p.isDefault) || list[0];
        if (def) {
          updateSetting('selectedPrinterName', def.name);
        }
      }
    } catch (err) {
      console.error('Error fetching printers:', err);
    } finally {
      setIsScanning(false);
    }
  };

  useEffect(() => {
    refreshPrinters();
  }, []);

  const updateSetting = async (field: keyof ReceiptSettings, value: any) => {
    const updated = { ...settings, [field]: value };
    onUpdateSettings(updated);
    await SyncService.updatePrinterSettings({ [field]: value });
  };

  const handleTestPrint = async () => {
    setIsTesting(true);
    setTestStatus('Mengirim data uji cetak ke mesin printer...');
    try {
      const res = await PrinterService.print(
        'printable-receipt',
        testTransaction,
        settings
      );
      setTestStatus(res.message);
    } catch (err: any) {
      setTestStatus('Gagal tes cetak: ' + (err.message || err));
    } finally {
      setIsTesting(false);
      setTimeout(() => setTestStatus(null), 8000);
    }
  };

  const handleExportBackup = async () => {
    try {
      const products = await db.products.toArray();
      const transactions = await db.transactions.toArray();
      const settingsData = await db.settings.toArray();
      const backupData = {
        app: 'Aplikasi Kasir Pro POS Offline',
        version: '1.0.0',
        exportedAt: new Date().toISOString(),
        products,
        transactions,
        settings: settingsData
      };

      const blob = new Blob([JSON.stringify(backupData, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `backup_kasir_${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      setBackupStatus('Backup database berhasil diunduh!');
      setTimeout(() => setBackupStatus(null), 4000);
    } catch (err) {
      console.error('Backup error:', err);
      alert('Gagal membuat backup database.');
    }
  };

  const handleImportBackup = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!confirm('Peringatan: Restore data akan menimpa database dengan file backup. Lanjutkan?')) {
      return;
    }

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const json = JSON.parse(event.target?.result as string);
        const payload = {
          products: Array.isArray(json.products) ? json.products : undefined,
          transactions: Array.isArray(json.transactions) ? json.transactions : undefined,
          settings: Array.isArray(json.settings) && json.settings[0] ? json.settings[0] : undefined
        };

        if (userRole !== 'OWNER') {
          setPendingRestorePayload(payload);
          return;
        }

        const res = await SyncService.restoreBackup(payload, ownerPin);
        if (!res.ok) {
          alert(res.error || 'Gagal memulihkan backup.');
          return;
        }
        setBackupStatus('Database berhasil dipulihkan!');
        setTimeout(() => setBackupStatus(null), 4000);
      } catch (err) {
        console.error('Restore error:', err);
        alert('Format file backup tidak valid.');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  return (
    <div className="flex-1 overflow-y-auto p-3.5 sm:p-6 bg-[#F6F3EC] text-[#1F1A17] animate-fade-in">
      <div className="max-w-6xl mx-auto">
      {/* Header */}
      <div className="pb-5 border-b border-[#E5DDD0] flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-lg font-extrabold text-[#1F1A17] tracking-tight">
            Pengaturan Printer & Perangkat
          </h1>
          <p className="text-xs text-[#7D6F63] mt-0.5">
            Sambungkan mesin cetak thermal via driver Windows, Bluetooth, atau Port Serial COM.
          </p>
        </div>

        <button
          onClick={handleTestPrint}
          disabled={isTesting}
          className="flex items-center gap-1.5 px-4 py-2 bg-[#285A3B] hover:bg-[#1E462D] active:scale-[0.98] text-[#FAF8F5] font-bold text-xs rounded-lg transition-colors disabled:opacity-50"
        >
          <Zap className="w-3.5 h-3.5" />
          <span>{isTesting ? 'Mencetak...' : 'Tes Cetak Thermal'}</span>
        </button>
      </div>

      {testStatus && (
        <div className="mt-4 p-3 bg-[#EFE9DF] border border-[#DDD3C5] rounded-lg text-[#3D332B] text-xs flex items-center justify-between animate-slide-up">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-[#285A3B] flex-shrink-0" />
            <span className="font-medium">{testStatus}</span>
          </div>
          <button onClick={() => setTestStatus(null)} className="text-xs font-bold underline text-[#7A4B1A]">
            Tutup
          </button>
        </div>
      )}

      {/* Main Settings Sections */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 mt-5">
        {/* Left Side: Connection Modes (8 cols) */}
        <div className="lg:col-span-8 space-y-4">
          {/* Card: Mode Koneksi Printer */}
          <div className="bg-[#FAF8F5] border border-[#E5DDD0] rounded-xl p-5">
            <h2 className="text-xs font-bold text-[#1F1A17] mb-1 flex items-center gap-2">
              <Sliders className="w-4 h-4 text-[#7A4B1A]" />
              Metode Sambungan Printer Thermal
            </h2>
            <p className="text-xs text-[#7D6F63] mb-4">
              Pilih jenis koneksi yang digunakan printer thermal di meja kasir.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {/* Option 1: Driver Windows */}
              <button
                type="button"
                onClick={() => updateSetting('printerMode', 'system')}
                className={`p-4 rounded-2xl border text-left transition-all flex flex-col justify-between active:scale-95 ${
                  settings.printerMode === 'system'
                    ? 'bg-[#EDE6DC]/60 border-[#2D241E] shadow-2xs'
                    : 'bg-[#F5F2EB] border-[#E8E1D7] hover:border-[#D5C9B8]'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="p-2 bg-[#FAF8F5] text-[#26201C] rounded-xl border border-[#E8E1D7]">
                      <Usb className="w-4 h-4" />
                    </span>
                    {settings.printerMode === 'system' && (
                      <span className="text-[10px] bg-[#2D241E] text-[#FDFCFB] font-bold px-2.5 py-0.5 rounded-full">
                        Aktif
                      </span>
                    )}
                  </div>
                  <h3 className="font-bold text-xs text-[#26201C]">Driver Windows</h3>
                  <p className="text-[11px] text-[#786C61] mt-1">
                    Printer kabel USB atau Bluetooth yang terpasang di Windows. Paling stabil.
                  </p>
                </div>
              </button>

              {/* Option 2: Direct Bluetooth */}
              <button
                type="button"
                onClick={() => updateSetting('printerMode', 'bluetooth')}
                className={`p-4 rounded-2xl border text-left transition-all flex flex-col justify-between active:scale-95 ${
                  settings.printerMode === 'bluetooth'
                    ? 'bg-[#EDE6DC]/60 border-[#2D241E] shadow-2xs'
                    : 'bg-[#F5F2EB] border-[#E8E1D7] hover:border-[#D5C9B8]'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="p-2 bg-[#FAF8F5] text-[#26201C] rounded-xl border border-[#E8E1D7]">
                      <Bluetooth className="w-4 h-4" />
                    </span>
                    {settings.printerMode === 'bluetooth' && (
                      <span className="text-[10px] bg-[#2D241E] text-[#FDFCFB] font-bold px-2.5 py-0.5 rounded-full">
                        Aktif
                      </span>
                    )}
                  </div>
                  <h3 className="font-bold text-xs text-[#26201C]">Direct Bluetooth</h3>
                  <p className="text-[11px] text-[#786C61] mt-1">
                    Koneksi Bluetooth nirkabel langsung via Web Bluetooth (printer thermal saku/mobile).
                  </p>
                </div>
              </button>

              {/* Option 3: Direct Serial */}
              <button
                type="button"
                onClick={() => updateSetting('printerMode', 'serial')}
                className={`p-4 rounded-2xl border text-left transition-all flex flex-col justify-between active:scale-95 ${
                  settings.printerMode === 'serial'
                    ? 'bg-[#EDE6DC]/60 border-[#2D241E] shadow-2xs'
                    : 'bg-[#F5F2EB] border-[#E8E1D7] hover:border-[#D5C9B8]'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="p-2 bg-[#FAF8F5] text-[#26201C] rounded-xl border border-[#E8E1D7]">
                      <Layers className="w-4 h-4" />
                    </span>
                    {settings.printerMode === 'serial' && (
                      <span className="text-[10px] bg-[#2D241E] text-[#FDFCFB] font-bold px-2.5 py-0.5 rounded-full">
                        Aktif
                      </span>
                    )}
                  </div>
                  <h3 className="font-bold text-xs text-[#26201C]">Kabel Serial COM</h3>
                  <p className="text-[11px] text-[#786C61] mt-1">
                    Port Serial COM (CH340/PL2303) mengirim byte command ESC/POS mentah ke printer.
                  </p>
                </div>
              </button>
            </div>

            {/* Mode Detail Panel */}
            <div className="mt-5 pt-4 border-t border-[#E8E1D7]">
              {settings.printerMode === 'system' && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-[#3D322A]">
                      Pilih Printer Terpasang di Komputer:
                    </label>
                    <button
                      type="button"
                      onClick={refreshPrinters}
                      disabled={isScanning}
                      className="inline-flex items-center gap-1.5 text-xs font-bold text-[#2D241E] hover:underline transition"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 ${isScanning ? 'animate-spin' : ''}`} />
                      Pindai Ulang
                    </button>
                  </div>

                  {printers.length > 0 ? (
                    <div className="space-y-2">
                      <select
                        value={settings.selectedPrinterName || ''}
                        onChange={(e) => updateSetting('selectedPrinterName', e.target.value)}
                        className="w-full px-3.5 py-2.5 bg-[#F5F2EB] border border-[#D5C9B8] rounded-xl text-xs text-[#26201C] font-semibold focus:outline-none focus:bg-[#FAF8F5] focus:border-[#2D241E]"
                      >
                        <option value="">-- Cetak ke Printer Standar Sistem --</option>
                        {printers.map((p) => (
                          <option key={p.name} value={p.name}>
                            {p.displayName || p.name} {p.isDefault ? '(Default)' : ''}
                          </option>
                        ))}
                      </select>

                      <p className="text-[11px] text-[#285A3B] flex items-center gap-1.5 font-bold">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        Terdeteksi {printers.length} printer di sistem Anda.
                      </p>
                    </div>
                  ) : (
                    <div className="p-3.5 bg-[#F5F2EB] rounded-2xl border border-[#E8E1D7] text-xs text-[#5C4F45] space-y-1">
                      <p className="font-bold text-[#26201C] flex items-center gap-1.5">
                        <AlertCircle className="w-3.5 h-3.5 text-[#7A4B1A]" />
                        Mode browser / printer default sistem
                      </p>
                      <p className="text-[11px] text-[#786C61]">
                        Struk akan dicetak melalui printer default Windows atau dialog cetak browser Anda.
                      </p>
                    </div>
                  )}
                </div>
              )}

              {settings.printerMode === 'bluetooth' && (
                <div className="p-3.5 bg-[#F5F2EB] border border-[#E8E1D7] rounded-2xl text-xs text-[#5C4F45] leading-relaxed">
                  <p className="font-bold mb-1.5 flex items-center gap-1.5 text-[#26201C]">
                    <Bluetooth className="w-4 h-4 text-[#7A4B1A]" />
                    Panduan Sambungan Bluetooth:
                  </p>
                  <ol className="list-decimal list-inside space-y-1 text-[#786C61] text-[11px]">
                    <li>Nyalakan printer Bluetooth portabel Anda di meja kasir.</li>
                    <li>Di Windows atau tablet, pasangkan perangkat Bluetooth (PIN: 0000 atau 1234).</li>
                    <li>Klik tombol <b>Tes Cetak Thermal Sekarang</b> di atas untuk tes cetak.</li>
                  </ol>
                </div>
              )}

              {settings.printerMode === 'serial' && (
                <div className="space-y-2">
                  <div>
                    <label className="block text-xs font-bold text-[#3D322A] mb-1">
                      Kecepatan Baud Rate Port COM:
                    </label>
                    <select
                      value={settings.serialBaudRate || 9600}
                      onChange={(e) => updateSetting('serialBaudRate', parseInt(e.target.value))}
                      className="w-56 px-3.5 py-2 bg-[#F5F2EB] border border-[#D5C9B8] rounded-xl text-xs text-[#26201C] font-semibold"
                    >
                      <option value={9600}>9600 bps (Standar POS-58)</option>
                      <option value={19200}>19200 bps</option>
                      <option value={38400}>38400 bps</option>
                      <option value={115200}>115200 bps</option>
                    </select>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Card: Opsi Tambahan Hardware */}
          <div className="bg-[#FAF8F5] border border-[#E5DDD0] rounded-xl p-5 space-y-3.5">
            <h2 className="text-xs font-bold text-[#1F1A17]">Otomasi Kasir & Laci Uang</h2>

            <div className="space-y-2.5">
              <label className="flex items-center gap-3 p-3 bg-[#F2ECE2] rounded-lg border border-[#E5DDD0] cursor-pointer hover:bg-[#EAE2D6] transition-colors">
                <input
                  type="checkbox"
                  checked={settings.autoPrintOnPayment}
                  onChange={(e) => updateSetting('autoPrintOnPayment', e.target.checked)}
                  className="w-4 h-4 rounded text-[#2A211B] focus:ring-[#2A211B] border-[#D5C9B8]"
                />
                <div>
                  <div className="text-xs font-bold text-[#1F1A17]">
                    Cetak Struk Otomatis Saat Pembayaran Lunas
                  </div>
                  <div className="text-[11px] text-[#7D6F63]">
                    Kasir tidak perlu menekan tombol cetak lagi setelah pesanan terbayar.
                  </div>
                </div>
              </label>

              <label className="flex items-center gap-3 p-3 bg-[#F2ECE2] rounded-lg border border-[#E5DDD0] cursor-pointer hover:bg-[#EAE2D6] transition-colors">
                <input
                  type="checkbox"
                  checked={settings.openCashDrawer}
                  onChange={(e) => updateSetting('openCashDrawer', e.target.checked)}
                  className="w-4 h-4 rounded text-[#2A211B] focus:ring-[#2A211B] border-[#D5C9B8]"
                />
                <div>
                  <div className="text-xs font-bold text-[#1F1A17]">
                    Buka Laci Kasir Otomatis (Cash Drawer Kick)
                  </div>
                  <div className="text-[11px] text-[#7D6F63]">
                    Mengirim sinyal RJ11 ke printer thermal untuk membuka laci kasir.
                  </div>
                </div>
              </label>

              <div className="p-3 bg-[#F2ECE2] rounded-lg border border-[#E5DDD0] flex items-center justify-between">
                <div>
                  <div className="text-xs font-bold text-[#1F1A17]">Jumlah Lembar Struk per Transaksi</div>
                  <div className="text-[11px] text-[#7D6F63]">Cetak 2 lembar jika butuh salinan untuk bar/dapur.</div>
                </div>
                <select
                  value={settings.copies || 1}
                  onChange={(e) => updateSetting('copies', parseInt(e.target.value) || 1)}
                  className="px-3 py-1.5 bg-[#FAF8F5] border border-[#D5C9B8] rounded-lg text-xs text-[#1F1A17] font-semibold"
                >
                  <option value={1}>1 Lembar (Pelanggan)</option>
                  <option value={2}>2 Lembar (Bar + Pelanggan)</option>
                </select>
              </div>
            </div>
          </div>
        </div>

        {/* Right Side: Guide & Database Backup (4 cols) */}
        <div className="lg:col-span-4 space-y-4">
          {/* Database Backup & Restore Card (Owner Only) */}
          {userRole === 'OWNER' && (
          <div className="bg-[#FAF8F5] border border-[#E5DDD0] rounded-xl p-5 space-y-3.5">
            <h3 className="font-bold text-[#1F1A17] text-xs flex items-center gap-2">
              <Archive className="w-4 h-4 text-[#7A4B1A]" />
              Backup & Restore Data
            </h3>
            <p className="text-xs text-[#7D6F63]">
              Menu dan riwayat penjualan tersimpan offline di perangkat ini. Unduh cadangan secara berkala.
            </p>

            {backupStatus && (
              <div className="p-2.5 bg-[#EAF3EC] border border-[#BCE1C7] rounded-lg text-[#285A3B] text-xs text-center font-bold animate-pop-in">
                {backupStatus}
              </div>
            )}

            <div className="space-y-2 pt-1">
              <button
                type="button"
                onClick={handleExportBackup}
                className="w-full flex items-center justify-center gap-1.5 px-4 py-2 bg-[#2A211B] hover:bg-[#1A1410] active:scale-[0.98] text-[#FAF8F5] text-xs font-bold rounded-lg transition-colors"
              >
                <Download className="w-3.5 h-3.5" />
                Download Backup (.json)
              </button>

              <label className="w-full cursor-pointer flex items-center justify-center gap-1.5 px-4 py-2 bg-[#EFE9DF] hover:bg-[#E5DDD0] active:scale-[0.98] text-[#3D332B] text-xs font-semibold rounded-lg border border-[#DDD3C5] transition-colors">
                <UploadCloud className="w-3.5 h-3.5 text-[#7A4B1A]" />
                Restore dari File
                <input
                  type="file"
                  accept="application/json"
                  onChange={handleImportBackup}
                  className="hidden"
                />
              </label>
            </div>
          </div>
          )}

          {/* Practical Guide */}
          <div className="bg-[#FAF8F5] border border-[#E5DDD0] rounded-xl p-5 space-y-2">
            <h3 className="font-bold text-[#1F1A17] text-xs flex items-center gap-1.5">
              <Info className="w-4 h-4 text-[#7A4B1A]" />
              Catatan Printer Kasir
            </h3>
            <div className="text-[11px] text-[#7D6F63] space-y-1.5 leading-relaxed">
              <p>
                • <b>Printer Barista</b>: Pilih 2 lembar struk agar salinan kedua langsung diberikan ke bar atau dapur.
              </p>
              <p>
                • <b>USB Thermal</b>: Sambungan kabel USB lebih stabil untuk meja kasir statis dibanding Bluetooth.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Hidden off-screen receipt for test printing */}
      <div className="fixed -left-[9999px] top-0 pointer-events-none print:left-0 print:top-0 print:pointer-events-auto">
        <ReceiptView transaction={testTransaction} settings={settings} />
      </div>

      <OwnerPinModal
        isOpen={!!pendingRestorePayload}
        onClose={() => setPendingRestorePayload(null)}
        onVerified={async (pin) => {
          if (!pendingRestorePayload) return;
          const res = await SyncService.restoreBackup(pendingRestorePayload, pin);
          if (!res.ok) throw new Error(res.error || 'Gagal memulihkan database.');
          setBackupStatus('Database berhasil dipulihkan oleh Owner!');
          setTimeout(() => setBackupStatus(null), 4000);
        }}
        currentPinHash={settings.security?.ownerPinHash}
        title="Otorisasi Restore Database"
        description="Untuk mencegah penimpaan riwayat transaksi, pemulihan database dari file backup memerlukan PIN Owner."
      />
      </div>
    </div>
  );
};
