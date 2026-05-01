import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { Order, OrderItem } from '../models/order.model';
import { EscPosService, PaperWidth } from './escpos.service';
import { MenuService } from './menu.service';
import { BluetoothSerial } from '@e-is/capacitor-bluetooth-serial';
import { registerPlugin, Capacitor } from '@capacitor/core';

// ── Custom native plugin: exposes Android getBondedDevices() ──────────────────
// The `@e-is/capacitor-bluetooth-serial` scan() method performs active device
// DISCOVERY (startDiscovery), NOT a bonded-devices list. Paired printers only
// show up reliably via getBondedDevices(). BondedDevicesPlugin is registered in
// MainActivity.java and provides exactly that API.
interface BondedDevicesResult { devices: Array<{ name: string; address: string }> }
interface BondedDevicesPlugin { getBondedDevices(): Promise<BondedDevicesResult> }
const BondedDevices = registerPlugin<BondedDevicesPlugin>('BondedDevices');

// ── USB Printer plugin ───────────────────────────────────────────────────────
// Backed by UsbPrinterPlugin.java which uses Android's USB Host API to send
// raw ESC/POS bytes over the bulk-OUT endpoint of a connected USB printer.
interface UsbDeviceResult { devices: UsbDevice[] }
interface UsbPermResult  { granted: boolean; deviceName?: string }
interface UsbPrinterPlugin {
  getUsbDevices(): Promise<UsbDeviceResult>;
  requestPermission(opts: { deviceName: string }): Promise<UsbPermResult>;
  print(opts: { deviceName: string; data: string }): Promise<void>;
}
const UsbPrinter = registerPlugin<UsbPrinterPlugin>('UsbPrinter');

// ── Network Printer plugin ───────────────────────────────────────────────────
// Backed by NetworkPrinterPlugin.java which sends raw ESC/POS bytes over TCP
// to a network printer on port 9100, and provides connectivity checks.
interface NetworkPrinterPlugin {
  print(opts: { host: string; port: number; data: string }): Promise<void>;
  testConnection(opts: { host: string; port: number }): Promise<void>;
}
const NetworkPrinter = registerPlugin<NetworkPrinterPlugin>('NetworkPrinter');

// ─────────────────────────────────────────────────────────────────────────────
// Production-ready Bluetooth thermal printer service.
//
// Supports:
//   • Android 12+ runtime permissions  (BLUETOOTH_CONNECT / BLUETOOTH_SCAN)
//   • Android ≤11 classic permissions  (BLUETOOTH / BLUETOOTH_ADMIN)
//   • Graceful BT-disabled detection with settings redirect
//   • Serial print queue  (mutex) — no overlapping sends
//   • Chunked write (512 B) — avoids MTU overflows on older printers
//   • Per-print timeout (15 s) — never hangs forever
//   • 58 mm / 80 mm paper width selection
//   • Test-print function
// ─────────────────────────────────────────────────────────────────────────────

const STORAGE_KEY_PAPER_WIDTH     = 'nearbite_paper_width';
const STORAGE_KEY_KOT_PRINTERS    = 'nearbite_kot_printers';
const STORAGE_KEY_VEG_KOT_PRINTERS    = 'nearbite_veg_kot_printers';
const STORAGE_KEY_NONVEG_KOT_PRINTERS = 'nearbite_nonveg_kot_printers';
const STORAGE_KEY_BILL_PRINTERS   = 'nearbite_bill_printers';
const STORAGE_KEY_GST_NUMBER      = 'nearbite_gst_number';
const STORAGE_KEY_PRINTER_MODE    = 'nearbite_printer_mode';

/** Timeout for a single BT connect or write call (ms) */
const PRINT_TIMEOUT_MS = 15_000;
/** BT write chunk size — keeps us below typical BT SPP MTU */
const WRITE_CHUNK_BYTES = 512;

export interface PrinterDevice {
  name: string;
  address: string;   // Bluetooth: MAC address  |  USB: device path (/dev/bus/usb/…)  |  Network: IP
  type: 'bluetooth' | 'usb' | 'network';
  port?: number;     // Network only — default 9100
  /** Category names this printer is restricted to. Empty/undefined = print ALL items (default). */
  categoryIds?: string[];
}

/** Raw USB device info returned by getUsbDevices() */
export interface UsbDevice {
  deviceName:      string;   // e.g. /dev/bus/usb/001/002
  productName:     string;
  manufacturerName: string;
  vendorId:        number;
  productId:       number;
  hasPermission:   boolean;
}

