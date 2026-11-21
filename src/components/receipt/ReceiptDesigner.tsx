import React, { useState } from 'react';
import { 
  Printer, 
  Upload, 
  Trash2, 
  Save, 
  CheckCircle2, 
  Eye, 
  Image as ImageIcon
} from 'lucide-react';
import type { ReceiptSettings, Transaction } from '../../types';
import { ReceiptView } from './ReceiptView';
import { PrinterService } from '../../services/printerService';
import { SyncService } from '../../services/syncService';

interface ReceiptDesignerProps {
  settings: ReceiptSettings;
  ownerPin: string;
  onUpdateSettings: (newSettings: ReceiptSettings) => void;
}

// Sample dummy transaction for live preview (Cafe theme)
const sampleTransaction: Transaction = {
  invoiceNumber: 'INV-20261106-0089',
  timestamp: new Date().toISOString(),
  cashierName: 'Budi Santoso',
  customerName: 'Kak Vina (Meja 05)',
  items: [
    {
      productId: 1,
      barcode: 'CFE-001',
      name: 'Kopi Susu Gula Aren (Iced)',
      buyPrice: 8000,
      price: 22000,
      quantity: 2,
      discount: 0,
      subtotal: 44000
    },
    {
      productId: 4,
      barcode: 'CFE-004',
      name: 'Butter Croissant Almond',
      buyPrice: 12000,
      price: 26000,
      quantity: 1,
      discount: 2000,
      note: 'Dihangatkan sebentar',
      subtotal: 24000
    },
    {
      productId: 5,
      barcode: 'CFE-005',
      name: 'Matcha Green Tea Oatmilk',
      buyPrice: 14000,
      price: 28000,
      quantity: 1,
      discount: 0,
      subtotal: 28000
    }
  ],
  subtotal: 96000,
  discount: 2000,
  tax: 9400,
  total: 103400,
  paidAmount: 110000,
  changeAmount: 6600,
  paymentMethod: 'QRIS',
  status: 'COMPLETED'
};

