import { EscPosBuilder } from './escpos';
import type { Transaction, ReceiptSettings, ElectronPrinterInfo, ShiftClosing } from '../types';

export class PrinterService {
  private static bluetoothDevice: any = null;
  private static bluetoothCharacteristic: any = null;
  private static serialPort: any = null;

  static disconnectBluetooth(): void {
    if (this.bluetoothDevice && this.bluetoothDevice.gatt?.connected) {
      this.bluetoothDevice.gatt.disconnect();
    }
    this.bluetoothDevice = null;
    this.bluetoothCharacteristic = null;
  }

  /**
   * Check if running inside Electron desktop app
   */
  static isElectron(): boolean {
    return !!window.electronAPI?.isElectron;
  }

  /**
   * Get list of all installed printers in Windows (both USB and Bluetooth)
   */
  static async getInstalledPrinters(): Promise<ElectronPrinterInfo[]> {
    if (this.isElectron() && window.electronAPI?.getPrinters) {
      try {
        const printers = await window.electronAPI.getPrinters();
        return printers;
      } catch (err) {
        console.error('Failed to get printers from Electron:', err);
      }
    }
    return [];
  }

  /**
   * Format Indonesian Rupiah
   */
  static formatRupiah(amount: number): string {
    return 'Rp ' + Number(amount || 0).toLocaleString('id-ID');
  }

