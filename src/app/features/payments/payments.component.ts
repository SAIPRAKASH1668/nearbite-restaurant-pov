import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  SettlementService,
  SettlementPreview,
  SettlementOrderRow,
} from '../../core/services/settlement.service';
import { RestaurantContextService } from '../../core/services/restaurant-context.service';
import { NotificationService } from '../../shared/components/notification/notification.service';
import { NotificationType } from '../../shared/components/notification/notification.model';
import { OrderIdHighlightPipe } from '../../shared/pipes/order-id-highlight.pipe';

@Component({
  selector: 'app-payments',
  standalone: true,
  imports: [CommonModule, FormsModule, OrderIdHighlightPipe],
  templateUrl: './payments.component.html',
  styleUrl: './payments.component.scss',
})
export class PaymentsComponent implements OnInit {
  // ── Date range ────────────────────────────────────────────────────────────
  startDate = '';
  endDate   = '';

  // ── State ─────────────────────────────────────────────────────────────────
  previewing  = false;
  confirming  = false;
  preview     : SettlementPreview | null = null;
  settled     = false;   // true after a successful confirm in this session
  settlementId = '';

  // ── Formatting helper exposed to template ─────────────────────────────────
  Math = Math;

  constructor(
    private settlementService    : SettlementService,
    private restaurantContext     : RestaurantContextService,
    private notificationService   : NotificationService,
    private cdr                   : ChangeDetectorRef,
  ) {}

  ngOnInit(): void {
    // Default range: last 7 days
    const today = new Date();
    const week  = new Date();
    week.setDate(today.getDate() - 6);
    this.startDate = this.toDateInput(week);
    this.endDate   = this.toDateInput(today);
  }

  // ── Actions ───────────────────────────────────────────────────────────────

  previewSettlement(): void {
    if (!this.startDate || !this.endDate) return;
    const id = this.restaurantContext.getRestaurantId();
    if (!id) return;

    this.previewing = true;
    this.preview    = null;
    this.settled    = false;
    this.cdr.detectChanges();

    this.settlementService.previewSettlement(id, this.startDate, this.endDate).subscribe({
      next : (res) => {
        this.preview    = res;
        this.previewing = false;
        this.cdr.detectChanges();
      },
      error: (err) => {
        this.previewing = false;
        const msg = err?.error?.error || 'Failed to load settlement preview.';
        this.notificationService.show(NotificationType.ERROR, msg);
        this.cdr.detectChanges();
      },
    });
  }

  confirmAndDownload(): void {
    if (!this.preview || this.preview.totalOrders === 0) return;
    const id = this.restaurantContext.getRestaurantId();
    if (!id) return;

    this.confirming = true;
    this.cdr.detectChanges();

    this.settlementService
      .confirmSettlement(id, this.startDate, this.endDate, this.preview.restaurantName)
      .subscribe({
        next : (res) => {
          this.confirming   = false;
          this.settled      = true;
          this.settlementId = res.settlementId;
          // Update preview with confirmed summary
          this.preview = { ...res };
          this.settlementService.downloadReport(res.reportBase64, res.filename);
          this.notificationService.show(
            NotificationType.SUCCESS,
            `Settlement ${res.settlementId} confirmed. Report downloaded.`
          );
          this.cdr.detectChanges();
        },
        error: (err) => {
          this.confirming = false;
          const msg = err?.error?.error || 'Failed to confirm settlement.';
          this.notificationService.show(NotificationType.ERROR, msg);
          this.cdr.detectChanges();
        },
      });
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  formatCurrency(value: number): string {
    return `₹${value.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;
  }

  formatDate(iso: string): string {
    if (!iso) return '-';
    try {
      return new Date(iso).toLocaleString('en-IN', {
        day: '2-digit', month: 'short', year: 'numeric',
        hour: '2-digit', minute: '2-digit',
      });
    } catch { return iso; }
  }

  private toDateInput(d: Date): string {
    return d.toISOString().slice(0, 10);
  }
}

