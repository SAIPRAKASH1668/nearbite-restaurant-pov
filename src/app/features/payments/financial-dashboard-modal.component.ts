import { Component, OnInit, OnDestroy, ChangeDetectionStrategy, ChangeDetectorRef, ElementRef, Inject } from '@angular/core';
import { CommonModule, DOCUMENT } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { 
  Payment, 
  EarningsSummary, 
  CommissionBreakdown, 
  PaymentStatusCounts,
  PaymentFilters,
  SortConfig,
  PaginationConfig,
  SettlementStatus,
  RestaurantEarning
} from '../../core/models/payment.model';
import { PaymentService } from '../../core/services/payment.service';
import { PaymentExportGroup } from '../../core/services/payment.service';
import { RestaurantContextService } from '../../core/services/restaurant-context.service';
import { NotificationService } from '../../shared/components/notification/notification.service';
import { OrderIdHighlightPipe } from '../../shared/pipes/order-id-highlight.pipe';

type FinancialTableTab = 'UNSETTLED' | 'SETTLED';
type SettledGroupMode = 'SETTLEMENT_ID' | 'WEEK' | 'DATE_RANGE';

interface PaymentGroup {
  key: string;
  label: string;
  payments: Payment[];
  totalGross: number;
  totalGstOnFood: number;
  totalCommission: number;
  totalNet: number;
}

