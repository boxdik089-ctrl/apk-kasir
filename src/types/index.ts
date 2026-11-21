export interface Product {
  id?: number;
  barcode: string;
  name: string;
  category: string;
  buyPrice: number; // Harga modal/beli
  price: number;    // Harga jual
  stock: number;
  minStock: number;
  image?: string;   // base64 atau url
  unit?: string;    // pcs, porsi, kg, botol, dll
  createdAt: string;
}

export interface CartItem {
  productId: number;
  barcode: string;
  name: string;
  buyPrice: number;
  price: number;
  quantity: number;
  discount: number; // potongan nominal per item atau total item
  note?: string;
  subtotal: number;
}

export type PaymentMethod = 'CASH' | 'QRIS' | 'TRANSFER' | 'DEBIT' | 'KASBON';

export type UserRole = 'CASHIER' | 'OWNER';

export type AuditAction =
  | 'CASHIER_LOGIN'
  | 'CASHIER_LOGIN_FAILED'
  | 'OWNER_LOGIN'
  | 'OWNER_LOGIN_FAILED'
  | 'VOID_TRANSACTION'
  | 'DELETE_HELD_CART'
  | 'MENU_CHANGED'
  | 'SETTINGS_CHANGED'
  | 'REMOTE_LOCK_CHANGED'
  | 'DB_RESTORED';

export interface AuditLog {
  id?: number;
  timestamp: string;
  actor: string;
  role: UserRole;
  action: AuditAction;
  summary: string;
  amount?: number;
}

export interface Transaction {
  id?: number;
  invoiceNumber: string;
  timestamp: string;
  cashierName: string;
  customerName?: string;
  customerPhone?: string;
  items: CartItem[];
  subtotal: number;
  discount: number;
  tax: number;
  total: number;
  paidAmount: number;
  changeAmount: number;
  paymentMethod: PaymentMethod;
  notes?: string;
  status: 'COMPLETED' | 'CANCELLED';
  voidReason?: string;
  voidBy?: string;
  voidAt?: string;
}

export interface HeldCart {
  id?: number;
  referenceName: string; // e.g. "Meja 04" / "Budi"
  items: CartItem[];
  timestamp: string;
  total: number;
}

export interface SecuritySettings {
  ownerPinHash: string; // SHA-256 hex digest
  cashierPinHash?: string; // SHA-256 hex digest (default '1234')
  requireCashierPin?: boolean;
  cashierCanAddMenu: boolean;
  cashierCanEditMenu: boolean;
  cashierCanViewReports: boolean;
  cashierCanDeleteHeldCart: boolean;
  terminalLocked: boolean;
}

export interface ReceiptSettings {
  id?: number;
  storeName: string;
  tagline: string;
  address: string;
  phone: string;
  footerMessage: string;
  logoBase64?: string;
  logoWidth: number; // px, e.g. 100
  showLogo: boolean;
  showDate: boolean;
  showCashier: boolean;
  showCustomer: boolean;
  showBarcode: boolean;
  showTax: boolean;
  taxRate: number; // e.g. 10 or 11 (%)
  paperWidth: '58mm' | '80mm';
  fontFamily: 'monospace' | 'sans-serif';
  separatorChar: '-' | '=' | '*' | '.';
  autoPrintOnPayment: boolean;
  openCashDrawer: boolean;
  copies: number;
  
  // Hardware printer configuration
  printerMode: 'system' | 'bluetooth' | 'serial';
  selectedPrinterName?: string; // Windows Printer device name (e.g. "POS-58", "XP-80C", "EPSON TM-T82")
  bluetoothDeviceName?: string;
  serialBaudRate?: number;

  // Owner security & remote controls
  security?: SecuritySettings;
}

export interface ElectronPrinterInfo {
  name: string;
  displayName: string;
  description: string;
  status: number;
  isDefault: boolean;
}

declare global {
  interface Window {
    electronAPI?: {
      isElectron: boolean;
      getPrinters: () => Promise<ElectronPrinterInfo[]>;
      printReceipt: (options: {
        silent?: boolean;
        deviceName?: string;
        copies?: number;
        pageSize?: { width: number; height: number };
      }) => Promise<{ success: boolean; reason?: string }>;
      minimize: () => Promise<void>;
      maximize: () => Promise<void>;
      close: () => Promise<void>;
    };
  }
}
