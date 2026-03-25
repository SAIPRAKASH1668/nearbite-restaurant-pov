import { Injectable } from '@angular/core';
import { Order } from '../models/order.model';

// ── ESC/POS byte constants ───────────────────────────────────────────────────
const ESC = 0x1B;
const GS  = 0x1D;

const CMD = {
  INIT:          [ESC, 0x40],
  ALIGN_LEFT:    [ESC, 0x61, 0x00],
  ALIGN_CENTER:  [ESC, 0x61, 0x01],
  ALIGN_RIGHT:   [ESC, 0x61, 0x02],
  BOLD_ON:       [ESC, 0x45, 0x01],
  BOLD_OFF:      [ESC, 0x45, 0x00],
  SIZE_NORMAL:   [GS,  0x21, 0x00],
  SIZE_DOUBLE_H: [GS,  0x21, 0x01],   // double height only
  SIZE_DOUBLE:   [GS,  0x21, 0x11],   // double width + height
  LF:            [0x0A],
  FEED_3:        [ESC, 0x64, 0x03],
  FEED_5:        [ESC, 0x64, 0x05],
  CUT:           [GS,  0x56, 0x42, 0x00],  // partial cut
};

/** Supported paper widths (mm). 80mm = 48 chars, 58mm = 32 chars at 12 CPI. */
export type PaperWidth = 58 | 80;
const CHARS_BY_WIDTH: Record<PaperWidth, number> = { 80: 48, 58: 32 };

@Injectable({ providedIn: 'root' })
export class EscPosService {

  private paperWidth: PaperWidth = 80;
  private get CHARS(): number { return CHARS_BY_WIDTH[this.paperWidth]; }

  /** Call once at startup and whenever the user changes paper width. */
  setPaperWidth(w: PaperWidth): void {
    this.paperWidth = w;
  }

  // ── Public API ─────────────────────────────────────────────────────────────

  /** Diagnostic test page — verifies printer connectivity and alignment. */
  formatTestPage(): Uint8Array {
    const CHARS = this.CHARS;
    const buf: number[] = [];
    const append = (...cmds: number[][]) => cmds.forEach(c => buf.push(...c));
    const text   = (s: string) => buf.push(...this.encode(s));
    const line   = () => append(CMD.LF);

    append(CMD.INIT, CMD.ALIGN_CENTER, CMD.BOLD_ON, CMD.SIZE_DOUBLE);
    text('TEST PAGE'); line();
    append(CMD.SIZE_NORMAL, CMD.BOLD_OFF);
    line();

    append(CMD.ALIGN_LEFT);
    text(`Paper width : ${this.paperWidth}mm`); line();
    text(`Char/line   : ${CHARS}`); line();
    text(`Printer     : Nearbite POS`); line();
    text(`Time        : ${this.formatTime(new Date().toISOString())}`); line();
    line();

    // Ruler
    append(CMD.BOLD_ON);
    text('0         1         2         3         4       '.substring(0, CHARS)); line();
    text('0123456789012345678901234567890123456789012345678'.substring(0, CHARS)); line();
    append(CMD.BOLD_OFF);
    text('-'.repeat(CHARS)); line();
    line();

    // Font samples
    text('Normal text sample'); line();
    append(CMD.BOLD_ON);
    text('Bold text sample'); line();
    append(CMD.BOLD_OFF, CMD.SIZE_DOUBLE_H);
    text('Double-height'); line();
    append(CMD.SIZE_NORMAL);
    text('-'.repeat(CHARS)); line();

    append(CMD.ALIGN_CENTER);
    text('** Printer OK **'); line();

    append(CMD.FEED_5, CMD.CUT);
    return new Uint8Array(buf);
  }

  formatKOT(order: Order): Uint8Array {
    const CHARS = this.CHARS;
    const buf: number[] = [];

    const append = (...cmds: number[][]) => cmds.forEach(c => buf.push(...c));
    const text   = (s: string) => buf.push(...this.encode(s));
    const line   = () => append(CMD.LF);

    // Init
    append(CMD.INIT, CMD.ALIGN_CENTER, CMD.BOLD_ON, CMD.SIZE_DOUBLE);
    text('KOT'); line();
    append(CMD.SIZE_NORMAL, CMD.BOLD_OFF);
    line();

    // YumDude branding
    append(CMD.BOLD_ON, CMD.SIZE_DOUBLE);
    text('YumDude'); line();
    append(CMD.SIZE_NORMAL);
    text('X'); line();
    append(CMD.BOLD_OFF);

    // Restaurant
    append(CMD.BOLD_ON);
    text(this.trim(order.restaurantName || 'Restaurant', CHARS)); line();
    append(CMD.BOLD_OFF);

    text('-'.repeat(CHARS)); line();

    // Order meta
    append(CMD.ALIGN_LEFT);
    text(`Order  : #${order.orderId.toUpperCase()}`); line();
    text(`Time   : ${this.formatTime(order.createdAt)}`);       line();

    text('-'.repeat(CHARS)); line();

    // Items
    append(CMD.BOLD_ON);
    text(this.padRight('ITEM', CHARS - 8) + this.padLeft('QTY', 8)); line();
    append(CMD.BOLD_OFF);
    text('-'.repeat(CHARS)); line();

    order.items.forEach(item => {
      const qty   = `x${item.quantity}`;
      const name  = this.trim(item.name, CHARS - qty.length - 1);
      text(this.padRight(name, CHARS - qty.length) + qty); line();
      // Print notes/modifiers if present
      if ((item as any).notes) {
        text('  >> ' + this.trim((item as any).notes, CHARS - 5)); line();
      }
    });

    text('-'.repeat(CHARS)); line();
    text('='.repeat(CHARS)); line();
    append(CMD.ALIGN_CENTER, CMD.BOLD_ON);
    text('** KITCHEN COPY **'); line();
    append(CMD.BOLD_OFF);

    append(CMD.FEED_5, CMD.CUT);

    return new Uint8Array(buf);
  }

