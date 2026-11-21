import React, { useState, useEffect } from 'react';
import { Coffee, Shield, User, Lock, Delete, AlertCircle, LogIn } from 'lucide-react';
import type { ReceiptSettings, UserRole } from '../../types';
import { DEFAULT_OWNER_PIN_HASH, DEFAULT_CASHIER_PIN_HASH } from '../../utils/hash';
import { SyncService } from '../../services/syncService';

interface LoginScreenProps {
  settings: ReceiptSettings;
  isSyncOnline: boolean;
  defaultMode?: UserRole;
  onLoginSuccess: (role: UserRole, userName: string, ownerPin?: string) => void;
}

export const LoginScreen: React.FC<LoginScreenProps> = ({
  settings,
  isSyncOnline,
  defaultMode = 'CASHIER',
  onLoginSuccess
}) => {
  const [role, setRole] = useState<UserRole>(defaultMode);
  const [cashierName, setCashierName] = useState('');
  const [pin, setPin] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const isTerminalLocked = !!settings.security?.terminalLocked;
  const requireCashierPin = settings.security?.requireCashierPin !== false;

  const isDefaultOwnerPin =
    !settings.security?.ownerPinHash || settings.security.ownerPinHash === DEFAULT_OWNER_PIN_HASH;
  const isDefaultCashierPin =
    !settings.security?.cashierPinHash || settings.security.cashierPinHash === DEFAULT_CASHIER_PIN_HASH;

  useEffect(() => {
    setRole(defaultMode);
  }, [defaultMode]);

  const handleSwitchRole = (nextRole: UserRole) => {
    setRole(nextRole);
    setPin('');
    setError(null);
  };

  const handleDigit = (digit: string) => {
    if (pin.length < 8) {
      setPin((prev) => prev + digit);
      setError(null);
    }
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
        setError('Masukkan nama kasir / barista terlebih dahulu.');
        return;
      }
      if (requireCashierPin && pin.length < 4) {
        setError('Masukkan minimal 4 digit PIN Kasir.');
        return;
      }

      setIsSubmitting(true);
      try {
        const res = await SyncService.verifyCashierPin(pin, cleanName);
        if (!res.ok) {
          setError(res.error || 'PIN Kasir salah.');
          setPin('');
          return;
        }
        onLoginSuccess('CASHIER', cleanName);
      } finally {
        setIsSubmitting(false);
      }
      return;
    }

    // OWNER login
    if (pin.length < 4) {
      setError('Masukkan minimal 4 digit PIN Owner.');
      return;
    }
    setIsSubmitting(true);
    try {
      const res = await SyncService.verifyOwnerPin(pin, 'Owner');
      if (!res.ok) {
        setError(res.error || 'PIN Owner salah.');
        setPin('');
        return;
      }
      onLoginSuccess('OWNER', 'Owner', pin);
    } finally {
      setIsSubmitting(false);
    }
  };

  const showPinPad = role === 'OWNER' || requireCashierPin;

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
          )}

          {showPinPad && (
            <div className="space-y-3">
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-bold text-[#3D332B]">
                    {role === 'OWNER' ? 'PIN Khusus Owner' : 'PIN Kasir'}
                  </label>
                  {role === 'OWNER' && isDefaultOwnerPin && (
                    <span className="text-[11px] font-semibold text-[#874C23]">
                      PIN bawaan: 123456
                    </span>
                  )}
                  {role === 'CASHIER' && isDefaultCashierPin && (
                    <span className="text-[11px] font-semibold text-[#874C23]">
                      PIN bawaan: 1234
                    </span>
                  )}
                </div>

                <input
                  type="password"
                  inputMode="numeric"
                  maxLength={8}
                  autoFocus={role === 'OWNER'}
                  value={pin}
                  onChange={(e) => {
                    setPin(e.target.value.replace(/[^0-9]/g, ''));
                    setError(null);
                  }}
                  placeholder={role === 'OWNER' ? '••••••' : '••••'}
                  className="w-full px-4 py-2.5 bg-[#F2ECE2] border border-[#D5C9B8] rounded-lg text-center text-xl font-mono tracking-[0.4em] text-[#1F1A17] focus:outline-none focus:bg-[#FAF8F5] focus:border-[#2A211B]"
                />
              </div>

              {/* Touch Keypad */}
              <div className="grid grid-cols-3 gap-2">
                {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((d) => (
                  <button
                    key={d}
                    type="button"
                    onClick={() => handleDigit(d)}
                    className="py-2.5 bg-[#EFE9DF] hover:bg-[#E5DDD0] active:scale-95 text-[#1F1A17] font-bold text-sm rounded-lg border border-[#E2D9CC] transition-all tabular-nums"
                  >
                    {d}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => setPin('')}
                  className="py-2.5 bg-[#F6F3EC] hover:bg-[#EFE9DF] active:scale-95 text-[#7D6F63] font-semibold text-xs rounded-lg border border-[#E5DDD0] transition-all"
                >
                  Reset
                </button>
                <button
                  type="button"
                  onClick={() => handleDigit('0')}
                  className="py-2.5 bg-[#EFE9DF] hover:bg-[#E5DDD0] active:scale-95 text-[#1F1A17] font-bold text-sm rounded-lg border border-[#E2D9CC] transition-all tabular-nums"
                >
                  0
                </button>
                <button
                  type="button"
                  onClick={() => setPin((prev) => prev.slice(0, -1))}
                  className="py-2.5 bg-[#F6F3EC] hover:bg-[#EFE9DF] active:scale-95 text-[#5E5248] rounded-lg border border-[#E5DDD0] flex items-center justify-center transition-all"
                  title="Hapus satu digit"
                >
                  <Delete className="w-4 h-4" />
                </button>
              </div>
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
