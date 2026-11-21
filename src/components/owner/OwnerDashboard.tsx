import React, { useState, useEffect } from 'react';
import {
  Shield,
  Wifi,
  WifiOff,
  Lock,
  Unlock,
  AlertTriangle,
  Copy,
  Check,
  RefreshCw,
  Globe,
  MonitorSmartphone
} from 'lucide-react';
import type { AuditLog, ReceiptSettings, SecuritySettings, Transaction } from '../../types';
import { defaultSecuritySettings, db } from '../../db/db';
import { PrinterService } from '../../services/printerService';
import { SyncService, type SyncHealthInfo, type RemoteTunnelStatus } from '../../services/syncService';

interface OwnerDashboardProps {
  settings: ReceiptSettings;
  ownerPin: string;
  onUpdateSettings: (newSettings: ReceiptSettings) => void;
  onUpdateOwnerPin: (newPin: string) => void;
  onLockBackToCashier: () => void;
}

export const OwnerDashboard: React.FC<OwnerDashboardProps> = ({
  settings,
  ownerPin,
  onUpdateSettings,
  onUpdateOwnerPin: _onUpdateOwnerPin,
  onLockBackToCashier
}) => {
  const [health, setHealth] = useState<SyncHealthInfo | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [auditFilter, setAuditFilter] = useState<'ALL' | 'ALERT'>('ALL');
  const [mobileSection, setMobileSection] = useState<'KONTROL' | 'AUDIT' | 'REMOTE'>('KONTROL');
  const [copiedUrl, setCopiedUrl] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [tunnel, setTunnel] = useState<RemoteTunnelStatus>({ status: 'idle', url: null, ownerUrl: null });
  const [isTogglingTunnel, setIsTogglingTunnel] = useState(false);

  const security: SecuritySettings = {
    ...defaultSecuritySettings,
    ...(settings.security || {})
  };

  const loadMonitoringData = async () => {
    const [txList, logs, serverHealth, tunnelInfo] = await Promise.all([
      db.transactions.reverse().toArray(),
      db.auditLogs.reverse().toArray(),
      SyncService.checkHealth(),
      SyncService.getRemoteTunnelStatus()
    ]);
    setTransactions(txList);
    setAuditLogs(logs);
    setHealth(serverHealth);
    setTunnel(tunnelInfo);
  };

  const handleToggleTunnel = async () => {
    setIsTogglingTunnel(true);
    try {
      if (tunnel.status === 'active') {
        await SyncService.stopRemoteTunnel(ownerPin);
        setTunnel({ status: 'idle', url: null, ownerUrl: null });
      } else {
        const res = await SyncService.startRemoteTunnel(ownerPin);
        setTunnel({
          status: res.ok ? 'active' : 'error',
          url: res.url || null,
          ownerUrl: res.ownerUrl || null,
          error: res.error || null
        });
      }
    } finally {
      setIsTogglingTunnel(false);
    }
  };

  useEffect(() => {
    loadMonitoringData();
    const unsubscribe = SyncService.subscribe(() => {
      loadMonitoringData();
    });
    return unsubscribe;
  }, []);

  // Today metrics
  const now = new Date();
  const todayTx = transactions.filter((tx) => {
    const d = new Date(tx.timestamp);
    return (
      d.getDate() === now.getDate() &&
      d.getMonth() === now.getMonth() &&
      d.getFullYear() === now.getFullYear()
    );
  });

  const todayCompleted = todayTx.filter((t) => t.status === 'COMPLETED');
  const todayVoid = todayTx.filter((t) => t.status === 'CANCELLED');
  const todayRevenue = todayCompleted.reduce((sum, t) => sum + t.total, 0);
  const todayVoidTotal = todayVoid.reduce((sum, t) => sum + t.total, 0);

  const getTxShift = (tx: Transaction) =>
    tx.shift || (new Date(tx.timestamp).getHours() < 14 ? 'Shift Pagi' : 'Shift Siang');
  const shiftPagiTx = todayCompleted.filter((t) => getTxShift(t) === 'Shift Pagi');
  const shiftSiangTx = todayCompleted.filter((t) => getTxShift(t) === 'Shift Siang');
  const shiftPagiRevenue = shiftPagiTx.reduce((sum, t) => sum + t.total, 0);
  const shiftSiangRevenue = shiftSiangTx.reduce((sum, t) => sum + t.total, 0);

  const handleToggleSecurity = async (field: keyof SecuritySettings, value: boolean) => {
    const updatedSettings: ReceiptSettings = {
      ...settings,
      security: {
        ...security,
        [field]: value
      }
    };
    const res = await SyncService.updateSettings(updatedSettings, ownerPin);
    if (res.ok) {
      onUpdateSettings(updatedSettings);
      setStatusMessage('Pengaturan diperbarui dan disinkronkan ke kasir.');
      setTimeout(() => setStatusMessage(null), 3500);
    } else {
      alert(res.error || 'Gagal memperbarui pengaturan.');
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopiedUrl(text);
      setTimeout(() => setCopiedUrl(null), 2000);
    });
  };

  const alertActions = new Set(['VOID_TRANSACTION', 'DELETE_HELD_CART', 'OWNER_LOGIN_FAILED', 'CASHIER_LOGIN_FAILED', 'DB_RESTORED']);
  const visibleLogs = auditFilter === 'ALERT' ? auditLogs.filter((l) => alertActions.has(l.action)) : auditLogs;

  const currentPort = window.location.port || '5173';
  const lanLinks = (health?.lanInterfaces || []).map((i) => `http://${i.ip}:${currentPort}/?mode=owner`);

  return (
    <div className="flex-1 overflow-y-auto p-3.5 sm:p-6 bg-[#F6F3EC] text-[#1F1A17] animate-fade-in">
      <div className="max-w-6xl mx-auto space-y-4 sm:space-y-5">
        {/* Header */}
        <div className="pb-4 sm:pb-5 border-b border-[#E5DDD0] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h1 className="text-base sm:text-lg font-extrabold text-[#1F1A17] tracking-tight flex items-center gap-2">
              <Shield className="w-5 h-5 text-[#285A3B] flex-shrink-0" />
              <span>Panel Owner & Remote</span>
            </h1>
            <p className="text-xs text-[#7D6F63] mt-0.5">
              Pantau omzet live, audit keamanan, dan kontrol akses kasir dari HP atau PC.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div
              className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold border ${
                health?.ok
                  ? 'bg-[#EAF3EC] text-[#285A3B] border-[#C5E0CE]'
                  : 'bg-[#FBEAE8] text-[#9A3B3B] border-[#F2C2BD]'
              }`}
            >
              {health?.ok ? <Wifi className="w-3.5 h-3.5" /> : <WifiOff className="w-3.5 h-3.5" />}
              <span>{health?.ok ? 'Sync Aktif' : 'Offline'}</span>
            </div>

            <button
              type="button"
              onClick={loadMonitoringData}
              className="p-2 bg-[#FAF8F5] hover:bg-[#EFE9DF] text-[#5E5248] rounded-lg border border-[#E5DDD0] transition-colors"
              title="Muat ulang data terbaru"
            >
              <RefreshCw className="w-4 h-4" />
            </button>

            <button
              type="button"
              onClick={onLockBackToCashier}
              className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-3.5 py-2 bg-[#2A211B] hover:bg-[#1A1410] text-[#FAF8F5] text-xs font-bold rounded-lg transition-colors"
            >
              <Lock className="w-3.5 h-3.5" />
              <span>Kunci ke Kasir</span>
            </button>
          </div>
        </div>

        {statusMessage && (
          <div className="p-3 bg-[#EAF3EC] border border-[#C5E0CE] rounded-lg text-[#285A3B] text-xs font-semibold animate-slide-up">
            {statusMessage}
          </div>
        )}

        {/* Today Live Metrics (2x2 on Phone, 4-col on Desktop) */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-3">
          <div className="p-3.5 sm:p-4 bg-[#FAF8F5] border border-[#E5DDD0] rounded-xl">
            <span className="text-[11px] sm:text-xs font-medium text-[#7D6F63]">Omzet Hari Ini</span>
            <div className="text-base sm:text-2xl font-extrabold text-[#1F1A17] mt-1 tabular-nums truncate">
              {PrinterService.formatRupiah(todayRevenue)}
            </div>
            <div className="text-[11px] text-[#7D6F63] mt-0.5 tabular-nums">
              {todayCompleted.length} transaksi selesai
            </div>
          </div>

          <div
            className={`p-3.5 sm:p-4 border rounded-xl ${
              todayVoid.length > 0
                ? 'bg-[#FDF5F4] border-[#F2C2BD]'
                : 'bg-[#FAF8F5] border-[#E5DDD0]'
            }`}
          >
            <span className="text-[11px] sm:text-xs font-medium text-[#7D6F63]">Batal (Void)</span>
            <div
              className={`text-base sm:text-2xl font-extrabold mt-1 tabular-nums ${
                todayVoid.length > 0 ? 'text-[#9A3B3B]' : 'text-[#1F1A17]'
              }`}
            >
              {todayVoid.length} <span className="text-xs font-semibold">struk</span>
            </div>
            <div className="text-[11px] text-[#7D6F63] mt-0.5 tabular-nums truncate">
              {PrinterService.formatRupiah(todayVoidTotal)}
            </div>
          </div>

          <div className="p-3.5 sm:p-4 bg-[#FAF8F5] border border-[#E5DDD0] rounded-xl">
            <span className="text-[11px] sm:text-xs font-medium text-[#7D6F63]">Catatan Audit</span>
            <div className="text-base sm:text-2xl font-extrabold text-[#1F1A17] mt-1 tabular-nums">
              {auditLogs.length}
            </div>
            <div className="text-[11px] text-[#7D6F63] mt-0.5">
              Aktivitas tercatat
            </div>
          </div>

          <div className="p-3.5 sm:p-4 bg-[#FAF8F5] border border-[#E5DDD0] rounded-xl flex flex-col justify-between">
            <div>
              <span className="text-[11px] sm:text-xs font-medium text-[#7D6F63]">Terminal Kasir</span>
              <div
                className={`text-sm sm:text-lg font-extrabold mt-1 flex items-center gap-1 ${
                  security.terminalLocked ? 'text-[#9A3B3B]' : 'text-[#285A3B]'
                }`}
              >
                {security.terminalLocked ? (
                  <>
                    <Lock className="w-3.5 h-3.5 sm:w-4 sm:h-4 flex-shrink-0" />
                    <span>Terkunci</span>
                  </>
                ) : (
                  <>
                    <Unlock className="w-3.5 h-3.5 sm:w-4 sm:h-4 flex-shrink-0" />
                    <span>Normal</span>
                  </>
                )}
              </div>
            </div>
            <button
              type="button"
              onClick={() => handleToggleSecurity('terminalLocked', !security.terminalLocked)}
              className={`mt-2 w-full py-1.5 px-2 text-[11px] sm:text-xs font-bold rounded-lg transition-colors ${
                security.terminalLocked
                  ? 'bg-[#285A3B] hover:bg-[#1E462D] text-[#FAF8F5]'
                  : 'bg-[#9A3B3B] hover:bg-[#7D2E2E] text-[#FAF8F5]'
              }`}
            >
              {security.terminalLocked ? 'Buka Kunci' : 'Kunci Kasir'}
            </button>
          </div>
        </div>

        {/* Shift Pagi vs Shift Siang Breakdown */}
        <div className="grid grid-cols-2 gap-2.5 sm:gap-3">
          <div className="p-3.5 bg-[#FAF8F5] border border-[#E5DDD0] rounded-xl flex items-center justify-between gap-2">
            <div>
              <div className="text-[11px] font-bold text-[#874C23]">Shift Pagi</div>
              <div className="text-sm sm:text-lg font-extrabold text-[#1F1A17] tabular-nums mt-0.5">
                {PrinterService.formatRupiah(shiftPagiRevenue)}
              </div>
            </div>
            <span className="px-2 py-1 rounded-md bg-[#EFE9DF] text-[#5E5248] text-[11px] font-semibold tabular-nums">
              {shiftPagiTx.length} struk
            </span>
          </div>

          <div className="p-3.5 bg-[#FAF8F5] border border-[#E5DDD0] rounded-xl flex items-center justify-between gap-2">
            <div>
              <div className="text-[11px] font-bold text-[#285A3B]">Shift Siang</div>
              <div className="text-sm sm:text-lg font-extrabold text-[#1F1A17] tabular-nums mt-0.5">
                {PrinterService.formatRupiah(shiftSiangRevenue)}
              </div>
            </div>
            <span className="px-2 py-1 rounded-md bg-[#EAF3EC] text-[#285A3B] text-[11px] font-semibold tabular-nums">
              {shiftSiangTx.length} struk
            </span>
          </div>
        </div>

            {/* Mobile Section Switcher (Hidden on Desktop) */}
        <div className="grid grid-cols-2 gap-1 p-1 bg-[#EAE3D7] rounded-xl lg:hidden">
          {[
            { id: 'REMOTE' as const, label: 'Remote HP' },
            { id: 'AUDIT' as const, label: `Audit (${auditLogs.length})` }
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setMobileSection(tab.id)}
              className={`py-2 px-2 rounded-lg text-xs font-bold transition-colors ${
                mobileSection === tab.id || (mobileSection === 'KONTROL' && tab.id === 'REMOTE')
                  ? 'bg-[#FAF8F5] text-[#1F1A17] shadow-2xs'
                  : 'text-[#6D6055]'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          {/* Left: Remote Access & Mode Info */}
          <div className="lg:col-span-5 space-y-4">
            <div className={`${mobileSection === 'AUDIT' ? 'hidden' : 'block'} lg:block bg-[#FAF8F5] border border-[#E5DDD0] rounded-xl p-4 sm:p-5 space-y-2`}>
              <h2 className="text-xs font-bold text-[#1F1A17]">
                Mode Akses Praktis (Tanpa PIN)
              </h2>
              <p className="text-[11px] text-[#7D6F63] leading-relaxed">
                Penambahan menu, edit harga Hot/Dingin, maupun pindah tab berjalan langsung tanpa PIN agar tidak menghambat pelayanan. Setiap aktivitas tetap tercatat otomatis di Audit Log.
              </p>
            </div>

            {/* Remote Access Card */}
            <div className={`${mobileSection === 'REMOTE' ? 'block' : 'hidden'} lg:block bg-[#FAF8F5] border border-[#E5DDD0] rounded-xl p-4 sm:p-5 space-y-3`}>
              <h2 className="text-xs font-bold text-[#1F1A17] flex items-center gap-1.5">
                <Globe className="w-4 h-4 text-[#285A3B]" />
                Akses Remote Owner dari HP / Jarak Jauh
              </h2>

              <div className="space-y-2">
                <div className="text-[11px] font-semibold text-[#5E5248] flex items-center gap-1.5">
                  <MonitorSmartphone className="w-3.5 h-3.5" />
                  <span>1. Akses via Wi-Fi Cafe (Satu Jaringan):</span>
                </div>
                {lanLinks.length > 0 ? (
                  lanLinks.map((url) => (
                    <div
                      key={url}
                      className="flex items-center justify-between gap-2 p-2.5 bg-[#F2ECE2] border border-[#E2D9CC] rounded-lg"
                    >
                      <span className="text-xs font-mono text-[#1F1A17] truncate">{url}</span>
                      <button
                        type="button"
                        onClick={() => copyToClipboard(url)}
                        className="px-2.5 py-1 bg-[#FAF8F5] hover:bg-[#E5DDD0] text-[#3D332B] text-[11px] font-semibold rounded border border-[#D5C9B8] flex items-center gap-1 flex-shrink-0"
                      >
                        {copiedUrl === url ? <Check className="w-3 h-3 text-[#285A3B]" /> : <Copy className="w-3 h-3" />}
                        <span>{copiedUrl === url ? 'Disalin' : 'Salin'}</span>
                      </button>
                    </div>
                  ))
                ) : (
                  <p className="text-[11px] text-[#7D6F63]">
                    Jalankan server sinkronisasi untuk melihat alamat IP Wi-Fi lokal.
                  </p>
                )}
              </div>

              <div className="pt-2.5 border-t border-[#EAE3D7] space-y-2.5 text-xs">
                <div className="font-bold text-[#1F1A17] text-[11px]">
                  2. Jaringan Berbeda / Pakai Kuota HP (Lewat Internet):
                </div>

                {tunnel.status === 'active' && tunnel.ownerUrl ? (
                  <div className="space-y-2">
                    <div className="p-2.5 bg-[#EAF3EC] border border-[#C5E0CE] rounded-lg space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-bold text-[#285A3B]">
                          Link Internet Aktif (HTTPS)
                        </span>
                        <button
                          type="button"
                          onClick={handleToggleTunnel}
                          disabled={isTogglingTunnel}
                          className="text-[11px] font-semibold text-[#9A3B3B] hover:underline"
                        >
                          Matikan
                        </button>
                      </div>
                      <div className="flex items-center justify-between gap-2 bg-[#FAF8F5] p-2 rounded border border-[#C5E0CE]">
                        <span className="text-[11px] font-mono text-[#1F1A17] truncate">
                          {tunnel.ownerUrl}
                        </span>
                        <button
                          type="button"
                          onClick={() => copyToClipboard(tunnel.ownerUrl!)}
                          className="px-2.5 py-1 bg-[#285A3B] text-[#FAF8F5] text-[11px] font-semibold rounded flex items-center gap-1 flex-shrink-0"
                        >
                          {copiedUrl === tunnel.ownerUrl ? (
                            <Check className="w-3 h-3" />
                          ) : (
                            <Copy className="w-3 h-3" />
                          )}
                          <span>{copiedUrl === tunnel.ownerUrl ? 'Disalin' : 'Salin'}</span>
                        </button>
                      </div>
                    </div>
                    <p className="text-[11px] text-[#7D6F63] leading-relaxed">
                      Salin & buka link di atas di HP Owner menggunakan paket data/Wi-Fi apa saja. Pastikan komputer kasir tetap menyala.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <p className="text-[11px] text-[#7D6F63] leading-relaxed">
                      Buat link internet terenkripsi langsung dari komputer kasir agar dapat dipantau dari mana saja tanpa harus satu Wi-Fi.
                    </p>
                    {tunnel.error && (
                      <div className="p-2 bg-[#FBEAE8] border border-[#F2C2BD] rounded-lg text-[11px] text-[#9A3B3B]">
                        {tunnel.error}
                      </div>
                    )}
                    <button
                      type="button"
                      onClick={handleToggleTunnel}
                      disabled={isTogglingTunnel || !health?.ok}
                      className="w-full py-2 px-3 bg-[#285A3B] hover:bg-[#1E462D] disabled:opacity-40 text-[#FAF8F5] text-xs font-bold rounded-lg transition-colors flex items-center justify-center gap-1.5"
                    >
                      <Globe className="w-3.5 h-3.5" />
                      <span>
                        {isTogglingTunnel
                          ? 'Membuat Link Internet (~5 detik)...'
                          : 'Aktifkan Link Internet (Luar Jaringan)'}
                      </span>
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>

        {/* Right: Audit Trail */}
          <div className={`${mobileSection === 'AUDIT' ? 'flex' : 'hidden'} lg:flex lg:col-span-7 bg-[#FAF8F5] border border-[#E5DDD0] rounded-xl overflow-hidden flex-col max-h-[600px] lg:max-h-[760px]`}>
            <div className="px-4 sm:px-5 py-3.5 border-b border-[#E5DDD0] bg-[#EFE9DF]/50 flex flex-wrap items-center justify-between gap-2">
              <div>
                <h2 className="text-xs font-bold text-[#1F1A17] flex items-center gap-1.5">
                  <AlertTriangle className="w-4 h-4 text-[#874C23]" />
                  Audit Log Aktivitas (Permanen & Anti-Hapus)
                </h2>
                <p className="text-[11px] text-[#7D6F63]">
                  Mencatat seluruh pembatalan struk, hapus open bill, perubahan menu/harga, dan aktivitas masuk.
                </p>
              </div>

              <div className="flex items-center gap-1 bg-[#FAF8F5] p-0.5 rounded-lg border border-[#E5DDD0]">
                <button
                  type="button"
                  onClick={() => setAuditFilter('ALL')}
                  className={`px-2.5 py-1 rounded-md text-[11px] font-semibold ${
                    auditFilter === 'ALL' ? 'bg-[#2A211B] text-[#FAF8F5]' : 'text-[#6D6055]'
                  }`}
                >
                  Semua ({auditLogs.length})
                </button>
                <button
                  type="button"
                  onClick={() => setAuditFilter('ALERT')}
                  className={`px-2.5 py-1 rounded-md text-[11px] font-semibold ${
                    auditFilter === 'ALERT' ? 'bg-[#9A3B3B] text-[#FAF8F5]' : 'text-[#6D6055]'
                  }`}
                >
                  Peringatan
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto divide-y divide-[#EFE9DF]">
              {visibleLogs.length === 0 ? (
                <div className="p-10 text-center text-xs text-[#8C7E71]">
                  Belum ada catatan aktivitas keamanan.
                </div>
              ) : (
                visibleLogs.map((log, idx) => {
                  const isAlert = alertActions.has(log.action);
                  return (
                    <div
                      key={log.id || idx}
                      className={`px-4 sm:px-5 py-3 text-xs flex flex-col sm:flex-row sm:items-start justify-between gap-2 sm:gap-4 ${
                        isAlert ? 'bg-[#FDF5F4]/60' : ''
                      }`}
                    >
                      <div className="space-y-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              isAlert
                                ? 'bg-[#FBEAE8] text-[#9A3B3B]'
                                : 'bg-[#EFE9DF] text-[#4D423A]'
                            }`}
                          >
                            {log.action}
                          </span>
                          <span className="font-bold text-[#1F1A17]">{log.actor}</span>
                          <span className="text-[11px] text-[#8C7E71] tabular-nums">
                            {PrinterService.formatDate(log.timestamp)}
                          </span>
                        </div>
                        <p className="text-xs text-[#3D332B] break-words">{log.summary}</p>
                      </div>

                      {log.amount !== undefined && (
                        <span className="font-bold text-[#9A3B3B] tabular-nums flex-shrink-0 self-start">
                          {PrinterService.formatRupiah(log.amount)}
                        </span>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
