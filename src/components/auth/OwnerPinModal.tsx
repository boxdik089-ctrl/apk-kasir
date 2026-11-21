import React, { useState, useEffect } from 'react';
import { Shield, X, Lock, Eye, EyeOff, AlertCircle } from 'lucide-react';
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
  title = 'Masuk Akun Owner',
  description = 'Masukkan sandi Owner untuk membuka dashboard dan pengaturan.',
  requireReason = false,
  reasonPlaceholder = 'Tulis alasan...',
  currentPinHash,
  actorName = 'Owner'
}) => {
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isChecking, setIsChecking] = useState(false);

  const isUsingDefaultPassword = !currentPinHash || currentPinHash === DEFAULT_OWNER_PIN_HASH;

  useEffect(() => {
    if (isOpen) {
      setPassword('');
      setShowPassword(false);
      setReason('');
      setError(null);
      setIsChecking(false);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (requireReason && !reason.trim()) {
      setError('Alasan wajib diisi sebelum melanjutkan.');
      return;
    }
    if (!password) {
      setError('Masukkan sandi Owner terlebih dahulu.');
      return;
    }

    setIsChecking(true);
    setError(null);
    try {
      if (requireReason) {
        await onVerified(password, reason.trim());
        onClose();
      } else {
        const res = await SyncService.verifyOwnerPin(password, actorName);
        if (!res.ok) {
          setError(res.error || 'Sandi Owner salah.');
          setPassword('');
          return;
        }
        await onVerified(password);
        onClose();
      }
    } catch (err: any) {
      setError(err?.message || 'Sandi Owner salah atau gagal verifikasi.');
      setPassword('');
    } finally {
      setIsChecking(false);
    }
  };

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 bg-[#1F1A17]/55 backdrop-blur-xs flex items-center justify-center p-4 animate-fade-in"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-[#FAF8F5] border border-[#E5DDD0] rounded-2xl w-full max-w-sm shadow-2xl overflow-hidden animate-pop-in"
      >
        <div className="px-5 py-4 border-b border-[#E5DDD0] flex items-center justify-between bg-[#F2ECE2]/70">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-[#2A211B] text-[#FAF8F5] flex items-center justify-center">
              <Shield className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-[#1F1A17]">{title}</h2>
              <p className="text-[11px] text-[#7D6F63]">Khusus pemilik usaha</p>
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
                Alasan <span className="text-[#9A3B3B]">*</span>
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

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-bold text-[#3D332B]">Sandi Owner</label>
              {isUsingDefaultPassword && (
                <span className="text-[11px] text-[#874C23] font-semibold">
                  Bawaan: 123456
                </span>
              )}
            </div>
            <div className="relative">
              <Lock className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[#9C8E80]" />
              <input
                type={showPassword ? 'text' : 'password'}
                autoFocus={!requireReason}
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  setError(null);
                }}
                placeholder="Ketik sandi Owner..."
                className="w-full pl-9 pr-10 py-2.5 bg-[#F2ECE2] border border-[#D5C9B8] rounded-xl text-sm font-semibold text-[#1F1A17] placeholder-[#9C8E80] focus:outline-none focus:bg-[#FAF8F5] focus:border-[#2A211B]"
              />
              <button
                type="button"
                onClick={() => setShowPassword((prev) => !prev)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-[#7D6F63] hover:text-[#1F1A17]"
                title={showPassword ? 'Sembunyikan sandi' : 'Lihat sandi'}
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
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
              className="flex-1 py-2.5 bg-[#FAF8F5] hover:bg-[#EFE9DF] text-[#5E5248] text-xs font-semibold rounded-xl border border-[#E5DDD0] transition-colors"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={isChecking || !password}
              className="flex-1 py-2.5 bg-[#2A211B] hover:bg-[#1A1410] text-[#FAF8F5] text-xs font-bold rounded-xl transition-colors disabled:opacity-40"
            >
              {isChecking ? 'Memeriksa...' : 'Masuk Owner'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