  /**
   * Format Date & Time
   */
  static formatDate(isoString: string): string {
    try {
      const d = new Date(isoString);
      return d.toLocaleDateString('id-ID', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch {
      return isoString;
    }
  }

  /**
   * Convert image URL / Base64 to an HTMLCanvasElement for raster bitmap generation
   */
  static async imageToCanvas(imgSrc: string, targetWidth: number = 180): Promise<HTMLCanvasElement | null> {
    return new Promise((resolve) => {
      if (!imgSrc) return resolve(null);
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        const scale = targetWidth / img.width;
        const width = targetWidth;
        const height = Math.round(img.height * scale);

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) return resolve(null);

        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, width, height);
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas);
      };
      img.onerror = () => resolve(null);
      img.src = imgSrc;
    });
  }

  /**
   * Build ESC/POS bytes from transaction and settings
   */
  static async buildEscPos(
    transaction: Transaction,
    settings: ReceiptSettings
  ): Promise<Uint8Array> {
    const builder = new EscPosBuilder();
    const cols = settings.paperWidth === '80mm' ? 48 : 32;

    // 1. Kick Cash Drawer if configured
    if (settings.openCashDrawer) {
      builder.openCashDrawer();
    }

    // 2. Logo if enabled and provided
    if (settings.showLogo && settings.logoBase64) {
      try {
        const canvas = await this.imageToCanvas(settings.logoBase64, settings.logoWidth || 160);
        if (canvas) {
          builder.rasterImage(canvas);
        }
      } catch (err) {
        console.warn('Error rendering logo for ESC/POS:', err);
      }
    }

    // 3. Header Store Info
    builder.align('center');
    builder.bold(true).fontSize('double-size');
    builder.line(settings.storeName || 'KASIR POS');
    builder.bold(false).fontSize('normal');

    if (settings.tagline) {
      builder.line(settings.tagline);
    }
    if (settings.address) {
      builder.line(settings.address);
    }
    if (settings.phone) {
      builder.line('Telp: ' + settings.phone);
    }

    builder.separator(settings.separatorChar || '-', cols);

    // 4. Transaction Meta
    builder.align('left');
    builder.twoColumn('No. Struk:', transaction.invoiceNumber, cols);
    if (settings.showDate) {
      builder.twoColumn('Waktu:', this.formatDate(transaction.timestamp), cols);
    }
    if (settings.showCashier && transaction.cashierName) {
      builder.twoColumn('Kasir:', transaction.cashierName, cols);
    }
    if (settings.showCustomer && transaction.customerName) {
      builder.twoColumn('Pelanggan:', transaction.customerName, cols);
    }

    builder.separator(settings.separatorChar || '-', cols);

    // 5. Items List
    for (const item of transaction.items) {
      builder.align('left');
      builder.bold(true).line(item.name);
      builder.bold(false);

      const qtyPrice = `${item.quantity} x ${this.formatRupiah(item.price)}`;
      const subtotalStr = this.formatRupiah(item.subtotal);
      builder.twoColumn('  ' + qtyPrice, subtotalStr, cols);

      if (item.discount > 0) {
        builder.twoColumn('  (Diskon Item)', '-' + this.formatRupiah(item.discount), cols);
      }
      if (item.note) {
        builder.line(`  * ${item.note}`);
      }
    }

    builder.separator(settings.separatorChar || '-', cols);

    // 6. Totals
    builder.twoColumn('Subtotal:', this.formatRupiah(transaction.subtotal), cols);
    if (transaction.discount > 0) {
      builder.twoColumn('Total Diskon:', '-' + this.formatRupiah(transaction.discount), cols);
    }
    if (settings.showTax && transaction.tax > 0) {
      builder.twoColumn(`Pajak (${settings.taxRate}%):`, this.formatRupiah(transaction.tax), cols);
    }

    builder.bold(true).fontSize('double-height');
    builder.twoColumn('TOTAL:', this.formatRupiah(transaction.total), cols);
    builder.bold(false).fontSize('normal');

    builder.twoColumn('Metode Bayar:', transaction.paymentMethod, cols);
    builder.twoColumn('Bayar Tunai:', this.formatRupiah(transaction.paidAmount), cols);
    builder.twoColumn('Kembalian:', this.formatRupiah(transaction.changeAmount), cols);

    builder.separator(settings.separatorChar || '-', cols);

    // 7. Footer Message
    if (settings.footerMessage) {
      builder.align('center');
      const lines = settings.footerMessage.split('\n');
      for (const line of lines) {
        builder.line(line);
      }
    }

    builder.feed(2);
    builder.cut();

    return builder.getBytes();
  }

  /**
   * Build ESC/POS bytes for Shift Handover / Cash Drawer Closing Receipt
   */
  static buildShiftEscPos(
    closing: ShiftClosing,
    settings: ReceiptSettings
  ): Uint8Array {
    const builder = new EscPosBuilder();
    const cols = settings.paperWidth === '80mm' ? 48 : 32;
    const sep = settings.separatorChar || '-';

    if (settings.openCashDrawer) {
      builder.openCashDrawer();
    }

    builder.align('center');
    builder.bold(true).fontSize('double-size');
    builder.line(settings.storeName || 'SENJA COFFEE');
    builder.bold(false).fontSize('normal');
    builder.bold(true).line('REKAP TUTUP SHIFT');
    builder.bold(false);
    builder.separator(sep, cols);

    builder.align('left');
    builder.twoColumn('Waktu:', this.formatDate(closing.closedAt), cols);
    builder.twoColumn('Shift:', closing.shift, cols);
    builder.twoColumn('Kasir:', closing.cashierName || 'Kasir', cols);
    builder.twoColumn('Struk Selesai:', `${closing.transactionCount}`, cols);
    if (closing.voidCount > 0) {
      builder.twoColumn('Struk Batal:', `${closing.voidCount}`, cols);
    }

    builder.separator(sep, cols);
    builder.bold(true).line('RINCIAN PENJUALAN');
    builder.bold(false);
    builder.twoColumn('Tunai:', this.formatRupiah(closing.cashSales), cols);
    builder.twoColumn('QRIS:', this.formatRupiah(closing.qrisSales), cols);
    builder.twoColumn('Transfer:', this.formatRupiah(closing.transferSales), cols);
    builder.twoColumn('Debit / EDC:', this.formatRupiah(closing.debitSales), cols);
    if (closing.kasbonSales > 0) {
      builder.twoColumn('Member/Tab:', this.formatRupiah(closing.kasbonSales), cols);
    }
    builder.bold(true);
    builder.twoColumn('TOTAL OMZET:', this.formatRupiah(closing.totalSales), cols);
    builder.bold(false);

    builder.separator(sep, cols);
    builder.bold(true).line('UANG DI LACI KASIR');
    builder.bold(false);
    builder.twoColumn('Modal Awal Laci:', this.formatRupiah(closing.openingCash), cols);
    builder.twoColumn('+ Jual Tunai:', this.formatRupiah(closing.cashSales), cols);
    builder.bold(true).fontSize('double-height');
    builder.twoColumn('TOTAL LACI:', this.formatRupiah(closing.expectedCashInDrawer), cols);
    builder.bold(false).fontSize('normal');

    if (closing.actualCashInDrawer !== undefined) {
      builder.twoColumn('Uang Fisik:', this.formatRupiah(closing.actualCashInDrawer), cols);
      const diff = closing.cashDifference || 0;
      const diffLabel =
        diff === 0 ? 'PAS' : diff > 0 ? `+${this.formatRupiah(diff)}` : `-${this.formatRupiah(Math.abs(diff))}`;
      builder.twoColumn('Selisih Kas:', diffLabel, cols);
    }

    if (closing.notes) {
      builder.separator(sep, cols);
      builder.line('Catatan: ' + closing.notes);
    }

    builder.separator(sep, cols);
    builder.align('center');
    builder.line('Serah Terima: Kasir / Owner');
    builder.feed(3);
    builder.cut();

    return builder.getBytes();
  }

  /**
   * Method 1: Print directly using Windows Printer Driver (USB / Bluetooth paired)
   */
  static async printViaSystem(
    receiptElementId: string,
    settings: ReceiptSettings
  ): Promise<{ success: boolean; message: string }> {
    const el = document.getElementById(receiptElementId);
    if (!el) {
      return { success: false, message: 'Elemen struk tidak ditemukan.' };
    }

    // In Electron, silent print with selected printer
    if (this.isElectron() && window.electronAPI?.printReceipt) {
      try {
        const widthMm = settings.paperWidth === '80mm' ? 80 : 58;
        // 1 inch = 25.4mm = 96px, 1 micron = 1/1000 mm
        const res = await window.electronAPI.printReceipt({
          silent: true,
          deviceName: settings.selectedPrinterName || undefined,
          copies: settings.copies || 1,
          pageSize: {
            width: widthMm * 1000,
            height: 297000 // roll height
          }
        });
        if (res.success) {
          return { success: true, message: 'Struk berhasil dicetak langsung ke printer!' };
        } else {
          // If silent print failed (e.g. printer off or not found), prompt fallback print dialog
          window.print();
          return { success: true, message: 'Dicetak melalui dialog print sistem.' };
        }
      } catch (err: any) {
        console.error('System print error:', err);
        window.print();
        return { success: true, message: 'Dicetak via dialog print browser.' };
      }
    } else {
      // Browser fallback
      window.print();
      return { success: true, message: 'Membuka dialog cetak browser.' };
    }
  }

  /**
   * Shared raw ESC/POS Bluetooth byte sender
   */
  private static async sendBluetoothBytes(
    bytes: Uint8Array
  ): Promise<{ success: boolean; message: string }> {
    if (!('bluetooth' in navigator)) {
      return {
        success: false,
        message: 'Browser / sistem belum mendukung Web Bluetooth. Silakan gunakan mode Driver Windows Printer.'
      };
    }

    try {
      let characteristic = this.bluetoothCharacteristic;

      if (!characteristic) {
        const device = await (navigator as any).bluetooth.requestDevice({
          filters: [
            { services: ['000018f0-0000-1000-8000-00805f9b34fb'] },
            { services: ['e7810a71-73ae-499d-8c15-faa9aef0c3f2'] },
            { services: ['49535343-fe7d-4ae5-8fa9-9fafd205e455'] }
          ],
          optionalServices: [
            '000018f0-0000-1000-8000-00805f9b34fb',
            'e7810a71-73ae-499d-8c15-faa9aef0c3f2',
            '49535343-fe7d-4ae5-8fa9-9fafd205e455',
            '0000ff00-0000-1000-8000-00805f9b34fb'
          ],
          acceptAllDevices: false
        }).catch(async () => {
          return await (navigator as any).bluetooth.requestDevice({
            acceptAllDevices: true,
            optionalServices: [
              '000018f0-0000-1000-8000-00805f9b34fb',
              'e7810a71-73ae-499d-8c15-faa9aef0c3f2',
              '49535343-fe7d-4ae5-8fa9-9fafd205e455',
              '0000ff00-0000-1000-8000-00805f9b34fb'
            ]
          });
        });

        if (!device) {
          return { success: false, message: 'Koneksi bluetooth dibatalkan.' };
        }

        const server = await device.gatt.connect();
        this.bluetoothDevice = device;

        const services = await server.getPrimaryServices();
        for (const service of services) {
          const chars = await service.getCharacteristics();
          for (const c of chars) {
            if (c.properties.write || c.properties.writeWithoutResponse) {
              characteristic = c;
              this.bluetoothCharacteristic = c;
              break;
            }
          }
          if (characteristic) break;
        }
      }

      if (!characteristic) {
        return { success: false, message: 'Karakteristik write Bluetooth thermal printer tidak ditemukan.' };
      }

      const chunkSize = 512;
      for (let i = 0; i < bytes.length; i += chunkSize) {
        const chunk = bytes.slice(i, i + chunkSize);
        await characteristic.writeValue(chunk);
      }

      return { success: true, message: 'Struk berhasil dikirim ke Bluetooth printer!' };
    } catch (err: any) {
      console.error('Bluetooth print error:', err);
      return { success: false, message: 'Gagal mencetak via Bluetooth: ' + (err.message || err) };
    }
  }

  /**
   * Shared raw ESC/POS USB Serial byte sender
   */
  private static async sendSerialBytes(
    bytes: Uint8Array,
    settings: ReceiptSettings
  ): Promise<{ success: boolean; message: string }> {
    if (!('serial' in navigator)) {
      return {
        success: false,
        message: 'Browser / sistem belum mendukung Web Serial. Silakan gunakan Driver Windows Printer.'
      };
    }

    try {
      let port = this.serialPort;
      if (!port) {
        port = await (navigator as any).serial.requestPort();
        await port.open({ baudRate: settings.serialBaudRate || 9600 });
        this.serialPort = port;
      }

      const writer = port.writable.getWriter();
      await writer.write(bytes);
      writer.releaseLock();

      return { success: true, message: 'Struk berhasil dikirim ke port USB / Serial!' };
    } catch (err: any) {
      console.error('Serial print error:', err);
      return { success: false, message: 'Gagal mencetak via Serial USB: ' + (err.message || err) };
    }
  }

  /**
   * Method 2: Direct Bluetooth Printing (Web Bluetooth API)
   */
  static async printViaBluetooth(
    transaction: Transaction,
    settings: ReceiptSettings
  ): Promise<{ success: boolean; message: string }> {
    const bytes = await this.buildEscPos(transaction, settings);
    return await this.sendBluetoothBytes(bytes);
  }

  /**
   * Method 3: Direct USB / Serial COM Port Printing (Web Serial API)
   */
  static async printViaSerial(
    transaction: Transaction,
    settings: ReceiptSettings
  ): Promise<{ success: boolean; message: string }> {
    const bytes = await this.buildEscPos(transaction, settings);
    return await this.sendSerialBytes(bytes, settings);
  }

  /**
   * Universal Smart Print dispatcher: picks the right mode based on user setting
   */
  static async print(
    receiptElementId: string,
    transaction: Transaction,
    settings: ReceiptSettings
  ): Promise<{ success: boolean; message: string }> {
    if (settings.printerMode === 'bluetooth') {
      return await this.printViaBluetooth(transaction, settings);
    } else if (settings.printerMode === 'serial') {
      return await this.printViaSerial(transaction, settings);
    } else {
      // Default: Windows Driver System Spooler (supports both USB & Bluetooth paired drivers)
      return await this.printViaSystem(receiptElementId, settings);
    }
  }

  /**
   * Print Shift Handover / Rekap Tutup Kasir Receipt
   */
  static async printShiftClosing(
    receiptElementId: string,
    closing: ShiftClosing,
    settings: ReceiptSettings
  ): Promise<{ success: boolean; message: string }> {
    if (settings.printerMode === 'bluetooth') {
      const bytes = this.buildShiftEscPos(closing, settings);
      return await this.sendBluetoothBytes(bytes);
    } else if (settings.printerMode === 'serial') {
      const bytes = this.buildShiftEscPos(closing, settings);
      return await this.sendSerialBytes(bytes, settings);
    } else {
      return await this.printViaSystem(receiptElementId, settings);
    }
  }
}
