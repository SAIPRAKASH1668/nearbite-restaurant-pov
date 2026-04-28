import { Component, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { OrderNotificationService } from '../../core/services/order-notification.service';
import { OrderService } from '../../core/services/order.service';
import { Order, OrderStatus } from '../../core/models/order.model';
import { Subscription } from 'rxjs';
import { OrderRejectionModalComponent } from '../../shared/components/order-rejection-modal/order-rejection-modal.component';
import { SoundService } from '../../core/services/sound.service';
import { PrinterService, PrintStatus } from '../../core/services/printer.service';

@Component({
  selector: 'app-orders',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, OrderRejectionModalComponent],
  templateUrl: './orders.component.html',
  styleUrl: './orders.component.scss'
})
export class OrdersComponent implements OnInit, OnDestroy {
  activeTab: 'new' | 'preparing' | 'ready' | 'completed' | 'cancelled' = 'new';
  searchQuery = '';
  expandedOrder: Order | null = null;
  
  // Subscriptions
  private ordersSubscription?: Subscription;
  private newOrderSubscription?: Subscription;
  private printerStatusSub?: Subscription;

  // Printer feedback
  printStatus: PrintStatus = 'idle';

  get hasPrinter(): boolean {
    return this.printerService.hasAnyPrinter();
  }
  get hasBillPrinter(): boolean {
    return this.printerService.getBillPrinters().length > 0;
  }
  get hasKotPrinter(): boolean {
    return this.printerService.getKotPrinters().length > 0;
  }
  get hasVegKotPrinter(): boolean {
    return this.printerService.getVegKotPrinters().length > 0;
  }
  get hasNonVegKotPrinter(): boolean {
    return this.printerService.getNonVegKotPrinters().length > 0;
  }

  // Orders state
  allOrders: Order[] = [];
  loading = true;
  isRefreshing = false;
  
  // Rejection modal state
  showRejectionModal = false;
  selectedOrderForRejection: Order | null = null;

