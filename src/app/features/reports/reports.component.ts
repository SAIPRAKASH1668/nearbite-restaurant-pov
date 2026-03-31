import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { FileExportService } from '../../core/services/file-export.service';
import { OrderService } from '../../core/services/order.service';
import { Order, OrderStatus } from '../../core/models/order.model';
import { NotificationService } from '../../shared/components/notification/notification.service';

interface OrderReport extends Order {
  formattedDate: string;
  formattedTime: string;
  itemsCount: number;
}

interface SummaryStats {
  totalOrders: number;
  totalRevenue: number;
  avgOrderValue: number;
  deliveredOrders: number;
  cancelledOrders: number;
  deliveryRate: number;
}

interface DateFilterOption {
  label: string;
  days: number;
}

@Component({
  selector: 'app-reports',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './reports.component.html',
  styleUrl: './reports.component.scss'
})
export class ReportsComponent implements OnInit {
  // All orders
  allOrders: Order[] = [];
  
  // Filtered and displayed orders
  filteredOrders: OrderReport[] = [];
  displayedOrders: OrderReport[] = [];
  
  // Filters
  selectedDateRange: string = '30';
  customStartDate: string = '';
  customEndDate: string = '';
  showCustomDateRange = false;
  
  selectedStatuses: OrderStatus[] = [];
  searchQuery: string = '';
  
  // Pagination
  currentPage = 1;
  pageSize = 20;
  totalPages = 1;
  
  // Sorting
  sortField: keyof OrderReport = 'createdAt';
  sortDirection: 'asc' | 'desc' = 'desc';
  
  // Loading
  loading = true;
  
  // Summary stats
  stats: SummaryStats = {
    totalOrders: 0,
    totalRevenue: 0,
    avgOrderValue: 0,
    deliveredOrders: 0,
    cancelledOrders: 0,
    deliveryRate: 0
  };
  
  // Date range options
  dateRangeOptions: DateFilterOption[] = [
    { label: 'Last 7 Days', days: 7 },
    { label: 'Last 30 Days', days: 30 },
    { label: 'Last 90 Days', days: 90 },
    { label: 'All Time', days: -1 }
  ];
  
  // Status filters
  statusOptions: OrderStatus[] = [
    OrderStatus.CONFIRMED,
    OrderStatus.ACCEPTED,
    OrderStatus.PREPARING,
    OrderStatus.READY_FOR_PICKUP,
    OrderStatus.RIDER_ASSIGNED,
    OrderStatus.PICKED_UP,
    OrderStatus.OUT_FOR_DELIVERY,
    OrderStatus.DELIVERED,
    OrderStatus.CANCELLED
  ];
  
  // Expose OrderStatus enum to template
  OrderStatus = OrderStatus;
  
  // Expose Math for template
  Math = Math;
  
  // Filter dropdowns visibility
  showStatusFilter = false;

  // Order details modal
  showOrderDetailsModal = false;
  selectedOrder: OrderReport | null = null;

  constructor(
    private orderService: OrderService,
    private fileExportService: FileExportService,
    private notificationService: NotificationService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.initializeDates();
    this.loadOrders();
  }

  /**
   * Initialize date inputs with default range (last 30 days)
   */
  private initializeDates(): void {
    const today = new Date();
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(today.getDate() - 30);
    
    this.customStartDate = this.formatDateForInput(thirtyDaysAgo);
    this.customEndDate = this.formatDateForInput(today);
  }

  /**
   * Load orders from service
   */
  loadOrders(): void {
    this.loading = true;
    this.orderService.orders$.subscribe(orders => {
      this.allOrders = orders;
      this.applyFilters();
      this.loading = false;
      this.cdr.detectChanges();
    });
    
    this.orderService.fetchOrders();
  }

