import { Component, OnInit, OnDestroy, NgZone, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { trigger, state, style, transition, animate } from '@angular/animations';
import { OrderNotificationService, IncomingOrder } from '../../../core/services/order-notification.service';
import { OrderService } from '../../../core/services/order.service';
import { PrinterService } from '../../../core/services/printer.service';
import { SoundService } from '../../../core/services/sound.service';
import { OrderStatus } from '../../../core/models/order.model';
import { Subscription, take } from 'rxjs';

/**
 * Global Order Notification Modal
 * Displays urgent order alerts anywhere in the application
 */
@Component({
  selector: 'app-order-notification-modal',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './order-notification-modal.component.html',
  styleUrl: './order-notification-modal.component.scss',
  animations: [
    trigger('fadeIn', [
      transition(':enter', [
        style({ opacity: 0 }),
        animate('200ms ease-out', style({ opacity: 1 }))
      ]),
      transition(':leave', [
        animate('150ms ease-in', style({ opacity: 0 }))
      ])
    ]),
    trigger('slideInScale', [
      transition(':enter', [
        style({ transform: 'translate(-50%, -55%) scale(0.95)', opacity: 0 }),
        animate('250ms cubic-bezier(0.4, 0, 0.2, 1)', 
          style({ transform: 'translate(-50%, -50%) scale(1)', opacity: 1 }))
      ]),
      transition(':leave', [
        animate('150ms ease-in', 
          style({ transform: 'translate(-50%, -45%) scale(0.98)', opacity: 0 }))
      ])
    ])
  ]
})
export class OrderNotificationModalComponent implements OnInit, OnDestroy {
  currentOrder: IncomingOrder | null = null;
  showModal = false;
  isProcessing = false;
  showPrepTimePicker = false;
  prepTime = 6;
  prepTimeOptions = [5, 10, 15, 20, 30, 45];
  private subscription?: Subscription;
  private orderQueue: IncomingOrder[] = [];

  constructor(
    private notificationService: OrderNotificationService,
    private orderService: OrderService,
    private printerService: PrinterService,
    private soundService: SoundService,
    private router: Router,
    private ngZone: NgZone,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.subscription = this.notificationService.getNewOrders().subscribe(
      (order: IncomingOrder) => {
        this.orderQueue.push(order);
        if (!this.showModal) {
          this.displayNextOrder();
        }
      }
    );
  }

  /**
   * Display the next order from the queue
   */
  private displayNextOrder(): void {
    if (this.orderQueue.length === 0) {
      return;
    }

    setTimeout(() => {
      this.currentOrder = this.orderQueue[0];
      this.showModal = true;
      this.isProcessing = false;
      this.cdr.detectChanges();
    }, 0);
  }

  /**
   * Get count of pending orders
   */
  getPendingOrdersCount(): number {
    return this.orderQueue.length;
  }

  ngOnDestroy(): void {
    if (this.subscription) {
      this.subscription.unsubscribe();
    }
  }

  /**
   * Accept the order — show prep time picker first
   */
  initiateAccept(): void {
    if (!this.currentOrder || this.isProcessing) return;
    this.prepTime = 6;
    this.showPrepTimePicker = true;
  }

  incrementPrepTime(): void {
    if (this.prepTime < 120) this.prepTime++;
  }

  decrementPrepTime(): void {
    if (this.prepTime > 1) this.prepTime--;
  }

  getEffectivePrepTime(): number {
    return this.prepTime;
  }

  /**
   * Confirm accept with chosen prep time — update status, print KOT + Bill, then dismiss
   */
  confirmAccept(): void {
    if (!this.currentOrder || this.isProcessing) return;
    const prepTime = this.getEffectivePrepTime();
    if (!prepTime) return;

    this.isProcessing = true;
    const orderId = this.currentOrder.orderId;
    console.log('✅ Order accepted:', orderId, 'prepTime:', prepTime);
    
    this.soundService.stopAlarm();

    // Find the full Order from the order service for printing
    this.orderService.orders$.pipe(take(1)).subscribe(orders => {
      const fullOrder = orders.find(o => o.orderId === orderId);
      if (fullOrder) {
        this.printerService.printOrderAccepted(fullOrder);
      }
    });

    // Update order status to PREPARING with prep time
    this.orderService.updateOrderStatus(orderId, OrderStatus.PREPARING, { preparationTime: prepTime }).subscribe({
      next: () => {
        this.notificationService.notifyOrderAccepted(orderId);
        this.orderService.fetchOrders();
      },
      error: () => {
        alert('Failed to accept order. Please try again.');
        this.isProcessing = false;
      }
    });
    
    // Remove from queue and show next
    this.orderQueue.shift();
    
    // Close modal/picker after short delay
    setTimeout(() => {
      this.closeModal();
      
      // Show next order if any
      if (this.orderQueue.length > 0) {
        setTimeout(() => this.displayNextOrder(), 300);
      }
      
      // Navigate to orders page if not already there
      if (!this.router.url.includes('/orders')) {
        this.router.navigate(['/orders']);
      }
    }, 500);
  }

  /**
   * Reject the order
   */
  rejectOrder(): void {
    if (!this.currentOrder || this.isProcessing) return;
    
    const confirmed = confirm(
      `⚠️ Reject Order ${this.currentOrder.orderNumber}?\n\nCustomer: ${this.currentOrder.customerName}\n\nThis action cannot be undone.`
    );
    
    if (confirmed) {
      this.isProcessing = true;
      console.log('❌ Order rejected:', this.currentOrder.orderId);
      
      // Notify service
      this.notificationService.notifyOrderRejected(this.currentOrder.orderId);
      
      // Remove from queue and show next
      this.orderQueue.shift();
      
      // Close modal
      setTimeout(() => {
        this.closeModal();
        
        // Show next order if any
        if (this.orderQueue.length > 0) {
          setTimeout(() => this.displayNextOrder(), 300);
        }
      }, 500);
    }
  }

  /**
   * View order details
   */
  viewDetails(): void {
    if (!this.currentOrder) return;
    
    // Keep order in queue, just close modal
    this.closeModal();
    
    // Show next order if more than 1 in queue
    if (this.orderQueue.length > 1) {
      this.orderQueue.shift();
      setTimeout(() => this.displayNextOrder(), 300);
    }
    
    this.router.navigate(['/orders']);
  }

  /**
   * Close modal
   */
  closeModal(): void {
    this.showModal = false;
    this.showPrepTimePicker = false;
    setTimeout(() => {
      this.currentOrder = null;
      this.isProcessing = false;
      this.prepTime = 6;
    }, 300);
  }

  /**
   * Get total items count
   */
  getTotalItemsCount(): number {
    if (!this.currentOrder) return 0;
    return this.currentOrder.items.reduce((sum, item) => sum + item.quantity, 0);
  }
}
