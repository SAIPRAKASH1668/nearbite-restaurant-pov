import { Component, OnInit, OnDestroy, NgZone, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Subscription } from 'rxjs';
import { PrinterService, PrinterDevice, PrintStatus, PaperWidth, UsbDevice } from '../../core/services/printer.service';
import { Order, OrderStatus } from '../../core/models/order.model';

type ScanError =
  | 'PERMISSIONS_DENIED'
  | 'BLUETOOTH_DISABLED'
  | 'SCAN_FAILED'
  | 'UNKNOWN';

@Component({
  selector: 'app-printer-settings',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './printer-settings.component.html',
  styleUrl: './printer-settings.component.scss'
})
export class PrinterSettingsComponent implements OnInit, OnDestroy {

  // ── Paper width & print status ─────────────────────────────────────────────
  paperWidth:  PaperWidth  = 80;
  printStatus: PrintStatus = 'idle';

  // ── KOT / Bill pools ───────────────────────────────────────────────────────
  kotPrinters:    PrinterDevice[] = [];
  vegKotPrinters: PrinterDevice[] = [];
  nonVegKotPrinters: PrinterDevice[] = [];
  billPrinters:   PrinterDevice[] = [];

  // ── Bluetooth scan state ───────────────────────────────────────────────────
  btDevices:  PrinterDevice[] = [];
  btScanning  = false;
  btScanDone  = false;
  btScanError: ScanError | null = null;

  // ── USB scan state ─────────────────────────────────────────────────────────
  usbDevices:   UsbDevice[] = [];
  usbScanning   = false;
  usbScanDone   = false;
  usbScanError: string | null = null;

  // ── Network / WiFi printer form ────────────────────────────────────────────
  netName    = '';
  netHost    = '';
  netPort    = 9100;
  netTesting = false;
  netTestOk: boolean | null = null;
  netError: string | null   = null;

  // ── Per-device test state ──────────────────────────────────────────────────
  testingAddress: string | null = null;
  testResults = new Map<string, 'success' | 'error'>();
  // ── Bluetooth connection test state (scanned device check) ───────────
  btTestingAddress: string | null = null;
  btTestResults = new Map<string, 'success' | 'error'>();
  private statusSub?: Subscription;

  // ── Lifecycle ──────────────────────────────────────────────────────────────
  constructor(
    public  printerService: PrinterService,
    private zone: NgZone,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.paperWidth = this.printerService.getPaperWidth();
    this.refreshPools();
    this.statusSub = this.printerService.status$.subscribe(s => {
      this.printStatus = s;
    });
  }

  ngOnDestroy(): void {
    this.statusSub?.unsubscribe();
  }

  // ── Pool sync ──────────────────────────────────────────────────────────────

  refreshPools(): void {
    this.kotPrinters       = this.printerService.getKotPrinters();
    this.vegKotPrinters    = this.printerService.getVegKotPrinters();
    this.nonVegKotPrinters = this.printerService.getNonVegKotPrinters();
    this.billPrinters      = this.printerService.getBillPrinters();
  }

  // ── Paper width ────────────────────────────────────────────────────────────

  selectPaperWidth(w: PaperWidth): void {
    this.paperWidth = w;
    this.printerService.savePaperWidth(w);
  }

  // ── Bluetooth scan ─────────────────────────────────────────────────────────

  async scanBt(): Promise<void> {
    this.btScanning  = true;
    this.btScanDone  = false;
    this.btScanError = null;
    this.btDevices   = [];    this.btTestResults.clear();
    this.btTestingAddress = null;
    try {
      const devices = await this.printerService.scanPairedDevices();
      this.zone.run(() => {
        this.btDevices  = devices;
        this.btScanning = false;
        this.btScanDone = true;
        this.cdr.detectChanges();
      });
    } catch (e: any) {
      const code: string = e?.message || '';
      this.zone.run(() => {
        if      (code === 'PERMISSIONS_DENIED')  this.btScanError = 'PERMISSIONS_DENIED';
        else if (code === 'BLUETOOTH_DISABLED')  this.btScanError = 'BLUETOOTH_DISABLED';
        else if (code === 'SCAN_FAILED')         this.btScanError = 'SCAN_FAILED';
        else                                     this.btScanError = 'UNKNOWN';
        this.btDevices  = [];
        this.btScanning = false;
        this.btScanDone = true;
        this.cdr.detectChanges();
      });
    }
  }