export type PrintStatus = 'idle' | 'connecting' | 'printing' | 'success' | 'error';

export type { PaperWidth };

@Injectable({ providedIn: 'root' })
export class PrinterService {

  private statusSubject       = new BehaviorSubject<PrintStatus>('idle');
  public  status$             = this.statusSubject.asObservable();

  private pairedDevicesSubject = new BehaviorSubject<PrinterDevice[]>([]);
  public  pairedDevices$       = this.pairedDevicesSubject.asObservable();

  /** Simple mutex — prevents two prints from running simultaneously */
  private printInProgress = false;

  constructor(private escpos: EscPosService, private menuService: MenuService) {
    // Apply saved paper width on startup so ESC/POS byte counts are correct
    this.escpos.setPaperWidth(this.getPaperWidth());
  }

  // ── KOT / Bill printer pools ──────────────────────────────────────────────

  getKotPrinters(): PrinterDevice[] {
    return this.loadPrinters(STORAGE_KEY_KOT_PRINTERS);
  }

  getVegKotPrinters(): PrinterDevice[] {
    return this.loadPrinters(STORAGE_KEY_VEG_KOT_PRINTERS);
  }

  getNonVegKotPrinters(): PrinterDevice[] {
    return this.loadPrinters(STORAGE_KEY_NONVEG_KOT_PRINTERS);
  }

  getBillPrinters(): PrinterDevice[] {
    return this.loadPrinters(STORAGE_KEY_BILL_PRINTERS);
  }

  addKotPrinter(device: PrinterDevice): void {
    const list = this.getKotPrinters().filter(p => p.address !== device.address);
    this.storePrinters(STORAGE_KEY_KOT_PRINTERS, [...list, device]);
  }

  addVegKotPrinter(device: PrinterDevice): void {
    const list = this.getVegKotPrinters().filter(p => p.address !== device.address);
    this.storePrinters(STORAGE_KEY_VEG_KOT_PRINTERS, [...list, device]);
  }

  addNonVegKotPrinter(device: PrinterDevice): void {
    const list = this.getNonVegKotPrinters().filter(p => p.address !== device.address);
    this.storePrinters(STORAGE_KEY_NONVEG_KOT_PRINTERS, [...list, device]);
  }

  addBillPrinter(device: PrinterDevice): void {
    const list = this.getBillPrinters().filter(p => p.address !== device.address);
    this.storePrinters(STORAGE_KEY_BILL_PRINTERS, [...list, device]);
  }

  removeKotPrinter(address: string): void {
    this.storePrinters(STORAGE_KEY_KOT_PRINTERS, this.getKotPrinters().filter(p => p.address !== address));
  }

  removeVegKotPrinter(address: string): void {
    this.storePrinters(STORAGE_KEY_VEG_KOT_PRINTERS, this.getVegKotPrinters().filter(p => p.address !== address));
  }

  removeNonVegKotPrinter(address: string): void {
    this.storePrinters(STORAGE_KEY_NONVEG_KOT_PRINTERS, this.getNonVegKotPrinters().filter(p => p.address !== address));
  }

  removeBillPrinter(address: string): void {
    this.storePrinters(STORAGE_KEY_BILL_PRINTERS, this.getBillPrinters().filter(p => p.address !== address));
  }

  /**
   * Update the category filter for a KOT printer that already exists in a pool.
   * Pass an empty array to remove the filter (printer will print all items again).
   */
  updateKotPrinterCategories(
    pool: 'kot' | 'vegKot' | 'nonVegKot',
    address: string,
    categoryIds: string[],
  ): void {
    const key =
      pool === 'kot'       ? STORAGE_KEY_KOT_PRINTERS :
      pool === 'vegKot'    ? STORAGE_KEY_VEG_KOT_PRINTERS :
                             STORAGE_KEY_NONVEG_KOT_PRINTERS;
    const list = this.loadPrinters(key).map(p =>
      p.address === address
        ? { ...p, categoryIds: categoryIds.length ? categoryIds : undefined }
        : p,
    );
    this.storePrinters(key, list);
  }

  hasAnyPrinter(): boolean {
    return this.getKotPrinters().length > 0 || this.getBillPrinters().length > 0;
  }

  private loadPrinters(key: string): PrinterDevice[] {
    try { return JSON.parse(localStorage.getItem(key) || '[]') as PrinterDevice[]; }
    catch { return []; }
  }