  /**
   * Apply all filters
   */
  applyFilters(): void {
    let filtered = [...this.allOrders];
    
    // Date range filter
    filtered = this.filterByDateRange(filtered);
    
    // Status filter
    if (this.selectedStatuses.length > 0) {
      filtered = filtered.filter(order => 
        this.selectedStatuses.includes(order.status)
      );
    }
    
    // Search filter (by order ID or customer phone)
    if (this.searchQuery.trim()) {
      const query = this.searchQuery.trim().toLowerCase();
      filtered = filtered.filter(order =>
        order.orderId.toLowerCase().includes(query) ||
        (order.customerPhone && order.customerPhone.toLowerCase().includes(query))
      );
    }
    
    // Convert to OrderReport format
    this.filteredOrders = filtered.map(order => this.convertToReport(order));
    
    // Calculate stats
    this.calculateStats();
    
    // Apply sorting
    this.applySorting();
    
    // Reset to page 1
    this.currentPage = 1;
    this.updatePagination();
  }

  /**
   * Filter orders by selected date range
   */
  private filterByDateRange(orders: Order[]): Order[] {
    if (this.selectedDateRange === 'custom') {
      if (!this.customStartDate || !this.customEndDate) return orders;
      
      const start = new Date(this.customStartDate);
      start.setHours(0, 0, 0, 0);
      const end = new Date(this.customEndDate);
      end.setHours(23, 59, 59, 999);
      
      return orders.filter(order => {
        const orderDate = new Date(order.createdAt);
        return orderDate >= start && orderDate <= end;
      });
    }
    
    const days = parseInt(this.selectedDateRange);
    if (days === -1) return orders; // All time
    
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);
    cutoffDate.setHours(0, 0, 0, 0);
    
