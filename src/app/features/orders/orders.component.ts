import { Component, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink, ActivatedRoute } from '@angular/router';
import { OrderNotificationService } from '../../core/services/order-notification.service';
import { OrderService } from '../../core/services/order.service';
import { Order, OrderAdjustmentRecord, OrderItem, OrderStatus } from '../../core/models/order.model';
import { Subscription } from 'rxjs';
import { OrderRejectionModalComponent } from '../../shared/components/order-rejection-modal/order-rejection-modal.component';
import { SoundService } from '../../core/services/sound.service';
import { PrinterService, PrintStatus } from '../../core/services/printer.service';
import { NotificationService } from '../../shared/components/notification/notification.service';
import { OrderIdHighlightPipe } from '../../shared/pipes/order-id-highlight.pipe';
import { MenuItem, MenuService } from '../../core/services/menu.service';

interface OrderEditLine {
  tempId: string;
  itemId: string;
  quantity: number;
  selectedAddOnIds: string[];
  source: 'existing' | 'new';
  originalItem?: OrderItem;
}

interface OrderCardSwapGroup {
  removedLabel: string;
  addedItems: OrderItem[];
}

@Component({
  selector: 'app-orders',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, OrderRejectionModalComponent, OrderIdHighlightPipe],
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

  // Manager order-modification state
  showSwapModal = false;
  swapOrder: Order | null = null;
  swapDraftItemId = '';
  swapDraftQuantity = 1;
  swapReplacementItems: OrderEditLine[] = [];
  swapReason = 'Item out of stock';
  swapSearchQuery = '';
  swapDraftAddOnIds: string[] = [];
  swapSubmitting = false;
  orderEditMobilePanel: 'current' | 'menu' | 'review' = 'menu';
  orderEditDetailsExpanded = false;
  swapReasonOptions = [
    'Item out of stock',
    'Customer requested order modification',
    'Kitchen stock change',
    'Wrong item selected'
  ];

  // Swap history modal state (separate from expandedOrder)
  showSwapHistoryModal = false;
  swapHistoryOrder: Order | null = null;
  
  // Status enum for template
  OrderStatus = OrderStatus;
  private readonly FOOD_READY_INTERNAL_STATUS = 'FOOD_READY';
  private readonly preFoodReadyDeliveryStatuses = new Set<OrderStatus>([
    OrderStatus.ACCEPTED,
    OrderStatus.PREPARING,
    OrderStatus.AWAITING_RIDER_ASSIGNMENT,
    OrderStatus.OFFERED_TO_RIDER,
    OrderStatus.RIDER_ASSIGNED
  ]);

  /** Page mode (driven by route data):
   *   - 'delivery' for /dashboard/orders   → DELIVERY orders only
   *   - 'theater'  for /dashboard/theater/orders → PICKUP (theater) orders only
   */
  mode: 'delivery' | 'theater' = 'delivery';

  get isTheaterMode(): boolean {
    return this.mode === 'theater';
  }

  constructor(
    private orderService: OrderService,
    private orderNotificationService: OrderNotificationService,
    private cdr: ChangeDetectorRef,
    private soundService: SoundService,
    private printerService: PrinterService,
    private notificationService: NotificationService,
    private menuService: MenuService,
    private route: ActivatedRoute
  ) {}

  private isConflictError(error: any): boolean {
    return error?.status === 409;
  }

  private notifyOrderAlreadyHandled(defaultMessage: string): void {
    this.notificationService.warning(defaultMessage);
    alert(defaultMessage);
  }

  ngOnInit(): void {
    this.printerStatusSub = this.printerService.status$.subscribe(s => {
      this.printStatus = s;
      this.cdr.detectChanges();
    });

    // Page mode comes from route data. Subscribing (vs. snapshot) keeps us
    // in sync if the user clicks between Orders ↔ Theater Orders without
    // remounting the component.
    this.route.data.subscribe((data) => {
      this.mode = (data['mode'] as 'delivery' | 'theater') || 'delivery';
      this.cdr.detectChanges();
    });

    this.loading = true;
    this.ordersSubscription = this.orderService.orders$.subscribe(orders => {
      this.allOrders = orders;
      this.loading = false;
      this.cdr.detectChanges();
    });
    this.orderService.fetchOrders();
    void this.menuService.ensureMenuLoaded().catch(() => {
      this.notificationService.warning('Menu could not be loaded for order modifications.');
    });
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
        filteredOrders = todayOrders.filter(o => this.isPreparingPhase(o));
        break;
      case 'ready':
        filteredOrders = todayOrders.filter(o => this.isReadyPhase(o));
        break;
      case 'completed':
        filteredOrders = todayOrders.filter(o => o.status === OrderStatus.DELIVERED);
        break;
      case 'cancelled':
        filteredOrders = todayOrders.filter(o =>
          o.status === OrderStatus.CANCELLED ||
          o.status === OrderStatus.FAILED_INVENTORY
        );
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
      if (!(orderDate >= today && orderDate < tomorrow)) return false;
      // Mode-aware split: /dashboard/orders shows DELIVERY only,
      //                  /dashboard/theater/orders shows PICKUP only.
      const isPickup = this.isPickupOrder(order);
      return this.isTheaterMode ? isPickup : !isPickup;
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
        return todayOrders.filter(o => this.isPreparingPhase(o)).length;
      case 'ready':
        return todayOrders.filter(o => this.isReadyPhase(o)).length;
      case 'completed':
        return todayOrders.filter(o => o.status === OrderStatus.DELIVERED).length;
      case 'cancelled':
        return todayOrders.filter(o =>
          o.status === OrderStatus.CANCELLED ||
          o.status === OrderStatus.FAILED_INVENTORY
        ).length;
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
    this.closeSwapModal();
    this.expandedOrder = null;
  }

  canAdjustOrder(order: Order | null): boolean {
    if (!order) return false;
    if (!['new', 'preparing'].includes(this.activeTab)) return false;
    return [
      OrderStatus.CONFIRMED,
      OrderStatus.ACCEPTED,
      OrderStatus.PREPARING
    ].includes(order.status);
  }

  openSwapModal(order: Order): void {
    if (!this.canAdjustOrder(order)) {
      this.notificationService.warning('This order can no longer be modified.');
      return;
    }

    this.swapOrder = order;
    this.swapDraftQuantity = 1;
    this.swapReplacementItems = (order.items || []).map(item => ({
      tempId: `existing-${item.itemId}`,
      itemId: item.itemId,
      quantity: Math.max(1, Number(item.quantity || 1)),
      selectedAddOnIds: [],
      source: 'existing',
      originalItem: item
    }));
    this.swapReason = 'Item out of stock';
    this.swapSearchQuery = '';
    this.swapDraftAddOnIds = [];
    this.swapDraftItemId = '';
    this.orderEditMobilePanel = 'menu';
    this.orderEditDetailsExpanded = false;
    this.showSwapModal = true;

    void this.menuService.ensureMenuLoaded()
      .then(() => {
        this.selectDefaultReplacement();
        this.cdr.detectChanges();
      })
      .catch(() => {
        this.notificationService.error('Menu is unavailable. Please refresh and try again.');
      });
  }

  closeSwapModal(): void {
    this.showSwapModal = false;
    this.swapOrder = null;
    this.swapDraftItemId = '';
    this.swapDraftQuantity = 1;
    this.swapReplacementItems = [];
    this.swapReason = 'Item out of stock';
    this.swapSearchQuery = '';
    this.swapDraftAddOnIds = [];
    this.swapSubmitting = false;
    this.orderEditMobilePanel = 'menu';
    this.orderEditDetailsExpanded = false;
  }

  get replacementOptions(): MenuItem[] {
    if (!this.swapOrder) return [];

    const selectedItemIds = new Set(this.swapReplacementItems.map(item => item.itemId));
    const query = this.swapSearchQuery.trim().toLowerCase();
    const isPickup = this.isPickupOrder(this.swapOrder);

    return this.menuService.currentItems
      .filter(item => {
        if (!item.itemId || selectedItemIds.has(item.itemId)) return false;
        if (item.isAvailable === false || item.effectivelyAvailable === false) return false;
        if (isPickup && item.theaterMode !== true) return false;
        if (!isPickup && item.theaterMode === true) return false;
        if (isPickup && item.theaterMode === true && typeof item.inventoryCount === 'number' && item.inventoryCount <= 0) {
          return false;
        }
        if (!query) return true;
        return [
          item.itemName,
          item.category,
          item.subCategory
        ].some(value => String(value || '').toLowerCase().includes(query));
      })
      .sort((a, b) => {
        const categorySort = String(a.category || '').localeCompare(String(b.category || ''));
        if (categorySort !== 0) return categorySort;
        return String(a.itemName || '').localeCompare(String(b.itemName || ''));
      });
  }

  get selectedDraftReplacementItem(): MenuItem | null {
    return this.menuService.currentItems.find(item => item.itemId === this.swapDraftItemId) || null;
  }

  get selectedDraftReplacementAddOns(): { optionId: string; name: string; extraPrice: number }[] {
    return (this.selectedDraftReplacementItem?.addOnOptions || [])
      .filter(option => this.swapDraftAddOnIds.includes(option.optionId));
  }

  get draftReplacementAddOnTotal(): number {
    return this.selectedDraftReplacementAddOns.reduce((sum, option) => sum + Number(option.extraPrice || 0), 0);
  }

  get originalOrderTotal(): number {
    return (this.swapOrder?.items || []).reduce(
      (sum, item) => sum + (Number(item.price || 0) + this.getOrderItemAddOnTotal(item)) * Math.max(1, Number(item.quantity || 1)),
      0
    );
  }

  get editedOrderTotal(): number {
    return this.swapReplacementItems.reduce((sum, line) => sum + this.getReplacementLineTotal(line), 0);
  }

  get estimatedSwapDelta(): number {
    return this.editedOrderTotal - this.originalOrderTotal;
  }

  get canSubmitSwap(): boolean {
    return Boolean(
      this.swapOrder &&
      this.canAdjustOrder(this.swapOrder) &&
      this.swapReplacementItems.length > 0 &&
      this.hasOrderEditChanges() &&
      this.swapReason.trim() &&
      !this.swapSubmitting
    );
  }

  private selectDefaultReplacement(): void {
    const first = this.replacementOptions[0];
    this.swapDraftItemId = first?.itemId || '';
    this.swapDraftAddOnIds = [];
  }

  selectReplacementItem(item: MenuItem): void {
    this.swapDraftItemId = item.itemId;
    this.swapDraftAddOnIds = [];
  }

  toggleReplacementAddOn(optionId: string): void {
    this.swapDraftAddOnIds = this.swapDraftAddOnIds.includes(optionId)
      ? this.swapDraftAddOnIds.filter(id => id !== optionId)
      : [...this.swapDraftAddOnIds, optionId];
  }

  incrementSwapQuantity(): void {
    if (this.swapDraftQuantity < 99) this.swapDraftQuantity++;
  }

  decrementSwapQuantity(): void {
    if (this.swapDraftQuantity > 1) this.swapDraftQuantity--;
  }

  addReplacementLine(): void {
    if (!this.selectedDraftReplacementItem) return;

    const itemId = this.selectedDraftReplacementItem.itemId;
    if (this.swapReplacementItems.some(line => line.itemId === itemId)) {
      this.notificationService.warning('This item is already in the new order. Adjust its quantity instead.');
      return;
    }

    const selectedAddOnIds = [...this.swapDraftAddOnIds].sort();
    const quantity = Math.max(1, Number(this.swapDraftQuantity || 1));

    this.swapReplacementItems = [
      ...this.swapReplacementItems,
      {
        tempId: `new-${itemId}-${Date.now()}`,
        itemId,
        quantity,
        selectedAddOnIds,
        source: 'new'
      }
    ];

    this.swapDraftQuantity = 1;
    this.swapDraftAddOnIds = [];
    this.selectDefaultReplacement();
  }

  removeReplacementLine(tempId: string): void {
    this.swapReplacementItems = this.swapReplacementItems.filter(line => line.tempId !== tempId);
  }

  updateReplacementLineQuantity(tempId: string, delta: number): void {
    this.swapReplacementItems = this.swapReplacementItems
      .map(line => line.tempId === tempId
        ? { ...line, quantity: Math.max(1, Math.min(99, line.quantity + delta)) }
        : line
      );
  }

  confirmSwap(): void {
    if (!this.canSubmitSwap || !this.swapOrder) return;

    this.swapSubmitting = true;

    this.orderService.adjustItems(this.swapOrder.orderId, {
      items: this.swapReplacementItems.map(line => ({
        itemId: line.itemId,
        quantity: Math.max(1, Number(line.quantity || 1)),
        ...(line.selectedAddOnIds.length
          ? { addOns: line.selectedAddOnIds.map(optionId => ({ optionId })) }
          : {})
      })),
      reason: this.swapReason.trim()
    }).subscribe({
      next: (result) => {
        const deltaText = result.delta === 0
          ? 'No bill change.'
          : `${result.delta > 0 ? 'Customer owes' : 'Refund due'} ${this.formatMoney(Math.abs(result.delta))}.`;
        this.notificationService.success(`Order modified. ${deltaText}`);
        this.closeSwapModal();
        this.orderService.fetchOrders({ suppressNewOrderEffects: true });
      },
      error: (error) => {
        this.swapSubmitting = false;
        const message = error?.error?.message || 'Order modification failed. Please refresh and try again.';
        this.notificationService.error(message);
      }
    });
  }

  getOrderItemAddOnTotal(item: OrderItem): number {
    if (typeof item.addOnTotal === 'number') return item.addOnTotal;
    return (item.addOns || item.addOnOptions || []).reduce((sum, option) => sum + Number(option.extraPrice || 0), 0);
  }

  getReplacementLineMenuItem(line: OrderEditLine): MenuItem | null {
    return this.menuService.currentItems.find(item => item.itemId === line.itemId) || null;
  }

  getReplacementLineName(line: OrderEditLine): string {
    return line.originalItem?.name || this.getReplacementLineMenuItem(line)?.itemName || line.itemId;
  }

  getReplacementLineAddOns(line: OrderEditLine): { optionId: string; name: string; extraPrice: number }[] {
    if (line.source === 'existing') return line.originalItem?.addOns || line.originalItem?.addOnOptions || [];
    const item = this.getReplacementLineMenuItem(line);
    return (item?.addOnOptions || []).filter(option => line.selectedAddOnIds.includes(option.optionId));
  }

  getReplacementLineAddOnTotal(line: OrderEditLine): number {
    if (line.source === 'existing' && line.originalItem) return this.getOrderItemAddOnTotal(line.originalItem);
    return this.getReplacementLineAddOns(line).reduce((sum, option) => sum + Number(option.extraPrice || 0), 0);
  }

  getReplacementLineUnitPrice(line: OrderEditLine): number {
    if (line.source === 'existing' && line.originalItem) {
      return Number(line.originalItem.price || 0) + this.getOrderItemAddOnTotal(line.originalItem);
    }

    const item = this.getReplacementLineMenuItem(line);
    return Number(item?.price || 0) + this.getReplacementLineAddOnTotal(line);
  }

  getReplacementLineTotal(line: OrderEditLine): number {
    return this.getReplacementLineUnitPrice(line) * Math.max(1, Number(line.quantity || 1));
  }

  getReplacementLineAddOnLabel(line: OrderEditLine): string {
    const labels = this.getReplacementLineAddOns(line).map(option => option.name);
    return labels.length ? labels.join(', ') : '';
  }

  getLineOriginalQuantity(line: OrderEditLine): number {
    return Math.max(0, Number(line.originalItem?.quantity || 0));
  }

  isLineChanged(line: OrderEditLine): boolean {
    if (line.source === 'new') return true;
    return this.getLineOriginalQuantity(line) !== Math.max(1, Number(line.quantity || 1));
  }

  hasOrderEditChanges(): boolean {
    if (!this.swapOrder) return false;

    const originalIds = new Set((this.swapOrder.items || []).map(item => item.itemId));
    const nextIds = new Set(this.swapReplacementItems.map(line => line.itemId));
    if (originalIds.size !== nextIds.size) return true;
    for (const item of this.swapOrder.items || []) {
      const next = this.swapReplacementItems.find(line => line.itemId === item.itemId);
      if (!next || Math.max(1, Number(next.quantity || 1)) !== Math.max(1, Number(item.quantity || 1))) {
        return true;
      }
    }
    return this.swapReplacementItems.some(line => line.source === 'new' && !originalIds.has(line.itemId));
  }

  formatMoney(value: number | undefined | null): string {
    return `₹${Number(value || 0).toFixed(2)}`;
  }

  getLatestAdjustment(order: Order | null) {
    return order?.adjustments?.length ? order.adjustments[order.adjustments.length - 1] : null;
  }

  hasSwapHistory(order: Order | null): boolean {
    return !!order?.adjustments?.length;
  }

  getAdjustmentsNewestFirst(order: Order | null): OrderAdjustmentRecord[] {
    const adjustments = order?.adjustments || [];
    return [...adjustments].sort((a, b) => {
      const bTime = b.at ? new Date(b.at).getTime() : 0;
      const aTime = a.at ? new Date(a.at).getTime() : 0;
      return (bTime - aTime) || (adjustments.indexOf(b) - adjustments.indexOf(a));
    });
  }

  getAdjustmentVersionLabel(order: Order | null, adjustment: OrderAdjustmentRecord): string {
    const originalIndex = (order?.adjustments || []).indexOf(adjustment);
    return originalIndex >= 0 ? `V${originalIndex + 2}` : 'V-';
  }

  getOrderItemName(order: Order | null, itemId: string): string {
    const orderItem = order?.items?.find(item => item.itemId === itemId);
    if (orderItem?.name) return orderItem.name;

    const menuItem = this.menuService.currentItems.find(item => item.itemId === itemId);
    return menuItem?.itemName || itemId;
  }

  getAdjustmentRemovedLabels(order: Order | null, adjustment: OrderAdjustmentRecord): string {
    const labels = (adjustment.removedItemIds || []).map(itemId => this.getOrderItemName(order, itemId));
    return labels.length ? labels.join(', ') : 'None';
  }

  getAdjustmentAddedLabels(adjustment: OrderAdjustmentRecord): string {
    const labels = (adjustment.addedItems || []).map(item => `${item.name}×${item.quantity}`);
    return labels.length ? labels.join(', ') : 'None';
  }

  getAdjustmentSummary(order: Order | null, adjustment: OrderAdjustmentRecord): string {
    const removed = this.getAdjustmentRemovedLabels(order, adjustment);
    const added = this.getAdjustmentAddedLabels(adjustment);
    const quantityChanges = adjustment.quantityChanges || [];
    const changes: string[] = [];

    if (removed !== 'None') changes.push(`removed ${removed}`);
    if (added !== 'None') changes.push(`added ${added}`);
    if (quantityChanges.length) {
      changes.push(`${quantityChanges.length} quantity change${quantityChanges.length !== 1 ? 's' : ''}`);
    }

    return changes.length ? `Modified order: ${changes.join(', ')}` : adjustment.reason || 'Order modified';
  }

  getSwapSummary(order: Order): string {
    const adjustment = this.getLatestAdjustment(order);
    if (!adjustment) return 'Order modified';

    return this.getAdjustmentSummary(order, adjustment);
  }

  getOrderCardItems(order: Order | null): OrderItem[] {
    return this.getOrderCardSourceItems(order)
      .filter(item => !this.getOrderCardSwapReplacementIds(order).has(item.itemId));
  }

  hasOrderCardContent(order: Order | null): boolean {
    return Boolean(this.getOrderCardSwapGroup(order) || this.getOrderCardItems(order).length);
  }

  getOrderCardSwapGroup(order: Order | null): OrderCardSwapGroup | null {
    const adjustment = this.getLatestAdjustment(order);
    const addedItems = adjustment?.addedItems || [];
    const removedItemIds = adjustment?.removedItemIds || [];

    if (!removedItemIds.length || !addedItems.length) return null;

    const removedLabel = removedItemIds
      .map(itemId => this.getOrderItemName(order, itemId))
      .filter(Boolean)
      .join(', ');

    return {
      removedLabel: removedLabel || 'unavailable item',
      addedItems
    };
  }

  private getOrderCardSourceItems(order: Order | null): OrderItem[] {
    return order?.items?.length
      ? order.items
      : this.getLatestAdjustment(order)?.addedItems || [];
  }

  private getOrderCardSwapReplacementIds(order: Order | null): Set<string> {
    const adjustment = this.getLatestAdjustment(order);
    const hasSwapGroup = Boolean(adjustment?.removedItemIds?.length && adjustment?.addedItems?.length);
    return new Set(hasSwapGroup ? (adjustment?.addedItems || []).map(item => item.itemId) : []);
  }

  viewSwapHistory(order: Order): void {
    this.swapHistoryOrder = order;
    this.showSwapHistoryModal = true;
    this.cdr.detectChanges();
  }

  closeSwapHistoryModal(): void {
    this.showSwapHistoryModal = false;
    this.swapHistoryOrder = null;
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
      [OrderStatus.CANCELLED]: 'Cancelled',
      [OrderStatus.FAILED_INVENTORY]: 'Sold Out (Refunded)'
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
      [OrderStatus.CANCELLED]: 'red',
      [OrderStatus.FAILED_INVENTORY]: 'red'
    };
    return colorMap[status] || 'gray';
  }

  /** True when an order is a theater (in-venue) PICKUP order. */
  isPickupOrder(order: Order): boolean {
    return order?.orderType === 'PICKUP' || /^THEATER#/i.test(order?.addressId || '');
  }

  isFoodReady(order: Order): boolean {
    return order?.internalStatus === this.FOOD_READY_INTERNAL_STATUS || order?.status === OrderStatus.READY_FOR_PICKUP;
  }

  isPreparingPhase(order: Order): boolean {
    if (this.isPickupOrder(order)) return false;
    return this.preFoodReadyDeliveryStatuses.has(order.status) && !this.isFoodReady(order);
  }

  isReadyPhase(order: Order): boolean {
    if (this.isPickupOrder(order)) return order.status === OrderStatus.READY_FOR_PICKUP;
    if (order.status === OrderStatus.PICKED_UP || order.status === OrderStatus.OUT_FOR_DELIVERY) return true;
    return this.isFoodReady(order) && [
      OrderStatus.READY_FOR_PICKUP,
      OrderStatus.AWAITING_RIDER_ASSIGNMENT,
      OrderStatus.OFFERED_TO_RIDER,
      OrderStatus.RIDER_ASSIGNED
    ].includes(order.status);
  }

  canMarkReady(order: Order): boolean {
    return !this.isPickupOrder(order) && this.isPreparingPhase(order);
  }

  /** Parse the stored "{venue} - {seat}" address into its two halves. */
  parseTheaterAddress(order: Order): { venue: string; seat: string } {
    const raw = String(order?.deliveryAddress || '');
    const idx = raw.lastIndexOf(' - ');
    if (idx === -1) return { venue: raw, seat: '' };
    return { venue: raw.slice(0, idx).trim(), seat: raw.slice(idx + 3).trim() };
  }

  /** Mark a theater PICKUP order as ready for pickup (instead of OUT_FOR_DELIVERY). */
  markReadyForPickup(order: Order, event?: Event): void {
    event?.stopPropagation();
    this.orderService.updateOrderStatus(order.orderId, OrderStatus.READY_FOR_PICKUP).subscribe({
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

  /** Mark a theater PICKUP order as picked up (terminal — uses DELIVERED status). */
  markPickedUp(order: Order, event?: Event): void {
    event?.stopPropagation();
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
    this.orderService.updateOrderStatus(order.orderId, OrderStatus.PREPARING, {
      preparationTime: prepTime,
      expectedCurrentStatus: OrderStatus.CONFIRMED
    }).subscribe({
      next: () => {
        this.orderNotificationService.notifyOrderAccepted(order.orderId);
        this.orderService.fetchOrders();
      },
      error: (error) => {
        this.orderService.fetchOrders();
        if (this.isConflictError(error)) {
          this.cancelPrepTimeModal();
          this.notifyOrderAlreadyHandled('Order already handled on another device.');
          return;
        }
        this.notificationService.error('Failed to accept order. Please refresh and try again.');
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
      { cancellationReason: reason, expectedCurrentStatus: OrderStatus.CONFIRMED }
    ).subscribe({
      next: () => {
        this.orderNotificationService.notifyOrderRejected(this.selectedOrderForRejection!.orderId);
        this.orderService.fetchOrders();
        this.showRejectionModal = false;
        this.selectedOrderForRejection = null;
      },
      error: (error) => {
        this.orderService.fetchOrders();
        if (this.isConflictError(error)) {
          this.showRejectionModal = false;
          this.selectedOrderForRejection = null;
          this.notifyOrderAlreadyHandled('Order already handled on another device.');
          return;
        }
        this.notificationService.error('Failed to reject order. Please try again.');
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
    this.orderService.updateOrderStatus(order.orderId, OrderStatus.PREPARING, {
      expectedCurrentStatus: OrderStatus.CONFIRMED
    }).subscribe({
      next: (updatedOrder) => {
        const index = this.allOrders.findIndex(o => o.orderId === order.orderId);
        if (index !== -1) {
          this.allOrders[index] = updatedOrder;
          this.cdr.detectChanges();
        }
      },
      error: (error) => {
        this.orderService.fetchOrders();
        this.notificationService.error(
          this.isConflictError(error)
            ? 'Order already handled on another device.'
            : 'Failed to update order. Please try again.'
        );
      }
    });
  }

  /**
   * Mark order as ready
   */
  markReady(order: Order): void {
    const nextStatus = [OrderStatus.ACCEPTED, OrderStatus.PREPARING].includes(order.status)
      ? OrderStatus.READY_FOR_PICKUP
      : order.status;

    this.orderService.updateOrderStatus(order.orderId, nextStatus, {
      expectedCurrentStatus: order.status,
      internalStatus: this.FOOD_READY_INTERNAL_STATUS
    }).subscribe({
      next: () => {
        this.orderService.fetchOrders();
      },
      error: (error) => {
        this.orderService.fetchOrders();
        if (this.isConflictError(error)) {
          if (this.expandedOrder?.orderId === order.orderId) {
            this.closeExpandedOrder();
          }
          this.notifyOrderAlreadyHandled('Order already moved by another device.');
          return;
        }
        this.notificationService.error('Failed to update order. Please try again.');
      }
    });
  }

  /**
   * Mark order as out for delivery
   */
  markOutForDelivery(order: Order, event?: Event): void {
    event?.stopPropagation();
    this.orderService.updateOrderStatus(order.orderId, OrderStatus.OUT_FOR_DELIVERY).subscribe({
      next: () => {
        this.orderService.fetchOrders();
        if (this.expandedOrder?.orderId === order.orderId) {
          this.closeExpandedOrder();
        }
      },
      error: (error) => {
        this.orderService.fetchOrders();
        if (this.isConflictError(error)) {
          if (this.expandedOrder?.orderId === order.orderId) {
            this.closeExpandedOrder();
          }
          this.notifyOrderAlreadyHandled('Order already moved by another device.');
          return;
        }
        this.notificationService.error('Failed to update order. Please try again.');
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
    if (this.canMarkReady(order)) return ['ready'];

    switch (order.status) {
      case OrderStatus.CONFIRMED:
        return ['accept', 'reject'];
      default:
        return [];
    }
  }

  /**
   * Determine if pickup OTP should be shown
   * Show OTP when order is ready for pickup but not yet picked up by rider
   */
  shouldShowPickupOtp(order: Order): boolean {
    return this.isFoodReady(order) && [
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

