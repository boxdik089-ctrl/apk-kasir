import React, { useState, useEffect } from 'react';
import {
  Coffee,
  Shield,
  User,
  Lock,
  Eye,
  EyeOff,
  AlertCircle,
  LogIn,
  Sun,
  Sunset,
  MapPin
} from 'lucide-react';
import type { ReceiptSettings, UserRole, CashierShift } from '../../types';
import { DEFAULT_OWNER_PIN_HASH, DEFAULT_CASHIER_PIN_HASH } from '../../utils/hash';
import { SyncService } from '../../services/syncService';

interface LoginScreenProps {
  settings: ReceiptSettings;
  isSyncOnline: boolean;
  defaultMode?: UserRole;
  onLoginSuccess: (role: UserRole, userName: string, ownerPin?: string, shift?: CashierShift) => void;
}

export const LoginScreen: React.FC<LoginScreenProps> = ({
  settings,
  isSyncOnline,
  defaultMode = 'CASHIER',
  onLoginSuccess
}) => {
  const defaultShiftByHour: CashierShift = new Date().getHours() < 14 ? 'Shift Pagi' : 'Shift Siang';
  const [role, setRole] = useState<UserRole>(defaultMode);
  const [cashierName, setCashierName] = useState('');
  const [shift, setShift] = useState<CashierShift>(defaultShiftByHour);
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const isTerminalLocked = !!settings.security?.terminalLocked;
  const isDefaultOwnerPassword =
    !settings.security?.ownerPinHash || settings.security.ownerPinHash === DEFAULT_OWNER_PIN_HASH;
  const isDefaultCashierPassword =
    !settings.security?.cashierPinHash || settings.security.cashierPinHash === DEFAULT_CASHIER_PIN_HASH;

  useEffect(() => {
    setRole(defaultMode);
  }, [defaultMode]);

  const handleSwitchRole = (nextRole: UserRole) => {
    setRole(nextRole);
    setPassword('');
    setShowPassword(false);
    setError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (role === 'CASHIER') {
      if (isTerminalLocked) {
        setError('Terminal kasir sedang dikunci oleh Owner.');
        return;
      }
      const cleanName = cashierName.trim();
      if (!cleanName) {
        setError('Masukkan nama kasir terlebih dahulu.');
        return;
      }
      if (!password) {
        setError('Masukkan sandi kasir terlebih dahulu.');
        return;
      }

      setIsSubmitting(true);
      try {
        const res = await SyncService.verifyCashierPin(password, cleanName, shift);
        if (!res.ok) {
          setError(res.error || 'Sandi Kasir salah.');
          setPassword('');
          return;
        }
        onLoginSuccess('CASHIER', cleanName, undefined, shift);
      } finally {
        setIsSubmitting(false);
      }
      return;
    }

    // OWNER login
    if (!password) {
      setError('Masukkan sandi Owner terlebih dahulu.');
      return;
    }
    setIsSubmitting(true);
    try {
      const res = await SyncService.verifyOwnerPin(password, 'Owner');
      if (!res.ok) {
        setError(res.error || 'Sandi Owner salah.');
        setPassword('');
        return;
      }
      onLoginSuccess('OWNER', 'Owner', password);
    } finally {
      setIsSubmitting(false);
    }
  };

  const todayFormatted = new Date().toLocaleDateString('id-ID', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  });

  return (
    <div className="min-h-screen w-screen bg-[#EFE9DF] text-[#1F1A17] flex items-center justify-center p-3 sm:p-6 overflow-y-auto">
      <div className="w-full max-w-4xl bg-[#FAF8F5] border border-[#DFD5C6] rounded-3xl shadow-[0_24px_60px_-20px_rgba(31,26,23,0.18)] overflow-hidden grid grid-cols-1 md:grid-cols-12 animate-pop-in">
        {/* Left Editorial Coffeehouse Brand Panel */}
        <div className="md:col-span-5 bg-[#241C17] text-[#FAF8F5] p-6 sm:p-8 flex flex-col justify-between gap-6">
          <div className="space-y-5">
            <div className="flex items-center gap-3">
              {settings.showLogo && settings.logoBase64 ? (
                <img
                  src={settings.logoBase64}
                  alt={settings.storeName}
                  className="h-11 w-auto object-contain rounded-lg bg-[#FAF8F5] p-1"
                />
              ) : (
                <div className="w-11 h-11 rounded-2xl bg-[#362A22] border border-[#4D3D32] text-[#F5DFC2] flex items-center justify-center flex-shrink-0">
                  <Coffee className="w-5 h-5" />
                </div>
              )}
              <div className="min-w-0">
                <h1 className="text-base sm:text-lg font-extrabold tracking-tight text-[#FAF8F5] truncate">
                  {settings.storeName || 'SENJA COFFEE & EATERY'}
                </h1>
                <p className="text-[11px] text-[#C8B9A6] truncate">
                  {settings.tagline || 'Point of Sale Cafe'}
                </p>
              </div>
            </div>

            <div className="hidden md:block pt-3 border-t border-[#382C24] space-y-2.5">
              <div className="text-[11px] uppercase tracking-wider font-bold text-[#B39F8B]">
                {role === 'OWNER' ? 'Panel Owner & Pemantauan' : 'Terminal Kasir'}
              </div>
              <p className="text-xs text-[#DFD3C5] leading-relaxed">
                {role === 'OWNER'
                  ? 'Pantau omzet shift pagi dan siang, cek riwayat transaksi, atur desain struk, serta kelola akses remote secara real-time.'
                  : 'Catat pesanan Hot/Dingin, kelola Open Bill meja, proses pembayaran tunai/QRIS, dan cetak struk thermal.'}
              </p>
            </div>
          </div>

          <div className="space-y-3 pt-2 md:pt-4 md:border-t md:border-[#382C24]">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#332720] border border-[#47382F] text-[11px] font-medium text-[#EDE3D6]">
                <span className={`w-2 h-2 rounded-full ${isSyncOnline ? 'bg-[#4ADE80]' : 'bg-[#FBBF24]'}`} />
                <span>{isSyncOnline ? 'Server Terhubung' : 'Mode Offline Lokal'}</span>
              </span>
              <span className="text-[11px] text-[#B39F8B] hidden sm:inline">
                {todayFormatted}
              </span>
            </div>

            {settings.address && (
              <div className="hidden md:flex items-start gap-1.5 text-[11px] text-[#A89480]">
                <MapPin className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
                <span className="line-clamp-2">{settings.address}</span>
              </div>
            )}
          </div>
        </div>

        {/* Right Clean Form Panel */}
        <div className="md:col-span-7 p-6 sm:p-8 flex flex-col justify-center">
          <div className="mb-5">
            <h2 className="text-lg sm:text-xl font-extrabold text-[#1F1A17] tracking-tight">
              Masuk ke Aplikasi
            </h2>
            <p className="text-xs text-[#7D6F63] mt-0.5">
              Pilih mode kasir atau owner lalu masukkan sandi akun.
            </p>
          </div>

          {/* Account Mode Switch */}
          <div className="grid grid-cols-2 gap-1.5 p-1 bg-[#EFE9DF] border border-[#E2D9CC] rounded-xl mb-5">
            <button
              type="button"
              onClick={() => handleSwitchRole('CASHIER')}
              className={`py-2.5 px-3 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-all ${
                role === 'CASHIER'
                  ? 'bg-[#FAF8F5] text-[#1F1A17] shadow-2xs border border-[#E5DDD0]'
                  : 'text-[#6D6055] hover:text-[#1F1A17]'
              }`}
            >
              <User className="w-3.5 h-3.5" />
              <span>Akun Kasir</span>
            </button>

            <button
              type="button"
              onClick={() => handleSwitchRole('OWNER')}
              className={`py-2.5 px-3 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-all ${
                role === 'OWNER'
                  ? 'bg-[#2A211B] text-[#FAF8F5] shadow-2xs'
                  : 'text-[#6D6055] hover:text-[#1F1A17]'
              }`}
            >
              <Shield className="w-3.5 h-3.5" />
              <span>Akun Owner</span>
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {role === 'CASHIER' && isTerminalLocked && (
              <div className="p-3 bg-[#FBEAE8] border border-[#F2C2BD] rounded-xl text-xs text-[#9A3B3B] flex items-start gap-2">
                <Lock className="w-4 h-4 flex-shrink-0 mt-0.5" />
                <div>
                  <div className="font-bold">Terminal Kasir Sedang Dikunci Owner</div>
                  <div className="text-[11px] mt-0.5">
                    Buka tab <strong>Akun Owner</strong> dengan sandi Owner untuk mengaktifkan kembali.
                  </div>
                </div>
              </div>
            )}

            {role === 'CASHIER' ? (
              <>
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-[#3D332B]">
                    Nama Kasir
                  </label>
                  <div className="relative">
                    <User className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-[#9C8E80]" />
                    <input
                      type="text"
                      autoFocus
                      value={cashierName}
                      onChange={(e) => {
                        setCashierName(e.target.value);
                        setError(null);
                      }}
                      placeholder="Ketik nama petugas kasir..."
                      className="w-full pl-10 pr-3.5 py-2.5 bg-[#F2ECE2] border border-[#D5C9B8] rounded-xl text-sm font-semibold text-[#1F1A17] placeholder-[#9C8E80] focus:outline-none focus:bg-[#FAF8F5] focus:border-[#2A211B]"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-[#3D332B]">
                    Shift Kerja
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    {([
                      { id: 'Shift Pagi' as const, label: 'Shift Pagi', icon: Sun },
                      { id: 'Shift Siang' as const, label: 'Shift Siang', icon: Sunset }
                    ]).map((s) => {
                      const Icon = s.icon;
                      const active = shift === s.id;
                      return (
                        <button
                          key={s.id}
                          type="button"
                          onClick={() => setShift(s.id)}
                          className={`py-2.5 px-3 rounded-xl border text-xs font-bold flex items-center justify-center gap-1.5 transition-colors ${
                            active
                              ? 'bg-[#2A211B] text-[#FAF8F5] border-[#2A211B]'
                              : 'bg-[#F2ECE2] text-[#5E5248] border-[#E2D9CC] hover:bg-[#EAE2D6]'
                          }`}
                        >
                          <Icon className="w-3.5 h-3.5" />
                          <span>{s.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </>
            ) : (
              <div className="p-3.5 rounded-xl bg-[#F2ECE2]/80 border border-[#E5DDD0] text-xs text-[#5E5248] leading-relaxed">
                Masuk sebagai <strong className="text-[#1F1A17]">Owner</strong> untuk mengakses pemantauan omzet live, desain struk, audit transaksi, dan link remote HP.
              </div>
            )}

            {/* Password Input (Clean Keyboard Field with Eye Toggle) */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-[#3D332B]">
                  {role === 'OWNER' ? 'Sandi Owner' : 'Sandi Kasir'}
                </label>
                {role === 'OWNER' && isDefaultOwnerPassword && (
                  <span className="text-[11px] font-semibold text-[#874C23]">
                    Bawaan: 123456
                  </span>
                )}
                {role === 'CASHIER' && isDefaultCashierPassword && (
                  <span className="text-[11px] font-semibold text-[#874C23]">
                    Bawaan: 1234
                  </span>
                )}
              </div>

              <div className="relative">
                <Lock className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-[#9C8E80]" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  autoFocus={role === 'OWNER'}
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    setError(null);
                  }}
                  placeholder={role === 'OWNER' ? 'Masukkan sandi Owner...' : 'Masukkan sandi Kasir...'}
                  className="w-full pl-10 pr-11 py-2.5 bg-[#F2ECE2] border border-[#D5C9B8] rounded-xl text-sm font-semibold text-[#1F1A17] placeholder-[#9C8E80] focus:outline-none focus:bg-[#FAF8F5] focus:border-[#2A211B]"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((prev) => !prev)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-[#7D6F63] hover:text-[#1F1A17] transition-colors"
                  title={showPassword ? 'Sembunyikan sandi' : 'Lihat sandi'}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {error && (
              <div className="p-2.5 bg-[#FBEAE8] border border-[#F2C2BD] rounded-xl text-[#9A3B3B] text-xs font-medium flex items-center gap-2">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={isSubmitting || (role === 'CASHIER' && isTerminalLocked)}
              className={`w-full py-3 px-4 rounded-xl text-sm font-bold text-[#FAF8F5] flex items-center justify-center gap-2 transition-colors active:scale-[0.99] disabled:opacity-40 ${
                role === 'OWNER'
                  ? 'bg-[#2A211B] hover:bg-[#1A1410]'
                  : 'bg-[#285A3B] hover:bg-[#1E462D]'
              }`}
            >
              <LogIn className="w-4 h-4" />
              <span>
                {isSubmitting
                  ? 'Memeriksa Sandi...'
                  : role === 'OWNER'
                  ? 'Masuk Dashboard Owner'
                  : 'Buka Layar Kasir'}
              </span>
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};
