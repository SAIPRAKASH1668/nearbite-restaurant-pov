import { Component, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { OrderNotificationService } from '../../core/services/order-notification.service';
import { OrderService } from '../../core/services/order.service';
import { Order, OrderStatus } from '../../core/models/order.model';
import { Subscription } from 'rxjs';
import { OrderRejectionModalComponent } from '../../shared/components/order-rejection-modal/order-rejection-modal.component';
import { SoundService } from '../../core/services/sound.service';
import { PrinterService } from '../../core/services/printer.service';

@Component({
  selector: 'app-orders',
  standalone: true,
  imports: [CommonModule, OrderRejectionModalComponent],
  templateUrl: './orders.component.html',
  styleUrl: './orders.component.scss'
})
export class OrdersComponent implements OnInit, OnDestroy {
  activeTab: 'new' | 'preparing' | 'ready' | 'completed' | 'cancelled' = 'new';
  expandedOrder: Order | null = null;
  
  // Subscriptions
  private ordersSubscription?: Subscription;
  private newOrderSubscription?: Subscription;
  
  // Orders state
  allOrders: Order[] = [];
  loading = true;
  
  // Rejection modal state
  showRejectionModal = false;
  selectedOrderForRejection: Order | null = null;
  
  // Status enum for template
  OrderStatus = OrderStatus;

  constructor(
    private orderService: OrderService,
    private orderNotificationService: OrderNotificationService,
    private cdr: ChangeDetectorRef,
    private soundService: SoundService,
    private printerService: PrinterService
  ) {}

  ngOnInit(): void {
    this.loading = true;
    this.ordersSubscription = this.orderService.orders$.subscribe(orders => {
      this.allOrders = orders;
      this.loading = false;
      this.cdr.detectChanges();
    });
    this.orderService.fetchOrders();
    this.newOrderSubscription = this.orderNotificationService.getNewOrders().subscribe();
  }

  ngOnDestroy(): void {
    this.ordersSubscription?.unsubscribe();
    this.newOrderSubscription?.unsubscribe();
  }

  /**
   * Get orders filtered by current tab and today's date
   */
  getOrders(): Order[] {
    // First filter by today's date
    const todayOrders = this.filterTodayOrders(this.allOrders);
    
    // Then filter by tab status
    let filteredOrders: Order[] = [];
    switch (this.activeTab) {
      case 'new':
        filteredOrders = todayOrders.filter(o => o.status === OrderStatus.CONFIRMED);
        break;
      case 'preparing':
        filteredOrders = todayOrders.filter(o => 
          o.status === OrderStatus.ACCEPTED || 
          o.status === OrderStatus.PREPARING
        );
        break;
      case 'ready':
        filteredOrders = todayOrders.filter(o => 
          o.status === OrderStatus.READY_FOR_PICKUP || 
          o.status === OrderStatus.AWAITING_RIDER_ASSIGNMENT ||
          o.status === OrderStatus.OFFERED_TO_RIDER ||
          o.status === OrderStatus.RIDER_ASSIGNED ||
          o.status === OrderStatus.PICKED_UP ||
          o.status === OrderStatus.OUT_FOR_DELIVERY
        );
        break;
      case 'completed':
        filteredOrders = todayOrders.filter(o => o.status === OrderStatus.DELIVERED);
        break;
      case 'cancelled':
        filteredOrders = todayOrders.filter(o => o.status === OrderStatus.CANCELLED);
        break;
      default:
        filteredOrders = [];
    }
    return filteredOrders;
  }

  /**
   * Filter orders for today only
   */
  private filterTodayOrders(orders: Order[]): Order[] {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    return orders.filter(order => {
      const orderDate = new Date(order.createdAt);
      return orderDate >= today && orderDate < tomorrow;
    });
  }

  /**
   * Get count for specific tab
   */
  getTabCount(tab: string): number {
    const todayOrders = this.filterTodayOrders(this.allOrders);
    switch (tab) {
      case 'new':
        return todayOrders.filter(o => o.status === OrderStatus.CONFIRMED).length;
      case 'preparing':
        return todayOrders.filter(o =>  
          o.status === OrderStatus.PREPARING
        ).length;
      case 'ready':
        return todayOrders.filter(o => 
          o.status === OrderStatus.READY_FOR_PICKUP || 
          o.status === OrderStatus.AWAITING_RIDER_ASSIGNMENT ||
          o.status === OrderStatus.OFFERED_TO_RIDER ||
          o.status === OrderStatus.RIDER_ASSIGNED ||
          o.status === OrderStatus.OUT_FOR_DELIVERY
        ).length;
      case 'completed':
        return todayOrders.filter(o => o.status === OrderStatus.DELIVERED).length;
      case 'cancelled':
        return todayOrders.filter(o => o.status === OrderStatus.CANCELLED).length;
      default:
        return 0;
    }
  }

  setActiveTab(tab: 'new' | 'preparing' | 'ready' | 'completed' | 'cancelled'): void {
    this.activeTab = tab;
  }

  expandOrder(order: Order): void {
    this.expandedOrder = order;
  }

  closeExpandedOrder(): void {
    this.expandedOrder = null;
  }

  /**
   * Check if order has more than 4 items
   */
  hasMoreItems(order: Order): boolean {
    return order.items.length > 4;
  }

  /**
   * Get status label for display
   */
  getStatusLabel(status: OrderStatus): string {
    const statusMap: Record<OrderStatus, string> = {
      [OrderStatus.INITIATED]: 'Payment Initiated',
      [OrderStatus.PENDING]: 'Payment Pending',
      [OrderStatus.CONFIRMED]: 'New Order',
      [OrderStatus.ACCEPTED]: 'Accepted',
      [OrderStatus.PREPARING]: 'Preparing',
      [OrderStatus.READY_FOR_PICKUP]: 'Ready for Pickup',
      [OrderStatus.AWAITING_RIDER_ASSIGNMENT]: 'Awaiting Rider',
      [OrderStatus.OFFERED_TO_RIDER]: 'Offered to Rider',
      [OrderStatus.RIDER_ASSIGNED]: 'Rider Assigned',
      [OrderStatus.PICKED_UP]: 'Picked Up',
      [OrderStatus.OUT_FOR_DELIVERY]: 'Out for Delivery',
      [OrderStatus.DELIVERED]: 'Delivered',
      [OrderStatus.CANCELLED]: 'Cancelled'
    };
    return statusMap[status] || status;
  }

  /**
   * Get status badge color
   */
  getStatusColor(status: OrderStatus): string {
    const colorMap: Record<OrderStatus, string> = {
      [OrderStatus.INITIATED]: 'gray',
      [OrderStatus.PENDING]: 'orange',
      [OrderStatus.CONFIRMED]: 'blue',
      [OrderStatus.ACCEPTED]: 'blue',
      [OrderStatus.PREPARING]: 'purple',
      [OrderStatus.READY_FOR_PICKUP]: 'green',
      [OrderStatus.AWAITING_RIDER_ASSIGNMENT]: 'yellow',
      [OrderStatus.OFFERED_TO_RIDER]: 'teal',
      [OrderStatus.RIDER_ASSIGNED]: 'teal',
      [OrderStatus.PICKED_UP]: 'teal',
      [OrderStatus.OUT_FOR_DELIVERY]: 'teal',
      [OrderStatus.DELIVERED]: 'gray',
      [OrderStatus.CANCELLED]: 'red'
    };
    return colorMap[status] || 'gray';
  }

  /**
   * Format timestamp to relative time
   */
  getRelativeTime(timestamp: string): string {
    const now = new Date();
    const orderTime = new Date(timestamp);
    const diffMs = now.getTime() - orderTime.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins} mins ago`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours} hours ago`;
    const diffDays = Math.floor(diffHours / 24);
    return `${diffDays} days ago`;
  }

  /**
   * Copy order ID to clipboard
   */
  copyOrderId(orderId: string): void {
    navigator.clipboard.writeText(orderId).catch(() => {});
  }

  /**
   * Accept order (CONFIRMED → PREPARING, backend starts 5-min timer for rider notification)
   */
  acceptOrder(order: Order): void {
    this.soundService.stopAlarm();
    this.printerService.printOrderAccepted(order);   // auto-print KOT + Bill
    this.orderService.updateOrderStatus(order.orderId, OrderStatus.PREPARING).subscribe({
      next: () => {
        this.orderNotificationService.notifyOrderAccepted(order.orderId);
        this.orderService.fetchOrders();
      },
      error: () => {
        alert('Failed to accept order. Please try again.');
      }
    });
  }

  /**
   * Reject order - show modal for reason
   */
  rejectOrder(order: Order): void {
    this.selectedOrderForRejection = order;
    this.showRejectionModal = true;
  }

  /**
   * Confirm rejection with reason
   */
  onRejectConfirm(reason: string): void {
    if (!this.selectedOrderForRejection) return;
    this.soundService.stopAlarm();
    this.orderService.updateOrderStatus(
      this.selectedOrderForRejection.orderId, 
      OrderStatus.CANCELLED,
      { cancellationReason: reason }
    ).subscribe({
      next: () => {
        this.orderNotificationService.notifyOrderRejected(this.selectedOrderForRejection!.orderId);
        this.orderService.fetchOrders();
        this.showRejectionModal = false;
        this.selectedOrderForRejection = null;
      },
      error: () => {
        alert('Failed to reject order. Please try again.');
      }
    });
  }

  /**
   * Cancel rejection modal
   */
  onRejectCancel(): void {
    this.showRejectionModal = false;
    this.selectedOrderForRejection = null;
  }

  /**
   * Mark order as preparing
   */
  markPreparing(order: Order): void {
    this.orderService.updateOrderStatus(order.orderId, OrderStatus.PREPARING).subscribe({
      next: (updatedOrder) => {
        const index = this.allOrders.findIndex(o => o.orderId === order.orderId);
        if (index !== -1) {
          this.allOrders[index] = updatedOrder;
          this.cdr.detectChanges();
        }
      },
      error: () => {
        alert('Failed to update order. Please try again.');
      }
    });
  }

  /**
   * Mark order as ready
   */
  markReady(order: Order): void {
    this.orderService.updateOrderStatus(order.orderId, OrderStatus.READY_FOR_PICKUP).subscribe({
      next: () => {
        this.orderService.fetchOrders();
      },
      error: () => {
        alert('Failed to update order. Please try again.');
      }
    });
  }

  /**
   * Mark order as out for delivery
   */
  markOutForDelivery(order: Order): void {
    this.orderService.updateOrderStatus(order.orderId, OrderStatus.OUT_FOR_DELIVERY).subscribe({
      next: (updatedOrder) => {
        const index = this.allOrders.findIndex(o => o.orderId === order.orderId);
        if (index !== -1) {
          this.allOrders[index] = updatedOrder;
          this.cdr.detectChanges();
        }
      },
      error: () => {
        alert('Failed to update order. Please try again.');
      }
    });
  }

  /**
   * Mark order as delivered
   */
  markDelivered(order: Order): void {
    this.orderService.updateOrderStatus(order.orderId, OrderStatus.DELIVERED).subscribe({
      next: (updatedOrder) => {
        const index = this.allOrders.findIndex(o => o.orderId === order.orderId);
        if (index !== -1) {
          this.allOrders[index] = updatedOrder;
          this.cdr.detectChanges();
        }
      },
      error: () => {
        alert('Failed to update order. Please try again.');
      }
    });
  }

  /**
   * Get available actions for an order based on its status
   */
  getAvailableActions(order: Order): string[] {
    switch (order.status) {
      case OrderStatus.CONFIRMED:
        return ['accept', 'reject'];
      case OrderStatus.ACCEPTED:
      case OrderStatus.PREPARING:
        return ['ready'];
      default:
        return [];
    }
  }

  /**
   * Determine if pickup OTP should be shown
   * Show OTP when order is ready for pickup but not yet picked up by rider
   */
  shouldShowPickupOtp(order: Order): boolean {
    return [
      OrderStatus.READY_FOR_PICKUP,
      OrderStatus.AWAITING_RIDER_ASSIGNMENT,
      OrderStatus.OFFERED_TO_RIDER,
      OrderStatus.RIDER_ASSIGNED
    ].includes(order.status);
  }
}

