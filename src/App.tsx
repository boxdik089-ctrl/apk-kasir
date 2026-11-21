import { useState, useEffect } from 'react';
import { Lock } from 'lucide-react';
import type { Product, ReceiptSettings, UserRole } from './types';
import { db, initDatabase, defaultSettings } from './db/db';
import { Navbar, type AppTab } from './components/Navbar';
import { CashierScreen } from './components/pos/CashierScreen';
import { ProductManagement } from './components/products/ProductManagement';
import { ReceiptDesigner } from './components/receipt/ReceiptDesigner';
import { PrinterSettingsScreen } from './components/settings/PrinterSettings';
import { ReportsScreen } from './components/reports/ReportsScreen';
import { OwnerDashboard } from './components/owner/OwnerDashboard';
import { OwnerPinModal } from './components/auth/OwnerPinModal';
import { SyncService } from './services/syncService';

export function App() {
  const [currentTab, setCurrentTab] = useState<AppTab>('pos');
  const [products, setProducts] = useState<Product[]>([]);
  const [settings, setSettings] = useState<ReceiptSettings>(defaultSettings);
  const [isLoading, setIsLoading] = useState(true);
  const [isSyncOnline, setIsSyncOnline] = useState(false);

  // Role & Owner session state (in-memory only; defaults safely to CASHIER)
  const [userRole, setUserRole] = useState<UserRole>('CASHIER');
  const [ownerPin, setOwnerPin] = useState<string>('');
  const [isPinModalOpen, setIsPinModalOpen] = useState(false);
  const [pendingTab, setPendingTab] = useState<AppTab | null>(null);

  const loadLocalData = async () => {
    try {
      const [productList, storeSettings] = await Promise.all([
        db.products.toArray(),
        db.settings.get(1)
      ]);
      setProducts(productList);
      if (storeSettings) {
        setSettings(storeSettings);
      }
      setIsSyncOnline(SyncService.isOnline);
    } catch (err) {
      console.error('Failed to load local database:', err);
    }
  };

  useEffect(() => {
    const boot = async () => {
      await initDatabase();
      await loadLocalData();
      setIsLoading(false);

      // Start real-time sync with cafe central server
      SyncService.startRealtimeSync();

      // If opened via ?mode=owner (e.g. Owner remote phone), prompt Owner PIN immediately
      const params = new URLSearchParams(window.location.search);
      if (params.get('mode') === 'owner') {
        setPendingTab('owner');
        setIsPinModalOpen(true);
      }
    };

    boot();
    const unsubscribe = SyncService.subscribe(() => {
      loadLocalData();
    });

    return () => {
      unsubscribe();
      SyncService.stopRealtimeSync();
    };
  }, []);

  const handleSelectTab = (tab: AppTab) => {
    const isRestricted = tab === 'owner' || tab === 'receipt';

    if (isRestricted && userRole !== 'OWNER') {
      setPendingTab(tab);
      setIsPinModalOpen(true);
      return;
    }

    setCurrentTab(tab);
  };

  const handleOwnerVerified = (pin: string) => {
    setOwnerPin(pin);
    setUserRole('OWNER');
    if (pendingTab) {
      setCurrentTab(pendingTab);
      setPendingTab(null);
    }
  };

  const handleLockToCashier = () => {
    setUserRole('CASHIER');
    setOwnerPin('');
    if (currentTab === 'owner' || currentTab === 'receipt') {
      setCurrentTab('pos');
    }
  };

  const handleUpdateSettings = (newSettings: ReceiptSettings) => {
    setSettings(newSettings);
  };

  if (isLoading) {
    return (
      <div className="h-screen w-screen flex flex-col items-center justify-center bg-[#F6F3EC] text-[#1F1A17]">
        <div className="w-9 h-9 border-2 border-[#E2D9CC] border-t-[#2A211B] rounded-full animate-spin mb-3" />
        <p className="text-xs font-semibold tracking-wider uppercase text-[#7D6F63]">
          Menyiapkan Kasir...
        </p>
      </div>
    );
  }

  const isTerminalLocked = !!settings.security?.terminalLocked && userRole !== 'OWNER';

  return (
    <div className="h-screen w-screen flex flex-col bg-[#F6F3EC] text-[#1F1A17] overflow-hidden font-sans antialiased selection:bg-[#EAE0D5]">
      <Navbar
        currentTab={currentTab}
        onSelectTab={handleSelectTab}
        settings={settings}
        userRole={userRole}
        isSyncOnline={isSyncOnline}
        onRequestOwnerLogin={() => {
          setPendingTab('owner');
          setIsPinModalOpen(true);
        }}
        onLockToCashier={handleLockToCashier}
      />

      <main className="flex-1 flex overflow-hidden relative">
        {isTerminalLocked ? (
          <div className="flex-1 flex flex-col items-center justify-center p-8 text-center bg-[#F6F3EC] animate-fade-in">
            <div className="w-14 h-14 rounded-2xl bg-[#FBEAE8] text-[#9A3B3B] border border-[#F2C2BD] flex items-center justify-center mb-4">
              <Lock className="w-6 h-6" />
            </div>
            <h1 className="text-lg font-extrabold text-[#1F1A17]">
              Terminal Kasir Sedang Dikunci oleh Owner
            </h1>
            <p className="text-xs text-[#7D6F63] mt-1.5 max-w-sm leading-relaxed">
              Owner mengaktifkan kunci jarak jauh untuk terminal kasir ini. Hubungi Owner atau masukkan PIN Owner untuk membuka kembali.
            </p>
            <button
              type="button"
              onClick={() => {
                setPendingTab('pos');
                setIsPinModalOpen(true);
              }}
              className="mt-5 px-5 py-2.5 bg-[#2A211B] hover:bg-[#1A1410] text-[#FAF8F5] text-xs font-bold rounded-lg transition-colors"
            >
              Buka dengan PIN Owner
            </button>
          </div>
        ) : (
          <>
            {currentTab === 'pos' && (
              <CashierScreen
                products={products}
                settings={settings}
                userRole={userRole}
                ownerPin={ownerPin}
                onRefreshProducts={loadLocalData}
                onNavigateToSettings={() => handleSelectTab('printer')}
              />
            )}

            {currentTab === 'products' && (
              <ProductManagement
                products={products}
                settings={settings}
                userRole={userRole}
                ownerPin={ownerPin}
                onRefreshProducts={loadLocalData}
              />
            )}

            {currentTab === 'reports' && (
              <ReportsScreen
                settings={settings}
                userRole={userRole}
                ownerPin={ownerPin}
              />
            )}

            {currentTab === 'receipt' && (
              <ReceiptDesigner
                settings={settings}
                ownerPin={ownerPin}
                onUpdateSettings={handleUpdateSettings}
              />
            )}

            {currentTab === 'printer' && (
              <PrinterSettingsScreen
                settings={settings}
                userRole={userRole}
                ownerPin={ownerPin}
                onUpdateSettings={handleUpdateSettings}
              />
            )}

            {currentTab === 'owner' && userRole === 'OWNER' && (
              <OwnerDashboard
                settings={settings}
                ownerPin={ownerPin}
                onUpdateSettings={handleUpdateSettings}
                onUpdateOwnerPin={setOwnerPin}
                onLockBackToCashier={handleLockToCashier}
              />
            )}
          </>
        )}
      </main>

      <OwnerPinModal
        isOpen={isPinModalOpen}
        onClose={() => {
          setIsPinModalOpen(false);
          setPendingTab(null);
        }}
        onVerified={(pin) => handleOwnerVerified(pin)}
        currentPinHash={settings.security?.ownerPinHash}
        title="Masuk Akun Owner"
        description="Masukkan PIN Owner untuk mengakses halaman laporan, pengaturan sistem, atau panel remote."
      />
    </div>
  );
}

export default App;
