import React, { useState, useEffect, useRef } from 'react';
import { 
  Search, 
  Plus, 
  Minus, 
  Trash2, 
  ShoppingBag, 
  Clock, 
  User,
  Coffee,
  MessageSquarePlus,
  Check,
  Flame,
  Snowflake,
  X
} from 'lucide-react';
import type { Product, ProductVariant, CartItem, ReceiptSettings, HeldCart, UserRole, CashierShift } from '../../types';
import { PrinterService } from '../../services/printerService';
import { SyncService } from '../../services/syncService';
import { PaymentModal } from './PaymentModal';
import { HeldCartsModal } from './HeldCartsModal';
import { ProductModal } from '../products/ProductModal';
import { OwnerPinModal } from '../auth/OwnerPinModal';
import { db } from '../../db/db';

interface CashierScreenProps {
  products: Product[];
  settings: ReceiptSettings;
  userRole: UserRole;
  ownerPin: string;
  initialCashierName?: string;
  activeShift?: CashierShift;
  onRefreshProducts: () => void;
  onNavigateToSettings: () => void;
}

export const CashierScreen: React.FC<CashierScreenProps> = ({
  products,
  settings,
  userRole,
  ownerPin,
  initialCashierName = 'Kasir',
  activeShift = 'Shift Pagi',
  onRefreshProducts
}) => {
  const [cart, setCart] = useState<CartItem[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('Semua');
  const [cashierName, setCashierName] = useState(initialCashierName);

  useEffect(() => {
    if (initialCashierName) {
      setCashierName(initialCashierName);
    }
  }, [initialCashierName]);
  const [orderType, setOrderType] = useState<'Dine-In' | 'Take Away'>('Dine-In');
  const [customerNote, setCustomerNote] = useState('');
  const [overallDiscount, setOverallDiscount] = useState<number>(0);
  const [editingNoteKey, setEditingNoteKey] = useState<string | null>(null);
  const [variantPickerProduct, setVariantPickerProduct] = useState<Product | null>(null);
  const [showMobileCart, setShowMobileCart] = useState(false);
  
  // Modals
  const [isPaymentOpen, setIsPaymentOpen] = useState(false);
  const [isHeldCartsOpen, setIsHeldCartsOpen] = useState(false);
  const [isAddMenuOpen, setIsAddMenuOpen] = useState(false);
  const [heldCarts, setHeldCarts] = useState<HeldCart[]>([]);
  const [pendingOwnerAction, setPendingOwnerAction] = useState<{
    title: string;
    description: string;
    onVerified: (pin: string) => Promise<void>;
  } | null>(null);
  
  // Search input ref
  const searchInputRef = useRef<HTMLInputElement>(null);

  const loadHeldCarts = async () => {
    try {
      const list = await db.heldCarts.toArray();
      setHeldCarts(list);
    } catch (err) {
      console.error('Error loading held carts:', err);
    }
  };

  useEffect(() => {
    loadHeldCarts();
    const unsubscribe = SyncService.subscribe(() => {
      loadHeldCarts();
    });
    return unsubscribe;
  }, []);

  // Keyboard shortcuts (F9: Bayar, F7: Tahan, F2: Cari)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'F9') {
        e.preventDefault();
        if (cart.length > 0) setIsPaymentOpen(true);
      } else if (e.key === 'F7') {
        e.preventDefault();
        if (cart.length > 0) handleHoldCart();
      } else if (e.key === 'F2') {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [cart]);

  const categories = ['Semua', ...Array.from(new Set(products.map((p) => p.category).filter(Boolean)))];

  const filteredProducts = products.filter((p) => {
    const matchesSearch =
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.barcode.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory =
      selectedCategory === 'Semua' || p.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const getCartKey = (productId: number, variantLabel?: string) =>
    `${productId}::${variantLabel || 'std'}`;

  const handleSelectProduct = (product: Product) => {
    if (product.variants && product.variants.length > 0) {
      setVariantPickerProduct(product);
      return;
    }
    addToCart(product);
  };

  const addToCart = (product: Product, variant?: ProductVariant) => {
    const unitPrice = variant ? variant.price : product.price;
    const itemName = variant ? `${product.name} (${variant.label})` : product.name;
    const vLabel = variant?.label;

    setCart((prev) => {
      const existing = prev.find(
        (item) => item.productId === product.id && (item.variantLabel || '') === (vLabel || '')
      );
      if (existing) {
        return prev.map((item) =>
          item.productId === product.id && (item.variantLabel || '') === (vLabel || '')
            ? {
                ...item,
                quantity: item.quantity + 1,
                subtotal: (item.quantity + 1) * item.price - item.discount
              }
            : item
        );
      }
      return [
        ...prev,
        {
          productId: product.id!,
          barcode: product.barcode,
          name: itemName,
          variantLabel: vLabel,
          buyPrice: product.buyPrice,
          price: unitPrice,
          quantity: 1,
          discount: 0,
          subtotal: unitPrice
        }
      ];
    });
  };

  const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && searchQuery.trim()) {
      e.preventDefault();
      const code = searchQuery.trim();
      const found = products.find(
        (p) => p.barcode.toLowerCase() === code.toLowerCase() || p.name.toLowerCase() === code.toLowerCase()
      );

      if (found) {
        handleSelectProduct(found);
        setSearchQuery('');
      } else if (filteredProducts.length === 1) {
        handleSelectProduct(filteredProducts[0]);
        setSearchQuery('');
      }
    }
  };

  const updateQuantity = (productId: number, variantLabel: string | undefined, delta: number) => {
    setCart((prev) =>
      prev
        .map((item) => {
          if (item.productId === productId && (item.variantLabel || '') === (variantLabel || '')) {
            const newQty = item.quantity + delta;
            if (newQty <= 0) return null;
            return {
              ...item,
              quantity: newQty,
              subtotal: newQty * item.price - item.discount
            };
          }
          return item;
        })
        .filter(Boolean) as CartItem[]
    );
  };

  const updateItemNote = (productId: number, variantLabel: string | undefined, note: string) => {
    setCart((prev) =>
      prev.map((item) =>
        item.productId === productId && (item.variantLabel || '') === (variantLabel || '')
          ? { ...item, note: note.trim() || undefined }
          : item
      )
    );
  };

  const removeFromCart = (productId: number, variantLabel: string | undefined) => {
    setCart((prev) =>
      prev.filter(
        (item) => !(item.productId === productId && (item.variantLabel || '') === (variantLabel || ''))
      )
    );
  };

  const clearCart = () => {
    if (cart.length === 0) return;
    if (confirm('Kosongkan pesanan ini?')) {
      setCart([]);
      setOverallDiscount(0);
      setCustomerNote('');
    }
  };

  const handleHoldCart = async () => {
    if (cart.length === 0) return;
    const defaultLabel = customerNote.trim()
      ? `${orderType} - ${customerNote.trim()}`
      : `${orderType} (${new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })})`;
    const note = prompt('Simpan pesanan atas nama / nomor meja:', defaultLabel);
    if (note === null) return;

    try {
      await SyncService.addHeldCart({
        timestamp: new Date().toISOString(),
        referenceName: note.trim() || defaultLabel,
        items: cart,
        total: grandTotal
      });
      setCart([]);
      setOverallDiscount(0);
      setCustomerNote('');
      loadHeldCarts();
    } catch (err) {
      console.error('Error holding cart:', err);
      alert('Gagal menyimpan pesanan sementara.');
    }
  };

  const handleRestoreCart = async (held: HeldCart) => {
    setCart(held.items);
    setCustomerNote(held.referenceName);
    if (held.id) {
      await SyncService.deleteHeldCart(held.id, { isRestoring: true, actor: cashierName });
      loadHeldCarts();
    }
  };

  const handleDeleteHeldCart = async (id: number) => {
    const canDelete = userRole === 'OWNER' || !!settings.security?.cashierCanDeleteHeldCart;
    if (!canDelete) {
      setPendingOwnerAction({
        title: 'Hapus Open Bill',
        description: 'Menghapus pesanan tertahan tanpa pembayaran memerlukan otorisasi PIN Owner.',
        onVerified: async (pin) => {
          const res = await SyncService.deleteHeldCart(id, {
            isRestoring: false,
            ownerPin: pin,
            actor: cashierName
          });
          if (!res.ok) throw new Error(res.error);
          loadHeldCarts();
        }
      });
      return;
    }

    const res = await SyncService.deleteHeldCart(id, {
      isRestoring: false,
      ownerPin: userRole === 'OWNER' ? ownerPin : undefined,
      actor: cashierName
    });
    if (!res.ok) {
      alert(res.error || 'Gagal menghapus pesanan.');
    }
    loadHeldCarts();
  };

  const handleOpenAddMenu = () => {
    const canAdd = userRole === 'OWNER' || settings.security?.cashierCanAddMenu !== false;
    if (!canAdd) {
      setPendingOwnerAction({
        title: 'Tambah Menu Terkunci',
        description: 'Owner membatasi penambahan menu. Masukkan PIN Owner untuk menambah menu baru.',
        onVerified: async () => {
          setIsAddMenuOpen(true);
        }
      });
      return;
    }
    setIsAddMenuOpen(true);
  };

  const handleSaveNewMenu = async (productData: Omit<Product, 'id'>) => {
    const res = await SyncService.saveProduct(
      productData,
      undefined,
      userRole === 'OWNER' ? ownerPin : undefined,
      userRole === 'OWNER' ? 'Owner' : cashierName
    );
    if (!res.ok) {
      alert(res.error || 'Gagal menambahkan menu baru.');
      return;
    }
    onRefreshProducts();
  };

  const getCategoryTagClass = (cat: string) => {
    const c = cat.toLowerCase();
    if (c.includes('coffee') || c.includes('kopi')) return 'text-[#874C23]';
    if (c.includes('non') || c.includes('tea') || c.includes('matcha')) return 'text-[#285A3B]';
    if (c.includes('toast') || c.includes('pastry') || c.includes('roti')) return 'text-[#925C25]';
    return 'text-[#6D6055]';
  };

  // Calculations
  const subtotal = cart.reduce((sum, item) => sum + item.quantity * item.price, 0);
  const itemsDiscount = cart.reduce((sum, item) => sum + item.discount, 0);
  const totalDiscount = itemsDiscount + overallDiscount;
  const taxableSubtotal = Math.max(0, subtotal - totalDiscount);
  const tax = settings.showTax ? Math.round(taxableSubtotal * ((settings.taxRate || 0) / 100)) : 0;
  const grandTotal = taxableSubtotal + tax;

  const formattedCustomerRef = customerNote.trim()
    ? `${customerNote.trim()} (${orderType})`
    : orderType;

  const totalCartItems = cart.reduce((sum, item) => sum + item.quantity, 0);

  return (
    <div className="flex-1 flex flex-col md:flex-row overflow-hidden bg-[#F6F3EC] relative">
      {/* LEFT SECTION: Menu Catalog */}
      <div className={`${showMobileCart ? 'hidden md:flex' : 'flex'} flex-1 flex-col min-w-0 overflow-hidden`}>
        {/* Search & Quick Add Bar */}
        <div className="px-4 py-3 border-b border-[#E5DDD0] bg-[#FAF8F5] flex items-center gap-2.5">
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-[#9C8E80]" />
            <input
              ref={searchInputRef}
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={handleSearchKeyDown}
              placeholder="Cari menu kopi, minuman, atau makanan... (F2)"
              className="w-full pl-10 pr-9 py-2 bg-[#F2ECE2] border border-[#E2D9CC] rounded-lg text-sm text-[#1F1A17] placeholder-[#9C8E80] focus:outline-none focus:bg-[#FAF8F5] focus:border-[#2A211B] transition-colors"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-[#9C8E80] hover:text-[#1F1A17] p-1"
              >
                ✕
              </button>
            )}
          </div>

          <button
            type="button"
            onClick={handleOpenAddMenu}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-[#2A211B] hover:bg-[#1A1410] active:scale-[0.98] text-[#FAF8F5] text-xs font-semibold rounded-lg transition-all whitespace-nowrap"
            title="Tambah menu baru"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Tambah Menu</span>
          </button>
        </div>

        {/* Category Filter Tabs */}
        <div className="px-4 py-2.5 border-b border-[#E5DDD0] bg-[#FAF8F5]/70 flex items-center gap-1.5 overflow-x-auto no-scrollbar">
          {categories.map((cat) => {
            const isSelected = selectedCategory === cat;
            return (
              <button
                key={cat}
                type="button"
                onClick={() => setSelectedCategory(cat)}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors active:scale-[0.98] ${
                  isSelected
                    ? 'bg-[#2A211B] text-[#FAF8F5]'
                    : 'bg-[#EFE9DF] text-[#5E5248] hover:text-[#1F1A17] hover:bg-[#E5DDD0]'
                }`}
              >
                {cat}
              </button>
            );
          })}
        </div>

        {/* Menu Grid */}
        <div className="flex-1 p-4 overflow-y-auto">
          {filteredProducts.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-[#8C7E71] p-8 text-center animate-fade-in">
              <Coffee className="w-10 h-10 mb-3 stroke-[1.5] text-[#C4B8A8]" />
              <p className="text-sm font-bold text-[#3D332B]">Menu tidak ditemukan</p>
              <p className="text-xs text-[#8C7E71] mt-1 max-w-xs">
                Tidak ada menu yang cocok dengan kata kunci tersebut.
              </p>
              <button
                type="button"
                onClick={handleOpenAddMenu}
                className="mt-4 flex items-center gap-1.5 px-4 py-2 bg-[#2A211B] hover:bg-[#1A1410] active:scale-[0.98] text-[#FAF8F5] text-xs font-semibold rounded-lg transition-all"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Tambah Menu Baru</span>
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-3">
              {filteredProducts.map((prod) => {
                const qtyInCart = cart
                  .filter((c) => c.productId === prod.id)
                  .reduce((sum, c) => sum + c.quantity, 0);
                const hasVariants = !!(prod.variants && prod.variants.length > 0);

                return (
                  <button
                    key={prod.id}
                    type="button"
                    onClick={() => handleSelectProduct(prod)}
                    className={`relative p-3.5 rounded-xl border text-left flex flex-col justify-between transition-all duration-150 group active:scale-[0.98] ${
                      qtyInCart > 0
                        ? 'bg-[#FDFBF7] border-[#2A211B] shadow-[0_2px_8px_rgba(42,33,27,0.06)]'
                        : 'bg-[#FAF8F5] border-[#E5DDD0] hover:border-[#BFB3A2] hover:bg-[#FDFBF7]'
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between gap-2 mb-1.5">
                        <span className={`text-[11px] font-bold tracking-tight ${getCategoryTagClass(prod.category)}`}>
                          {prod.category}
                        </span>

                        {qtyInCart > 0 && (
                          <span className="min-w-5 h-5 px-1.5 rounded-md bg-[#2A211B] text-[#FAF8F5] text-[11px] font-bold tabular-nums flex items-center justify-center animate-pop-in">
                            {qtyInCart}
                          </span>
                        )}
                      </div>

                      <h3 className="font-bold text-[13px] text-[#1F1A17] line-clamp-2 leading-snug">
                        {prod.name}
                      </h3>

                      {hasVariants && (
                        <div className="mt-1 inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-[#EFE9DF] text-[10px] font-semibold text-[#6D6055]">
                          <span>Hot / Dingin</span>
                        </div>
                      )}
                    </div>

                    <div className="mt-4 pt-2.5 border-t border-[#EFE9DF] flex items-center justify-between gap-2">
                      {hasVariants ? (
                        <div className="space-y-0.5 min-w-0">
                          {prod.variants!.map((v) => (
                            <div key={v.label} className="text-[11px] font-bold text-[#1F1A17] tabular-nums leading-tight truncate">
                              <span className="text-[#7D6F63] font-semibold mr-1">{v.label}</span>
                              {PrinterService.formatRupiah(v.price)}
                            </div>
                          ))}
                        </div>
                      ) : (
                        <span className="font-extrabold text-sm text-[#1F1A17] tabular-nums">
                          {PrinterService.formatRupiah(prod.price)}
                        </span>
                      )}
                      <span className="w-7 h-7 flex-shrink-0 rounded-lg bg-[#EFE9DF] group-hover:bg-[#2A211B] text-[#5E5248] group-hover:text-[#FAF8F5] flex items-center justify-center transition-colors">
                        <Plus className="w-3.5 h-3.5" />
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Mobile Floating Cart Bar */}
        {cart.length > 0 && (
          <div className="md:hidden p-3 bg-[#FAF8F5] border-t border-[#E5DDD0]">
            <button
              type="button"
              onClick={() => setShowMobileCart(true)}
              className="w-full py-3 px-4 bg-[#285A3B] hover:bg-[#1E462D] text-[#FAF8F5] rounded-xl font-bold text-sm flex items-center justify-between active:scale-[0.99]"
            >
              <span className="flex items-center gap-2">
                <ShoppingBag className="w-4 h-4" />
                <span>Lihat Pesanan ({totalCartItems} item)</span>
              </span>
              <span className="tabular-nums">{PrinterService.formatRupiah(grandTotal)}</span>
            </button>
          </div>
        )}
      </div>

      {/* RIGHT SECTION: Order Ticket */}
      <aside className={`${showMobileCart ? 'flex flex-1 w-full' : 'hidden md:flex md:w-[330px] lg:w-[385px]'} flex-col bg-[#FAF8F5] md:border-l border-[#E5DDD0] flex-shrink-0 overflow-hidden`}>
        {/* Mobile Back to Menu Bar */}
        <div className="md:hidden px-4 py-2.5 bg-[#EFE9DF] border-b border-[#E5DDD0] flex items-center justify-between">
          <button
            type="button"
            onClick={() => setShowMobileCart(false)}
            className="text-xs font-bold text-[#2A211B] flex items-center gap-1"
          >
            ← Kembali ke Menu
          </button>
          <span className="text-xs font-semibold text-[#6D6055] tabular-nums">
            {totalCartItems} item
          </span>
        </div>
        {/* Order Header */}
        <div className="px-4 py-3 border-b border-[#E5DDD0] flex items-center justify-between">
          <div>
            <h2 className="text-sm font-extrabold text-[#1F1A17]">Pesanan</h2>
            <div className="flex items-center gap-1.5 text-[11px] text-[#7D6F63] mt-0.5">
              <User className="w-3 h-3" />
              <button
                type="button"
                onClick={() => {
                  const name = prompt('Nama Kasir:', cashierName);
                  if (name?.trim()) setCashierName(name.trim());
                }}
                className="hover:text-[#1F1A17] underline underline-offset-2 font-medium"
                title="Ubah nama kasir"
              >
                {cashierName}
              </button>
              <span className="px-1.5 py-0.5 rounded bg-[#EFE9DF] text-[#5E5248] text-[10px] font-semibold">
                {activeShift}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            {heldCarts.length > 0 && (
              <button
                type="button"
                onClick={() => setIsHeldCartsOpen(true)}
                className="px-2.5 py-1.5 bg-[#F6EBDD] hover:bg-[#EFE0CC] text-[#7A4B1A] text-xs font-bold rounded-lg border border-[#E5CFAF] transition-colors flex items-center gap-1 active:scale-[0.98]"
                title="Lihat pesanan yang ditahan"
              >
                <Clock className="w-3.5 h-3.5" />
                <span className="tabular-nums">{heldCarts.length}</span>
              </button>
            )}

            {cart.length > 0 && (
              <button
                type="button"
                onClick={clearCart}
                className="p-1.5 text-[#8C7E71] hover:text-[#9A3B3B] hover:bg-[#FBEAE8] rounded-lg transition-colors"
                title="Kosongkan pesanan"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {/* Dine-In / Take Away & Table Input */}
        <div className="px-4 py-2.5 border-b border-[#E5DDD0] bg-[#F6F3EC]/60 space-y-2">
          <div className="grid grid-cols-2 gap-1 p-0.5 bg-[#EAE3D7] rounded-lg">
            {(['Dine-In', 'Take Away'] as const).map((type) => (
              <button
                key={type}
                type="button"
                onClick={() => setOrderType(type)}
                className={`py-1.5 text-xs font-bold rounded-md transition-all ${
                  orderType === type
                    ? 'bg-[#FAF8F5] text-[#1F1A17] shadow-2xs'
                    : 'text-[#6D6055] hover:text-[#1F1A17]'
                }`}
              >
                {type}
              </button>
            ))}
          </div>

          <input
            type="text"
            value={customerNote}
            onChange={(e) => setCustomerNote(e.target.value)}
            placeholder="No. Meja / Nama tamu (opsional)"
            className="w-full px-3 py-1.5 bg-[#FAF8F5] border border-[#E2D9CC] rounded-lg text-xs text-[#1F1A17] placeholder-[#9C8E80] focus:outline-none focus:border-[#2A211B] transition-colors"
          />
        </div>

        {/* Cart Items */}
        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2.5 bg-[#F6F3EC]/40">
          {cart.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-[#9C8E80] p-6 text-center">
              <ShoppingBag className="w-9 h-9 mb-2.5 stroke-[1.5] text-[#C8BDB0]" />
              <p className="text-xs font-bold text-[#4D423A]">Keranjang masih kosong</p>
              <p className="text-[11px] text-[#8C7E71] mt-1">
                Pilih menu di sebelah kiri untuk mulai mencatat pesanan.
              </p>
            </div>
          ) : (
            cart.map((item) => {
              const itemKey = getCartKey(item.productId, item.variantLabel);
              const isEditingThisNote = editingNoteKey === itemKey;
              return (
                <div
                  key={itemKey}
                  className="p-3 bg-[#FAF8F5] border border-[#E5DDD0] rounded-xl space-y-2 animate-slide-up"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="font-bold text-xs text-[#1F1A17] leading-snug">
                        {item.name}
                      </div>
                      {item.note && !isEditingThisNote && (
                        <div className="text-[11px] text-[#874C23] mt-0.5 font-medium">
                          Catatan: {item.note}
                        </div>
                      )}
                    </div>

                    <div className="flex items-center gap-1 flex-shrink-0">
                      <button
                        type="button"
                        onClick={() => setEditingNoteKey(isEditingThisNote ? null : itemKey)}
                        className={`p-1 rounded-md transition-colors ${
                          item.note || isEditingThisNote
                            ? 'text-[#874C23] bg-[#F6EBDD]'
                            : 'text-[#9C8E80] hover:text-[#1F1A17] hover:bg-[#EFE9DF]'
                        }`}
                        title="Tambah catatan pesanan (mis. Less Ice, Less Sugar)"
                      >
                        <MessageSquarePlus className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => removeFromCart(item.productId, item.variantLabel)}
                        className="p-1 text-[#9C8E80] hover:text-[#9A3B3B] hover:bg-[#FBEAE8] rounded-md transition-colors"
                        title="Hapus item"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {isEditingThisNote && (
                    <div className="flex items-center gap-1.5 pt-0.5">
                      <input
                        type="text"
                        autoFocus
                        defaultValue={item.note || ''}
                        placeholder="Mis: Less Ice, Less Sugar, Oatmilk..."
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            updateItemNote(item.productId, item.variantLabel, (e.target as HTMLInputElement).value);
                            setEditingNoteKey(null);
                          } else if (e.key === 'Escape') {
                            setEditingNoteKey(null);
                          }
                        }}
                        onBlur={(e) => {
                          updateItemNote(item.productId, item.variantLabel, e.target.value);
                          setEditingNoteKey(null);
                        }}
                        className="flex-1 px-2.5 py-1 bg-[#F2ECE2] border border-[#D5C9B8] rounded-md text-[11px] text-[#1F1A17] focus:outline-none focus:border-[#2A211B]"
                      />
                      <button
                        type="button"
                        onClick={() => setEditingNoteKey(null)}
                        className="p-1 bg-[#2A211B] text-[#FAF8F5] rounded-md"
                      >
                        <Check className="w-3 h-3" />
                      </button>
                    </div>
                  )}

                  <div className="flex items-center justify-between text-xs pt-0.5">
                    <span className="text-[#7D6F63] tabular-nums">
                      {PrinterService.formatRupiah(item.price)}
                    </span>

                    <div className="flex items-center gap-1 bg-[#F2ECE2] px-1.5 py-0.5 rounded-lg border border-[#E5DDD0]">
                      <button
                        type="button"
                        onClick={() => updateQuantity(item.productId, item.variantLabel, -1)}
                        className="w-5 h-5 flex items-center justify-center text-[#5E5248] hover:text-[#1F1A17] rounded active:scale-90"
                      >
                        <Minus className="w-3 h-3" />
                      </button>
                      <span className="font-bold text-[#1F1A17] min-w-5 text-center tabular-nums">
                        {item.quantity}
                      </span>
                      <button
                        type="button"
                        onClick={() => updateQuantity(item.productId, item.variantLabel, 1)}
                        className="w-5 h-5 flex items-center justify-center text-[#5E5248] hover:text-[#1F1A17] rounded active:scale-90"
                      >
                        <Plus className="w-3 h-3" />
                      </button>
                    </div>

                    <span className="font-bold text-[#1F1A17] tabular-nums min-w-[74px] text-right">
                      {PrinterService.formatRupiah(item.subtotal)}
                    </span>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Summary & Checkout Footer */}
        <div className="p-4 border-t border-[#E5DDD0] bg-[#FAF8F5] space-y-3">
          <div className="space-y-1.5 text-xs">
            <div className="flex justify-between text-[#7D6F63]">
              <span>Subtotal</span>
              <span className="text-[#1F1A17] font-semibold tabular-nums">
                {PrinterService.formatRupiah(subtotal)}
              </span>
            </div>

            {totalDiscount > 0 && (
              <div className="flex justify-between text-[#9A3B3B] font-medium">
                <span>Diskon</span>
                <span className="tabular-nums">-{PrinterService.formatRupiah(totalDiscount)}</span>
              </div>
            )}

            {settings.showTax && tax > 0 && (
              <div className="flex justify-between text-[#7D6F63]">
                <span>Pajak ({settings.taxRate}%)</span>
                <span className="tabular-nums">{PrinterService.formatRupiah(tax)}</span>
              </div>
            )}

            <div className="flex justify-between items-baseline pt-2 border-t border-[#EAE3D7]">
              <span className="text-xs font-bold text-[#5E5248]">Total Tagihan</span>
              <span className="text-xl text-[#1F1A17] font-extrabold tabular-nums tracking-tight">
                {PrinterService.formatRupiah(grandTotal)}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2 pt-0.5">
            <button
              type="button"
              disabled={cart.length === 0}
              onClick={handleHoldCart}
              className="py-2.5 px-2 bg-[#EFE9DF] hover:bg-[#E5DDD0] text-[#3D332B] text-xs font-bold rounded-lg border border-[#DDD3C5] transition-colors disabled:opacity-40 active:scale-[0.98]"
              title="Simpan pesanan sementara (F7)"
            >
              Tahan (F7)
            </button>

            <button
              type="button"
              disabled={cart.length === 0}
              onClick={() => setIsPaymentOpen(true)}
              className="col-span-2 py-2.5 px-4 bg-[#285A3B] hover:bg-[#1E462D] text-[#FAF8F5] font-bold text-sm rounded-lg transition-colors flex items-center justify-center gap-2 disabled:opacity-40 active:scale-[0.98]"
            >
              <span>Bayar</span>
              {grandTotal > 0 && (
                <span className="tabular-nums opacity-95">
                  • {PrinterService.formatRupiah(grandTotal)}
                </span>
              )}
            </button>
          </div>
        </div>
      </aside>

      {/* Variant Picker Modal (Hot / Dingin) */}
      {variantPickerProduct && variantPickerProduct.variants && (
        <div
          onClick={() => setVariantPickerProduct(null)}
          className="fixed inset-0 z-50 bg-[#26201C]/60 backdrop-blur-xs flex items-center justify-center p-4 animate-fade-in"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-[#FAF8F5] border border-[#E5DDD0] rounded-2xl w-full max-w-sm shadow-2xl overflow-hidden animate-pop-in"
          >
            <div className="px-5 py-4 border-b border-[#E5DDD0] flex items-center justify-between bg-[#F2ECE2]/70">
              <div className="min-w-0 pr-3">
                <h3 className="text-sm font-extrabold text-[#1F1A17] truncate">
                  {variantPickerProduct.name}
                </h3>
                <p className="text-[11px] text-[#7D6F63] mt-0.5">
                  Pilih versi penyajian untuk masuk ke pesanan
                </p>
              </div>
              <button
                type="button"
                onClick={() => setVariantPickerProduct(null)}
                className="p-1.5 rounded-lg text-[#7D6F63] hover:text-[#1F1A17] hover:bg-[#E5DDD0] transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-4 space-y-2.5">
              {variantPickerProduct.variants.map((variant) => {
                const isHot = variant.label.toLowerCase().includes('hot');
                return (
                  <button
                    key={variant.label}
                    type="button"
                    onClick={() => {
                      addToCart(variantPickerProduct, variant);
                      setVariantPickerProduct(null);
                    }}
                    className={`w-full p-3.5 rounded-xl border flex items-center justify-between gap-3 transition-all active:scale-[0.98] ${
                      isHot
                        ? 'bg-[#F6EFE6] hover:bg-[#EFE2D2] border-[#DFCBB3] text-[#1F1A17]'
                        : 'bg-[#EEF4F8] hover:bg-[#DFECF4] border-[#C3D8E6] text-[#1F1A17]'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                          isHot
                            ? 'bg-[#EAD6BE] text-[#7A4B1A]'
                            : 'bg-[#D6E6F2] text-[#255478]'
                        }`}
                      >
                        {isHot ? <Flame className="w-5 h-5" /> : <Snowflake className="w-5 h-5" />}
                      </div>
                      <div className="text-left">
                        <div className="text-sm font-extrabold text-[#1F1A17]">
                          {isHot ? 'Hot (Panas)' : `${variant.label} (Ice)`}
                        </div>
                        <div className="text-[11px] text-[#7D6F63]">
                          Ketuk untuk tambah 1 {variantPickerProduct.unit || 'cup'}
                        </div>
                      </div>
                    </div>

                    <div className="text-sm font-extrabold text-[#1F1A17] tabular-nums">
                      {PrinterService.formatRupiah(variant.price)}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Modals */}
      <PaymentModal
        isOpen={isPaymentOpen}
        onClose={() => setIsPaymentOpen(false)}
        items={cart}
        subtotal={subtotal}
        discount={totalDiscount}
        tax={tax}
        total={grandTotal}
        cashierName={cashierName}
        activeShift={activeShift}
        initialCustomerName={formattedCustomerRef}
        settings={settings}
        onTransactionComplete={() => {
          setCart([]);
          setOverallDiscount(0);
          setCustomerNote('');
          setShowMobileCart(false);
          onRefreshProducts();
        }}
      />

      <HeldCartsModal
        isOpen={isHeldCartsOpen}
        onClose={() => setIsHeldCartsOpen(false)}
        heldCarts={heldCarts}
        onRestoreCart={handleRestoreCart}
        onDeleteCart={handleDeleteHeldCart}
      />

      <ProductModal
        isOpen={isAddMenuOpen}
        onClose={() => setIsAddMenuOpen(false)}
        onSave={handleSaveNewMenu}
        categories={categories.filter((c) => c !== 'Semua')}
      />

      <OwnerPinModal
        isOpen={!!pendingOwnerAction}
        onClose={() => setPendingOwnerAction(null)}
        onVerified={async (pin) => {
          if (pendingOwnerAction) {
            await pendingOwnerAction.onVerified(pin);
          }
        }}
        currentPinHash={settings.security?.ownerPinHash}
        title={pendingOwnerAction?.title}
        description={pendingOwnerAction?.description}
        actorName={cashierName}
      />
    </div>
  );
};
