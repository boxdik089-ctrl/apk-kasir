import React, { useState, useEffect } from 'react';
import { Coffee, Shield, User, Lock, AlertCircle, LogIn, Sun, Sunset } from 'lucide-react';
import type { ReceiptSettings, UserRole, CashierShift } from '../../types';
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
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const isTerminalLocked = !!settings.security?.terminalLocked;

  useEffect(() => {
    setRole(defaultMode);
  }, [defaultMode]);

  const handleSwitchRole = (nextRole: UserRole) => {
    setRole(nextRole);
    setError(null);
  };

  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();
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

      setIsSubmitting(true);
      try {
        const res = await SyncService.verifyCashierPin('', cleanName, shift);
        if (!res.ok) {
          setError(res.error || 'Gagal masuk kasir.');
          return;
        }
        onLoginSuccess('CASHIER', cleanName, undefined, shift);
      } finally {
        setIsSubmitting(false);
      }
      return;
    }

    // OWNER login (tanpa PIN)
    setIsSubmitting(true);
    try {
      const res = await SyncService.verifyOwnerPin('', 'Owner');
      if (!res.ok) {
        setError(res.error || 'Gagal masuk dashboard Owner.');
        return;
      }
      onLoginSuccess('OWNER', 'Owner', '');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen w-screen bg-[#F6F3EC] text-[#1F1A17] flex flex-col items-center justify-center p-4 sm:p-6 overflow-y-auto">
      <div className="w-full max-w-md bg-[#FAF8F5] border border-[#E5DDD0] rounded-2xl shadow-sm overflow-hidden animate-pop-in">
        {/* Top Store Brand Header */}
        <div className="px-6 pt-6 pb-5 border-b border-[#EFE9DF] text-center">
          <div className="flex justify-center mb-3">
            {settings.showLogo && settings.logoBase64 ? (
              <img
                src={settings.logoBase64}
                alt={settings.storeName}
                className="h-12 w-auto object-contain rounded-lg"
              />
            ) : (
              <div className="w-11 h-11 rounded-xl bg-[#2A211B] text-[#FAF8F5] flex items-center justify-center">
                <Coffee className="w-5 h-5" />
              </div>
            )}
          </div>
          <h1 className="text-base sm:text-lg font-extrabold text-[#1F1A17] tracking-tight">
            {settings.storeName || 'SENJA COFFEE & EATERY'}
          </h1>
          <p className="text-xs text-[#7D6F63] mt-0.5">
            {settings.tagline || 'Sistem Kasir Cafe'}
          </p>

          <div className="mt-3 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-[#F2ECE2] border border-[#E5DDD0] text-[11px] font-medium text-[#5E5248]">
            <span className={`w-2 h-2 rounded-full ${isSyncOnline ? 'bg-[#285A3B]' : 'bg-[#B7791F]'}`} />
            <span>{isSyncOnline ? 'Terhubung ke Server Kasir' : 'Mode Offline Lokal'}</span>
          </div>
        </div>

        {/* Role Selector */}
        <div className="px-6 pt-5">
          <div className="grid grid-cols-2 gap-1 p-1 bg-[#EAE3D7] rounded-xl">
            <button
              type="button"
              onClick={() => handleSwitchRole('CASHIER')}
              className={`py-2 px-3 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-all ${
                role === 'CASHIER'
                  ? 'bg-[#FAF8F5] text-[#1F1A17] shadow-2xs'
                  : 'text-[#6D6055] hover:text-[#1F1A17]'
              }`}
            >
              <User className="w-3.5 h-3.5" />
              <span>Masuk Kasir</span>
            </button>

            <button
              type="button"
              onClick={() => handleSwitchRole('OWNER')}
              className={`py-2 px-3 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-all ${
                role === 'OWNER'
                  ? 'bg-[#2A211B] text-[#FAF8F5] shadow-2xs'
                  : 'text-[#6D6055] hover:text-[#1F1A17]'
              }`}
            >
              <Shield className="w-3.5 h-3.5" />
              <span>Masuk Owner</span>
            </button>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {role === 'CASHIER' && isTerminalLocked && (
            <div className="p-3 bg-[#FBEAE8] border border-[#F2C2BD] rounded-xl text-xs text-[#9A3B3B] flex items-start gap-2">
              <Lock className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <div>
                <div className="font-bold">Terminal Kasir Dikunci oleh Owner</div>
                <div className="text-[11px] mt-0.5">
                  Pilih tab <b>Masuk Owner</b> untuk membuka kunci terminal kasir.
                </div>
              </div>
            </div>
          )}

          {role === 'CASHIER' && (
            <div className="space-y-3">
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-[#3D332B]">
                  Nama Kasir
                </label>
                <input
                  type="text"
                  autoFocus
                  value={cashierName}
                  onChange={(e) => {
                    setCashierName(e.target.value);
                    setError(null);
                  }}
                  placeholder="Ketik nama kasir..."
                  className="w-full px-3.5 py-2.5 bg-[#F2ECE2] border border-[#D5C9B8] rounded-lg text-sm font-semibold text-[#1F1A17] placeholder-[#9C8E80] focus:outline-none focus:bg-[#FAF8F5] focus:border-[#2A211B]"
                />
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-[#3D332B]">
                  Pilih Shift Kasir
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
                        className={`py-2 px-3 rounded-lg border text-xs font-bold flex items-center justify-center gap-1.5 transition-colors ${
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
            </div>
          )}

          {role === 'OWNER' && (
            <div className="p-3.5 bg-[#F2ECE2]/70 border border-[#E5DDD0] rounded-xl text-xs text-[#5E5248] leading-relaxed">
              Masuk sebagai <strong className="text-[#1F1A17]">Owner</strong> untuk memantau omzet per shift, riwayat transaksi, desain struk, dan kontrol jarak jauh dari HP.
            </div>
          )}

          {error && (
            <div className="p-2.5 bg-[#FBEAE8] border border-[#F2C2BD] rounded-lg text-[#9A3B3B] text-xs font-medium flex items-center gap-2">
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
                ? 'Memeriksa...'
                : role === 'OWNER'
                ? 'Masuk Dashboard Owner'
                : 'Buka Kasir'}
            </span>
          </button>
        </form>
      </div>
    </div>
  );
};
