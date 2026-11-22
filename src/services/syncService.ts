import { db, defaultSettings, defaultSecuritySettings } from '../db/db';
import type {
  Product,
  Transaction,
  HeldCart,
  ReceiptSettings,
  AuditLog,
  AuditAction,
  UserRole,
  CashierShift,
  ShiftClosing
} from '../types';
import { sha256 } from '../utils/hash';

export interface SyncHealthInfo {
  ok: boolean;
  revision: number;
  seeded: boolean;
  lanInterfaces: { interface: string; ip: string }[];
  port: number;
}

export interface RemoteTunnelStatus {
  status: 'idle' | 'starting' | 'active' | 'error';
  url: string | null;
  ownerUrl: string | null;
  error?: string | null;
}

class SyncServiceClass {
  private baseUrl = '';
  private eventSource: EventSource | null = null;
  private pollTimer: ReturnType<typeof setInterval> | null = null;
  private listeners = new Set<() => void>();
  private lastRevision = 0;
  public isOnline = false;

  public setBaseUrl(url: string) {
    this.baseUrl = url.replace(/\/+$/, '');
  }

  private api(path: string) {
    return `${this.baseUrl}${path}`;
  }

  public subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notifyListeners() {
    this.listeners.forEach((cb) => cb());
  }

  public async checkHealth(): Promise<SyncHealthInfo | null> {
    try {
      const res = await fetch(this.api('/api/health'));
      if (!res.ok) return null;
      const data = await res.json();
      this.isOnline = true;
      return data;
    } catch {
      this.isOnline = false;
      return null;
    }
  }

  public startRealtimeSync() {
    this.stopRealtimeSync();
    this.pullFromServer().catch(() => {});

    try {
      const es = new EventSource(this.api('/api/events'));
      es.onmessage = (event) => {
        try {
          const payload = JSON.parse(event.data);
          if (payload.type === 'sync' && payload.revision !== this.lastRevision) {
            this.pullFromServer();
          }
          this.isOnline = true;
        } catch {
          // ignore malformed event
        }
      };
      es.onerror = () => {
        this.isOnline = false;
      };
      this.eventSource = es;
    } catch {
      // Fallback to polling
    }

    // Periodic safety poll every 6s in case SSE drops on mobile networks
    this.pollTimer = setInterval(() => {
      this.checkHealthAndPull();
    }, 6000);
  }

