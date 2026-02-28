import { Component, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { OrderNotificationService } from '../../core/services/order-notification.service';
import { OrderService } from '../../core/services/order.service';
import { Order, OrderStatus } from '../../core/models/order.model';
import { Subscription } from 'rxjs';
import { OrderRejectionModalComponent } from '../../shared/components/order-rejection-modal/order-rejection-modal.component';

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

  // ── Dummy preview data (remove when going live) ───────────────────────────
  private readonly DUMMY_ORDERS: Order[] = (() => {
    const now = new Date();
    const ts = (minutesAgo: number) =>
      new Date(now.getTime() - minutesAgo * 60000).toISOString();
    return [
      // ── NEW (CONFIRMED) ──────────────────────────────────────────────────
      {
        orderId: 'ORD-20260228-001',
        customerPhone: '+91 98765 43210',
        restaurantId: 'RES-001',
        restaurantName: 'Spice Garden',
        restaurantImage: '',
        items: [
          { itemId: 'I1', name: 'Butter Chicken', quantity: 1, price: 280 },
          { itemId: 'I2', name: 'Garlic Naan',    quantity: 2, price: 45 },
          { itemId: 'I3', name: 'Dal Makhani',    quantity: 1, price: 180 },
        ],
        foodTotal: 550,
        deliveryFee: 40,
        platformFee: 10,
        grandTotal: 600,
        status: OrderStatus.CONFIRMED,
        riderId: null,
        createdAt: ts(3),
        deliveryAddress: '12, MG Road, Koramangala, Bangalore – 560034',
        formattedAddress: 'Near Forum Mall',
        addressId: 'A1',
      },
      {
        orderId: 'ORD-20260228-002',
        customerPhone: '+91 87654 32109',
        restaurantId: 'RES-001',
        restaurantName: 'Spice Garden',
        restaurantImage: '',
        items: [
          { itemId: 'I4', name: 'Paneer Tikka Masala', quantity: 1, price: 260 },
          { itemId: 'I5', name: 'Jeera Rice',          quantity: 1, price: 120 },
          { itemId: 'I6', name: 'Raita',               quantity: 1, price: 60 },
          { itemId: 'I7', name: 'Papad',               quantity: 2, price: 20 },
          { itemId: 'I8', name: 'Gulab Jamun',         quantity: 1, price: 80 },
        ],
        foodTotal: 560,
        deliveryFee: 40,
        platformFee: 10,
        grandTotal: 610,
        status: OrderStatus.CONFIRMED,
        riderId: null,
        createdAt: ts(7),
        deliveryAddress: '45, Indiranagar 12th Main, Bangalore – 560038',
        formattedAddress: 'Near 100 Feet Road',
        addressId: 'A2',
      },
      {
        orderId: 'ORD-20260228-003',
        customerPhone: '+91 76543 21098',
        restaurantId: 'RES-001',
        restaurantName: 'Spice Garden',
        restaurantImage: '',
        items: [
          { itemId: 'I9',  name: 'Chicken Biryani', quantity: 2, price: 320 },
          { itemId: 'I10', name: 'Mirchi Ka Salan', quantity: 1, price: 90 },
        ],
        foodTotal: 730,
        deliveryFee: 40,
        platformFee: 10,
        grandTotal: 780,
        status: OrderStatus.CONFIRMED,
        riderId: null,
        createdAt: ts(1),
        deliveryAddress: '8, HSR Layout Sector 2, Bangalore – 560102',
        formattedAddress: 'Opposite BDA Complex',
        addressId: 'A3',
      },
      // ── PREPARING ────────────────────────────────────────────────────────
      {
        orderId: 'ORD-20260228-004',
        customerPhone: '+91 65432 10987',
        restaurantId: 'RES-001',
        restaurantName: 'Spice Garden',
        restaurantImage: '',
        items: [
          { itemId: 'I11', name: 'Mutton Rogan Josh', quantity: 1, price: 380 },
          { itemId: 'I12', name: 'Laccha Paratha',    quantity: 3, price: 55 },
          { itemId: 'I13', name: 'Lassi',             quantity: 2, price: 70 },
        ],
        foodTotal: 705,
        deliveryFee: 50,
        platformFee: 10,
        grandTotal: 765,
        status: OrderStatus.PREPARING,
        riderId: null,
        createdAt: ts(18),
        deliveryAddress: '22, JP Nagar 3rd Phase, Bangalore – 560078',
        formattedAddress: 'Near BMTC Depot',
        addressId: 'A4',
        acceptedAt: ts(15),
      },
      {
        orderId: 'ORD-20260228-005',
        customerPhone: '+91 54321 09876',
        restaurantId: 'RES-001',
        restaurantName: 'Spice Garden',
        restaurantImage: '',
        items: [
          { itemId: 'I14', name: 'Veg Thali',   quantity: 1, price: 220 },
          { itemId: 'I15', name: 'Cold Coffee', quantity: 1, price: 110 },
        ],
        foodTotal: 330,
        deliveryFee: 30,
        platformFee: 5,
        grandTotal: 365,
        status: OrderStatus.PREPARING,
        riderId: null,
        createdAt: ts(25),
        deliveryAddress: '3, Whitefield Main Road, Bangalore – 560066',
        formattedAddress: 'ITPL Gate 2 Area',
        addressId: 'A5',
        acceptedAt: ts(22),
      },
      // ── READY ─────────────────────────────────────────────────────────────
      {
        orderId: 'ORD-20260228-006',
        customerPhone: '+91 43210 98765',
        restaurantId: 'RES-001',
        restaurantName: 'Spice Garden',
        restaurantImage: '',
        items: [
          { itemId: 'I16', name: 'Fish Curry',    quantity: 1, price: 310 },
          { itemId: 'I17', name: 'Steamed Rice',  quantity: 2, price: 80 },
        ],
        foodTotal: 470,
        deliveryFee: 40,
        platformFee: 10,
        grandTotal: 520,
        status: OrderStatus.READY_FOR_PICKUP,
        riderId: null,
        createdAt: ts(42),
        deliveryAddress: '67, Bannerghatta Road, Bangalore – 560029',
        formattedAddress: 'Near Meenakshi Mall',
        addressId: 'A6',
        acceptedAt: ts(40),
        pickupOtp: '7382',
      },
      {
        orderId: 'ORD-20260228-007',
        customerPhone: '+91 32109 87654',
        restaurantId: 'RES-001',
        restaurantName: 'Spice Garden',
        restaurantImage: '',
        items: [
          { itemId: 'I18', name: 'Palak Paneer',  quantity: 1, price: 230 },
          { itemId: 'I19', name: 'Butter Naan',   quantity: 3, price: 50 },
          { itemId: 'I20', name: 'Kheer',         quantity: 2, price: 90 },
        ],
        foodTotal: 560,
        deliveryFee: 40,
        platformFee: 10,
        grandTotal: 610,
        status: OrderStatus.AWAITING_RIDER_ASSIGNMENT,
        riderId: null,
        createdAt: ts(55),
        deliveryAddress: '101, Sarjapur Road, Bangalore – 560035',
        formattedAddress: 'Embassy Tech Village Area',
        addressId: 'A7',
        acceptedAt: ts(53),
        pickupOtp: '4519',
      },
      // ── COMPLETED ─────────────────────────────────────────────────────────
      {
        orderId: 'ORD-20260228-008',
        customerPhone: '+91 21098 76543',
        restaurantId: 'RES-001',
        restaurantName: 'Spice Garden',
        restaurantImage: '',
        items: [
          { itemId: 'I21', name: 'Chicken 65',    quantity: 1, price: 250 },
          { itemId: 'I22', name: 'Fried Rice',    quantity: 1, price: 160 },
          { itemId: 'I23', name: 'Mango Lassi',   quantity: 2, price: 90 },
        ],
        foodTotal: 590,
        deliveryFee: 40,
        platformFee: 10,
        grandTotal: 640,
        status: OrderStatus.DELIVERED,
        riderId: 'RDR-00421',
        createdAt: ts(120),
        deliveryAddress: '55, Rajajinagar 1st Block, Bangalore – 560010',
        formattedAddress: 'Near Majestic',
        addressId: 'A8',
        acceptedAt: ts(118),
        pickupOtp: '2847',
      },
      {
        orderId: 'ORD-20260228-009',
        customerPhone: '+91 10987 65432',
        restaurantId: 'RES-001',
        restaurantName: 'Spice Garden',
        restaurantImage: '',
        items: [
          { itemId: 'I24', name: 'Prawn Masala',  quantity: 1, price: 420 },
          { itemId: 'I25', name: 'Appam',         quantity: 4, price: 35 },
        ],
        foodTotal: 560,
        deliveryFee: 50,
        platformFee: 10,
        grandTotal: 620,
        status: OrderStatus.DELIVERED,
        riderId: 'RDR-00388',
        createdAt: ts(95),
        deliveryAddress: '14, Electronic City Phase 1, Bangalore – 560100',
        formattedAddress: 'Infosys Gate Area',
        addressId: 'A9',
        acceptedAt: ts(93),
      },
      // ── CANCELLED ─────────────────────────────────────────────────────────
      {
        orderId: 'ORD-20260228-010',
        customerPhone: '+91 99887 76655',
        restaurantId: 'RES-001',
        restaurantName: 'Spice Garden',
        restaurantImage: '',
        items: [
          { itemId: 'I26', name: 'Tandoori Chicken', quantity: 1, price: 340 },
          { itemId: 'I27', name: 'Mint Chutney',     quantity: 1, price: 30 },
        ],
        foodTotal: 370,
        deliveryFee: 40,
        platformFee: 10,
        grandTotal: 420,
        status: OrderStatus.CANCELLED,
        riderId: null,
        createdAt: ts(80),
        deliveryAddress: '28, BTM Layout 2nd Stage, Bangalore – 560076',
        formattedAddress: 'Near Udupi Garden',
        addressId: 'A10',
        cancellationReason: 'Item out of stock — Tandoori Chicken not available',
      },
    ] as Order[];
  })();

  constructor(
    private orderService: OrderService,
    private orderNotificationService: OrderNotificationService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    // ── PREVIEW MODE: load dummy data instead of live API ─────────────────
    this.allOrders = this.DUMMY_ORDERS;
    this.loading = false;
    this.cdr.detectChanges();
    // ── END PREVIEW MODE ───────────────────────────────────────────────────
    // To restore live data, comment out the 3 lines above and uncomment below:
    /*
    this.loading = true;
    this.ordersSubscription = this.orderService.orders$.subscribe(orders => {
      this.allOrders = orders;
      this.loading = false;
      this.cdr.detectChanges();
    });
    this.orderService.fetchOrders();
    this.newOrderSubscription = this.orderNotificationService.getNewOrders().subscribe(
      (incomingOrder) => { console.log('📥 New order notification:', incomingOrder); }
    );
    */
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
        // Debug: Check OTP data in ready orders
        filteredOrders.forEach(order => {
          console.log(`📦 Ready Order: ${order.orderId}, Status: ${order.status}, OTP: ${order.pickupOtp || 'MISSING'}`);
        });
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
    navigator.clipboard.writeText(orderId).then(() => {
      console.log('📋 Order ID copied:', orderId);
    }).catch(err => {
      console.error('Failed to copy order ID:', err);
    });
  }

  /**
   * Accept order (CONFIRMED → PREPARING, backend starts 5-min timer for rider notification)
   */
  acceptOrder(order: Order): void {
    this.orderService.updateOrderStatus(order.orderId, OrderStatus.PREPARING).subscribe({
      next: () => {
        console.log('✅ Order accepted:', order.orderId);
        this.orderNotificationService.notifyOrderAccepted(order.orderId);
        // Refresh orders to get updated status from backend
        this.orderService.fetchOrders();
      },
      error: (err) => {
        console.error('❌ Error accepting order:', err);
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
    
    this.orderService.updateOrderStatus(
      this.selectedOrderForRejection.orderId, 
      OrderStatus.CANCELLED,
      { cancellationReason: reason }
    ).subscribe({
      next: () => {
        console.log('❌ Order rejected:', this.selectedOrderForRejection!.orderId, 'Reason:', reason);
        this.orderNotificationService.notifyOrderRejected(this.selectedOrderForRejection!.orderId);
        // Refresh orders to get updated status from backend
        this.orderService.fetchOrders();
        this.showRejectionModal = false;
        this.selectedOrderForRejection = null;
      },
      error: (err) => {
        console.error('❌ Error rejecting order:', err);
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
    this.orderService.updateOrderStatus(order.orderId, OrderStatus.READY_FOR_PICKUP).subscribe({
      next: () => {
        console.log('✅ Order marked as ready:', order.orderId);
        // Refresh orders to get updated status from backend
        this.orderService.fetchOrders();
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

