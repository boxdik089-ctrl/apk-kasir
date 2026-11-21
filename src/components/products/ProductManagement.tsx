import React, { useState } from 'react';
import { 
  Plus, 
  Search, 
  Edit2, 
  Trash2, 
  Download, 
  RotateCcw,
  Utensils
} from 'lucide-react';
import type { Product, ReceiptSettings, UserRole } from '../../types';
import { ProductModal } from './ProductModal';
import { OwnerPinModal } from '../auth/OwnerPinModal';
import { PrinterService } from '../../services/printerService';
import { SyncService } from '../../services/syncService';
import { initialCafeProducts } from '../../db/db';

interface ProductManagementProps {
  products: Product[];
  settings: ReceiptSettings;
  userRole: UserRole;
  ownerPin: string;
  onRefreshProducts: () => void;
}

export const ProductManagement: React.FC<ProductManagementProps> = ({
  products,
  settings,
  userRole,
  ownerPin,
  onRefreshProducts
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('Semua');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [productToEdit, setProductToEdit] = useState<Product | null>(null);
  const [pendingAuth, setPendingAuth] = useState<{
    title: string;
    description: string;
    onVerified: (pin: string) => Promise<void> | void;
  } | null>(null);

  const canEditOrDelete = userRole === 'OWNER' || !!settings.security?.cashierCanEditMenu;
  const canAddMenu = userRole === 'OWNER' || settings.security?.cashierCanAddMenu !== false;

  const categories = Array.from(new Set(products.map((p) => p.category).filter(Boolean)));
  if (categories.length === 0) categories.push('Coffee', 'Non-Coffee', 'Pastry & Toast', 'Main Course');

  const filtered = products.filter((p) => {
    const matchesSearch =
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.barcode.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCat = selectedCategory === 'Semua' || p.category === selectedCategory;
    return matchesSearch && matchesCat;
  });

  const handleSaveProduct = async (productData: Omit<Product, 'id'>, id?: number) => {
    const activePin = userRole === 'OWNER' ? ownerPin : undefined;
    const res = await SyncService.saveProduct(
      productData,
      id,
      activePin,
      userRole === 'OWNER' ? 'Owner' : 'Kasir'
    );
    if (!res.ok) {
      alert(res.error || 'Gagal menyimpan menu cafe.');
      return;
    }
    onRefreshProducts();
  };

  const handleDeleteProduct = async (id: number, name: string) => {
    if (!canEditOrDelete) {
      setPendingAuth({
        title: 'Hapus Menu Terkunci',
        description: `Hanya Owner yang dapat menghapus menu "${name}". Masukkan PIN Owner untuk melanjutkan.`,
        onVerified: async (pin) => {
          const res = await SyncService.deleteProduct(id, pin, 'Owner');
          if (!res.ok) throw new Error(res.error);
          onRefreshProducts();
        }
      });
      return;
    }

    if (confirm(`Yakin ingin menghapus menu "${name}"?`)) {
      const res = await SyncService.deleteProduct(id, ownerPin, 'Owner');
      if (!res.ok) {
        alert(res.error || 'Gagal menghapus menu.');
        return;
      }
      onRefreshProducts();
    }
  };

  const handleLoadSampleCafeMenus = async () => {
    if (!canEditOrDelete) {
      setPendingAuth({
        title: 'Reset Menu Memerlukan PIN Owner',
        description: 'Reset seluruh daftar menu hanya dapat dilakukan oleh Owner.',
        onVerified: async (pin) => {
          const res = await SyncService.resetSampleMenus(initialCafeProducts, pin);
          if (!res.ok) throw new Error(res.error);
          onRefreshProducts();
        }
      });
      return;
    }

    if (confirm('Muat daftar contoh Menu Cafe (Kopi, Non-Kopi, Pastry, Makanan)? Data menu lama akan digantikan dengan menu cafe.')) {
      const res = await SyncService.resetSampleMenus(initialCafeProducts, ownerPin);
      if (!res.ok) {
        alert(res.error || 'Gagal memuat menu cafe.');
        return;
      }
      onRefreshProducts();
      alert('Berhasil memuat daftar menu cafe!');
    }
  };

  const handleExportCSV = () => {
    const headers = ['Kode Menu', 'Nama Menu', 'Kategori', 'HPP Modal', 'Harga Jual'];
    const rows = products.map((p) => [
      `"${p.barcode}"`,
      `"${p.name.replace(/"/g, '""')}"`,
      `"${p.category}"`,
      p.buyPrice,
      p.price
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `daftar_menu_cafe_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const avgMarginPercent = products.length > 0
    ? Math.round(
        products.reduce((acc, p) => {
          const margin = p.price > 0 && p.buyPrice > 0 ? ((p.price - p.buyPrice) / p.price) * 100 : 0;
          return acc + margin;
        }, 0) / products.length
      )
    : 0;

  return (
    <div className="flex-1 overflow-y-auto p-3.5 sm:p-6 bg-[#F6F3EC] text-[#1F1A17] animate-fade-in">
      <div className="max-w-6xl mx-auto">
      {/* Header */}
      <div className="pb-4 sm:pb-5 border-b border-[#E5DDD0] flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-base sm:text-lg font-extrabold text-[#1F1A17] tracking-tight">
            Katalog Menu & Harga
          </h1>
          <p className="text-xs text-[#7D6F63] mt-0.5">
            Daftar minuman, pastry, dan makanan beserta HPP serta harga jual.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={handleLoadSampleCafeMenus}
            className="flex items-center gap-1.5 px-3 py-2 bg-[#EFE9DF] hover:bg-[#E5DDD0] active:scale-[0.98] text-[#3D332B] text-xs font-semibold rounded-lg border border-[#DDD3C5] transition-colors"
            title="Isi ulang daftar contoh menu cafe"
          >
            <RotateCcw className="w-3.5 h-3.5 text-[#6D6055]" />
            <span>Reset Contoh Menu</span>
          </button>

          <button
            type="button"
            onClick={handleExportCSV}
            className="flex items-center gap-1.5 px-3 py-2 bg-[#FAF8F5] hover:bg-[#EFE9DF] active:scale-[0.98] text-[#3D332B] text-xs font-semibold rounded-lg border border-[#E5DDD0] transition-colors"
          >
            <Download className="w-3.5 h-3.5 text-[#6D6055]" />
            <span>Export CSV</span>
          </button>

          <button
            type="button"
            onClick={() => {
              if (!canAddMenu) {
                setPendingAuth({
                  title: 'Tambah Menu Terkunci',
                  description: 'Penambahan menu dikunci oleh Owner. Masukkan PIN Owner untuk melanjutkan.',
                  onVerified: () => {
                    setProductToEdit(null);
                    setIsModalOpen(true);
                  }
                });
                return;
              }
              setProductToEdit(null);
              setIsModalOpen(true);
            }}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-[#2A211B] hover:bg-[#1A1410] active:scale-[0.98] text-[#FAF8F5] text-xs font-bold rounded-lg transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Tambah Menu</span>
          </button>
        </div>
      </div>

      {/* Stats Summary */}
      <div className="grid grid-cols-3 gap-2 sm:gap-3 my-4 sm:my-5">
        <div className="p-3 sm:p-4 bg-[#FAF8F5] border border-[#E5DDD0] rounded-xl">
          <span className="text-[11px] sm:text-xs font-medium text-[#7D6F63]">Jumlah Menu</span>
          <div className="text-lg sm:text-2xl font-extrabold text-[#1F1A17] mt-1 tabular-nums">{products.length}</div>
        </div>

        <div className="p-3 sm:p-4 bg-[#FAF8F5] border border-[#E5DDD0] rounded-xl">
          <span className="text-[11px] sm:text-xs font-medium text-[#7D6F63]">Kategori</span>
          <div className="text-lg sm:text-2xl font-extrabold text-[#1F1A17] mt-1 tabular-nums">{categories.length}</div>
        </div>

        <div className="p-3 sm:p-4 bg-[#FAF8F5] border border-[#E5DDD0] rounded-xl">
          <span className="text-[11px] sm:text-xs font-medium text-[#7D6F63]">Rata Margin</span>
          <div className="text-lg sm:text-2xl font-extrabold text-[#285A3B] mt-1 tabular-nums">{avgMarginPercent}%</div>
        </div>
      </div>

      {/* Search & Filter Bar */}
      <div className="p-3 bg-[#FAF8F5] border border-[#E5DDD0] rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 mb-4">
        <div className="relative flex-1 min-w-0">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-[#9C8E80]" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Cari nama menu atau kode..."
            className="w-full pl-9 pr-3.5 py-2 bg-[#F2ECE2] border border-[#E2D9CC] rounded-lg text-xs text-[#1F1A17] placeholder-[#9C8E80] focus:outline-none focus:bg-[#FAF8F5] focus:border-[#2A211B] transition-colors"
          />
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-[#7D6F63]">Kategori:</span>
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="flex-1 sm:flex-none px-3 py-2 bg-[#F2ECE2] border border-[#E2D9CC] rounded-lg text-xs text-[#1F1A17] focus:outline-none focus:bg-[#FAF8F5] focus:border-[#2A211B] font-semibold"
          >
            <option value="Semua">Semua Kategori</option>
            {categories.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Menu List (Mobile Cards + Desktop Table) */}
      <div className="bg-[#FAF8F5] border border-[#E5DDD0] rounded-xl overflow-hidden">
        {/* Mobile Card View */}
        <div className="md:hidden divide-y divide-[#EFE9DF]">
          {filtered.length === 0 ? (
            <div className="py-10 text-center text-xs text-[#8C7E71]">
              Tidak ada menu yang cocok dengan pencarian.
            </div>
          ) : (
            filtered.map((prod) => (
              <div key={prod.id} className="p-3.5 flex items-center justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-[#EFE9DF] text-[#4D423A]">
                      {prod.category}
                    </span>
                    <span className="text-[11px] font-mono text-[#8C7E71]">{prod.barcode}</span>
                  </div>
                  <div className="font-bold text-xs text-[#1F1A17] mt-1 truncate">{prod.name}</div>
                  <div className="text-xs font-extrabold text-[#1F1A17] mt-0.5 tabular-nums">
                    {PrinterService.formatRupiah(prod.price)}
                    <span className="text-[11px] font-normal text-[#7D6F63] ml-1.5">
                      (HPP: {PrinterService.formatRupiah(prod.buyPrice)})
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  <button
                    type="button"
                    onClick={() => {
                      if (!canEditOrDelete) {
                        setPendingAuth({
                          title: 'Ubah Harga / Menu Terkunci',
                          description: 'Untuk mencegah perubahan harga oleh kasir, pengeditan menu memerlukan PIN Owner.',
                          onVerified: () => {
                            setProductToEdit(prod);
                            setIsModalOpen(true);
                          }
                        });
                        return;
                      }
                      setProductToEdit(prod);
                      setIsModalOpen(true);
                    }}
                    className="p-2 bg-[#F2ECE2] hover:bg-[#E5DDD0] text-[#4D423A] rounded-lg border border-[#E5DDD0]"
                    title="Edit Menu"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => prod.id && handleDeleteProduct(prod.id, prod.name)}
                    className="p-2 bg-[#FAF8F5] hover:bg-[#FBEAE8] text-[#8C7E71] hover:text-[#9A3B3B] rounded-lg border border-[#E5DDD0]"
                    title="Hapus Menu"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Desktop Table View */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-[#EFE9DF]/70 border-b border-[#E5DDD0] text-[#6D6055] font-semibold">
              <tr>
                <th className="py-3 px-4">Kode</th>
                <th className="py-3 px-4">Nama Menu</th>
                <th className="py-3 px-4">Kategori</th>
                <th className="py-3 px-4 text-right">HPP / Modal</th>
                <th className="py-3 px-4 text-right">Harga Jual</th>
                <th className="py-3 px-4 text-center">Satuan</th>
                <th className="py-3 px-4 text-center">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#EFE9DF] text-[#1F1A17]">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-10 text-center text-[#8C7E71]">
                    Tidak ada menu yang cocok dengan pencarian.
                  </td>
                </tr>
              ) : (
                filtered.map((prod) => {
                  return (
                    <tr key={prod.id} className="hover:bg-[#F2ECE2]/60 transition-colors">
                      <td className="py-3 px-4 font-mono text-[#7D6F63]">
                        {prod.barcode || '-'}
                      </td>
                      <td className="py-3 px-4 font-bold text-[#1F1A17] text-xs flex items-center gap-2">
                        <Utensils className="w-3.5 h-3.5 text-[#874C23] flex-shrink-0" />
                        <span>{prod.name}</span>
                      </td>
                      <td className="py-3 px-4">
                        <span className="px-2 py-0.5 rounded-md text-[11px] font-semibold bg-[#EFE9DF] text-[#4D423A]">
                          {prod.category}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right text-[#7D6F63] tabular-nums">
                        {PrinterService.formatRupiah(prod.buyPrice)}
                      </td>
                      <td className="py-3 px-4 text-right font-bold text-[#1F1A17] tabular-nums">
                        {PrinterService.formatRupiah(prod.price)}
                      </td>
                      <td className="py-3 px-4 text-center text-[#7D6F63]">
                        {prod.unit || 'cup'}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => {
                              if (!canEditOrDelete) {
                                setPendingAuth({
                                  title: 'Ubah Harga / Menu Terkunci',
                                  description: 'Untuk mencegah perubahan harga oleh kasir, pengeditan menu memerlukan PIN Owner.',
                                  onVerified: () => {
                                    setProductToEdit(prod);
                                    setIsModalOpen(true);
                                  }
                                });
                                return;
                              }
                              setProductToEdit(prod);
                              setIsModalOpen(true);
                            }}
                            className="p-1.5 bg-[#F2ECE2] hover:bg-[#E5DDD0] active:scale-95 text-[#4D423A] rounded-lg border border-[#E5DDD0] transition-colors"
                            title="Edit Menu"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => prod.id && handleDeleteProduct(prod.id, prod.name)}
                            className="p-1.5 bg-[#FAF8F5] hover:bg-[#FBEAE8] active:scale-95 text-[#8C7E71] hover:text-[#9A3B3B] rounded-lg border border-[#E5DDD0] transition-colors"
                            title="Hapus Menu"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      <ProductModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        productToEdit={productToEdit}
        onSave={handleSaveProduct}
        categories={categories}
      />

      <OwnerPinModal
        isOpen={!!pendingAuth}
        onClose={() => setPendingAuth(null)}
        onVerified={async (pin) => {
          if (pendingAuth) await pendingAuth.onVerified(pin);
        }}
        currentPinHash={settings.security?.ownerPinHash}
        title={pendingAuth?.title}
        description={pendingAuth?.description}
      />
      </div>
    </div>
  );
};