  public stopRealtimeSync() {
    if (this.eventSource) {
      this.eventSource.close();
      this.eventSource = null;
    }
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }
  }

  private async checkHealthAndPull() {
    const health = await this.checkHealth();
    if (health && health.revision !== this.lastRevision) {
      await this.pullFromServer();
    }
  }

  public async seedServerIfEmpty() {
    try {
      const health = await this.checkHealth();
      if (!health || health.seeded) return;

      const [products, transactions, heldCarts, settings, shiftClosings] = await Promise.all([
        db.products.toArray(),
        db.transactions.toArray(),
        db.heldCarts.toArray(),
        db.settings.get(1),
        db.shiftClosings.toArray()
      ]);

      await fetch(this.api('/api/seed'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ products, transactions, heldCarts, settings, shiftClosings })
      });
    } catch {
      // Offline mode continues cleanly
    }
  }

  public async pullFromServer(force = false): Promise<boolean> {
    try {
      const res = await fetch(this.api('/api/state'));
      if (!res.ok) return false;
      const data = await res.json();
      this.isOnline = true;

      if (!data.seeded) {
        await this.seedServerIfEmpty();
        return true;
      }

      if (!force && data.revision === this.lastRevision && this.lastRevision > 0) {
        return true;
      }
      this.lastRevision = data.revision;

      await db.transaction(
        'rw',
        [db.products, db.transactions, db.heldCarts, db.settings, db.auditLogs, db.shiftClosings],
        async () => {
        if (Array.isArray(data.products)) {
          await db.products.clear();
          if (data.products.length > 0) await db.products.bulkPut(data.products);
        }
        if (Array.isArray(data.transactions)) {
          await db.transactions.clear();
          if (data.transactions.length > 0) await db.transactions.bulkPut(data.transactions);
        }
        if (Array.isArray(data.heldCarts)) {
          await db.heldCarts.clear();
          if (data.heldCarts.length > 0) await db.heldCarts.bulkPut(data.heldCarts);
        }
        if (Array.isArray(data.auditLogs)) {
          await db.auditLogs.clear();
          if (data.auditLogs.length > 0) await db.auditLogs.bulkPut(data.auditLogs);
        }
        if (Array.isArray(data.shiftClosings)) {
          await db.shiftClosings.clear();
          if (data.shiftClosings.length > 0) await db.shiftClosings.bulkPut(data.shiftClosings);
        }
        if (data.settings) {
          const merged: ReceiptSettings = {
            ...defaultSettings,
            ...data.settings,
            id: 1,
            security: {
              ...defaultSecuritySettings,
              ...(data.settings.security || {})
            }
          };
          await db.settings.put(merged);
        }
      });

      this.notifyListeners();
      return true;
    } catch {
      this.isOnline = false;
      return false;
    }
  }

  public async logLocalAudit(actor: string, role: UserRole, action: AuditAction, summary: string, amount?: number) {
    await db.auditLogs.add({
      timestamp: new Date().toISOString(),
      actor,
      role,
      action,
      summary,
      ...(amount !== undefined ? { amount } : {})
    });
  }

  public async verifyOwnerPin(pin: string, actor = 'Owner'): Promise<{ ok: boolean; error?: string }> {
    const deviceLabel = /Mobi|Android|iPhone/i.test(navigator.userAgent) ? 'HP / Tablet' : 'Komputer Kasir';
    try {
      const res = await fetch(this.api('/api/owner/verify'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin, actor, device: deviceLabel })
      });
      const data = await res.json();
      if (data.ok) {
        await this.pullFromServer();
        return { ok: true };
      }
      return { ok: false, error: data.error || 'Sandi Owner salah.' };
    } catch {
      const localSettings = await db.settings.get(1);
      const expectedHash = localSettings?.security?.ownerPinHash || defaultSecuritySettings.ownerPinHash;
      if (sha256(pin) === expectedHash) {
        await this.logLocalAudit(actor, 'OWNER', 'OWNER_LOGIN', `Login Owner offline (${deviceLabel})`);
        this.notifyListeners();
        return { ok: true };
      }
      await this.logLocalAudit(actor, 'CASHIER', 'OWNER_LOGIN_FAILED', `Percobaan sandi Owner gagal (${deviceLabel})`);
      this.notifyListeners();
      return { ok: false, error: 'Sandi Owner salah.' };
    }
  }

  public async verifyCashierPin(pin: string, cashierName: string, shift: CashierShift = 'Shift Pagi'): Promise<{ ok: boolean; error?: string }> {
    const deviceLabel = /Mobi|Android|iPhone/i.test(navigator.userAgent) ? 'HP / Tablet' : 'Komputer Kasir';
    const cleanName = cashierName.trim() || 'Kasir';
    try {
      const res = await fetch(this.api('/api/cashier/verify'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin, cashierName: cleanName, shift, device: deviceLabel })
      });
      const data = await res.json();
      if (data.ok) {
        await this.pullFromServer();
        return { ok: true };
      }
      return { ok: false, error: data.error || 'Sandi Kasir salah.' };
    } catch {
      const localSettings = await db.settings.get(1);
      const expectedHash = localSettings?.security?.cashierPinHash || defaultSecuritySettings.cashierPinHash || sha256('1234');
      if (sha256(pin) === expectedHash) {
        await this.logLocalAudit(cleanName, 'CASHIER', 'CASHIER_LOGIN', `Kasir ${cleanName} masuk ${shift} offline (${deviceLabel})`);
        this.notifyListeners();
        return { ok: true };
      }
      await this.logLocalAudit(cleanName, 'CASHIER', 'CASHIER_LOGIN_FAILED', `Percobaan sandi Kasir gagal (${shift}, ${deviceLabel})`);
      this.notifyListeners();
      return { ok: false, error: 'Sandi Kasir salah.' };
    }
  }

  public async addTransaction(tx: Transaction): Promise<Transaction> {
    try {
      const res = await fetch(this.api('/api/transactions'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(tx)
      });
      if (res.ok) {
        const data = await res.json();
        const savedTx: Transaction = data.transaction || tx;
        try {
          await db.transactions.put(savedTx);
        } catch {
          // ignore local cache error if IndexedDB unavailable
        }
        await this.pullFromServer(true);
        this.notifyListeners();
        return savedTx;
      }
    } catch {
      // Offline fallback saved in IndexedDB
    }

    let id: number | undefined;
    try {
      id = await db.transactions.add(tx);
    } catch {
      // ignore local fallback error
    }
    const localSaved = { ...tx, ...(id ? { id } : {}) };
    this.notifyListeners();
    return localSaved;
  }

  public async addShiftClosing(closing: ShiftClosing): Promise<ShiftClosing> {
    try {
      const res = await fetch(this.api('/api/shift-closings'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(closing)
      });
      if (res.ok) {
        const data = await res.json();
        const saved: ShiftClosing = data.shiftClosing || closing;
        try {
          await db.shiftClosings.put(saved);
        } catch {
          // ignore
        }
        await this.pullFromServer(true);
        this.notifyListeners();
        return saved;
      }
    } catch {
      await this.logLocalAudit(
        closing.cashierName || 'Kasir',
        'CASHIER',
        'SHIFT_CLOSED',
        `Tutup ${closing.shift} (Tunai Laci: Rp ${Number(closing.expectedCashInDrawer).toLocaleString('id-ID')})`,
        closing.totalSales
      );
    }

    let id: number | undefined;
    try {
      id = await db.shiftClosings.add(closing);
    } catch {
      // ignore
    }
    const localSaved = { ...closing, ...(id ? { id } : {}) };
    this.notifyListeners();
    return localSaved;
  }

  public async voidTransaction(txId: number, ownerPin: string, reason: string, actor: string): Promise<{ ok: boolean; error?: string }> {
    try {
      const res = await fetch(this.api(`/api/transactions/${txId}/void`), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ownerPin, reason, actor })
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        return { ok: false, error: data.error || 'Gagal membatalkan transaksi.' };
      }
      await this.pullFromServer(true);
      return { ok: true };
    } catch {
      // Offline fallback
      const target = await db.transactions.get(txId);
      if (!target) return { ok: false, error: 'Transaksi tidak ditemukan.' };
      await db.transactions.update(txId, {
        status: 'CANCELLED',
        voidReason: reason,
        voidBy: actor,
        voidAt: new Date().toISOString()
      });
      await this.logLocalAudit(actor, 'OWNER', 'VOID_TRANSACTION', `Batalkan struk ${target.invoiceNumber}: ${reason}`, target.total);
      this.notifyListeners();
      return { ok: true };
    }
  }

  public async addHeldCart(cart: HeldCart): Promise<void> {
    let id: number | undefined;
    try {
      id = await db.heldCarts.add(cart);
    } catch {
      // ignore local fallback error
    }
    try {
      await fetch(this.api('/api/held-carts'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...cart, ...(id ? { id } : {}) })
      });
      await this.pullFromServer(true);
      this.notifyListeners();
    } catch {
      this.notifyListeners();
    }
  }

  public async deleteHeldCart(id: number, options: { isRestoring?: boolean; ownerPin?: string; actor?: string }): Promise<{ ok: boolean; error?: string }> {
    try {
      const res = await fetch(this.api(`/api/held-carts/${id}`), {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(options)
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        return { ok: false, error: data.error || 'Gagal menghapus pesanan tertahan.' };
      }
      await this.pullFromServer(true);
      this.notifyListeners();
      return { ok: true };
    } catch {
      const target = await db.heldCarts.get(id);
      if (!options.isRestoring && target) {
        await this.logLocalAudit(options.actor || 'Kasir', 'CASHIER', 'DELETE_HELD_CART', `Hapus Open Bill "${target.referenceName}"`, target.total);
      }
      await db.heldCarts.delete(id);
      this.notifyListeners();
      return { ok: true };
    }
  }

  public async saveProduct(productData: Omit<Product, 'id'>, id?: number, ownerPin?: string, actor = 'Kasir'): Promise<{ ok: boolean; error?: string }> {
    try {
      const url = id ? this.api(`/api/products/${id}`) : this.api('/api/products');
      const method = id ? 'PUT' : 'POST';
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ product: productData, ownerPin, actor })
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        return { ok: false, error: data.error || 'Gagal menyimpan menu.' };
      }
      await this.pullFromServer();
      return { ok: true };
    } catch {
      if (id) {
        await db.products.update(id, productData);
      } else {
        await db.products.add(productData as Product);
      }
      await this.logLocalAudit(actor, ownerPin ? 'OWNER' : 'CASHIER', 'MENU_CHANGED', `${id ? 'Ubah' : 'Tambah'} menu "${productData.name}"`);
      this.notifyListeners();
      return { ok: true };
    }
  }

  public async deleteProduct(id: number, ownerPin?: string, actor = 'Owner'): Promise<{ ok: boolean; error?: string }> {
    try {
      const res = await fetch(this.api(`/api/products/${id}`), {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ownerPin, actor })
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        return { ok: false, error: data.error || 'Gagal menghapus menu.' };
      }
      await this.pullFromServer();
      return { ok: true };
    } catch {
      const target = await db.products.get(id);
      await db.products.delete(id);
      await this.logLocalAudit(actor, 'OWNER', 'MENU_CHANGED', `Hapus menu "${target?.name || id}"`);
      this.notifyListeners();
      return { ok: true };
    }
  }

  public async resetSampleMenus(products: Omit<Product, 'id'>[], ownerPin: string): Promise<{ ok: boolean; error?: string }> {
    try {
      const res = await fetch(this.api('/api/products/reset-sample'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ products, ownerPin })
      });
      const data = await res.json();
      if (!res.ok || !data.ok) return { ok: false, error: data.error };
      await this.pullFromServer();
      return { ok: true };
    } catch {
      await db.products.clear();
      await db.products.bulkAdd(products as Product[]);
      await this.logLocalAudit('Owner', 'OWNER', 'MENU_CHANGED', 'Reset daftar contoh menu cafe');
      this.notifyListeners();
      return { ok: true };
    }
  }

  public async updatePrinterSettings(printerPatch: Partial<ReceiptSettings>): Promise<{ ok: boolean; error?: string }> {
    try {
      const res = await fetch(this.api('/api/printer-settings'), {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(printerPatch)
      });
      const data = await res.json();
      if (!res.ok || !data.ok) return { ok: false, error: data.error || 'Gagal memperbarui pengaturan printer.' };
      await this.pullFromServer();
      return { ok: true };
    } catch {
      const current = (await db.settings.get(1)) || defaultSettings;
      await db.settings.put({ ...current, ...printerPatch, id: 1 });
      this.notifyListeners();
      return { ok: true };
    }
  }

  public async updateSettings(settings: ReceiptSettings, ownerPin: string, newOwnerPin?: string, newCashierPin?: string): Promise<{ ok: boolean; error?: string }> {
    try {
      const res = await fetch(this.api('/api/settings'), {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ settings, ownerPin, newOwnerPin, newCashierPin })
      });
      const data = await res.json();
      if (!res.ok || !data.ok) return { ok: false, error: data.error || 'Gagal memperbarui pengaturan.' };
      await this.pullFromServer();
      return { ok: true };
    } catch {
      const verify = await this.verifyOwnerPin(ownerPin, 'Owner');
      if (!verify.ok) return verify;
      const updated = { ...settings, id: 1 };
      if (newOwnerPin && newOwnerPin.length >= 4) {
        updated.security = {
          ...(updated.security || defaultSecuritySettings),
          ownerPinHash: sha256(newOwnerPin)
        };
      }
      if (newCashierPin && newCashierPin.length >= 4) {
        updated.security = {
          ...(updated.security || defaultSecuritySettings),
          cashierPinHash: sha256(newCashierPin)
        };
      }
      await db.settings.put(updated);
      this.notifyListeners();
      return { ok: true };
    }
  }

  public async restoreBackup(payload: { products?: Product[]; transactions?: Transaction[]; settings?: ReceiptSettings }, ownerPin: string): Promise<{ ok: boolean; error?: string }> {
    try {
      const res = await fetch(this.api('/api/restore'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...payload, ownerPin })
      });
      const data = await res.json();
      if (!res.ok || !data.ok) return { ok: false, error: data.error };
      await this.pullFromServer();
      return { ok: true };
    } catch {
      const verify = await this.verifyOwnerPin(ownerPin, 'Owner');
      if (!verify.ok) return verify;
      if (payload.products) {
        await db.products.clear();
        await db.products.bulkAdd(payload.products);
      }
      if (payload.transactions) {
        await db.transactions.clear();
        await db.transactions.bulkAdd(payload.transactions);
      }
      await this.logLocalAudit('Owner', 'OWNER', 'DB_RESTORED', 'Pulihkan database dari backup JSON');
      this.notifyListeners();
      return { ok: true };
    }
  }

  public async getAuditLogs(): Promise<AuditLog[]> {
    return db.auditLogs.reverse().toArray();
  }

  public async getRemoteTunnelStatus(): Promise<RemoteTunnelStatus> {
    try {
      const res = await fetch(this.api('/api/remote-tunnel/status'));
      if (!res.ok) return { status: 'idle', url: null, ownerUrl: null };
      return await res.json();
    } catch {
      return { status: 'idle', url: null, ownerUrl: null };
    }
  }

  public async startRemoteTunnel(ownerPin: string): Promise<RemoteTunnelStatus & { ok?: boolean }> {
    try {
      const res = await fetch(this.api('/api/remote-tunnel/start'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ownerPin })
      });
      return await res.json();
    } catch {
      return { ok: false, status: 'error', url: null, ownerUrl: null, error: 'Gagal menghubungi server sinkronisasi.' };
    }
  }

  public async stopRemoteTunnel(ownerPin: string): Promise<boolean> {
    try {
      const res = await fetch(this.api('/api/remote-tunnel/stop'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ownerPin })
      });
      return res.ok;
    } catch {
      return false;
    }
  }
}

export const SyncService = new SyncServiceClass();
