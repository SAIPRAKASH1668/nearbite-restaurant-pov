import { Component, OnInit, OnDestroy, NgZone, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Subscription } from 'rxjs';
import { PrinterService, PrinterDevice, PrintStatus, PaperWidth, UsbDevice } from '../../core/services/printer.service';

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
  kotPrinters:  PrinterDevice[] = [];
  billPrinters: PrinterDevice[] = [];

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
    this.kotPrinters  = this.printerService.getKotPrinters();
    this.billPrinters = this.printerService.getBillPrinters();
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
    this.btDevices   = [];

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

  addToBill(device: PrinterDevice): void {
    this.printerService.addBillPrinter(device);
    this.refreshPools();
  }

  addUsbToKot(device: UsbDevice): void {
    this.printerService.addKotPrinter({ name: device.productName || 'USB Printer', address: device.deviceName, type: 'usb' });
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
      this.netTestOk = true;
    } catch (e: any) {
      this.netTestOk = false;
      this.netError  = e?.message || 'Could not reach printer.';
    } finally {
      this.netTesting = false;
      this.cdr.detectChanges();
    }
  }

  removeKot(address: string): void {
    this.printerService.removeKotPrinter(address);
    this.refreshPools();
  }

  removeBill(address: string): void {
    this.printerService.removeBillPrinter(address);
    this.refreshPools();
  }

  isInKot(address: string): boolean {
    return this.kotPrinters.some(p => p.address === address);
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
      this.testResults.set(device.address, 'success');
    } catch {
      this.testResults.set(device.address, 'error');
    } finally {
      this.testingAddress = null;
      setTimeout(() => { this.testResults.delete(device.address); this.cdr.detectChanges(); }, 5000);
      this.cdr.detectChanges();
    }
  }

  isTesting(address: string): boolean {
    return this.testingAddress === address;
  }

  testResult(address: string): 'success' | 'error' | null {
    return this.testResults.get(address) ?? null;
  }

  // ── Helpers ────────────────────────────────────────────────────────────────

  // ── printerAPI test buttons (Electron / native bridge) ──────────────────

  callOpenSettings(): void {
    (window as any).printerAPI?.openSettings();
  }

  callPrintBill(): void {
    (window as any).printerAPI?.printBill();
  }

  callPrintKOT(): void {
    (window as any).printerAPI?.printKOT();
  }

  get printerAPIAvailable(): boolean {
    return typeof (window as any).printerAPI !== 'undefined';
  }

  // ── Helpers ────────────────────────────────────────────────────────────────

  get isNativeApp(): boolean {
    return this.printerService.isNativeApp();
  }

  get eposSdkAvailable(): boolean {
    return this.printerService.isEposSdkAvailable();
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