  private storePrinters(key: string, list: PrinterDevice[]): void {
    localStorage.setItem(key, JSON.stringify(list));
  }

  // ── Paper width ────────────────────────────────────────────────────────────

  getPaperWidth(): PaperWidth {
    const saved = localStorage.getItem(STORAGE_KEY_PAPER_WIDTH);
    return (saved === '58' ? 58 : 80) as PaperWidth;
  }

  savePaperWidth(w: PaperWidth): void {
    localStorage.setItem(STORAGE_KEY_PAPER_WIDTH, String(w));
    this.escpos.setPaperWidth(w);
  }

  // ── Printer mode ───────────────────────────────────────────────────────────

  getPrinterMode(): 'basic' | 'customized' {
    const saved = localStorage.getItem(STORAGE_KEY_PRINTER_MODE);
    return saved === 'customized' ? 'customized' : 'basic';
  }

  savePrinterMode(mode: 'basic' | 'customized'): void {
    localStorage.setItem(STORAGE_KEY_PRINTER_MODE, mode);
  }

  // ── GST Number ─────────────────────────────────────────────────────────────

  getGstNumber(): string {
    return localStorage.getItem(STORAGE_KEY_GST_NUMBER) || '';
  }

  saveGstNumber(gst: string): void {
    const trimmed = gst.trim();
    if (trimmed) {
      localStorage.setItem(STORAGE_KEY_GST_NUMBER, trimmed);
    } else {
      localStorage.removeItem(STORAGE_KEY_GST_NUMBER);
    }
  }

  // ── Device scanning ────────────────────────────────────────────────────────

  /**
   * Returns the list of devices already PAIRED (bonded) in Android Settings.
   *
   * Uses our custom BondedDevicesPlugin (BondedDevicesPlugin.java in the
   * Android project) which calls BluetoothAdapter.getBondedDevices() directly.
   *
   * WHY NOT BluetoothSerial.scan()?
   *   scan() runs startDiscovery() — active Bluetooth scan for nearby/
   *   discoverable devices. It does NOT return already-paired printers unless
   *   they happen to be in discoverable mode. getBondedDevices() is the correct
   *   API: instant, no discovery needed, works offline, finds all paired devices.
   *
   * Throws typed error codes:
   *   'PERMISSIONS_DENIED'  — user denied BLUETOOTH_CONNECT permission
   *   'BLUETOOTH_DISABLED'  — BT adapter is off
   *   'SCAN_FAILED'         — unexpected error
   */
  async scanPairedDevices(): Promise<PrinterDevice[]> {
    if (!this.isNativeApp()) {
      this.pairedDevicesSubject.next([]);
      return [];
    }

    console.log('[PrinterService] Platform:', Capacitor.getPlatform());
    console.log('[PrinterService] isNativePlatform:', Capacitor.isNativePlatform());

    try {
      console.log('[PrinterService] Calling BondedDevices.getBondedDevices()…');
      const result = await BondedDevices.getBondedDevices();
      console.log('[PrinterService] Raw result:', JSON.stringify(result));
      const devices: PrinterDevice[] = (result.devices || []).map((d) => ({
        name:    d.name || d.address,
        address: d.address,
        type:    'bluetooth' as const,
      }));
      this.pairedDevicesSubject.next(devices);
      return devices;
    } catch (e: any) {
      const msg = (e?.message || '').toLowerCase();

      if (msg.includes('disabled')) {
        throw new Error('BLUETOOTH_DISABLED');
      }
      if (msg.includes('permission') || msg.includes('denied')) {
        throw new Error('PERMISSIONS_DENIED');
      }

      console.error('PrinterService: getBondedDevices error', e);
      throw new Error('SCAN_FAILED');
    }
  }

  // ── USB device scan ────────────────────────────────────────────────────────

  /**
   * Returns USB devices currently connected to the host port.
   * Electron: enumerates real Windows USB printers via IPC.
   * Android: uses UsbPrinter native plugin.
   * Browser: returns empty (USB access not available in browser).
   */
  async scanUsbDevices(): Promise<UsbDevice[]> {
    if (this.isElectronApp()) {
      // Electron (Windows): ask main process via IPC
      const api = (window as any).printerAPI;
      return await api.listUsbPrinters();
    }
    if (!this.isNativeApp()) {
      return [];
    }
    try {
      const result = await UsbPrinter.getUsbDevices();
      return result.devices || [];
    } catch (e) {
      console.error('PrinterService: getUsbDevices error', e);
      throw new Error('USB_SCAN_FAILED');
    }
  }