  formatBill(order: Order): Uint8Array {
    const CHARS = this.CHARS;
    const buf: number[] = [];

    const append = (...cmds: number[][]) => cmds.forEach(c => buf.push(...c));
    const text   = (s: string) => buf.push(...this.encode(s));
    const line   = () => append(CMD.LF);

    // Init — YumDude branding
    append(CMD.INIT, CMD.ALIGN_CENTER, CMD.BOLD_ON, CMD.SIZE_DOUBLE);
    text('YumDude'); line();
    append(CMD.SIZE_NORMAL);
    text('X'); line();
    append(CMD.BOLD_OFF);

    // Restaurant name
    append(CMD.BOLD_ON, CMD.SIZE_DOUBLE);
    text(this.trim(order.restaurantName || 'Restaurant', CHARS - 4)); line();
    append(CMD.SIZE_NORMAL);
    text('TAX INVOICE'); line();
    append(CMD.BOLD_OFF);
    line();

    text('-'.repeat(CHARS)); line();

    // Order meta
    append(CMD.ALIGN_LEFT);
    text(`Order  : #${order.orderId.toUpperCase()}`);              line();
    text(`Date   : ${this.formatDate(order.createdAt)}`);          line();
    text(`Time   : ${this.formatTime(order.createdAt)}`);          line();

    text('-'.repeat(CHARS)); line();

    // Items header
    const qtyW   = 5;
    const priceW = CHARS <= 32 ? 8 : 12;
    const nameW  = CHARS - qtyW - priceW;
    append(CMD.BOLD_ON);
    text(this.padRight('ITEM', nameW) + this.padLeft('QTY', qtyW) + this.padLeft('AMT', priceW)); line();
    append(CMD.BOLD_OFF);
    text('-'.repeat(CHARS)); line();

    // Items
    order.items.forEach(item => {
      const name  = this.padRight(this.trim(item.name, nameW), nameW);
      const qty   = this.padLeft(`x${item.quantity}`, qtyW);
      const amt   = this.padLeft(`${(item.price * item.quantity).toFixed(0)}`, priceW);
      text(name + qty + amt); line();
    });

    text('-'.repeat(CHARS)); line();

    // Totals
    text(this.twoCol('Food Total',    `${order.foodTotal.toFixed(2)}`,    CHARS)); line();
    text(this.twoCol('Delivery',      `${order.deliveryFee.toFixed(2)}`,  CHARS)); line();
    text(this.twoCol('Platform Fee',  `${order.platformFee.toFixed(2)}`,  CHARS)); line();
    text('='.repeat(CHARS)); line();

    append(CMD.BOLD_ON);
    text(this.twoCol('GRAND TOTAL', `Rs.${order.grandTotal.toFixed(2)}`, CHARS)); line();
    append(CMD.BOLD_OFF);

    text('-'.repeat(CHARS)); line();

    // OTP if present
    if (order.deliveryOtp) {
      append(CMD.ALIGN_CENTER, CMD.BOLD_ON);
      text(`Delivery OTP: ${order.deliveryOtp}`); line();
      append(CMD.BOLD_OFF, CMD.ALIGN_LEFT);
    }

    // Payment mode
    if ((order as any).paymentMode) {
      text(`Payment: ${(order as any).paymentMode}`); line();
      text('-'.repeat(CHARS)); line();
    }

    // Footer
    line();
    append(CMD.ALIGN_CENTER);
    text('Thank you for your order!'); line();
    text('www.yumdude.com'); line();
    line();

    append(CMD.FEED_5, CMD.CUT);

    return new Uint8Array(buf);
  }

  // ── Debug: convert bytes back to readable text for console ────────────────
  toDebugString(bytes: Uint8Array): string {
    let out = '';
    for (let i = 0; i < bytes.length; i++) {
      const b = bytes[i];
      if (b === 0x0A) {
        out += '\n';
      } else if (b >= 0x20 && b < 0x7F) {
        out += String.fromCharCode(b);
      } else if (b === 0x1B || b === 0x1D) {
        i += 2; // skip ESC/GS command bytes
      }
      // skip other control bytes
    }
    return out;
  }

  // ── Helpers ────────────────────────────────────────────────────────────────

  private encode(s: string): number[] {
    return Array.from(s).map(c => c.charCodeAt(0) & 0xFF);
  }

  private padRight(s: string, width: number): string {
    return s.substring(0, width).padEnd(width);
  }

  private padLeft(s: string, width: number): string {
    return s.substring(0, width).padStart(width);
  }

  private trim(s: string, max: number): string {
    return s.length > max ? s.substring(0, max - 1) + '~' : s;
  }

  private twoCol(left: string, right: string, width: number): string {
    const r = right.substring(0, width - 1);
    const l = left.substring(0, width - r.length - 1);
    return l.padEnd(width - r.length) + r;
  }

  private wrap(s: string, width: number, indent: string): string {
    if (s.length <= width) return s;
    return s.substring(0, width) + '\n' + indent + s.substring(width, width * 2);
  }

  private formatTime(iso: string): string {
    try {
      return new Date(iso).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
    } catch { return iso; }
  }

  private formatDate(iso: string): string {
    try {
      return new Date(iso).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
    } catch { return iso; }
  }
}