@Component({
  selector: 'app-financial-dashboard-modal',
  standalone: true,
  imports: [CommonModule, FormsModule, OrderIdHighlightPipe],
  templateUrl: './financial-dashboard-modal.component.html',
  styleUrl: './financial-dashboard-modal.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class FinancialDashboardModalComponent implements OnInit, OnDestroy {
  
  // Modal visibility
  isVisible = false;

  // Data stores
  allPayments: Payment[] = [];
  filteredPayments: Payment[] = [];
  displayedPayments: Payment[] = [];
  
  earnings: EarningsSummary | null = null;
  commission: CommissionBreakdown | null = null;
  statusCounts: PaymentStatusCounts | null = null;

  // Filters
  filters: PaymentFilters = {};
  startDate: string = '';
  endDate: string = '';
  
  selectedSettlementStatuses: SettlementStatus[] = [];

  // Filter visibility toggles
  showSettlementStatusFilter = false;

  // Search
  searchOrderId: string = '';
  selectedCommentOrderId = '';
  selectedCommentText = '';

  // Table view
  activeTableTab: FinancialTableTab = 'UNSETTLED';
  settledGroupMode: SettledGroupMode = 'SETTLEMENT_ID';
  settledGroups: PaymentGroup[] = [];
  collapsedGroupKeys = new Set<string>();

  // Pagination
  pagination: PaginationConfig = {
    currentPage: 1,
    pageSize: 15, // Show 15 rows per page (compact, manageable)
    totalItems: 0,
    totalPages: 0
  };

  // Sorting
  sortConfig: SortConfig = { field: 'deliveryDate', direction: 'desc' };

  // Loading states
  isLoading = false;
  isExporting = false;

  // Filter options (loaded from service - production-ready)
  settlementStatuses: SettlementStatus[] = [];

  // Expose Math for template
  Math = Math;

  // Real AWS data
  realEarnings: RestaurantEarning[] = [];
  useRealData = true; // Toggle to switch between real and mock data

  private _originalParent: Element | null = null;

  constructor(
    private paymentService: PaymentService,
    private restaurantContextService: RestaurantContextService,
    private notificationService: NotificationService,
    private cdr: ChangeDetectorRef,
    private el: ElementRef<HTMLElement>,
    @Inject(DOCUMENT) private document: Document
  ) {}

  ngOnInit(): void {
    // Set default date range: last 30 days
    const today = new Date();
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(today.getDate() - 30);
    
    this.startDate = this.formatDateForInput(thirtyDaysAgo);
    this.endDate = this.formatDateForInput(today);
    
    // Load filter options from service (production-ready)
    this.paymentService.getSettlementStatuses().subscribe(statuses => {
      this.settlementStatuses = statuses;
      this.cdr.markForCheck();
    });
    
    this.loadData();
  }

  /**
   * Open modal and load fresh data
   */
  open(): void {
    // Teleport host to document.body so position:fixed covers the full viewport,
    // escaping any ancestor stacking context (transforms, transitions, etc.)
    if (!this._originalParent) {
      this._originalParent = this.el.nativeElement.parentElement;
    }
    this.document.body.appendChild(this.el.nativeElement);
    this.isVisible = true;
    this.loadData();
    this.cdr.markForCheck();
  }

  /**
   * Close modal
   */
  close(): void {
    this.isVisible = false;
    this.cdr.markForCheck();
  }

  ngOnDestroy(): void {
    // Return host to original parent on destroy to avoid DOM leaks
    if (this._originalParent && this.el.nativeElement.parentElement === this.document.body) {
      this._originalParent.appendChild(this.el.nativeElement);
    }
  }

  /**
   * Load all financial data with current filters
   * IMPORTANT: Filters apply to ENTIRE dataset, then we paginate
   */
  loadData(): void {
    this.isLoading = true;
    this.cdr.markForCheck();

    // Update filters from UI
    this.updateFiltersFromUI();

    if (this.useRealData) {
      // Load REAL data from AWS
      this.loadRealDataFromAWS();
    } else {
      // Load mock data (fallback)
      this.loadMockData();
    }
  }

  /**
   * Load real restaurant earnings from AWS backend
   */
  private loadRealDataFromAWS(): void {
    const restaurantId = this.restaurantContextService.getRestaurantId();
    
    this.paymentService.getRestaurantFinancialData(
      restaurantId,
      this.startDate,
      this.endDate
    ).subscribe({
      next: (data) => {
        this.realEarnings = data.history;
        this.allPayments = data.payments;
        this.earnings = data.earningsSummary;
        this.commission = data.commissionBreakdown;
        this.statusCounts = data.statusCounts;
        
        // Apply search and update UI
        this.applySearch();
        this.pagination.currentPage = 1;
        this.updatePagination();
        
        this.isLoading = false;
        this.cdr.markForCheck();
      },
      error: () => {
        this.isLoading = false;
        this.cdr.markForCheck();
      }
    });
  }

  /**
   * Load mock data (original implementation)
   */
  private loadMockData(): void {
    this.paymentService.getFilteredPayments(this.filters).subscribe(payments => {
      this.allPayments = payments;
      this.applySearch();
      this.pagination.currentPage = 1;
      this.updatePagination();
      this.isLoading = false;
      this.cdr.markForCheck();
    });

    this.paymentService.getEarningsSummary().subscribe(earnings => {
      this.earnings = earnings;
      this.cdr.markForCheck();
    });

    this.paymentService.getCommissionBreakdown(this.filters).subscribe(commission => {
      this.commission = commission;
      this.cdr.markForCheck();
    });

    this.paymentService.getStatusCounts(this.filters).subscribe(counts => {
      this.statusCounts = counts;
      this.cdr.markForCheck();
    });
  }

  /**
   * Update filters object from UI inputs
   */
  private updateFiltersFromUI(): void {
    this.filters = {
      startDate: this.startDate || undefined,
      endDate: this.endDate || undefined,
      settlementStatus: this.selectedSettlementStatuses.length > 0 ? this.selectedSettlementStatuses : undefined
    };
  }

  /**
   * Apply date range filter
   */
  applyDateFilter(): void {
    this.loadData();
  }

  /**
   * Clear all filters and reload
   */
  clearFilters(): void {
    const today = new Date();
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(today.getDate() - 30);
    
    this.startDate = this.formatDateForInput(thirtyDaysAgo);
    this.endDate = this.formatDateForInput(today);
    this.selectedSettlementStatuses = [];
    this.searchOrderId = '';
    
    this.loadData();
  }

  /**
   * Search by Order ID
   */
  onSearchChange(): void {
    this.applySearch();
    this.pagination.currentPage = 1;
    this.updatePagination();
    this.cdr.markForCheck();
  }

  clearSearch(): void {
    this.searchOrderId = '';
    this.applySearch();
    this.pagination.currentPage = 1;
    this.updatePagination();
    this.cdr.markForCheck();
  }

  hasComments(payment: Payment): boolean {
    return !!payment.comments?.trim();
  }

  openComments(payment: Payment): void {
    if (!this.hasComments(payment)) return;
    this.selectedCommentOrderId = payment.orderId;
    this.selectedCommentText = payment.comments!.trim();
    this.cdr.markForCheck();
  }

  closeComments(): void {
    this.selectedCommentOrderId = '';
    this.selectedCommentText = '';
    this.cdr.markForCheck();
  }

  async copySettlementId(settlementId: string | null | undefined, event?: MouseEvent): Promise<void> {
    event?.stopPropagation();
    if (!settlementId) return;

    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(settlementId);
      } else {
        this.copyTextFallback(settlementId);
      }
      this.notificationService.success('Settlement ID copied.');
    } catch (error) {
      console.error('Failed to copy settlement ID', error);
      this.notificationService.error('Could not copy settlement ID.');
    }
  }

  private copyTextFallback(text: string): void {
    const textarea = this.document.createElement('textarea');
    textarea.value = text;
    textarea.setAttribute('readonly', '');
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    this.document.body.appendChild(textarea);
    textarea.select();
    const copied = this.document.execCommand('copy');
    this.document.body.removeChild(textarea);

    if (!copied) {
      throw new Error('Clipboard fallback failed');
    }
  }

  private applySearch(): void {
    // Start with all payments
    let payments = [...this.allPayments];

    // Apply order ID search
    if (this.searchOrderId.trim()) {
      const searchTerm = this.searchOrderId.trim().toLowerCase();
      payments = payments.filter(p => 
        p.orderId.toLowerCase().includes(searchTerm)
      );
    }
    
    this.filteredPayments = payments;
    this.applySorting();
  }

  setTableTab(tab: FinancialTableTab): void {
    this.activeTableTab = tab;
    this.pagination.currentPage = 1;
    this.updatePagination();
    this.cdr.markForCheck();
  }

  setSettledGroupMode(mode: SettledGroupMode): void {
    this.settledGroupMode = mode;
    this.collapsedGroupKeys.clear();
    this.updateSettledGroups(this.getActiveTabPayments());
    this.cdr.markForCheck();
  }

  toggleSettledGroup(groupKey: string): void {
    if (this.collapsedGroupKeys.has(groupKey)) {
      this.collapsedGroupKeys.delete(groupKey);
    } else {
      this.collapsedGroupKeys.add(groupKey);
    }
    this.cdr.markForCheck();
  }

  isSettledGroupCollapsed(groupKey: string): boolean {
    return this.collapsedGroupKeys.has(groupKey);
  }

  getTabCount(tab: FinancialTableTab): number {
    const status: SettlementStatus = tab === 'SETTLED' ? 'SETTLED' : 'NOT_INITIATED';
    return this.filteredPayments.filter(payment => payment.settlementStatus === status).length;
  }

  getActiveTableTitle(): string {
    if (this.activeTableTab === 'UNSETTLED') {
      return 'Unsettled Transactions';
    }
    const labels: Record<SettledGroupMode, string> = {
      SETTLEMENT_ID: 'Settled Transactions by Settlement ID',
      WEEK: 'Settled Transactions by Week',
      DATE_RANGE: 'Settled Transactions for Selected Dates'
    };
    return labels[this.settledGroupMode];
  }

  private getActiveTabPayments(): Payment[] {
    const status: SettlementStatus = this.activeTableTab === 'SETTLED' ? 'SETTLED' : 'NOT_INITIATED';
    return this.filteredPayments.filter(payment => payment.settlementStatus === status);
  }

  private updateSettledGroups(payments: Payment[]): void {
    if (this.activeTableTab !== 'SETTLED') {
      this.settledGroups = [];
      return;
    }

    const groupMap = new Map<string, Payment[]>();

    payments.forEach((payment) => {
      const key = this.getGroupKey(payment);
      const groupPayments = groupMap.get(key) || [];
      groupPayments.push(payment);
      groupMap.set(key, groupPayments);
    });

    this.settledGroups = Array.from(groupMap.entries())
      .map(([key, groupPayments]) => this.buildPaymentGroup(key, groupPayments))
      .sort((a, b) => this.getGroupLatestDeliveryTime(b) - this.getGroupLatestDeliveryTime(a));
  }

  private getGroupKey(payment: Payment): string {
    if (this.settledGroupMode === 'SETTLEMENT_ID') {
      return payment.settlementId || 'No Settlement ID';
    }
    if (this.settledGroupMode === 'DATE_RANGE') {
      return `${this.startDate || 'Start'} to ${this.endDate || 'End'}`;
    }

    return this.getWeekKey(this.getOrderDeliveryDate(payment));
  }

  private buildPaymentGroup(key: string, payments: Payment[]): PaymentGroup {
    return {
      key,
      label: this.getGroupLabel(key, payments),
      payments: [...payments].sort((a, b) => this.getOrderDeliveryTime(b) - this.getOrderDeliveryTime(a)),
      totalGross: payments.reduce((sum, payment) => sum + payment.grossAmount, 0),
      totalGstOnFood: payments.reduce((sum, payment) => sum + payment.gstOnFoodAmount, 0),
      totalCommission: payments.reduce((sum, payment) => sum + payment.commissionAmount, 0),
      totalNet: payments.reduce((sum, payment) => sum + payment.netPayoutAmount, 0)
    };
  }

  private getGroupLatestDeliveryTime(group: PaymentGroup): number {
    return Math.max(...group.payments.map(payment => this.getOrderDeliveryTime(payment)), 0);
  }

  getOrderDeliveryDate(payment: Payment): string {
    return payment.deliveryDate || payment.createdAt;
  }

  private getOrderDeliveryTime(payment: Payment): number {
    const time = new Date(this.getOrderDeliveryDate(payment)).getTime();
    return Number.isNaN(time) ? 0 : time;
  }

  private getGroupLabel(key: string, payments: Payment[]): string {
    if (this.settledGroupMode === 'SETTLEMENT_ID') {
      return key;
    }
    if (this.settledGroupMode === 'DATE_RANGE') {
      return `Selected Dates (${this.formatDate(this.startDate)} - ${this.formatDate(this.endDate)})`;
    }

    const firstPayment = payments[0];
    return firstPayment ? this.formatWeekLabel(this.getOrderDeliveryDate(firstPayment)) : key;
  }

  private getWeekKey(dateString: string): string {
    const date = new Date(dateString);
    if (Number.isNaN(date.getTime())) {
      return 'Unknown Week';
    }
    const weekStart = this.getWeekStart(date);
    return weekStart.toISOString().slice(0, 10);
  }

  private formatWeekLabel(dateString: string): string {
    const date = new Date(dateString);
    if (Number.isNaN(date.getTime())) {
      return 'Unknown Week';
    }
    const weekStart = this.getWeekStart(date);
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 6);
    return `${this.formatDate(this.formatDateForInput(weekStart))} - ${this.formatDate(this.formatDateForInput(weekEnd))}`;
  }

  private getWeekStart(date: Date): Date {
    const result = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    const day = result.getDay();
    const diff = day === 0 ? -6 : 1 - day;
    result.setDate(result.getDate() + diff);
    return result;
  }

  getExportGroups(): PaymentExportGroup[] {
    if (this.activeTableTab !== 'SETTLED') {
      return [{ label: this.getActiveTableTitle(), payments: this.getActiveTabPayments() }];
    }
    return this.settledGroups.map(group => ({
      label: group.label,
      payments: group.payments
    }));
  }

  /**
   * Toggle filter selection (multi-select)
   */
  toggleSettlementStatus(status: SettlementStatus): void {
    const index = this.selectedSettlementStatuses.indexOf(status);
    if (index > -1) {
      this.selectedSettlementStatuses.splice(index, 1);
    } else {
      this.selectedSettlementStatuses.push(status);
    }
    // Re-apply filters without reloading from AWS
    this.applySearch();
    this.pagination.currentPage = 1;
    this.updatePagination();
    this.cdr.markForCheck();
  }

  /**
   * Check if filter is selected
   */
  isSettlementStatusSelected(status: SettlementStatus): boolean {
    return this.selectedSettlementStatuses.includes(status);
  }

  /**
   * Sort table by column
   */
  sortBy(field: keyof Payment): void {
    if (this.sortConfig.field === field) {
      // Toggle direction
      this.sortConfig.direction = this.sortConfig.direction === 'asc' ? 'desc' : 'asc';
    } else {
      this.sortConfig = { field, direction: 'desc' };
    }
    this.applySorting();
    this.cdr.markForCheck();
  }

  /**
   * Apply current sort configuration and update pagination
   */
  private applySorting(): void {
    const { field, direction } = this.sortConfig;
    
    this.filteredPayments.sort((a, b) => {
      const aVal = a[field];
      const bVal = b[field];
      
      // Handle undefined/null values
      if (aVal == null && bVal == null) return 0;
      if (aVal == null) return 1;
      if (bVal == null) return -1;
      
      let comparison = 0;
      if (aVal > bVal) comparison = 1;
      if (aVal < bVal) comparison = -1;
      
      return direction === 'asc' ? comparison : -comparison;
    });

    // After sorting, update pagination
    this.updatePagination();
  }

  /**
   * Update pagination state and slice data for current page
   */
  private updatePagination(): void {
    const activePayments = this.getActiveTabPayments();

    this.updateSettledGroups(activePayments);
    this.pagination.totalItems = activePayments.length;
    this.pagination.totalPages = Math.ceil(this.pagination.totalItems / this.pagination.pageSize);
    
    // Ensure current page is valid
    if (this.pagination.currentPage > this.pagination.totalPages && this.pagination.totalPages > 0) {
      this.pagination.currentPage = this.pagination.totalPages;
    }
    if (this.pagination.currentPage < 1) {
      this.pagination.currentPage = 1;
    }
    
    // Slice data for current page
    const startIndex = (this.pagination.currentPage - 1) * this.pagination.pageSize;
    const endIndex = startIndex + this.pagination.pageSize;
    this.displayedPayments = activePayments.slice(startIndex, endIndex);
  }

  /**
   * Go to specific page
   */
  goToPage(page: number): void {
    if (page >= 1 && page <= this.pagination.totalPages) {
      this.pagination.currentPage = page;
      this.updatePagination();
      this.cdr.markForCheck();
    }
  }

  /**
   * Go to next page
   */
  nextPage(): void {
    if (this.pagination.currentPage < this.pagination.totalPages) {
      this.pagination.currentPage++;
      this.updatePagination();
      this.cdr.markForCheck();
    }
  }

  /**
   * Go to previous page
   */
  previousPage(): void {
    if (this.pagination.currentPage > 1) {
      this.pagination.currentPage--;
      this.updatePagination();
      this.cdr.markForCheck();
    }
  }

  /**
   * Get page numbers to display in pagination
   */
  getPageNumbers(): number[] {
    const pages: number[] = [];
    const maxPagesToShow = 7;
    
    if (this.pagination.totalPages <= maxPagesToShow) {
      // Show all pages
      for (let i = 1; i <= this.pagination.totalPages; i++) {
        pages.push(i);
      }
    } else {
      // Show first, last, current, and nearby pages
      pages.push(1);
      
      let start = Math.max(2, this.pagination.currentPage - 2);
      let end = Math.min(this.pagination.totalPages - 1, this.pagination.currentPage + 2);
      
      if (start > 2) pages.push(-1); // -1 represents ellipsis
      
      for (let i = start; i <= end; i++) {
        pages.push(i);
      }
      
      if (end < this.pagination.totalPages - 1) pages.push(-1);
      
      pages.push(this.pagination.totalPages);
    }
    
    return pages;
  }

  /**
   * Get sort icon for column header
   */
  getSortIcon(field: keyof Payment): string {
    if (this.sortConfig.field !== field) return '↕';
    return this.sortConfig.direction === 'asc' ? '↑' : '↓';
  }

  /**
   * Export current view to CSV
   */
  async exportCSV(): Promise<void> {
    this.isExporting = true;
    this.cdr.markForCheck();

    try {
      const payments = this.getActiveTabPayments();
      await this.paymentService.exportToCSVFile(payments, {
        title: this.getActiveTableTitle(),
        groups: this.getExportGroups()
      });
      this.notificationService.success('Financial dashboard CSV is ready.');
    } catch (error) {
      console.error('Failed to export financial dashboard CSV', error);
      this.notificationService.error('Could not export financial dashboard CSV.');
    } finally {
      this.isExporting = false;
      this.cdr.markForCheck();
    }
  }

  async exportGroupCSV(group: PaymentGroup, event: MouseEvent): Promise<void> {
    event.stopPropagation();
    this.isExporting = true;
    this.cdr.markForCheck();

    try {
      await this.paymentService.exportToCSVFile(group.payments, {
        title: group.label,
        groups: [{ label: group.label, payments: group.payments }]
      });
      this.notificationService.success('Financial dashboard CSV is ready.');
    } catch (error) {
      console.error('Failed to export financial dashboard group CSV', error);
      this.notificationService.error('Could not export financial dashboard CSV.');
    } finally {
      this.isExporting = false;
      this.cdr.markForCheck();
    }
  }

  /**
   * Export current view to PDF
   */
  async exportPDF(): Promise<void> {
    this.isExporting = true;
    this.cdr.markForCheck();

    try {
      const payments = this.getActiveTabPayments();
      await this.paymentService.exportToPDFFile(payments, {
        title: this.getActiveTableTitle(),
        groups: this.getExportGroups()
      });
      this.notificationService.success('Financial dashboard PDF is ready.');
    } catch (error) {
      console.error('Failed to export financial dashboard PDF', error);
      this.notificationService.error('Could not export financial dashboard PDF.');
    } finally {
      this.isExporting = false;
      this.cdr.markForCheck();
    }
  }

  async exportGroupPDF(group: PaymentGroup, event: MouseEvent): Promise<void> {
    event.stopPropagation();
    this.isExporting = true;
    this.cdr.markForCheck();

    try {
      await this.paymentService.exportToPDFFile(group.payments, {
        title: group.label,
        groups: [{ label: group.label, payments: group.payments }]
      });
      this.notificationService.success('Financial dashboard PDF is ready.');
    } catch (error) {
      console.error('Failed to export financial dashboard group PDF', error);
      this.notificationService.error('Could not export financial dashboard PDF.');
    } finally {
      this.isExporting = false;
      this.cdr.markForCheck();
    }
  }

  /**
   * Format date for input[type="date"]
   */
  private formatDateForInput(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  /**
   * Format date for display
   */
  formatDate(dateString: string): string {
    return new Date(dateString).toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    });
  }

  /**
   * Format currency
   */
  formatCurrency(amount: number): string {
    return `₹${amount.toFixed(2)}`;
  }

  /**
   * Get CSS class for settlement status
   */
  getSettlementStatusClass(status: SettlementStatus): string {
    const map: Record<SettlementStatus, string> = {
      'SETTLED': 'status-success',
      'NOT_INITIATED': 'status-muted'
    };
    return map[status] || '';
  }

  /**
   * Format status label for display
   */
  formatStatusLabel(status: string): string {
    return status.replace(/_/g, ' ').toLowerCase()
      .split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  }

  /**
   * Handle backdrop click (close modal)
   */
  onBackdropClick(event: MouseEvent): void {
    if (event.target === event.currentTarget) {
      this.close();
    }
  }
}
