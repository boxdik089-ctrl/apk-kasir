import React, { useState, useEffect } from 'react';
import { Shield, X, Delete, AlertCircle } from 'lucide-react';
import { DEFAULT_OWNER_PIN_HASH } from '../../utils/hash';
import { SyncService } from '../../services/syncService';

interface OwnerPinModalProps {
  isOpen: boolean;
  onClose: () => void;
  onVerified: (pin: string, reason?: string) => Promise<void> | void;
  title?: string;
  description?: string;
  requireReason?: boolean;
  reasonPlaceholder?: string;
  currentPinHash?: string;
  actorName?: string;
}

export const OwnerPinModal: React.FC<OwnerPinModalProps> = ({
  isOpen,
  onClose,
  onVerified,
  title = 'Verifikasi Akun Owner',
  description = 'Masukkan PIN khusus Owner untuk melanjutkan.',
  requireReason = false,
  reasonPlaceholder = 'Contoh: Salah input menu / Tamu batal memesan',
  currentPinHash,
  actorName = 'Owner'
}) => {
  const [pin, setPin] = useState('');
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isChecking, setIsChecking] = useState(false);

  const isUsingDefaultPin = !currentPinHash || currentPinHash === DEFAULT_OWNER_PIN_HASH;

  useEffect(() => {
    if (isOpen) {
      setPin('');
      setReason('');
      setError(null);
      setIsChecking(false);
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      } else if (e.key === 'Enter') {
        const activeTag = document.activeElement?.tagName;
        if (activeTag !== 'INPUT' || !requireReason) {
          handleSubmit();
        }
      } else if (/^[0-9]$/.test(e.key) && document.activeElement?.tagName !== 'INPUT') {
        setPin((prev) => (prev.length < 8 ? prev + e.key : prev));
        setError(null);
      } else if (e.key === 'Backspace' && document.activeElement?.tagName !== 'INPUT') {
        setPin((prev) => prev.slice(0, -1));
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [isOpen, pin, reason, requireReason]);

  if (!isOpen) return null;

  const handleDigit = (digit: string) => {
    if (pin.length < 8) {
      setPin((prev) => prev + digit);
      setError(null);
    }
  };

  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (requireReason && !reason.trim()) {
      setError('Alasan wajib diisi sebelum melanjutkan.');
      return;
    }
    if (pin.length < 4) {
      setError('Masukkan minimal 4 digit PIN Owner.');
      return;
    }

    setIsChecking(true);
    setError(null);
    try {
      if (requireReason) {
        // Caller (e.g. voidTransaction) verifies PIN and reason atomically on server
        await onVerified(pin, reason.trim());
        onClose();
      } else {
        const res = await SyncService.verifyOwnerPin(pin, actorName);
        if (!res.ok) {
          setError(res.error || 'PIN Owner salah.');
          setPin('');
          return;
        }
        await onVerified(pin);
        onClose();
      }
    } catch (err: any) {
      setError(err?.message || 'PIN Owner salah atau gagal verifikasi.');
      setPin('');
    } finally {
      setIsChecking(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-[#1F1A17]/55 backdrop-blur-xs flex items-center justify-center p-4 animate-fade-in">
      <div className="bg-[#FAF8F5] border border-[#E5DDD0] rounded-2xl w-full max-w-sm shadow-2xl overflow-hidden animate-pop-in">
        <div className="px-5 py-4 border-b border-[#E5DDD0] flex items-center justify-between bg-[#F2ECE2]/70">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-[#2A211B] text-[#FAF8F5] flex items-center justify-center">
              <Shield className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-[#1F1A17]">{title}</h2>
              <p className="text-[11px] text-[#7D6F63]">Akses terbatas khusus pemilik usaha</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-[#8C7E71] hover:text-[#1F1A17] p-1 rounded-lg hover:bg-[#E5DDD0] transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <p className="text-xs text-[#5E5248] leading-relaxed">{description}</p>

          {requireReason && (
            <div>
              <label className="block text-xs font-bold text-[#3D332B] mb-1">
                Alasan Pembatalan / Aksi <span className="text-[#9A3B3B]">*</span>
              </label>
              <input
                type="text"
                autoFocus
                value={reason}
                onChange={(e) => {
                  setReason(e.target.value);
                  setError(null);
                }}
                placeholder={reasonPlaceholder}
                className="w-full px-3 py-2 bg-[#F2ECE2] border border-[#D5C9B8] rounded-lg text-xs text-[#1F1A17] focus:outline-none focus:bg-[#FAF8F5] focus:border-[#2A211B]"
              />
            </div>
          )}

          {/* PIN Display */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-bold text-[#3D332B]">PIN Owner</label>
              {isUsingDefaultPin && (
                <span className="text-[11px] text-[#874C23] font-semibold">
                  PIN bawaan: 123456
                </span>
              )}
            </div>
            <input
              type="password"
              inputMode="numeric"
              maxLength={8}
              autoFocus={!requireReason}
              value={pin}
              onChange={(e) => {
                setPin(e.target.value.replace(/[^0-9]/g, ''));
                setError(null);
              }}
              placeholder="••••••"
              className="w-full px-4 py-2.5 bg-[#F2ECE2] border border-[#D5C9B8] rounded-lg text-center text-xl font-mono tracking-[0.4em] text-[#1F1A17] focus:outline-none focus:bg-[#FAF8F5] focus:border-[#2A211B]"
            />
          </div>

          {/* Numeric Keypad */}
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

          {error && (
            <div className="p-2.5 bg-[#FBEAE8] border border-[#F2C2BD] rounded-lg text-[#9A3B3B] text-xs font-medium flex items-center gap-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div className="flex items-center gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 bg-[#FAF8F5] hover:bg-[#EFE9DF] text-[#5E5248] text-xs font-semibold rounded-lg border border-[#E5DDD0] transition-colors"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={isChecking || pin.length < 4}
              className="flex-1 py-2.5 bg-[#2A211B] hover:bg-[#1A1410] text-[#FAF8F5] text-xs font-bold rounded-lg transition-colors disabled:opacity-40"
            >
              {isChecking ? 'Memeriksa...' : 'Verifikasi'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
