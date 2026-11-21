import React, { useState, useEffect } from 'react';
import { 
  ShoppingBag, 
  Coffee, 
  FileText, 
  Printer, 
  BarChart3, 
  Shield,
  Lock,
  Unlock,
  Minus, 
  Square, 
  X, 
  Maximize2, 
  Minimize2,
  LogOut
} from 'lucide-react';
import type { ReceiptSettings, UserRole, CashierShift } from '../types';

export type AppTab = 'pos' | 'products' | 'receipt' | 'printer' | 'reports' | 'owner';

interface NavbarProps {
  currentTab: AppTab;
  onSelectTab: (tab: AppTab) => void;
  settings: ReceiptSettings;
  userRole: UserRole;
  activeUserName: string;
  activeShift: CashierShift;
  isSyncOnline: boolean;
  onRequestOwnerLogin: () => void;
  onLockToCashier: () => void;
  onLogout: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentTab,
  onSelectTab,
  settings,
  userRole,
  activeUserName,
  activeShift,
  isSyncOnline,
  onRequestOwnerLogin,
  onLockToCashier,
  onLogout
}) => {
  const [timeStr, setTimeStr] = useState('');
  const [isFullscreen, setIsFullscreen] = useState(false);
  const isElectron = !!window.electronAPI?.isElectron;

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
    } else {
      document.exitFullscreen().catch(() => {});
    }
  };

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setTimeStr(
        now.toLocaleTimeString('id-ID', {
          hour: '2-digit',
          minute: '2-digit'
        })
      );
    };
    updateTime();
    const interval = setInterval(updateTime, 15000);
    return () => clearInterval(interval);
  }, []);

  const allNavItems: { id: AppTab; label: string; icon: any; ownerOnly?: boolean }[] = [
    { id: 'pos', label: 'Kasir', icon: ShoppingBag },
    { id: 'products', label: 'Katalog Menu', icon: Coffee },
    { id: 'reports', label: 'Laporan', icon: BarChart3 },
    { id: 'printer', label: 'Printer', icon: Printer },
    { id: 'receipt', label: 'Desain Struk', icon: FileText, ownerOnly: true },
    { id: 'owner', label: 'Owner', icon: Shield, ownerOnly: true }
  ];

  const navItems = allNavItems.filter((item) => !item.ownerOnly || userRole === 'OWNER');

  return (
    <header className="bg-[#FAF8F5] border-b border-[#E5DDD0] select-none flex-shrink-0">
      <div className="px-3 sm:px-4 lg:px-5 h-12 md:h-14 flex items-center justify-between gap-2.5">
        {/* Left: Brand + Desktop Navigation */}
        <div className="flex items-center gap-3 lg:gap-4 min-w-0">
          <div className="flex items-center gap-2 flex-shrink-0">
            <div className="w-7 h-7 md:w-8 md:h-8 rounded-lg bg-[#2A211B] text-[#FAF8F5] flex items-center justify-center">
              <Coffee className="w-3.5 h-3.5 md:w-4 md:h-4" />
            </div>
            <span className="text-xs sm:text-sm font-extrabold tracking-tight text-[#1F1A17] truncate max-w-[140px] sm:max-w-[180px]">
              {settings.storeName || 'SENJA COFFEE'}
            </span>
          </div>

          <div className="h-5 w-px bg-[#E5DDD0] hidden md:block" />

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center gap-1 overflow-x-auto no-scrollbar">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = currentTab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => onSelectTab(item.id)}
                  className={`flex items-center gap-1.5 px-2.5 lg:px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors active:scale-[0.98] ${
                    isActive
                      ? 'bg-[#2A211B] text-[#FAF8F5]'
                      : 'text-[#6D6055] hover:text-[#1F1A17] hover:bg-[#EFE9DF]'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </nav>
        </div>

        {/* Right: Sync Status, Role Switcher, Clock & Window Controls */}
        <div className="flex items-center gap-1.5 sm:gap-2 flex-shrink-0">
          <span
            className="inline-flex items-center gap-1 text-[11px] font-medium text-[#7D6F63] pr-0.5"
            title={isSyncOnline ? 'Tersinkronisasi dengan server pusat cafe' : 'Berjalan dalam mode offline lokal'}
          >
            <span className={`w-2 h-2 rounded-full ${isSyncOnline ? 'bg-[#285A3B]' : 'bg-[#B7791F]'}`} />
            <span className="hidden xl:inline">{isSyncOnline ? 'Sync' : 'Offline'}</span>
          </span>

          {userRole === 'OWNER' ? (
            <button
              type="button"
              onClick={onLockToCashier}
              className="flex items-center gap-1.5 px-2.5 py-1.5 bg-[#EAF3EC] hover:bg-[#DCECE0] text-[#285A3B] border border-[#C5E0CE] rounded-lg text-[11px] sm:text-xs font-bold transition-colors active:scale-[0.98]"
              title="Kunci kembali ke mode Kasir"
            >
              <Unlock className="w-3.5 h-3.5" />
              <span>Owner • Kunci</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={onRequestOwnerLogin}
              className="flex items-center gap-1.5 px-2.5 py-1.5 bg-[#EFE9DF] hover:bg-[#E5DDD0] text-[#3D332B] border border-[#DDD3C5] rounded-lg text-[11px] sm:text-xs font-semibold transition-colors active:scale-[0.98]"
              title="Masuk dengan PIN khusus Owner"
            >
              <Lock className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">{activeUserName} ({activeShift === 'Shift Pagi' ? 'Pagi' : 'Siang'}) • </span>
              <span>Owner</span>
            </button>
          )}

          <button
            type="button"
            onClick={onLogout}
            className="flex items-center gap-1 px-2 py-1.5 bg-[#FAF8F5] hover:bg-[#FBEAE8] text-[#6D6055] hover:text-[#9A3B3B] border border-[#E5DDD0] rounded-lg text-[11px] sm:text-xs font-semibold transition-colors active:scale-[0.98]"
            title="Keluar ke halaman login"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span className="hidden md:inline">Keluar</span>
          </button>

          <span className="text-xs font-mono text-[#7D6F63] tabular-nums hidden lg:inline pl-1">
            {timeStr}
          </span>

          {isElectron ? (
            <div className="flex items-center gap-0.5 pl-1.5 border-l border-[#E5DDD0]">
              <button
                type="button"
                onClick={() => window.electronAPI?.minimize()}
                className="p-1.5 text-[#6D6055] hover:text-[#1F1A17] hover:bg-[#EFE9DF] rounded-md transition-colors"
                title="Minimize"
              >
                <Minus className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => window.electronAPI?.maximize()}
                className="p-1.5 text-[#6D6055] hover:text-[#1F1A17] hover:bg-[#EFE9DF] rounded-md transition-colors"
                title="Maximize"
              >
                <Square className="w-3 h-3" />
              </button>
              <button
                type="button"
                onClick={() => window.electronAPI?.close()}
                className="p-1.5 text-[#6D6055] hover:text-[#9A3B3B] hover:bg-[#FBEAE8] rounded-md transition-colors"
                title="Tutup"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={toggleFullscreen}
              className="hidden sm:flex p-1.5 text-[#5E5248] hover:text-[#1F1A17] hover:bg-[#EFE9DF] rounded-lg transition-colors border border-[#E5DDD0]"
              title="Mode Layar Penuh"
            >
              {isFullscreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
            </button>
          )}
        </div>
      </div>

      {/* Mobile Navigation Bar */}
      <nav className="md:hidden px-3 pb-2 flex items-center gap-1.5 overflow-x-auto no-scrollbar border-t border-[#EFE9DF] pt-1.5">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = currentTab === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onSelectTab(item.id)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors active:scale-[0.98] ${
                isActive
                  ? 'bg-[#2A211B] text-[#FAF8F5]'
                  : 'bg-[#EFE9DF]/70 text-[#5E5248] hover:text-[#1F1A17]'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              <span>{item.label}</span>
            </button>
          );
        })}
      </nav>
    </header>
  );
};
