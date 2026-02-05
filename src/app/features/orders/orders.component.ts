import { Component, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { OrderNotificationService } from '../../core/services/order-notification.service';
import { OrderService } from '../../core/services/order.service';
import { Order, OrderStatus } from '../../core/models/order.model';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-orders',
  standalone: true,
  imports: [CommonModule],
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
  
  // Status enum for template
  OrderStatus = OrderStatus;

  constructor(
    private orderService: OrderService,
    private orderNotificationService: OrderNotificationService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.loading = true;
    
    // Subscribe to orders from the service
    this.ordersSubscription = this.orderService.orders$.subscribe(orders => {
      console.log('📦 Orders updated:', orders.length, 'orders');
      this.allOrders = orders;
      this.loading = false;
      this.cdr.detectChanges();
    });
    
    // Fetch orders
    this.orderService.fetchOrders();
    
    // Subscribe to new orders from global notification service (for UI notifications)
    this.newOrderSubscription = this.orderNotificationService.getNewOrders().subscribe(
      (incomingOrder) => {
        console.log('📥 [ORDERS COMPONENT] New order notification:', incomingOrder);
      }
    );
  }

  ngOnDestroy(): void {
    this.ordersSubscription?.unsubscribe();
    this.newOrderSubscription?.unsubscribe();
  }

  /**
   * Get orders filtered by current tab
   */
  getOrders(): Order[] {
    switch (this.activeTab) {
      case 'new':
        return this.allOrders.filter(o => o.status === OrderStatus.PENDING);
      case 'preparing':
        return this.allOrders.filter(o => 
          o.status === OrderStatus.CONFIRMED || 
          o.status === OrderStatus.PREPARING
        );
      case 'ready':
        return this.allOrders.filter(o => 
          o.status === OrderStatus.READY || 
          o.status === OrderStatus.OUT_FOR_DELIVERY
        );
      case 'completed':
        return this.allOrders.filter(o => o.status === OrderStatus.DELIVERED);
      case 'cancelled':
        return this.allOrders.filter(o => o.status === OrderStatus.CANCELLED);
      default:
        return [];
    }
  }

  /**
   * Get count for specific tab
   */
  getTabCount(tab: string): number {
    switch (tab) {
      case 'new':
        return this.allOrders.filter(o => o.status === OrderStatus.PENDING).length;
      case 'preparing':
        return this.allOrders.filter(o => 
          o.status === OrderStatus.CONFIRMED || 
          o.status === OrderStatus.PREPARING
        ).length;
      case 'ready':
        return this.allOrders.filter(o => 
          o.status === OrderStatus.READY || 
          o.status === OrderStatus.OUT_FOR_DELIVERY
        ).length;
      case 'completed':
        return this.allOrders.filter(o => o.status === OrderStatus.DELIVERED).length;
      case 'cancelled':
        return this.allOrders.filter(o => o.status === OrderStatus.CANCELLED).length;
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
   * Get status label for display
   */
  getStatusLabel(status: OrderStatus): string {
    const statusMap: Record<OrderStatus, string> = {
      [OrderStatus.PENDING]: 'Pending',
      [OrderStatus.CONFIRMED]: 'Confirmed',
      [OrderStatus.PREPARING]: 'Preparing',
      [OrderStatus.READY]: 'Ready',
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
      [OrderStatus.PENDING]: 'orange',
      [OrderStatus.CONFIRMED]: 'blue',
      [OrderStatus.PREPARING]: 'purple',
      [OrderStatus.READY]: 'green',
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
    navigator.clipboard.writeText(orderId).then(() => {
      console.log('📋 Order ID copied:', orderId);
    }).catch(err => {
      console.error('Failed to copy order ID:', err);
    });
  }

  /**
   * Accept order (move from PENDING to CONFIRMED)
   */
  acceptOrder(order: Order): void {
    this.orderService.updateOrderStatus(order.orderId, OrderStatus.CONFIRMED).subscribe({
      next: (updatedOrder) => {
        console.log('✅ Order accepted:', order.orderId);
        this.orderNotificationService.notifyOrderAccepted(order.orderId);
        // Manually update local state to ensure UI refresh
        const index = this.allOrders.findIndex(o => o.orderId === order.orderId);
        if (index !== -1) {
          this.allOrders[index] = updatedOrder;
          this.cdr.detectChanges();
        }
      },
      error: (err) => {
        console.error('❌ Error accepting order:', err);
        alert('Failed to accept order. Please try again.');
      }
    });
  }

  /**
   * Reject order (move to CANCELLED)
   */
  rejectOrder(order: Order): void {
    if (confirm('Are you sure you want to reject this order?')) {
      this.orderService.updateOrderStatus(order.orderId, OrderStatus.CANCELLED).subscribe({
        next: (updatedOrder) => {
          console.log('❌ Order rejected:', order.orderId);
          this.orderNotificationService.notifyOrderRejected(order.orderId);
          // Manually update local state to ensure UI refresh
          const index = this.allOrders.findIndex(o => o.orderId === order.orderId);
          if (index !== -1) {
            this.allOrders[index] = updatedOrder;
            this.cdr.detectChanges();
          }
        },
        error: (err) => {
          console.error('❌ Error rejecting order:', err);
          alert('Failed to reject order. Please try again.');
        }
      });
    }
  }

  /**
   * Mark order as preparing
   */
  markPreparing(order: Order): void {
    this.orderService.updateOrderStatus(order.orderId, OrderStatus.PREPARING).subscribe({
      next: (updatedOrder) => {
        console.log('🍳 Order marked as preparing:', order.orderId);
        const index = this.allOrders.findIndex(o => o.orderId === order.orderId);
        if (index !== -1) {
          this.allOrders[index] = updatedOrder;
          this.cdr.detectChanges();
        }
      },
      error: (err) => {
        console.error('❌ Error updating order:', err);
        alert('Failed to update order. Please try again.');
      }
    });
  }

  /**
   * Mark order as ready
   */
  markReady(order: Order): void {
    this.orderService.updateOrderStatus(order.orderId, OrderStatus.READY).subscribe({
      next: (updatedOrder) => {
        console.log('✅ Order marked as ready:', order.orderId);
        alert('Order marked as ready for pickup!');
        const index = this.allOrders.findIndex(o => o.orderId === order.orderId);
        if (index !== -1) {
          this.allOrders[index] = updatedOrder;
          this.cdr.detectChanges();
        }
      },
      error: (err) => {
        console.error('❌ Error updating order:', err);
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
        console.log('🚚 Order marked as out for delivery:', order.orderId);
        const index = this.allOrders.findIndex(o => o.orderId === order.orderId);
        if (index !== -1) {
          this.allOrders[index] = updatedOrder;
          this.cdr.detectChanges();
        }
      },
      error: (err) => {
        console.error('❌ Error updating order:', err);
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
        console.log('🎉 Order marked as delivered:', order.orderId);
        const index = this.allOrders.findIndex(o => o.orderId === order.orderId);
        if (index !== -1) {
          this.allOrders[index] = updatedOrder;
          this.cdr.detectChanges();
        }
      },
      error: (err) => {
        console.error('❌ Error updating order:', err);
        alert('Failed to update order. Please try again.');
      }
    });
  }

  /**
   * Get available actions for an order based on its status
   */
  getAvailableActions(order: Order): string[] {
    switch (order.status) {
      case OrderStatus.PENDING:
        return ['accept', 'reject'];
      case OrderStatus.CONFIRMED:
        return ['preparing'];
      case OrderStatus.PREPARING:
        return ['ready'];
      case OrderStatus.READY:
        return ['outForDelivery'];
      case OrderStatus.OUT_FOR_DELIVERY:
        return ['delivered'];
      default:
        return [];
    }
  }
}