  // ── USB scan ───────────────────────────────────────────────────────────────

  async scanUsb(): Promise<void> {
    this.usbScanning  = true;
    this.usbScanDone  = false;
    this.usbScanError = null;
    this.usbDevices   = [];
    try {
      const devices = await this.printerService.scanUsbDevices();
      this.zone.run(() => {
        this.usbDevices  = devices;
        this.usbScanning = false;
        this.usbScanDone = true;
        this.cdr.detectChanges();
      });
    } catch (e: any) {
      this.zone.run(() => {
        this.usbScanError = e?.message === 'USB_SCAN_FAILED'
          ? 'Failed to read USB devices. Make sure USB Host is supported on this device.'
          : (e?.message || 'Unknown error');
        this.usbScanning = false;
        this.usbScanDone = true;
        this.cdr.detectChanges();
      });
    }
  }

  // ── Add / Remove from pools ────────────────────────────────────────────────

  addToKot(device: PrinterDevice): void {
    this.printerService.addKotPrinter(device);
    this.refreshPools();
  }

  addToVegKot(device: PrinterDevice): void {
    this.printerService.addVegKotPrinter(device);
    this.refreshPools();
  }

  addToNonVegKot(device: PrinterDevice): void {
    this.printerService.addNonVegKotPrinter(device);
    this.refreshPools();
  }

  addToBill(device: PrinterDevice): void {
    this.printerService.addBillPrinter(device);
    this.refreshPools();
  }

  addUsbToKot(device: UsbDevice): void {
    this.printerService.addKotPrinter({ name: device.productName || 'USB Printer', address: device.deviceName, type: 'usb' });
    this.refreshPools();
  }

  addUsbToVegKot(device: UsbDevice): void {
    this.printerService.addVegKotPrinter({ name: device.productName || 'USB Printer', address: device.deviceName, type: 'usb' });
    this.refreshPools();
  }

  addUsbToNonVegKot(device: UsbDevice): void {
    this.printerService.addNonVegKotPrinter({ name: device.productName || 'USB Printer', address: device.deviceName, type: 'usb' });
    this.refreshPools();
  }

  addUsbToBill(device: UsbDevice): void {
    this.printerService.addBillPrinter({ name: device.productName || 'USB Printer', address: device.deviceName, type: 'usb' });
    this.refreshPools();
  }

  // ── Network / WiFi printer ─────────────────────────────────────────────────

  get isNetworkFormValid(): boolean {
    return this.netHost.trim().length > 0 && this.netPort > 0 && this.netPort < 65536;
  }

  addNetworkToKot(): void {
    if (!this.isNetworkFormValid) { this.netError = 'Enter a valid IP address and port.'; return; }
    this.printerService.addKotPrinter({
      name:    this.netName.trim() || this.netHost.trim(),
      address: this.netHost.trim(),
      type:    'network',
      port:    this.netPort,
    });
    this.refreshPools();
    this.netError = null;
  }

  addNetworkToVegKot(): void {
    if (!this.isNetworkFormValid) { this.netError = 'Enter a valid IP address and port.'; return; }
    this.printerService.addVegKotPrinter({
      name:    this.netName.trim() || this.netHost.trim(),
      address: this.netHost.trim(),
      type:    'network',
      port:    this.netPort,
    });
    this.refreshPools();
    this.netError = null;
  }