  // ── Test print ─────────────────────────────────────────────────────────────

  /**
   * Sends a test page to a specific printer device.
   */
  async testPrintOn(device: PrinterDevice): Promise<void> {
    this.escpos.setPaperWidth(this.getPaperWidth());
    if (device.type === 'network') {
      await this.sendBytesNetwork(device.address, device.port ?? 9100, this.escpos.formatTestPage(), 'Test Page');
      return;
    }
    if (this.isElectronApp() && device.type === 'usb') {
      // Electron: USB path is fully supported via IPC
      await this.sendBytesUsb(device.address, this.escpos.formatTestPage(), 'Test Page');
      return;
    }
    if (!this.isNativeApp()) {
      console.group('%c🖨️  TEST PRINT', 'color: #ff6b35; font-weight: bold;');
      console.log(this.escpos.toDebugString(this.escpos.formatTestPage()));
      console.groupEnd();
      this.statusSubject.next('success');
      setTimeout(() => this.statusSubject.next('idle'), 3000);
      return;
    }
    if (device.type === 'usb') {
      await this.sendBytesUsb(device.address, this.escpos.formatTestPage(), 'Test Page');
    } else {
      await this.sendBytes(device.address, this.escpos.formatTestPage(), 'Test Page');
    }
  }

  /** @deprecated Use testPrintOn(device) instead */
  async testPrint(): Promise<void> {
    const all = [...this.getKotPrinters(), ...this.getVegKotPrinters(),
                 ...this.getNonVegKotPrinters(), ...this.getBillPrinters()];
    if (all.length === 0) throw new Error('NO_PRINTER');
    await this.testPrintOn(all[0]);
  }

  // ── Auto-print KOT + Bill on order accept ─────────────────────────────────

  /**
   * Prints KOT (kitchen copy) and customer Bill when an order is accepted.
   * Silently skips if no printer is configured.
   *
   * Routing depends on printer mode:
   *   – basic       → all KOT printers receive the full order (no category split)
   *   – customized  → each KOT printer is filtered by its categoryIds (empty = all items)
   */
  async printOrderAccepted(order: Order): Promise<void> {
    this.escpos.setPaperWidth(this.getPaperWidth());
    const bill    = this.escpos.formatBill(order, this.getGstNumber() || undefined);
    const fullKot = this.escpos.formatKOT(order);
    const isCustomized = this.getPrinterMode() === 'customized';
    // Ensure menu cache is populated before category filtering.
    // ensureMenuLoaded() resolves instantly when cache is already warm,
    // so there is zero overhead on the second and subsequent prints.
    if (isCustomized) {
      await this.menuService.ensureMenuLoaded();
    }

    /** Returns KOT bytes for one printer; null = skip (no matching items or unconfigured). */
    const kotDataForPrinter = (p: PrinterDevice): Uint8Array | null => {
      if (!isCustomized) return fullKot;
      // In customized mode: printer with no categories assigned is unconfigured — skip to prevent duplicates.
      if (!p.categoryIds?.length) return null;
      const filtered = this.filterItemsByCategories(order.items, p.categoryIds);
      if (filtered.length === 0) return null;
      return this.escpos.formatFilteredKOT(order, filtered, this.categoryLabel(p.categoryIds));
    };

    if (!this.isNativeApp()) {
      console.group(`%c🖨️  KOT — Order #${order.orderId.slice(-8).toUpperCase()}`, 'color: #ff6b35; font-weight: bold;');
      console.log(this.escpos.toDebugString(fullKot));
      console.groupEnd();
      console.group(`%c🧾 BILL — Order #${order.orderId.slice(-8).toUpperCase()}`, 'color: #2ecc71; font-weight: bold;');
      console.log(this.escpos.toDebugString(bill));
      console.groupEnd();

      // Electron supports network + USB; browser supports network only.
      const isElectron  = this.isElectronApp();
      const kotPrinters = this.getKotPrinters();
      const billPrinters = this.getBillPrinters();
      const kotList  = kotPrinters.filter(p => p.type === 'network' || (isElectron && p.type === 'usb'));
      const billList = billPrinters.filter(p => p.type === 'network' || (isElectron && p.type === 'usb'));

      if (kotList.length === 0 && billList.length === 0) {
        console.info('ℹ️  PrinterService: No network/USB printers configured for this environment.');
        this.statusSubject.next('success');
        setTimeout(() => this.statusSubject.next('idle'), 3000);
        return;
      }

      if (this.printInProgress) {
        console.warn('PrinterService: another print in progress — skipping.');
        return;
      }
      this.printInProgress = true;
      try {
        for (const p of kotList) {
          const data = kotDataForPrinter(p);
          if (!data) continue;
          if (p.type === 'usb') await this.sendBytesUsb(p.address, data, 'KOT');
          else await this.sendBytesNetwork(p.address, p.port ?? 9100, data, 'KOT');
        }
        for (const p of billList) {
          if (p.type === 'usb') await this.sendBytesUsb(p.address, bill, 'Bill');
          else await this.sendBytesNetwork(p.address, p.port ?? 9100, bill, 'Bill');
        }
      } finally {
        this.printInProgress = false;
      }
      return;
    }

    const kotPrinters  = this.getKotPrinters();
    const billPrinters = this.getBillPrinters();

    if (kotPrinters.length === 0 && billPrinters.length === 0) {
      console.warn('PrinterService: no printers configured — skipping print.');
      return;
    }

    if (this.printInProgress) {
      console.warn('PrinterService: another print is in progress — skipping.');
      return;
    }

    const sendKot = async (p: PrinterDevice, data: Uint8Array, lbl: string) => {
      if (p.type === 'usb')          await this.sendBytesUsb(p.address, data, lbl);
      else if (p.type === 'network') await this.sendBytesNetwork(p.address, p.port ?? 9100, data, lbl);
      else                           await this.sendBytes(p.address, data, lbl);
    };

    this.printInProgress = true;
    try {
      for (const p of kotPrinters) {
        const data = kotDataForPrinter(p);
        if (data) await sendKot(p, data, 'KOT');
      }
      for (const p of billPrinters) {
        if (p.type === 'usb')          await this.sendBytesUsb(p.address, bill, 'Bill');
        else if (p.type === 'network') await this.sendBytesNetwork(p.address, p.port ?? 9100, bill, 'Bill');
        else                           await this.sendBytes(p.address, bill, 'Bill');
      }
    } finally {
      this.printInProgress = false;
    }
  }