  // Prep time modal state
  showPrepTimeModal = false;
  orderPendingAccept: Order | null = null;
  prepTime = 6;
  prepTimeOptions = [5, 10, 15, 20, 30, 45];
  
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
    this.printerStatusSub = this.printerService.status$.subscribe(s => {
      this.printStatus = s;
      this.cdr.detectChanges();
    });

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
    this.printerStatusSub?.unsubscribe();
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
    const query = this.searchQuery.trim().toLowerCase();
    if (!query) return filteredOrders;
    return filteredOrders.filter(order => this.matchesOrderSearch(order, query));
  }

  private matchesOrderSearch(order: Order, query: string): boolean {
    const orderId = (order.orderId || '').toLowerCase();
    const customerPhone = (order.customerPhone || '').toLowerCase();
    const riderId = (order.riderId || '').toLowerCase();
    const deliveryAddress = (order.deliveryAddress || '').toLowerCase();
    const itemMatch = (order.items || []).some(item =>
      ((item.name || '').toLowerCase().includes(query))
    );
    return (
      orderId.includes(query) ||
      customerPhone.includes(query) ||
      riderId.includes(query) ||
      deliveryAddress.includes(query) ||
      itemMatch
    );
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
   * Initiate accept — open prep time picker modal
   */
  initiateAccept(order: Order): void {
    this.orderPendingAccept = order;
    this.prepTime = 6;
    this.showPrepTimeModal = true;
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
   * Confirm accept with chosen prep time
   */
  confirmAccept(): void {
    const order = this.orderPendingAccept;
    const prepTime = this.getEffectivePrepTime();
    if (!order || !prepTime) return;
    this.showPrepTimeModal = false;
    this.orderPendingAccept = null;
    this.soundService.stopAlarm();
    this.printerService.printOrderAccepted(order);
    this.orderService.updateOrderStatus(order.orderId, OrderStatus.PREPARING, { preparationTime: prepTime }).subscribe({
      next: () => {
        this.orderNotificationService.notifyOrderAccepted(order.orderId);
        this.orderService.fetchOrders();
      },
      error: () => {
        alert('Failed to accept order. Please try again.');
      }
    });
  }

  cancelPrepTimeModal(): void {
    this.showPrepTimeModal = false;
    this.orderPendingAccept = null;
    this.prepTime = 6;
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
  // ── Manual print shortcuts ────────────────────────────────────────────────

  manualPrint(type: 'bill' | 'kot' | 'vegkot' | 'nonvegkot' | 'all', order: Order): void {
    switch (type) {
      case 'bill':     this.printerService.printBillOnly(order);    break;
      case 'kot':      this.printerService.printKotOnly(order);     break;
      case 'vegkot':   this.printerService.printVegKotOnly(order);  break;
      case 'nonvegkot':this.printerService.printNonVegKotOnly(order); break;
      case 'all':      this.printerService.printOrderAccepted(order); break;
    }
  }

  hasVegItems(order: Order): boolean {
    return order.items.some(i => i.isVeg === true);
  }

  hasNonVegItems(order: Order): boolean {
    return order.items.some(i => i.isVeg !== true);
  }

  // ── Manual refresh ───────────────────────────────────────────────────────────

  manualRefresh(): void {
    if (this.isRefreshing) return;
    this.isRefreshing = true;
    this.orderService.fetchOrders();
    // spin icon briefly, then reset once orders$ emits
    setTimeout(() => {
      this.isRefreshing = false;
      this.cdr.detectChanges();
    }, 1200);
  }
  // ── Sample / Demo mode ────────────────────────────────────────────────────

  loadSampleOrders(): void {
    const now = new Date();
    const ts = (minsAgo: number) =>
      new Date(now.getTime() - minsAgo * 60_000).toISOString();

    const samples: Order[] = [
      {
        orderId: 'ORD-DEMO-001',
        customerPhone: '918****3421',
        restaurantId: 'DEMO',
        restaurantName: 'YumDude Kitchen',
        restaurantImage: '',
        items: [
          { itemId: 'itm1', name: 'Butter Chicken', quantity: 2, price: 320,
            addOnOptions: [{ optionId: 'ao1', name: 'Extra Gravy', extraPrice: 30 }] },
          { itemId: 'itm2', name: 'Garlic Naan', quantity: 4, price: 60 },
          { itemId: 'itm3', name: 'Raita', quantity: 1, price: 49 }
        ],
        foodTotal: 809,
        deliveryFee: 35,
        platformFee: 10,
        grandTotal: 854,
        status: OrderStatus.CONFIRMED,
        riderId: null,
        createdAt: ts(2),
        deliveryAddress: '42, Lakeview Apartments, HSR Layout',
        formattedAddress: 'HSR Layout, Bengaluru 560034',
        addressId: 'addr1'
      },
      {
        orderId: 'ORD-DEMO-002',
        customerPhone: '917****9856',
        restaurantId: 'DEMO',
        restaurantName: 'YumDude Kitchen',
        restaurantImage: '',
        items: [
          { itemId: 'itm4', name: 'Paneer Tikka Masala', quantity: 1, price: 299,
            addOnOptions: [
              { optionId: 'ao2', name: 'Extra Paneer', extraPrice: 50 },
              { optionId: 'ao3', name: 'Less Spicy', extraPrice: 0 }
            ] },
          { itemId: 'itm5', name: 'Jeera Rice', quantity: 2, price: 120 },
          { itemId: 'itm6', name: 'Mango Lassi', quantity: 1, price: 99 },
          { itemId: 'itm7', name: 'Gulab Jamun', quantity: 2, price: 80 },
          { itemId: 'itm8', name: 'Papad', quantity: 2, price: 30 }
        ],
        foodTotal: 758,
        deliveryFee: 35,
        platformFee: 10,
        grandTotal: 803,
        status: OrderStatus.CONFIRMED,
        riderId: null,
        createdAt: ts(6),
        deliveryAddress: 'F-12, Silver Oak Society, Koramangala',
        formattedAddress: 'Koramangala, Bengaluru 560095',
        addressId: 'addr2'
      },
      {
        orderId: 'ORD-DEMO-003',
        customerPhone: '919****1234',
        restaurantId: 'DEMO',
        restaurantName: 'YumDude Kitchen',
        restaurantImage: '',
        items: [
          { itemId: 'itm9', name: 'Chicken Biryani', quantity: 1, price: 349 },
          { itemId: 'itm10', name: 'Salan', quantity: 1, price: 59 },
          { itemId: 'itm11', name: 'Cold Drink', quantity: 2, price: 60 }
        ],
        foodTotal: 527,
        deliveryFee: 40,
        platformFee: 10,
        grandTotal: 577,
        status: OrderStatus.PREPARING,
        riderId: null,
        createdAt: ts(18),
        deliveryAddress: 'B-304, Green Valley Apts, BTM Layout',
        formattedAddress: 'BTM Layout, Bengaluru 560076',
        addressId: 'addr3'
      },
      {
        orderId: 'ORD-DEMO-004',
        customerPhone: '916****7890',
        restaurantId: 'DEMO',
        restaurantName: 'YumDude Kitchen',
        restaurantImage: '',
        items: [
          { itemId: 'itm12', name: 'Dal Makhani', quantity: 1, price: 249 },
          { itemId: 'itm13', name: 'Butter Naan', quantity: 3, price: 55 },
          { itemId: 'itm14', name: 'Sweet Lassi', quantity: 1, price: 89 }
        ],
        foodTotal: 503,
        deliveryFee: 35,
        platformFee: 10,
        grandTotal: 548,
        status: OrderStatus.READY_FOR_PICKUP,
        riderId: null,
        createdAt: ts(32),
        deliveryAddress: '11, Palm Grove Road, Indiranagar',
        formattedAddress: 'Indiranagar, Bengaluru 560038',
        addressId: 'addr4',
        pickupOtp: '4872'
      },
      {
        orderId: 'ORD-DEMO-005',
        customerPhone: '913****5566',
        restaurantId: 'DEMO',
        restaurantName: 'YumDude Kitchen',
        restaurantImage: '',
        items: [
          { itemId: 'itm15', name: 'Veggie Thali', quantity: 2, price: 199 },
          { itemId: 'itm16', name: 'Papad', quantity: 2, price: 30 }
        ],
        foodTotal: 458,
        deliveryFee: 35,
        platformFee: 10,
        grandTotal: 503,
        status: OrderStatus.DELIVERED,
        riderId: 'RDR-091',
        createdAt: ts(95),
        deliveryAddress: '22, Sunrise Apartments, Whitefield',
        formattedAddress: 'Whitefield, Bengaluru 560066',
        addressId: 'addr5'
      },
      {
        orderId: 'ORD-DEMO-006',
        customerPhone: '912****3344',
        restaurantId: 'DEMO',
        restaurantName: 'YumDude Kitchen',
        restaurantImage: '',
        items: [
          { itemId: 'itm17', name: 'Chicken Burger', quantity: 1, price: 179 },
          { itemId: 'itm18', name: 'Fries', quantity: 1, price: 99 }
        ],
        foodTotal: 278,
        deliveryFee: 35,
        platformFee: 10,
        grandTotal: 323,
        status: OrderStatus.CANCELLED,
        riderId: null,
        createdAt: ts(55),
        deliveryAddress: '7, MG Road, Central Bengaluru',
        formattedAddress: 'MG Road, Bengaluru 560001',
        addressId: 'addr6',
        cancellationReason: 'Customer requested cancellation'
      }
    ];

    this.allOrders = samples;
    this.cdr.detectChanges();
  }

  dismissSampleMode(): void {
    this.allOrders = [];
    this.orderService.fetchOrders({ suppressNewOrderEffects: true });
    this.cdr.detectChanges();
  }
}