  addNetworkToNonVegKot(): void {
    if (!this.isNetworkFormValid) { this.netError = 'Enter a valid IP address and port.'; return; }
    this.printerService.addNonVegKotPrinter({
      name:    this.netName.trim() || this.netHost.trim(),
      address: this.netHost.trim(),
      type:    'network',
      port:    this.netPort,
    });
    this.refreshPools();
    this.netError = null;
  }

  addNetworkToBill(): void {
    if (!this.isNetworkFormValid) { this.netError = 'Enter a valid IP address and port.'; return; }
    this.printerService.addBillPrinter({
      name:    this.netName.trim() || this.netHost.trim(),
      address: this.netHost.trim(),
      type:    'network',
      port:    this.netPort,
    });
    this.refreshPools();
    this.netError = null;
  }

  async testNetworkConnection(): Promise<void> {
    if (!this.isNetworkFormValid || this.netTesting) return;
    this.netTesting = true;
    this.netTestOk  = null;
    this.netError   = null;
    try {
      await this.printerService.testNetworkConnection(this.netHost.trim(), this.netPort);
      this.zone.run(() => { this.netTestOk = true; this.cdr.detectChanges(); });
    } catch (e: any) {
      this.zone.run(() => {
        this.netTestOk = false;
        this.netError  = e?.message || 'Could not reach printer.';
        this.cdr.detectChanges();
      });
    } finally {
      this.netTesting = false;
      this.cdr.detectChanges();
    }
  }

  removeKot(address: string): void {
    this.printerService.removeKotPrinter(address);
    this.refreshPools();
  }

  removeVegKot(address: string): void {
    this.printerService.removeVegKotPrinter(address);
    this.refreshPools();
  }

  removeNonVegKot(address: string): void {
    this.printerService.removeNonVegKotPrinter(address);
    this.refreshPools();
  }

  removeBill(address: string): void {
    this.printerService.removeBillPrinter(address);
    this.refreshPools();
  }

  isInKot(address: string): boolean {
    return this.kotPrinters.some(p => p.address === address);
  }

  isInVegKot(address: string): boolean {
    return this.vegKotPrinters.some(p => p.address === address);
  }

  isInNonVegKot(address: string): boolean {
    return this.nonVegKotPrinters.some(p => p.address === address);
  }

  isInBill(address: string): boolean {
    return this.billPrinters.some(p => p.address === address);
  }

  // ── Per-device test print ──────────────────────────────────────────────────

  async testOn(device: PrinterDevice): Promise<void> {
    if (this.testingAddress) return;
    this.testingAddress = device.address;
    this.testResults.delete(device.address);
    try {
      await this.printerService.testPrintOn(device);
      this.zone.run(() => { this.testResults.set(device.address, 'success'); this.cdr.detectChanges(); });
    } catch {
      this.zone.run(() => { this.testResults.set(device.address, 'error'); this.cdr.detectChanges(); });
    } finally {
      this.testingAddress = null;
      setTimeout(() => { this.testResults.delete(device.address); this.cdr.detectChanges(); }, 5000);
      this.cdr.detectChanges();
    }
  }

  // ── Bluetooth connection test (scanned devices, no data sent) ──────────

  async testBtConnection(device: PrinterDevice): Promise<void> {
    if (this.btTestingAddress) return;
    this.btTestingAddress = device.address;
    this.btTestResults.delete(device.address);
    this.cdr.detectChanges();
    try {
      await this.printerService.testBluetoothConnection(device.address);
      this.zone.run(() => {
        this.btTestResults.set(device.address, 'success');
        this.btTestingAddress = null;
        this.cdr.detectChanges();
      });
    } catch {
      this.zone.run(() => {
        this.btTestResults.set(device.address, 'error');
        this.btTestingAddress = null;
        this.cdr.detectChanges();
      });
    } finally {
      setTimeout(() => { this.btTestResults.delete(device.address); this.cdr.detectChanges(); }, 5000);
    }
  }