  // ── Manual / individual print commands ────────────────────────────────────

  /** Manually reprint only the customer bill for an order. */
  async printBillOnly(order: Order): Promise<void> {
    this.escpos.setPaperWidth(this.getPaperWidth());
    const bill = this.escpos.formatBill(order, this.getGstNumber() || undefined);
    await this._printToPool(this.getBillPrinters(), bill, 'Bill');
  }

  /** Manually reprint only the full KOT (all items) for an order. In customized mode respects per-printer categoryIds. */
  async printKotOnly(order: Order): Promise<void> {
    this.escpos.setPaperWidth(this.getPaperWidth());
    const printers = this.getKotPrinters();
    if (!printers.length) { console.warn('PrinterService: no KOT printers configured.'); return; }
    const isCustomized = this.getPrinterMode() === 'customized';
    for (const p of printers) {
      if (!isCustomized) {
        await this._printToPool([p], this.escpos.formatKOT(order), 'KOT');
      } else if (p.categoryIds?.length) {
        const items = this.filterItemsByCategories(order.items, p.categoryIds);
        if (!items.length) continue;
        await this._printToPool([p], this.escpos.formatFilteredKOT(order, items, this.categoryLabel(p.categoryIds)), 'KOT');
      }
      // customized mode + no categories = skip (prevent duplicate prints)
    }
  }

  /** Manually reprint only the veg KOT for an order. Respects per-printer categoryIds. */
  async printVegKotOnly(order: Order): Promise<void> {
    this.escpos.setPaperWidth(this.getPaperWidth());
    const vegItems = order.items.filter(i => i.isVeg === true);
    if (!vegItems.length) return;
    const printers = this.getVegKotPrinters();
    for (const p of printers) {
      const items = p.categoryIds?.length ? this.filterItemsByCategories(vegItems, p.categoryIds) : vegItems;
      if (!items.length) continue;
      const label = p.categoryIds?.length ? this.categoryLabel(p.categoryIds) : 'VEG';
      await this._printToPool([p], this.escpos.formatFilteredKOT(order, items, label), 'KOT-VEG');
    }
  }