export const ReceiptDesigner: React.FC<ReceiptDesignerProps> = ({
  settings,
  ownerPin,
  onUpdateSettings
}) => {
  const [formData, setFormData] = useState<ReceiptSettings>({ ...settings });
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [isPrinting, setIsPrinting] = useState(false);
  const [testPrintStatus, setTestPrintStatus] = useState<string | null>(null);

  const handleChange = (field: keyof ReceiptSettings, value: any) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  // Upload Logo
  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 1024 * 1024 * 2) {
      alert('Ukuran gambar logo maksimal 2 MB.');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const base64 = event.target?.result as string;
      setFormData((prev) => ({
        ...prev,
        logoBase64: base64,
        showLogo: true
      }));
    };
    reader.readAsDataURL(file);
  };

  // Remove Logo
  const handleRemoveLogo = () => {
    setFormData((prev) => ({
      ...prev,
      logoBase64: undefined,
      showLogo: false
    }));
  };

  // Save Settings to Server & IndexedDB
  const handleSave = async () => {
    const res = await SyncService.updateSettings(formData, ownerPin);
    if (!res.ok) {
      alert(res.error || 'Gagal menyimpan pengaturan.');
      return;
    }
    onUpdateSettings(formData);
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 3000);
  };

  // Test Print current design
  const handleTestPrint = async () => {
    setIsPrinting(true);
    setTestPrintStatus('Mengirim struk preview ke printer...');
    try {
      const res = await PrinterService.print(
        'printable-receipt',
        sampleTransaction,
        formData
      );
      setTestPrintStatus(res.message);
    } catch (err: any) {
      setTestPrintStatus('Gagal tes cetak: ' + (err.message || err));
    } finally {
      setIsPrinting(false);
      setTimeout(() => setTestPrintStatus(null), 6000);
    }
  };

  return (
    <div className="flex-1 overflow-y-auto p-3.5 sm:p-6 bg-[#F6F3EC] text-[#1F1A17] animate-fade-in">
      <div className="max-w-6xl mx-auto">
      {/* Header */}
      <div className="pb-5 border-b border-[#E5DDD0] flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-lg font-extrabold text-[#1F1A17] tracking-tight">
            Desain & Tata Letak Struk
          </h1>
          <p className="text-xs text-[#7D6F63] mt-0.5">
            Atur identitas cafe, logo, lebar kertas thermal (58mm/80mm), dan catatan kaki struk.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleTestPrint}
            disabled={isPrinting}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-[#FAF8F5] hover:bg-[#EFE9DF] active:scale-[0.98] text-[#3D332B] text-xs font-semibold rounded-lg border border-[#E5DDD0] transition-colors disabled:opacity-50"
          >
            <Printer className="w-3.5 h-3.5 text-[#6D6055]" />
            <span>{isPrinting ? 'Mencetak...' : 'Tes Cetak Struk'}</span>
          </button>

          <button
            onClick={handleSave}
            className="flex items-center gap-1.5 px-4 py-2 bg-[#2A211B] hover:bg-[#1A1410] active:scale-[0.98] text-[#FAF8F5] text-xs font-bold rounded-lg transition-colors"
          >
            {saveSuccess ? (
              <>
                <CheckCircle2 className="w-3.5 h-3.5 text-[#6EE7B7]" />
                <span>Tersimpan</span>
              </>
            ) : (
              <>
                <Save className="w-3.5 h-3.5" />
                <span>Simpan</span>
              </>
            )}
          </button>
        </div>
      </div>

      {testPrintStatus && (
        <div className="mt-4 p-3 bg-[#EFE9DF] border border-[#DDD3C5] rounded-lg text-[#3D332B] text-xs flex items-center justify-between animate-slide-up">
          <span className="font-medium">{testPrintStatus}</span>
          <button onClick={() => setTestPrintStatus(null)} className="text-xs font-bold underline text-[#7A4B1A]">
            Tutup
          </button>
        </div>
      )}

      {/* Main Grid: Left Editor Controls, Right Live Preview */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 mt-5">
        {/* Left Form: 7 cols */}
        <div className="lg:col-span-7 space-y-4">
          {/* Card 1: Logo & Branding */}
          <div className="bg-[#FAF8F5] border border-[#E5DDD0] rounded-xl p-5">
            <h2 className="text-xs font-bold text-[#1F1A17] mb-3 flex items-center gap-2">
              <ImageIcon className="w-4 h-4 text-[#7A4B1A]" />
              Logo Cafe
            </h2>

            <div className="space-y-4">
              <div className="flex items-start gap-4">
                <div className="w-24 h-24 bg-[#F5F2EB] border-2 border-dashed border-[#D5C9B8] rounded-2xl flex flex-col items-center justify-center p-2 text-center overflow-hidden relative shadow-2xs">
                  {formData.logoBase64 ? (
                    <img
                      src={formData.logoBase64}
                      alt="Logo Preview"
                      className="max-h-full max-w-full object-contain"
                    />
                  ) : (
                    <div className="text-[#8A7D71] text-xs flex flex-col items-center gap-1">
                      <Upload className="w-5 h-5 text-[#C4B8A8]" />
                      <span className="text-[10px]">Tanpa logo</span>
                    </div>
                  )}
                </div>

                <div className="flex-1 space-y-2.5">
                  <div className="flex items-center gap-2">
                    <label className="cursor-pointer inline-flex items-center gap-1.5 px-3.5 py-2 bg-[#2D241E] hover:bg-[#1E1713] active:scale-95 text-[#FDFCFB] text-xs font-bold rounded-xl transition-all shadow-2xs">
                      <Upload className="w-3.5 h-3.5" />
                      Upload Logo Cafe
                      <input
                        type="file"
                        accept="image/png, image/jpeg, image/jpg, image/webp"
                        onChange={handleLogoUpload}
                        className="hidden"
                      />
                    </label>

                    {formData.logoBase64 && (
                      <button
                        onClick={handleRemoveLogo}
                        className="inline-flex items-center gap-1 px-3 py-2 bg-[#FAF8F5] hover:bg-[#FBEAE8] active:scale-95 text-[#9A3B3B] text-xs font-bold rounded-xl border border-[#F2C2BD] transition-all"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        Hapus
                      </button>
                    )}
                  </div>

                  <p className="text-[11px] text-[#786C61]">
                    Format: PNG, JPG, atau WebP (disarankan latar transparan/putih untuk thermal printer).
                  </p>

                  {formData.logoBase64 && (
                    <div className="pt-1">
                      <div className="flex justify-between text-xs text-[#5C4F45] mb-1">
                        <span>Lebar Logo di Struk:</span>
                        <span className="font-mono font-bold text-[#26201C]">{formData.logoWidth} px</span>
                      </div>
                      <input
                        type="range"
                        min="60"
                        max="240"
                        step="10"
                        value={formData.logoWidth}
                        onChange={(e) => handleChange('logoWidth', parseInt(e.target.value))}
                        className="w-full accent-[#2D241E]"
                      />
                    </div>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-2.5 pt-1">
                <input
                  type="checkbox"
                  id="showLogo"
                  checked={formData.showLogo}
                  onChange={(e) => handleChange('showLogo', e.target.checked)}
                  className="w-4 h-4 rounded text-[#2D241E] focus:ring-[#2D241E] border-[#D5C9B8]"
                />
                <label htmlFor="showLogo" className="text-xs font-bold text-[#3D322A] cursor-pointer">
                  Cetak logo cafe di atas struk kasir
                </label>
              </div>
            </div>
          </div>

          {/* Card 2: Informasi Toko */}
          <div className="bg-[#FAF8F5] border border-[#E5DDD0] rounded-xl p-5 space-y-3.5">
            <h2 className="text-xs font-bold text-[#1F1A17]">Informasi Cafe (Header Struk)</h2>

            <div>
              <label className="block text-xs font-semibold text-[#3D332B] mb-1">
                Nama Cafe / Brand:
              </label>
              <input
                type="text"
                value={formData.storeName}
                onChange={(e) => handleChange('storeName', e.target.value)}
                placeholder="Contoh: SENJA COFFEE & EATERY"
                className="w-full px-3 py-2 bg-[#F2ECE2] border border-[#D5C9B8] rounded-lg text-xs text-[#1F1A17] focus:outline-none focus:bg-[#FAF8F5] focus:border-[#2A211B] font-bold"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-[#3D332B] mb-1">
                  Tagline / Konsep Cafe:
                </label>
                <input
                  type="text"
                  value={formData.tagline}
                  onChange={(e) => handleChange('tagline', e.target.value)}
                  placeholder="Contoh: Artisan Coffee & Warm Bakery"
                  className="w-full px-3 py-2 bg-[#F2ECE2] border border-[#D5C9B8] rounded-lg text-xs text-[#1F1A17] focus:outline-none focus:bg-[#FAF8F5] focus:border-[#2A211B]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#3D332B] mb-1">
                  No. WhatsApp / Kontak:
                </label>
                <input
                  type="text"
                  value={formData.phone}
                  onChange={(e) => handleChange('phone', e.target.value)}
                  placeholder="Contoh: 0812-3456-7890"
                  className="w-full px-3 py-2 bg-[#F2ECE2] border border-[#D5C9B8] rounded-lg text-xs text-[#1F1A17] focus:outline-none focus:bg-[#FAF8F5] focus:border-[#2A211B]"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#3D332B] mb-1">
                Alamat Cafe:
              </label>
              <textarea
                rows={2}
                value={formData.address}
                onChange={(e) => handleChange('address', e.target.value)}
                placeholder="Contoh: Jl. Senja Kopi No. 12, Bandung"
                className="w-full px-3 py-2 bg-[#F2ECE2] border border-[#D5C9B8] rounded-lg text-xs text-[#1F1A17] focus:outline-none focus:bg-[#FAF8F5] focus:border-[#2A211B]"
              />
            </div>
          </div>

          {/* Card 3: Layout Kertas & Font */}
          <div className="bg-[#FAF8F5] border border-[#E5DDD0] rounded-xl p-5 space-y-3.5">
            <h2 className="text-xs font-bold text-[#1F1A17]">Format Kertas Thermal & Huruf</h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-[#3D332B] mb-1">
                  Lebar Kertas Thermal:
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => handleChange('paperWidth', '58mm')}
                    className={`py-2 px-3 text-xs font-semibold rounded-lg border transition-colors ${
                      formData.paperWidth === '58mm'
                        ? 'bg-[#2A211B] text-[#FAF8F5] border-[#2A211B]'
                        : 'bg-[#F2ECE2] text-[#5E5248] border-[#E5DDD0] hover:bg-[#EAE2D6]'
                    }`}
                  >
                    58 mm
                  </button>
                  <button
                    type="button"
                    onClick={() => handleChange('paperWidth', '80mm')}
                    className={`py-2 px-3 text-xs font-semibold rounded-lg border transition-colors ${
                      formData.paperWidth === '80mm'
                        ? 'bg-[#2A211B] text-[#FAF8F5] border-[#2A211B]'
                        : 'bg-[#F2ECE2] text-[#5E5248] border-[#E5DDD0] hover:bg-[#EAE2D6]'
                    }`}
                  >
                    80 mm
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#3D332B] mb-1">
                  Gaya Huruf (Font):
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => handleChange('fontFamily', 'monospace')}
                    className={`py-2 px-3 text-xs font-mono font-semibold rounded-lg border transition-colors ${
                      formData.fontFamily === 'monospace'
                        ? 'bg-[#2A211B] text-[#FAF8F5] border-[#2A211B]'
                        : 'bg-[#F2ECE2] text-[#5E5248] border-[#E5DDD0] hover:bg-[#EAE2D6]'
                    }`}
                  >
                    Monospace
                  </button>
                  <button
                    type="button"
                    onClick={() => handleChange('fontFamily', 'sans-serif')}
                    className={`py-2 px-3 text-xs font-sans font-semibold rounded-lg border transition-colors ${
                      formData.fontFamily === 'sans-serif'
                        ? 'bg-[#2A211B] text-[#FAF8F5] border-[#2A211B]'
                        : 'bg-[#F2ECE2] text-[#5E5248] border-[#E5DDD0] hover:bg-[#EAE2D6]'
                    }`}
                  >
                    Sans-Serif
                  </button>
                </div>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#3D332B] mb-1">
                Garis Pemisah Struk:
              </label>
              <div className="flex gap-2">
                {[
                  { char: '-', label: 'Strip (-)' },
                  { char: '=', label: 'Ganda (=)' },
                  { char: '*', label: 'Bintang (*)' },
                  { char: '.', label: 'Titik (.)' }
                ].map((item) => (
                  <button
                    key={item.char}
                    type="button"
                    onClick={() => handleChange('separatorChar', item.char)}
                    className={`flex-1 py-1.5 text-xs font-mono font-semibold rounded-lg border transition-colors ${
                      formData.separatorChar === item.char
                        ? 'bg-[#2A211B] text-[#FAF8F5] border-[#2A211B]'
                        : 'bg-[#F2ECE2] text-[#5E5248] border-[#E5DDD0] hover:bg-[#EAE2D6]'
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Card 4: Elemen Tampilan & Footer */}
          <div className="bg-[#FAF8F5] border border-[#E5DDD0] rounded-xl p-5 space-y-3.5">
            <h2 className="text-xs font-bold text-[#1F1A17]">Elemen Struk & Info Pelanggan</h2>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
              {[
                { id: 'showDate', label: 'Tanggal & Jam' },
                { id: 'showCashier', label: 'Nama Kasir' },
                { id: 'showCustomer', label: 'Meja / Tamu' },
                { id: 'showBarcode', label: 'Barcode Struk' },
                { id: 'showTax', label: 'Pajak (PB1/PPN)' },
                { id: 'autoPrintOnPayment', label: 'Auto Cetak' }
              ].map((opt) => (
                <label
                  key={opt.id}
                  className="flex items-center gap-2 p-2.5 bg-[#F2ECE2] rounded-lg border border-[#E5DDD0] cursor-pointer hover:bg-[#EAE2D6] text-xs font-semibold text-[#3D332B] transition-colors"
                >
                  <input
                    type="checkbox"
                    checked={(formData as any)[opt.id] ?? false}
                    onChange={(e) => handleChange(opt.id as any, e.target.checked)}
                    className="w-4 h-4 rounded text-[#2A211B] focus:ring-[#2A211B] border-[#D5C9B8]"
                  />
                  <span>{opt.label}</span>
                </label>
              ))}
            </div>

            {formData.showTax && (
              <div className="w-44">
                <label className="block text-xs font-semibold text-[#3D332B] mb-1">
                  Persentase Pajak (%):
                </label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={formData.taxRate}
                  onChange={(e) => handleChange('taxRate', parseFloat(e.target.value) || 0)}
                  className="w-full px-3 py-1.5 bg-[#F2ECE2] border border-[#D5C9B8] rounded-lg text-xs text-[#1F1A17] font-bold"
                />
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-[#3D332B] mb-1">
                Catatan Kaki Struk (Wi-Fi, IG & Ucapan):
              </label>
              <textarea
                rows={3}
                value={formData.footerMessage}
                onChange={(e) => handleChange('footerMessage', e.target.value)}
                placeholder="Contoh: Password WiFi: senjakopi2026&#10;Follow IG: @senja.coffee&#10;Terima kasih telah berkunjung!"
                className="w-full px-3 py-2 bg-[#F2ECE2] border border-[#D5C9B8] rounded-lg text-xs text-[#1F1A17] focus:outline-none focus:bg-[#FAF8F5] focus:border-[#2A211B] font-mono"
              />
            </div>
          </div>
        </div>

        {/* Right Preview: 5 cols */}
        <div className="lg:col-span-5 flex flex-col items-center">
          <div className="sticky top-6 w-full flex flex-col items-center">
            <div className="w-full flex items-center justify-between mb-2.5 px-1">
              <span className="text-xs font-bold text-[#1F1A17] flex items-center gap-1.5">
                <Eye className="w-4 h-4 text-[#7A4B1A]" />
                Preview Struk Thermal
              </span>
              <span className="text-[11px] bg-[#EFE9DF] text-[#3D332B] px-2.5 py-0.5 rounded-md border border-[#DDD3C5] font-mono font-semibold">
                {formData.paperWidth} • {formData.fontFamily}
              </span>
            </div>

            {/* Receipt Container */}
            <div className="p-6 bg-[#EAE3D7]/70 rounded-xl border border-[#DDD3C5] flex justify-center w-full overflow-hidden">
              <div className="relative shadow-md">
                <div className="h-2 w-full bg-white [mask-image:radial-gradient(circle,transparent_4px,black_4.5px)] [mask-size:12px_12px] [mask-repeat:repeat-x] transform rotate-180" />
                <ReceiptView transaction={sampleTransaction} settings={formData} />
                <div className="h-2 w-full bg-white [mask-image:radial-gradient(circle,transparent_4px,black_4.5px)] [mask-size:12px_12px] [mask-repeat:repeat-x]" />
              </div>
            </div>

            <p className="text-[11px] text-[#7D6F63] mt-3 text-center max-w-xs">
              Simulasi di atas mencerminkan hasil cetak kertas thermal di kasir.
            </p>
          </div>
        </div>
      </div>
      </div>
    </div>
  );
};
