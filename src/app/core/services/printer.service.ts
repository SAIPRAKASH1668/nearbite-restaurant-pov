import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { Order } from '../models/order.model';
import { EscPosService, PaperWidth } from './escpos.service';
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

const STORAGE_KEY_PRINTER     = 'nearbite_printer_address';
const STORAGE_KEY_PRINTER_NAME = 'nearbite_printer_name';
const STORAGE_KEY_PAPER_WIDTH  = 'nearbite_paper_width';

/** Timeout for a single BT connect or write call (ms) */
const PRINT_TIMEOUT_MS = 15_000;
/** BT write chunk size — keeps us below typical BT SPP MTU */
const WRITE_CHUNK_BYTES = 512;

export interface PrinterDevice {
  name: string;
  address: string;
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

  constructor(private escpos: EscPosService) {
    // Apply saved paper width on startup so ESC/POS byte counts are correct
    this.escpos.setPaperWidth(this.getPaperWidth());
  }

  // ── Saved printer ──────────────────────────────────────────────────────────

  getSavedPrinter(): PrinterDevice | null {
    const address = localStorage.getItem(STORAGE_KEY_PRINTER);
    const name    = localStorage.getItem(STORAGE_KEY_PRINTER_NAME);
    if (!address) return null;
    return { address, name: name || address };
  }

  savePrinter(device: PrinterDevice): void {
    localStorage.setItem(STORAGE_KEY_PRINTER, device.address);
    localStorage.setItem(STORAGE_KEY_PRINTER_NAME, device.name);
  }

  clearSavedPrinter(): void {
    localStorage.removeItem(STORAGE_KEY_PRINTER);
    localStorage.removeItem(STORAGE_KEY_PRINTER_NAME);
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
      const fakes: PrinterDevice[] = [
        { name: 'XP-58 (Browser Preview)',        address: '00:11:22:33:44:55' },
        { name: 'Epson TM-T20 (Browser Preview)',  address: 'AA:BB:CC:DD:EE:FF' },
      ];
      this.pairedDevicesSubject.next(fakes);
      return fakes;
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

  // ── Test print ─────────────────────────────────────────────────────────────

  /**
   * Sends a test page to the saved printer to verify connectivity.
   * Throws 'NO_PRINTER' if no printer has been configured.
   */
  async testPrint(): Promise<void> {
    if (!this.isNativeApp()) {
      console.group('%c🖨️  TEST PRINT', 'color: #ff6b35; font-weight: bold;');
      console.log(this.escpos.toDebugString(this.escpos.formatTestPage()));
      console.groupEnd();
      console.info('ℹ️  Running in browser — actual Bluetooth print only works in the Android app.');
      this.statusSubject.next('success');
      setTimeout(() => this.statusSubject.next('idle'), 3000);
      return;
    }

    const printer = this.getSavedPrinter();
    if (!printer) throw new Error('NO_PRINTER');

    this.escpos.setPaperWidth(this.getPaperWidth());
    await this.sendBytes(printer.address, this.escpos.formatTestPage(), 'Test Page');
  }

  // ── Auto-print KOT + Bill on order accept ─────────────────────────────────

  /**
   * Prints KOT (kitchen copy) and customer Bill when an order is accepted.
   * Silently skips if no printer is configured.
   * Each document is sent as a separate BT connection for maximum compatibility.
   */
  async printOrderAccepted(order: Order): Promise<void> {
    this.escpos.setPaperWidth(this.getPaperWidth());
    const kot  = this.escpos.formatKOT(order);
    const bill = this.escpos.formatBill(order);

    if (!this.isNativeApp()) {
      console.group(`%c🖨️  KOT — Order #${order.orderId.slice(-8).toUpperCase()}`, 'color: #ff6b35; font-weight: bold;');
      console.log(this.escpos.toDebugString(kot));
      console.groupEnd();
      console.group(`%c🧾 BILL — Order #${order.orderId.slice(-8).toUpperCase()}`, 'color: #2ecc71; font-weight: bold;');
      console.log(this.escpos.toDebugString(bill));
      console.groupEnd();
      console.info('ℹ️  PrinterService: Running in browser — Bluetooth printing only works in the Android app.');
      this.statusSubject.next('success');
      setTimeout(() => this.statusSubject.next('idle'), 3000);
      return;
    }

    const printer = this.getSavedPrinter();
    if (!printer) {
      console.warn('PrinterService: no printer configured — skipping print.');
      return;
    }

    if (this.printInProgress) {
      console.warn('PrinterService: another print is in progress — skipping.');
      return;
    }

    this.printInProgress = true;
    try {
      await this.sendBytes(printer.address, kot,  'KOT');
      await this.sendBytes(printer.address, bill, 'Bill');
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

  // ── Platform helpers ───────────────────────────────────────────────────────

  isNativeApp(): boolean {
    return Capacitor.isNativePlatform();
  }
}
