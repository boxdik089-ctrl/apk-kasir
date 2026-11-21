import Dexie, { type Table } from 'dexie';
import type { Product, Transaction, HeldCart, ReceiptSettings, AuditLog, SecuritySettings } from '../types';
import { DEFAULT_OWNER_PIN_HASH, DEFAULT_CASHIER_PIN_HASH } from '../utils/hash';

export class KasirDatabase extends Dexie {
  products!: Table<Product, number>;
  transactions!: Table<Transaction, number>;
  heldCarts!: Table<HeldCart, number>;
  settings!: Table<ReceiptSettings, number>;
  auditLogs!: Table<AuditLog, number>;

  constructor() {
    super('KasirOfflineDB');
    this.version(1).stores({
      products: '++id, barcode, name, category, stock',
      transactions: '++id, invoiceNumber, timestamp, cashierName, paymentMethod, status',
      heldCarts: '++id, referenceName, timestamp',
      settings: '++id'
    });
    this.version(2).stores({
      products: '++id, barcode, name, category, stock',
      transactions: '++id, invoiceNumber, timestamp, cashierName, paymentMethod, status',
      heldCarts: '++id, referenceName, timestamp',
      settings: '++id',
      auditLogs: '++id, timestamp, actor, action'
    });
  }
}

export const db = new KasirDatabase();

export const defaultSecuritySettings: SecuritySettings = {
  ownerPinHash: DEFAULT_OWNER_PIN_HASH,
  cashierPinHash: DEFAULT_CASHIER_PIN_HASH,
  requireCashierPin: true,
  cashierCanAddMenu: true,
  cashierCanEditMenu: false,
  cashierCanViewReports: false,
  cashierCanDeleteHeldCart: false,
  terminalLocked: false
};

export const defaultSettings: ReceiptSettings = {
  id: 1,
  storeName: 'SENJA COFFEE & EATERY',
  tagline: 'Specialty Coffee & Warm Pastry',
  address: 'Jl. Senopati No. 42, Kebayoran Baru, Jakarta Selatan',
  phone: '0812-8899-7766',
  footerMessage: 'Terima Kasih Atas Kunjungan Anda!\nPassword Wi-Fi: senjakopi2026\nFollow IG: @senjacoffee.id',
  logoBase64: '',
  logoWidth: 120,
  showLogo: true,
  showDate: true,
  showCashier: true,
  showCustomer: true,
  showBarcode: true,
  showTax: false,
  taxRate: 11,
  paperWidth: '58mm',
  fontFamily: 'monospace',
  separatorChar: '-',
  autoPrintOnPayment: true,
  openCashDrawer: true,
  copies: 1,
  printerMode: 'system',
  selectedPrinterName: '',
  bluetoothDeviceName: '',
  serialBaudRate: 9600,
  security: defaultSecuritySettings
};

export const initialCafeProducts: Omit<Product, 'id'>[] = [
  {
    barcode: 'CF01',
    name: 'Espresso Single Origin',
    category: 'Coffee',
    buyPrice: 6000,
    price: 18000,
    stock: 999,
    minStock: 0,
    unit: 'cup',
    createdAt: new Date().toISOString()
  },
  {
    barcode: 'CF02',
    name: 'Caffe Latte Art (Hot/Ice)',
    category: 'Coffee',
    buyPrice: 9000,
    price: 26000,
    stock: 999,
    minStock: 0,
    unit: 'cup',
    createdAt: new Date().toISOString()
  },
  {
    barcode: 'CF03',
    name: 'Kopi Susu Gula Aren Signature',
    category: 'Coffee',
    buyPrice: 8500,
    price: 24000,
    stock: 999,
    minStock: 0,
    unit: 'cup',
    createdAt: new Date().toISOString()
  },
  {
    barcode: 'CF04',
    name: 'Caramel Macchiato Iced',
    category: 'Coffee',
    buyPrice: 11000,
    price: 32000,
    stock: 999,
    minStock: 0,
    unit: 'cup',
    createdAt: new Date().toISOString()
  },
  {
    barcode: 'CF05',
    name: 'Matcha Green Tea Latte',
    category: 'Non-Coffee',
    buyPrice: 10000,
    price: 28000,
    stock: 999,
    minStock: 0,
    unit: 'cup',
    createdAt: new Date().toISOString()
  },
  {
    barcode: 'CF06',
    name: 'Red Velvet Artisan Latte',
    category: 'Non-Coffee',
    buyPrice: 9500,
    price: 27000,
    stock: 999,
    minStock: 0,
    unit: 'cup',
    createdAt: new Date().toISOString()
  },
  {
    barcode: 'CF07',
    name: 'Earl Grey Iced Milk Tea',
    category: 'Non-Coffee',
    buyPrice: 7000,
    price: 22000,
    stock: 999,
    minStock: 0,
    unit: 'cup',
    createdAt: new Date().toISOString()
  },
  {
    barcode: 'CF08',
    name: 'Butter Croissant Warm Crisp',
    category: 'Pastry & Toast',
    buyPrice: 12000,
    price: 25000,
    stock: 999,
    minStock: 0,
    unit: 'porsi',
    createdAt: new Date().toISOString()
  },
  {
    barcode: 'CF09',
    name: 'Roti Bakar Keju Cokelat Lumer',
    category: 'Pastry & Toast',
    buyPrice: 8000,
    price: 20000,
    stock: 999,
    minStock: 0,
    unit: 'porsi',
    createdAt: new Date().toISOString()
  },
  {
    barcode: 'CF10',
    name: 'French Fries with Truffle Mayo',
    category: 'Snack & Bites',
    buyPrice: 10000,
    price: 25000,
    stock: 999,
    minStock: 0,
    unit: 'porsi',
    createdAt: new Date().toISOString()
  },
  {
    barcode: 'CF11',
    name: 'Spaghetti Aglio e Olio Tuna',
    category: 'Main Course',
    buyPrice: 16000,
    price: 38000,
    stock: 999,
    minStock: 0,
    unit: 'porsi',
    createdAt: new Date().toISOString()
  },
  {
    barcode: 'CF12',
    name: 'Nasi Goreng Spesial Cafe + Telur',
    category: 'Main Course',
    buyPrice: 14000,
    price: 34000,
    stock: 999,
    minStock: 0,
    unit: 'porsi',
    createdAt: new Date().toISOString()
  }
];

export async function initDatabase() {
  // Check settings
  const count = await db.settings.count();
  if (count === 0) {
    await db.settings.add(defaultSettings);
  } else {
    const existing = await db.settings.get(1);
    if (existing && !existing.security) {
      await db.settings.update(1, { security: defaultSecuritySettings });
    }
  }

  // Check products
  const productCount = await db.products.count();
  if (productCount === 0) {
    await db.products.bulkAdd(initialCafeProducts as Product[]);
  }
}