  isBtTesting(address: string): boolean {
    return this.btTestingAddress === address;
  }

  btTestResult(address: string): 'success' | 'error' | null {
    return this.btTestResults.get(address) ?? null;
  }

  isTesting(address: string): boolean {
    return this.testingAddress === address;
  }

  testResult(address: string): 'success' | 'error' | null {
    return this.testResults.get(address) ?? null;
  }

  // ── Quick Test buttons (Electron printerAPI + service) ────────────────────

  /** Asks Electron main process to focus/open the printer settings window. */
  callOpenSettings(): void {
    (window as any).printerAPI?.openSettings();
  }

  /** Prints a mock Bill with sample items on all Bill printers. */
  async callPrintBill(): Promise<void> {
    const printers = this.printerService.getBillPrinters();
    if (printers.length === 0) { alert('No Bill printers configured.'); return; }
    await this.printerService.printOrderAccepted(this.buildMockOrder()).catch(e => console.error('Test Bill failed', e));
  }

  /** Prints a mock KOT with sample items on all KOT printers. */
  async callPrintKOT(): Promise<void> {
    const hasKot = this.printerService.getKotPrinters().length > 0
               || this.printerService.getVegKotPrinters().length > 0
               || this.printerService.getNonVegKotPrinters().length > 0;
    if (!hasKot) { alert('No KOT printers configured.'); return; }
    await this.printerService.printOrderAccepted(this.buildMockOrder()).catch(e => console.error('Test KOT failed', e));
  }

  /** Builds a realistic mock order for test printing. */
  private buildMockOrder(): Order {
    return {
      orderId:          'TEST' + Date.now().toString(36).toUpperCase(),
      customerPhone:    '+91 98765 43210',
      restaurantId:     'rest-mock-001',
      restaurantName:   'NearBite Kitchen',
      restaurantImage:  '',
      items: [
        { itemId: 'i1', name: 'Butter Chicken',      quantity: 2, price: 320, isVeg: false },
        { itemId: 'i2', name: 'Garlic Naan',          quantity: 4, price: 60,  isVeg: true  },
        { itemId: 'i3', name: 'Paneer Tikka Masala',  quantity: 1, price: 280, isVeg: true  },
        { itemId: 'i4', name: 'Veg Biryani',          quantity: 1, price: 220, isVeg: true  },
        { itemId: 'i5', name: 'Gulab Jamun (2 pcs)',   quantity: 2, price: 80,  isVeg: true  },
      ],
      foodTotal:        1400,
      deliveryFee:      40,
      platformFee:      25,
      grandTotal:       1465,
      status:           OrderStatus.ACCEPTED,
      riderId:          null,
      createdAt:        new Date().toISOString(),
      deliveryAddress:  'Flat 302, Sunshine Apartments, MG Road',
      formattedAddress: 'Flat 302, Sunshine Apartments, MG Road, Bengaluru 560001',
      addressId:        'addr-mock-001',
      deliveryOtp:      '4829',
      pickupOtp:        '7312',
    };
  }

  get printerAPIAvailable(): boolean {
    return this.printerService.isElectronApp();
  }

  // ── Helpers ────────────────────────────────────────────────────────────────

  get isNativeApp(): boolean {
    return this.printerService.isNativeApp();
  }

  get statusBadgeClass(): string {
    switch (this.printStatus) {
      case 'connecting': return 'badge--warn';
      case 'printing':   return 'badge--warn';
      case 'success':    return 'badge--ok';
      case 'error':      return 'badge--error';
      default:           return 'badge--idle';
    }
  }

  get statusLabel(): string {
    switch (this.printStatus) {
      case 'connecting': return 'Connecting...';
      case 'printing':   return 'Printing...';
      case 'success':    return 'Print OK';
      case 'error':      return 'Print Failed';
      default:           return 'Ready';
    }
  }
}