  /** Manually reprint only the non-veg KOT for an order. Respects per-printer categoryIds. */
  async printNonVegKotOnly(order: Order): Promise<void> {
    this.escpos.setPaperWidth(this.getPaperWidth());
    const nonVegItems = order.items.filter(i => i.isVeg === false);
    if (!nonVegItems.length) return;
    const printers = this.getNonVegKotPrinters();
    for (const p of printers) {
      const items = p.categoryIds?.length ? this.filterItemsByCategories(nonVegItems, p.categoryIds) : nonVegItems;
      if (!items.length) continue;
      const label = p.categoryIds?.length ? this.categoryLabel(p.categoryIds) : 'NON-VEG';
      await this._printToPool([p], this.escpos.formatFilteredKOT(order, items, label), 'KOT-NONVEG');
    }
  }

  // ── Category-based filtering helpers ─────────────────────────────────────

  /**
   * Returns order items whose menu category is in `categoryIds`.
   * Looks up the category from the locally cached menu items.
   * If a menu item is not found (cache miss) it is excluded from the result —
   * so the printer silently skips unknown items rather than printing garbage.
   */
  private filterItemsByCategories(items: OrderItem[], categoryIds: string[]): OrderItem[] {
    const menuItems = this.menuService.currentItems;
    // Cache should always be warm here because printOrderAccepted() awaits
    // ensureMenuLoaded() before calling this function. The fallback below is
    // a last-resort safety net for direct calls (e.g. manual reprint) where
    // the menu somehow never loaded — prefer printing everything over silently
    // dropping items.
    if (!menuItems.length) return items;
    const catMap = new Map<string, string>();
    for (const mi of menuItems) {
      if (mi.category) catMap.set(mi.itemId, mi.category);
    }
    return items.filter(item => {
      const cat = catMap.get(item.itemId);
      return cat !== undefined && categoryIds.includes(cat);
    });
  }

  /** Produces a short printable label from category names, e.g. "GRILLS/KEBAB" */
  private categoryLabel(categoryIds: string[]): string {
    return categoryIds.slice(0, 2).join('/').toUpperCase();
  }

  /**
   * Shared helper: sends `data` to every printer in `printers`.
   * Handles BT, USB, and Network printer types.
   * Respects the printInProgress mutex to prevent overlapping prints.
   */
  private async _printToPool(printers: PrinterDevice[], data: Uint8Array, label: string): Promise<void> {
    if (printers.length === 0) {
      console.warn(`PrinterService: no printers in pool for [${label}] — skipping.`);
      return;
    }

    if (!this.isNativeApp()) {
      console.group(`%c🖨️  ${label}`, 'color: #ff6b35; font-weight: bold;');
      console.log(this.escpos.toDebugString(data));
      console.groupEnd();
      const isElectron = this.isElectronApp();
      const routable = printers.filter(p => p.type === 'network' || (isElectron && p.type === 'usb'));
      if (routable.length === 0) {
        this.statusSubject.next('success');
        setTimeout(() => this.statusSubject.next('idle'), 3000);
        return;
      }
      if (this.printInProgress) return;
      this.printInProgress = true;
      try {
        for (const p of routable) {
          if (p.type === 'usb') await this.sendBytesUsb(p.address, data, label);
          else await this.sendBytesNetwork(p.address, p.port ?? 9100, data, label);
        }
      } finally { this.printInProgress = false; }
      return;
    }

    if (this.printInProgress) {
      console.warn('PrinterService: another print in progress — skipping.');
      return;
    }
    this.printInProgress = true;
    try {
      for (const p of printers) {
        if (p.type === 'usb')          await this.sendBytesUsb(p.address, data, label);
        else if (p.type === 'network') await this.sendBytesNetwork(p.address, p.port ?? 9100, data, label);
        else                           await this.sendBytes(p.address, data, label);
      }
    } finally {
      this.printInProgress = false;
    }
  }

  // ── Low-level send ─────────────────────────────────────────────────────────

