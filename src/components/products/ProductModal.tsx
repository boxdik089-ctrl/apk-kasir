import React, { useState, useEffect } from 'react';
import { X, Save, Coffee, Wand2 } from 'lucide-react';
import type { Product } from '../../types';

interface ProductModalProps {
  isOpen: boolean;
  onClose: () => void;
  productToEdit?: Product | null;
  onSave: (productData: Omit<Product, 'id'>, id?: number) => void;
  categories: string[];
}

export const ProductModal: React.FC<ProductModalProps> = ({
  isOpen,
  onClose,
  productToEdit,
  onSave,
  categories
}) => {
  const [name, setName] = useState('');
  const [barcode, setBarcode] = useState('');
  const [category, setCategory] = useState('Coffee');
  const [newCategory, setNewCategory] = useState('');
  const [isAddingCategory, setIsAddingCategory] = useState(false);
  const [buyPrice, setBuyPrice] = useState<number>(0);
  const [price, setPrice] = useState<number>(0);
  const [unit, setUnit] = useState('cup');

  useEffect(() => {
    if (productToEdit) {
      setName(productToEdit.name);
      setBarcode(productToEdit.barcode);
      setCategory(productToEdit.category || 'Coffee');
      setBuyPrice(productToEdit.buyPrice || 0);
      setPrice(productToEdit.price || 0);
      setUnit(productToEdit.unit || 'cup');
    } else {
      setName('');
      setBarcode('');
      setCategory(categories[0] || 'Coffee');
      setBuyPrice(0);
      setPrice(0);
      setUnit('cup');
    }
  }, [productToEdit, isOpen, categories]);

  if (!isOpen) return null;

  const generateCode = () => {
    const randomCode = 'MN-' + Math.floor(100 + Math.random() * 900);
    setBarcode(randomCode);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      alert('Nama menu cafe wajib diisi.');
      return;
    }

    const finalCode = barcode.trim() || ('MN-' + Math.floor(100 + Math.random() * 900));
    const finalCategory = isAddingCategory && newCategory.trim() ? newCategory.trim() : category;

    onSave(
      {
        name: name.trim(),
        barcode: finalCode,
        category: finalCategory,
        buyPrice: Number(buyPrice) || 0,
        price: Number(price) || 0,
        stock: 999, // Unlimited stock for cafe food & beverages
        minStock: 0,
        unit: unit.trim() || 'cup',
        createdAt: productToEdit ? productToEdit.createdAt : new Date().toISOString()
      },
      productToEdit?.id
    );
    onClose();
  };

  // Margin calculation
  const margin = price > 0 ? price - buyPrice : 0;
  const marginPercent = buyPrice > 0 ? Math.round((margin / buyPrice) * 100) : 0;

  return (
    <div className="fixed inset-0 z-50 bg-[#26201C]/60 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in">
      <div className="bg-[#FAF8F5] border border-[#E8E1D7] rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col animate-pop-in">
        {/* Header */}
        <div className="px-6 py-4 border-b border-[#E8E1D7] flex items-center justify-between bg-[#F5F2EB]/90">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-[#EDE6DC] text-[#7A4B1A] flex items-center justify-center">
              <Coffee className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-[#26201C]">
                {productToEdit ? 'Edit Menu Cafe' : 'Tambah Menu Cafe Baru'}
              </h2>
              <p className="text-[11px] text-[#786C61]">Kelola item F&B pada kasir</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-[#8A7D71] hover:text-[#26201C] p-1.5 rounded-xl hover:bg-[#EDE6DC] transition active:scale-95"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4 overflow-y-auto max-h-[75vh]">
          {/* Menu Name */}
          <div>
            <label className="block text-xs font-bold text-[#3D322A] mb-1.5">
              Nama Menu Minuman / Makanan: <span className="text-[#9A3B3B]">*</span>
            </label>
            <input
              type="text"
              required
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Contoh: Caramel Macchiato Iced / Croissant Butter"
              className="w-full px-4 py-2.5 bg-[#F5F2EB] border border-[#D5C9B8] rounded-xl text-xs text-[#26201C] font-semibold focus:outline-none focus:bg-[#FAF8F5] focus:border-[#2D241E] focus:ring-2 focus:ring-[#2D241E]/10 transition"
            />
          </div>

          {/* Menu Code / Barcode */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-bold text-[#3D322A]">
                Kode Menu:
              </label>
              <button
                type="button"
                onClick={generateCode}
                className="text-[11px] text-[#7A4B1A] hover:underline flex items-center gap-1 font-bold"
              >
                <Wand2 className="w-3 h-3 text-[#7A4B1A]" />
                Buat Kode Acak
              </button>
            </div>
            <input
              type="text"
              value={barcode}
              onChange={(e) => setBarcode(e.target.value)}
              placeholder="Contoh: CF01 (atau kosongkan untuk otomatis)"
              className="w-full px-4 py-2.5 bg-[#F5F2EB] border border-[#D5C9B8] rounded-xl text-xs font-mono font-bold text-[#26201C] focus:outline-none focus:bg-[#FAF8F5] focus:border-[#2D241E]"
            />
          </div>

          {/* Category */}
          <div>
            <label className="block text-xs font-bold text-[#3D322A] mb-1.5">
              Kategori Menu:
            </label>
            {!isAddingCategory ? (
              <div className="flex gap-2">
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="flex-1 px-4 py-2.5 bg-[#F5F2EB] border border-[#D5C9B8] rounded-xl text-xs text-[#26201C] focus:outline-none focus:bg-[#FAF8F5] focus:border-[#2D241E] font-bold"
                >
                  {categories.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => setIsAddingCategory(true)}
                  className="px-3.5 py-2 bg-[#EDE6DC] hover:bg-[#E2D8C9] active:scale-95 text-[#3D322A] text-xs font-bold rounded-xl border border-[#DFD5C6] transition-all"
                >
                  + Baru
                </button>
              </div>
            ) : (
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="Nama kategori baru..."
                  value={newCategory}
                  onChange={(e) => setNewCategory(e.target.value)}
                  className="flex-1 px-4 py-2.5 bg-[#F5F2EB] border border-[#D5C9B8] rounded-xl text-xs text-[#26201C] focus:outline-none focus:bg-[#FAF8F5] focus:border-[#2D241E]"
                />
                <button
                  type="button"
                  onClick={() => setIsAddingCategory(false)}
                  className="px-3.5 py-2 bg-[#FAF8F5] hover:bg-[#EDE6DC] active:scale-95 text-[#5C4F45] text-xs font-bold rounded-xl border border-[#E8E1D7]"
                >
                  Batal
                </button>
              </div>
            )}
          </div>

          {/* Pricing: Modal HPP & Harga Jual */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-[#3D322A] mb-1.5">
                Biaya Bahan / HPP (Rp):
              </label>
              <input
                type="number"
                min="0"
                step="500"
                value={buyPrice || ''}
                onChange={(e) => setBuyPrice(parseFloat(e.target.value) || 0)}
                placeholder="0"
                className="w-full px-4 py-2.5 bg-[#F5F2EB] border border-[#D5C9B8] rounded-xl text-xs text-[#26201C] font-semibold focus:outline-none focus:bg-[#FAF8F5] focus:border-[#2D241E]"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-[#3D322A] mb-1.5">
                Harga Jual Kasir (Rp): <span className="text-[#9A3B3B]">*</span>
              </label>
              <input
                type="number"
                required
                min="0"
                step="500"
                value={price || ''}
                onChange={(e) => setPrice(parseFloat(e.target.value) || 0)}
                placeholder="0"
                className="w-full px-4 py-2.5 bg-[#F5F2EB] border border-[#D5C9B8] rounded-xl text-xs font-black text-[#26201C] focus:outline-none focus:bg-[#FAF8F5] focus:border-[#2D241E]"
              />
            </div>
          </div>

          {/* Margin info bar */}
          {price > 0 && (
            <div className="p-3 bg-[#EDE6DC]/60 border border-[#DFD5C6] rounded-2xl text-xs flex items-center justify-between text-[#5C4F45]">
              <span className="font-medium">Estimasi Margin Keuntungan:</span>
              <span className="font-bold text-[#285A3B]">
                Rp {margin.toLocaleString('id-ID')} ({marginPercent}%)
              </span>
            </div>
          )}

          {/* Serving Unit */}
          <div>
            <label className="block text-xs font-bold text-[#3D322A] mb-1.5">
              Satuan Penyajian:
            </label>
            <input
              type="text"
              value={unit}
              onChange={(e) => setUnit(e.target.value)}
              placeholder="cup / glass / porsi / plate"
              className="w-full px-4 py-2.5 bg-[#F5F2EB] border border-[#D5C9B8] rounded-xl text-xs text-[#26201C] focus:outline-none focus:bg-[#FAF8F5] focus:border-[#2D241E]"
            />
          </div>

          {/* Footer Actions */}
          <div className="pt-4 border-t border-[#E8E1D7] flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-[#FAF8F5] hover:bg-[#EDE6DC] active:scale-95 text-[#5C4F45] text-xs font-bold rounded-xl border border-[#E8E1D7] transition-all"
            >
              Batal
            </button>
            <button
              type="submit"
              className="flex items-center gap-1.5 px-5 py-2.5 bg-[#2D241E] hover:bg-[#1E1713] active:scale-95 text-[#FDFCFB] text-xs font-bold rounded-xl shadow-xs transition-all"
            >
              <Save className="w-3.5 h-3.5" />
              Simpan Menu
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
