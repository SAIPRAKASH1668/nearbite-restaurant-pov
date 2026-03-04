import { Component, OnInit, OnDestroy, NgZone, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Subscription } from 'rxjs';
import { PrinterService, PrinterDevice, PrintStatus, PaperWidth } from '../../core/services/printer.service';

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

  // ── State ──────────────────────────────────────────────────────────────────
  devices:      PrinterDevice[]  = [];
  savedPrinter: PrinterDevice | null = null;
  paperWidth:   PaperWidth       = 80;

  scanning    = false;
  scanDone    = false;
  scanError:  ScanError | null  = null;

  testPrinting  = false;
  testSuccess   = false;
  testError     = false;

  printStatus: PrintStatus = 'idle';

  private statusSub?: Subscription;

  // ── Lifecycle ──────────────────────────────────────────────────────────────
  constructor(
    public  printerService: PrinterService,
    private zone: NgZone,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.savedPrinter = this.printerService.getSavedPrinter();
    this.paperWidth   = this.printerService.getPaperWidth();

    this.statusSub = this.printerService.status$.subscribe(s => {
      this.printStatus = s;
    });
  }

  ngOnDestroy(): void {
    this.statusSub?.unsubscribe();
  }

  // ── Paper width ────────────────────────────────────────────────────────────

  selectPaperWidth(w: PaperWidth): void {
    this.paperWidth = w;
    this.printerService.savePaperWidth(w);
  }

  // ── Bluetooth scan ─────────────────────────────────────────────────────────

  async scan(): Promise<void> {
    this.scanning  = true;
    this.scanDone  = false;
    this.scanError = null;
    this.devices   = [];

    try {
      const devices = await this.printerService.scanPairedDevices();
      // Use NgZone.run() to ensure Angular change detection fires after the
      // native Capacitor callback resolves (app pause/resume for permission dialog
      // can take the resolution outside Angular's zone).
      this.zone.run(() => {
        this.devices  = devices;
        this.scanning = false;
        this.scanDone = true;
        this.cdr.detectChanges();
      });
    } catch (e: any) {
      const code: string = e?.message || '';
      this.zone.run(() => {
        if      (code === 'PERMISSIONS_DENIED')  this.scanError = 'PERMISSIONS_DENIED';
        else if (code === 'BLUETOOTH_DISABLED')  this.scanError = 'BLUETOOTH_DISABLED';
        else if (code === 'SCAN_FAILED')         this.scanError = 'SCAN_FAILED';
        else                                     this.scanError = 'UNKNOWN';
        this.devices  = [];
        this.scanning = false;
        this.scanDone = true;
        this.cdr.detectChanges();
      });
    }
  }

  // ── Printer selection ──────────────────────────────────────────────────────

  selectDevice(device: PrinterDevice): void {
    this.printerService.savePrinter(device);
    this.savedPrinter = device;
  }

  clearPrinter(): void {
    this.printerService.clearSavedPrinter();
    this.savedPrinter = null;
    this.testSuccess  = false;
    this.testError    = false;
  }

  isSelected(device: PrinterDevice): boolean {
    return this.savedPrinter?.address === device.address;
  }

  // ── Test print ─────────────────────────────────────────────────────────────

  async doTestPrint(): Promise<void> {
    if (this.testPrinting) return;
    this.testPrinting = true;
    this.testSuccess  = false;
    this.testError    = false;

    try {
      await this.printerService.testPrint();
      this.testSuccess = true;
    } catch (e: any) {
      this.testError = true;
      console.error('Test print failed:', e?.message);
    } finally {
      this.testPrinting = false;
      setTimeout(() => {
        this.testSuccess = false;
        this.testError   = false;
      }, 5000);
    }
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
      case 'connecting': return 'Connecting…';
      case 'printing':   return 'Printing…';
      case 'success':    return 'Print OK';
      case 'error':      return 'Print Failed';
      default:           return 'Ready';
    }
  }
}