  private async sendBytes(address: string, data: Uint8Array, label: string): Promise<void> {
    this.statusSubject.next('connecting');

    // Disconnect any stale connection first
    try { await BluetoothSerial.disconnect({ address }); } catch {}

    const withTimeout = <T>(p: Promise<T>): Promise<T> =>
      Promise.race([
        p,
        new Promise<T>((_, rej) =>
          setTimeout(() => rej(new Error(`PrinterService: ${label} timed out after ${PRINT_TIMEOUT_MS / 1000}s`)),
            PRINT_TIMEOUT_MS)),
      ]);

    try {
      // connectInsecure works with both phone-to-phone SPP testing and
      // real thermal printers (most BT printers use unauthenticated SPP)
      await withTimeout(BluetoothSerial.connectInsecure({ address }));
      this.statusSubject.next('printing');

      // Chunked write — avoids MTU overflows on older SPP printers
      for (let offset = 0; offset < data.length; offset += WRITE_CHUNK_BYTES) {
        const slice = data.slice(offset, offset + WRITE_CHUNK_BYTES);
        const b64   = btoa(String.fromCharCode(...slice));
        await withTimeout(BluetoothSerial.write({ address, value: b64 }));
      }

      await BluetoothSerial.disconnect({ address });
      this.statusSubject.next('success');
      console.log(`✅ PrinterService: [${label}] sent to ${address}`);
    } catch (e) {
      console.error(`❌ PrinterService: failed to send [${label}]`, e);
      this.statusSubject.next('error');
      try { await BluetoothSerial.disconnect({ address }); } catch {}
    } finally {
      setTimeout(() => this.statusSubject.next('idle'), 4000);
    }
  }

  // ── USB low-level send ─────────────────────────────────────────────────────

  /**
   * Requests USB permission (if not already granted), then sends ESC/POS bytes
   * to the USB printer via the UsbPrinterPlugin bulk-OUT transfer.
   */
  private async sendBytesUsb(deviceName: string, data: Uint8Array, label: string): Promise<void> {
    this.statusSubject.next('connecting');
    try {
      // Build base64 without spread operator — spread crashes on large arrays
      let bin = '';
      for (let i = 0; i < data.length; i++) bin += String.fromCharCode(data[i]);
      const b64 = btoa(bin);

      if (this.isElectronApp()) {
        // Electron (Windows): write ESC/POS bytes to Windows USB port via IPC
        this.statusSubject.next('printing');
        const api = (window as any).printerAPI;
        await api.printUsbRaw(deviceName, b64);
        this.statusSubject.next('success');
        console.log(`✅ PrinterService: [${label}] sent via Electron USB to ${deviceName}`);
      } else {
        // Android Capacitor: request permission then bulk-transfer
        const perm = await UsbPrinter.requestPermission({ deviceName });
        if (!perm.granted) throw new Error('USB permission denied by user');
        this.statusSubject.next('printing');
        await UsbPrinter.print({ deviceName, data: b64 });
        this.statusSubject.next('success');
        console.log(`✅ PrinterService: [${label}] sent via USB to ${deviceName}`);
      }
    } catch (e) {
      console.error(`❌ PrinterService: USB failed [${label}]`, e);
      this.statusSubject.next('error');
    } finally {
      setTimeout(() => this.statusSubject.next('idle'), 4000);
    }
  }

  // ── Network (TCP via Electron IPC) low-level send ────────────────────────────

  /**
   * Tests TCP connectivity to a network printer.
   * Capacitor: routes through NetworkPrinterPlugin (raw TCP socket).
   * Electron:  routes through window.printerAPI (IPC → Node net module).
   * Browser:   fallback to Epson ePOS SDK connect attempt.
   */
  async testNetworkConnection(host: string, port: number): Promise<void> {
    if (this.isNativeApp()) {
      await NetworkPrinter.testConnection({ host, port });
      return;
    }
    if (this.isElectronApp()) {
      const api = (window as any).printerAPI;
      await api.testConnection(host, port);
      return;
    }
    // Pure browser fallback: ePOS SDK connect attempt (Epson only)
    return this.testEposConnection(host);
  }

  /**
   * Tests Bluetooth connectivity by connecting and immediately disconnecting.
   * Does NOT send any data — purely a reachability check.
   * Only works on native (Capacitor) platform.
   */
  async testBluetoothConnection(address: string): Promise<void> {
    if (!this.isNativeApp()) {
      // Browser preview — always succeed for mock devices
      return;
    }

    const withTimeout = <T>(p: Promise<T>): Promise<T> =>
      Promise.race([
        p,
        new Promise<T>((_, rej) =>
          setTimeout(() => rej(new Error('Bluetooth connection timed out')), PRINT_TIMEOUT_MS)),
      ]);

    // Disconnect any stale connection first
    try { await BluetoothSerial.disconnect({ address }); } catch {}

    try {
      await withTimeout(BluetoothSerial.connectInsecure({ address }));
      await BluetoothSerial.disconnect({ address });
    } catch (e: any) {
      try { await BluetoothSerial.disconnect({ address }); } catch {}
      throw new Error(e?.message || 'Cannot reach Bluetooth printer');
    }
  }