    return orders.filter(order => {
      const orderDate = new Date(order.createdAt);
      return orderDate >= cutoffDate;
    });
  }

  /**
   * Convert Order to OrderReport
   */
  private convertToReport(order: Order): OrderReport {
    const date = new Date(order.createdAt);
    return {
      ...order,
      formattedDate: date.toLocaleDateString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric'
      }),
      formattedTime: date.toLocaleTimeString('en-IN', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: true
      }),
      itemsCount: order.items.length
    };
  }

  /**
   * Calculate summary statistics
   */
  private calculateStats(): void {
    const orders = this.filteredOrders;
    
    this.stats.totalOrders = orders.length;
    this.stats.totalRevenue = orders.reduce((sum, o) => sum + (o.grandTotal || 0), 0);
    this.stats.avgOrderValue = this.stats.totalOrders > 0 
      ? this.stats.totalRevenue / this.stats.totalOrders 
      : 0;
    this.stats.deliveredOrders = orders.filter(o => o.status === OrderStatus.DELIVERED).length;
    this.stats.cancelledOrders = orders.filter(o => o.status === OrderStatus.CANCELLED).length;
    this.stats.deliveryRate = this.stats.totalOrders > 0
      ? (this.stats.deliveredOrders / this.stats.totalOrders) * 100
      : 0;
  }

  /**
   * Apply sorting
   */
  private applySorting(): void {
    this.filteredOrders.sort((a, b) => {
      let aVal = a[this.sortField];
      let bVal = b[this.sortField];
      
      // Handle undefined and null
      if ((aVal === undefined || aVal === null) && (bVal === undefined || bVal === null)) return 0;
      if (aVal === undefined || aVal === null) return 1;
      if (bVal === undefined || bVal === null) return -1;
      
      // Compare
      let comparison = 0;
      if (aVal > bVal) comparison = 1;
      if (aVal < bVal) comparison = -1;
      
      return this.sortDirection === 'asc' ? comparison : -comparison;
    });
  }

  /**
   * Update pagination
   */
  private updatePagination(): void {
    this.totalPages = Math.ceil(this.filteredOrders.length / this.pageSize);
    if (this.currentPage > this.totalPages && this.totalPages > 0) {
      this.currentPage = this.totalPages;
    }
    if (this.currentPage < 1) this.currentPage = 1;
    
    const startIndex = (this.currentPage - 1) * this.pageSize;
    const endIndex = startIndex + this.pageSize;
    this.displayedOrders = this.filteredOrders.slice(startIndex, endIndex);
  }

  /**
   * Sort by column
   */
  sortBy(field: keyof OrderReport): void {
    if (this.sortField === field) {
      this.sortDirection = this.sortDirection === 'asc' ? 'desc' : 'asc';
    } else {
      this.sortField = field;
      this.sortDirection = 'desc';
    }
    this.applySorting();
    this.updatePagination();
  }

  /**
   * Get sort icon
   */
  getSortIcon(field: keyof OrderReport): string {
    if (this.sortField !== field) return '↕';
    return this.sortDirection === 'asc' ? '↑' : '↓';
  }

  /**
   * Date range changed
   */
  onDateRangeChange(): void {
    this.showCustomDateRange = this.selectedDateRange === 'custom';
    if (this.selectedDateRange !== 'custom') {
      this.applyFilters();
    }
  }

  /**
   * Custom date changed
   */
  onCustomDateChange(): void {
    if (this.customStartDate && this.customEndDate) {
      this.applyFilters();
    }
  }

  /**
   * Toggle status filter
   */
  toggleStatus(status: OrderStatus): void {
    const index = this.selectedStatuses.indexOf(status);
    if (index > -1) {
      this.selectedStatuses.splice(index, 1);
    } else {
      this.selectedStatuses.push(status);
    }
    this.applyFilters();
  }

  /**
   * Check if status is selected
   */
  isStatusSelected(status: OrderStatus): boolean {
    return this.selectedStatuses.includes(status);
  }

  /**
   * Clear all filters
   */
  clearFilters(): void {
    this.selectedDateRange = '30';
    this.showCustomDateRange = false;
    this.selectedStatuses = [];
    this.searchQuery = '';
    this.initializeDates();
    this.applyFilters();
  }

  /**
   * Search
   */
  onSearch(): void {
    this.applyFilters();
  }

  /**
   * Clear search
   */
  clearSearch(): void {
    this.searchQuery = '';
    this.applyFilters();
  }

  /**
   * Pagination
   */
  goToPage(page: number): void {
    if (page >= 1 && page <= this.totalPages) {
      this.currentPage = page;
      this.updatePagination();
    }
  }

  nextPage(): void {
    if (this.currentPage < this.totalPages) {
      this.currentPage++;
      this.updatePagination();
    }
  }

  previousPage(): void {
    if (this.currentPage > 1) {
      this.currentPage--;
      this.updatePagination();
    }
  }

  getPageNumbers(): number[] {
    const pages: number[] = [];
    const maxPages = 5;
    
    if (this.totalPages <= maxPages) {
      for (let i = 1; i <= this.totalPages; i++) {
        pages.push(i);
      }
    } else {
      pages.push(1);
      
      let start = Math.max(2, this.currentPage - 1);
      let end = Math.min(this.totalPages - 1, this.currentPage + 1);
      
      if (start > 2) pages.push(-1);
      
      for (let i = start; i <= end; i++) {
        pages.push(i);
      }
      
      if (end < this.totalPages - 1) pages.push(-1);
      
      pages.push(this.totalPages);
    }
    
    return pages;
  }

  /**
   * Format status label
   */
  getStatusLabel(status: OrderStatus): string {
    const statusMap: Record<OrderStatus, string> = {
      [OrderStatus.INITIATED]: 'Initiated',
      [OrderStatus.PENDING]: 'Pending',
      [OrderStatus.CONFIRMED]: 'Confirmed',
      [OrderStatus.ACCEPTED]: 'Accepted',
      [OrderStatus.PREPARING]: 'Preparing',
      [OrderStatus.READY_FOR_PICKUP]: 'Ready',
      [OrderStatus.AWAITING_RIDER_ASSIGNMENT]: 'Awaiting Rider',
      [OrderStatus.OFFERED_TO_RIDER]: 'Offered',
      [OrderStatus.RIDER_ASSIGNED]: 'Rider Assigned',
      [OrderStatus.PICKED_UP]: 'Picked Up',
      [OrderStatus.OUT_FOR_DELIVERY]: 'Out for Delivery',
      [OrderStatus.DELIVERED]: 'Delivered',
      [OrderStatus.CANCELLED]: 'Cancelled'
    };
    return statusMap[status] || status;
  }

  /**
   * Get status color class
   */
  getStatusColorClass(status: OrderStatus): string {
    const colorMap: Record<OrderStatus, string> = {
      [OrderStatus.INITIATED]: 'status-gray',
      [OrderStatus.PENDING]: 'status-orange',
      [OrderStatus.CONFIRMED]: 'status-blue',
      [OrderStatus.ACCEPTED]: 'status-blue',
      [OrderStatus.PREPARING]: 'status-purple',
      [OrderStatus.READY_FOR_PICKUP]: 'status-green',
      [OrderStatus.AWAITING_RIDER_ASSIGNMENT]: 'status-yellow',
      [OrderStatus.OFFERED_TO_RIDER]: 'status-teal',
      [OrderStatus.RIDER_ASSIGNED]: 'status-teal',
      [OrderStatus.PICKED_UP]: 'status-teal',
      [OrderStatus.OUT_FOR_DELIVERY]: 'status-teal',
      [OrderStatus.DELIVERED]: 'status-success',
      [OrderStatus.CANCELLED]: 'status-error'
    };
    return colorMap[status] || 'status-gray';
  }

  /**
   * Format currency
   */
  formatCurrency(amount: number): string {
    return `₹${amount.toFixed(2)}`;
  }

  /**
   * Format date for input
   */
  private formatDateForInput(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  /**
   * Open order details modal
   */
  openOrderDetails(order: OrderReport): void {
    this.selectedOrder = order;
    this.showOrderDetailsModal = true;
    this.cdr.detectChanges();
  }

  /**
   * Close order details modal
   */
  closeOrderDetails(): void {
    this.showOrderDetailsModal = false;
    this.selectedOrder = null;
    this.cdr.detectChanges();
  }

  /**
   * Calculate delivery time in minutes
   */
  getDeliveryTime(order: Order): string {
    if (order.status !== OrderStatus.DELIVERED) {
      return 'N/A';
    }
    
    // Currently, we don't have a deliveredAt timestamp in the Order model
    // For now, we'll estimate based on acceptedAt if available
    // In production, you'd want to add a deliveredAt field to the Order model
    
    if (!order.acceptedAt) {
      return 'N/A';
    }
    
    const acceptedTime = new Date(order.acceptedAt).getTime();
    const currentTime = new Date().getTime();
    
    // Estimate: typical delivery takes 30-45 minutes from acceptance
    // This is a placeholder calculation until deliveredAt is added
    const estimatedDeliveryMinutes = 35; // Average delivery time
    
    const diffMinutes = Math.round((currentTime - acceptedTime) / (1000 * 60));
    
    // If the order was accepted recently, use estimated time
    const deliveryMinutes = Math.min(diffMinutes, estimatedDeliveryMinutes);
    
    if (deliveryMinutes < 0) return 'N/A';
    if (deliveryMinutes < 60) return `${deliveryMinutes} min`;
    
    const hours = Math.floor(deliveryMinutes / 60);
    const minutes = deliveryMinutes % 60;
    return `${hours}h ${minutes}m`;
  }

  /**
   * Export to CSV
   */
  async exportCSV(): Promise<void> {
    const headers = ['Order ID', 'Date', 'Time', 'Customer Phone', 'Items', 'Amount', 'Status'];
    const rows = this.filteredOrders.map(order => [
      order.orderId,
      order.formattedDate,
      order.formattedTime,
      order.customerPhone,
      order.itemsCount.toString(),
      order.grandTotal?.toFixed(2) || '0.00',
      this.getStatusLabel(order.status)
    ]);
    
    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => this.escapeCsvCell(cell)).join(','))
    ].join('\n');

    try {
      await this.fileExportService.exportTextFile(csvContent, {
        fileName: `order-report-${new Date().toISOString().split('T')[0]}.csv`,
        mimeType: 'text/csv;charset=utf-8',
        title: 'Order Reports CSV',
        dialogTitle: 'Share order report CSV'
      });
      this.notificationService.success('Order report export is ready.');
    } catch (error) {
      console.error('Failed to export order report CSV', error);
      this.notificationService.error('Could not export order report. Please try again.');
    }
  }

  private escapeCsvCell(value: string): string {
    return `"${value.replace(/"/g, '""')}"`;
  }
}

