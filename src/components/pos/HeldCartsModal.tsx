import React from 'react';
import { X, Clock, Play, Trash2, ShoppingBag } from 'lucide-react';
import type { HeldCart } from '../../types';
import { PrinterService } from '../../services/printerService';

interface HeldCartsModalProps {
  isOpen: boolean;
  onClose: () => void;
  heldCarts: HeldCart[];
  onRestoreCart: (cart: HeldCart) => void;
  onDeleteCart: (id: number) => void;
}

export const HeldCartsModal: React.FC<HeldCartsModalProps> = ({
  isOpen,
  onClose,
  heldCarts,
  onRestoreCart,
  onDeleteCart
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-[#26201C]/60 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in">
      <div className="bg-[#FAF8F5] border border-[#E8E1D7] rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col max-h-[80vh] animate-pop-in">
        {/* Header */}
        <div className="px-6 py-4 border-b border-[#E8E1D7] flex items-center justify-between bg-[#F5F2EB]/90">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-[#EDE6DC] text-[#7A4B1A] flex items-center justify-center">
              <Clock className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-[#26201C]">Pesanan Ditahan / Open Bill</h2>
              <p className="text-[11px] text-[#786C61]">Daftar pesanan meja atau tamu yang belum dituntaskan</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-[#8A7D71] hover:text-[#26201C] p-1.5 rounded-xl hover:bg-[#EDE6DC] transition active:scale-95"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto flex-1 space-y-2.5">
          {heldCarts.length === 0 ? (
            <div className="text-center py-10 text-[#8A7D71]">
              <ShoppingBag className="w-10 h-10 mx-auto mb-2 stroke-1 text-[#C4B8A8]" />
              <p className="text-xs text-[#786C61] font-medium">Tidak ada pesanan yang sedang ditahan.</p>
            </div>
          ) : (
            heldCarts.map((cart) => (
              <div
                key={cart.id}
                className="p-3.5 bg-[#F5F2EB] border border-[#E8E1D7] rounded-2xl flex items-center justify-between gap-4 hover:border-[#D5C9B8] transition-all"
              >
                <div className="space-y-0.5">
                  <div className="font-bold text-[#26201C] text-xs flex items-center gap-2">
                    <span>{cart.referenceName || 'Tanpa Catatan'}</span>
                    <span className="text-[11px] font-normal text-[#786C61]">
                      ({cart.items.length} Menu)
                    </span>
                  </div>
                  <div className="text-[11px] text-[#8A7D71]">
                    Waktu: {PrinterService.formatDate(cart.timestamp)}
                  </div>
                  <div className="text-xs font-black text-[#26201C]">
                    {PrinterService.formatRupiah(cart.total)}
                  </div>
                </div>

                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => {
                      onRestoreCart(cart);
                      onClose();
                    }}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-[#2D241E] hover:bg-[#1E1713] active:scale-95 text-[#FDFCFB] text-xs font-bold rounded-xl shadow-xs transition-all"
                  >
                    <Play className="w-3 h-3" />
                    Lanjutkan
                  </button>

                  <button
                    type="button"
                    onClick={() => cart.id && onDeleteCart(cart.id)}
                    className="p-1.5 bg-[#FAF8F5] hover:bg-[#FBEAE8] text-[#8A7D71] hover:text-[#9A3B3B] rounded-xl border border-[#E8E1D7] active:scale-95 transition-all"
                    title="Hapus"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        <div className="px-6 py-3 border-t border-[#E8E1D7] bg-[#F5F2EB]/90 text-right">
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-[#FAF8F5] hover:bg-[#EDE6DC] active:scale-95 text-[#5C4F45] text-xs font-bold rounded-xl border border-[#E8E1D7] transition-all"
          >
            Tutup
          </button>
        </div>
      </div>
    </div>
  );
};