  /**
   * Sends raw ESC/POS bytes to a network printer.
   * Capacitor: routes through NetworkPrinterPlugin (raw TCP socket).
   * Electron:  routes through window.printerAPI (IPC → Node net).
   * Browser:   tries Epson ePOS SDK (TM-T82X / T88 only).
   */
  private async sendBytesNetwork(host: string, port: number, data: Uint8Array, label: string): Promise<void> {
    this.statusSubject.next('connecting');
    try {
      // Build base64 without spread — spread crashes on large typed arrays
      let bin = '';
      for (let i = 0; i < data.length; i++) bin += String.fromCharCode(data[i]);
      const b64 = btoa(bin);

      if (this.isNativeApp()) {
        this.statusSubject.next('printing');
        await NetworkPrinter.print({ host, port, data: b64 });
        this.statusSubject.next('success');
        console.log(`✅ PrinterService: [${label}] sent via Capacitor TCP to ${host}:${port}`);
      } else if (this.isElectronApp()) {
        const api = (window as any).printerAPI;
        await api.printRaw(host, port, b64);
        this.statusSubject.next('success');
        console.log(`✅ PrinterService: [${label}] sent via Electron TCP to ${host}:${port}`);
      } else {
        await this.sendBytesEpos(host, data, label);
      }
    } catch (e) {
      console.error(`❌ PrinterService: network send failed [${label}]`, e);
      this.statusSubject.next('error');
    } finally {
      setTimeout(() => this.statusSubject.next('idle'), 4000);
    }
  }

  // ── Epson ePOS SDK (browser WiFi fallback) ──────────────────────────────

  isEposSdkAvailable(): boolean {
    return typeof (window as any).epson !== 'undefined';
  }

  private testEposConnection(host: string): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.isEposSdkAvailable()) {
        reject(new Error('Epson ePOS SDK not loaded — place epos-sdk.js in src/assets/'));
        return;
      }
      const ePosDev = new (window as any).epson.ePOSDevice();
      ePosDev.connect(host, 8008, (result: string) => {
        if (result === 'OK' || result === 'SSL_CONNECT_OK') { ePosDev.disconnect(); resolve(); }
        else reject(new Error(`Cannot reach printer at ${host}:8008 — ${result}`));
      });
    });
  }

  private sendBytesEpos(host: string, data: Uint8Array, label: string): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.isEposSdkAvailable()) {
        reject(new Error('Epson ePOS SDK not loaded — WiFi printing unavailable in browser'));
        return;
      }
      this.statusSubject.next('connecting');
      const ePosDev = new (window as any).epson.ePOSDevice();
      ePosDev.connect(host, 8008, (connectResult: string) => {
        if (connectResult !== 'OK' && connectResult !== 'SSL_CONNECT_OK') {
          this.statusSubject.next('error');
          setTimeout(() => this.statusSubject.next('idle'), 4000);
          reject(new Error(`ePOS connect failed for ${host}: ${connectResult}`));
          return;
        }
        ePosDev.createDevice('local_printer', ePosDev.DEVICE_TYPE_PRINTER,
          { crypto: false, buffer: false },
          (printer: any, createCode: string) => {
            if (createCode !== 'OK' || !printer) {
              this.statusSubject.next('error');
              setTimeout(() => this.statusSubject.next('idle'), 4000);
              ePosDev.disconnect();
              reject(new Error(`ePOS createDevice failed: ${createCode}`));
              return;
            }
            this.statusSubject.next('printing');
            printer.onreceive = (res: { success: boolean; code: string }) => {
              ePosDev.deleteDevice(printer, () => ePosDev.disconnect());
              if (res.success) { this.statusSubject.next('success'); resolve(); }
              else { this.statusSubject.next('error'); reject(new Error(`ePOS print failed: ${res.code}`)); }
              setTimeout(() => this.statusSubject.next('idle'), 4000);
            };
            printer.addCommand(data);
            printer.send();
          }
        );
      });
    });
  }

  // ── Platform helpers ───────────────────────────────────────────────────────

  /** True when running inside the Electron desktop app (window.printerAPI present). */
  isElectronApp(): boolean {
    return typeof (window as any).printerAPI !== 'undefined';
  }

  isNativeApp(): boolean {
    return Capacitor.isNativePlatform();
  }
}
