import { Component, OnInit, ChangeDetectionStrategy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { 
  Payment, 
  EarningsSummary, 
  CommissionBreakdown, 
  PaymentStatusCounts,
  PaymentFilters,
  SortConfig,
  PaginationConfig,
  PaymentStatus,
  SettlementStatus,
  PaymentMethod
} from '../../core/models/payment.model';
import { PaymentService } from '../../core/services/payment.service';

@Component({
  selector: 'app-financial-dashboard-modal',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './financial-dashboard-modal.component.html',
  styleUrl: './financial-dashboard-modal.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class FinancialDashboardModalComponent implements OnInit {
  
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
  
  selectedPaymentStatuses: PaymentStatus[] = [];
  selectedSettlementStatuses: SettlementStatus[] = [];
  selectedPaymentMethods: PaymentMethod[] = [];

  // Filter visibility toggles
  showPaymentStatusFilter = false;
  showSettlementStatusFilter = false;
  showPaymentMethodFilter = false;

  // Search
  searchOrderId: string = '';

  // Pagination
  pagination: PaginationConfig = {
    currentPage: 1,
    pageSize: 15, // Show 15 rows per page (compact, manageable)
    totalItems: 0,
    totalPages: 0
  };

  // Sorting
  sortConfig: SortConfig = { field: 'createdAt', direction: 'desc' };

  // Loading states
  isLoading = false;
  isExporting = false;

  // Filter options (loaded from service - production-ready)
  paymentStatuses: PaymentStatus[] = [];
  settlementStatuses: SettlementStatus[] = [];
  paymentMethods: PaymentMethod[] = [];

  // Expose Math for template
  Math = Math;

  constructor(
    private paymentService: PaymentService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    // Set default date range: last 30 days
    const today = new Date();
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(today.getDate() - 30);
    
    this.startDate = this.formatDateForInput(thirtyDaysAgo);
    this.endDate = this.formatDateForInput(today);
    
    // Load filter options from service (production-ready)
    this.paymentService.getPaymentStatuses().subscribe(statuses => {
      this.paymentStatuses = statuses;
      this.cdr.markForCheck();
    });
    
    this.paymentService.getSettlementStatuses().subscribe(statuses => {
      this.settlementStatuses = statuses;
      this.cdr.markForCheck();
    });
    
    this.paymentService.getPaymentMethods().subscribe(methods => {
      this.paymentMethods = methods;
      this.cdr.markForCheck();
    });
    
    this.loadData();
  }

  /**
   * Open modal and load fresh data
   */
  open(): void {
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

  /**
   * Load all financial data with current filters
   * IMPORTANT: Filters apply to ENTIRE dataset, then we paginate
   */
  loadData(): void {
    this.isLoading = true;
    this.cdr.markForCheck();

    // Update filters from UI
    this.updateFiltersFromUI();

    // Load all data sources
    this.paymentService.getFilteredPayments(this.filters).subscribe(payments => {
      this.allPayments = payments;
      this.applySearch(); // Apply search after loading new data
      
      // Reset to first page when data changes
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
      paymentStatus: this.selectedPaymentStatuses.length > 0 ? this.selectedPaymentStatuses : undefined,
      settlementStatus: this.selectedSettlementStatuses.length > 0 ? this.selectedSettlementStatuses : undefined,
      paymentMethod: this.selectedPaymentMethods.length > 0 ? this.selectedPaymentMethods : undefined
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
    this.selectedPaymentStatuses = [];
    this.selectedSettlementStatuses = [];
    this.selectedPaymentMethods = [];
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

  private applySearch(): void {
    if (!this.searchOrderId.trim()) {
      // No search term - show all filtered payments
      this.filteredPayments = [...this.allPayments];
    } else {
      // Filter by order ID (case-insensitive partial match)
      const searchTerm = this.searchOrderId.trim().toLowerCase();
      this.filteredPayments = this.allPayments.filter(p => 
        p.orderId.toLowerCase().includes(searchTerm)
      );
    }
    this.applySorting();
  }

  /**
   * Toggle filter selection (multi-select)
   */
  togglePaymentStatus(status: PaymentStatus): void {
    const index = this.selectedPaymentStatuses.indexOf(status);
    if (index > -1) {
      this.selectedPaymentStatuses.splice(index, 1);
    } else {
      this.selectedPaymentStatuses.push(status);
    }
    this.loadData();
  }

  toggleSettlementStatus(status: SettlementStatus): void {
    const index = this.selectedSettlementStatuses.indexOf(status);
    if (index > -1) {
      this.selectedSettlementStatuses.splice(index, 1);
    } else {
      this.selectedSettlementStatuses.push(status);
    }
    this.loadData();
  }

  togglePaymentMethod(method: PaymentMethod): void {
    const index = this.selectedPaymentMethods.indexOf(method);
    if (index > -1) {
      this.selectedPaymentMethods.splice(index, 1);
    } else {
      this.selectedPaymentMethods.push(method);
    }
    this.loadData();
  }

  /**
   * Check if filter is selected
   */
  isPaymentStatusSelected(status: PaymentStatus): boolean {
    return this.selectedPaymentStatuses.includes(status);
  }

  isSettlementStatusSelected(status: SettlementStatus): boolean {
    return this.selectedSettlementStatuses.includes(status);
  }

  isPaymentMethodSelected(method: PaymentMethod): boolean {
    return this.selectedPaymentMethods.includes(method);
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
      
      // Handle undefined values
      if (aVal === undefined && bVal === undefined) return 0;
      if (aVal === undefined) return 1;
      if (bVal === undefined) return -1;
      
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
    this.pagination.totalItems = this.filteredPayments.length;
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
    this.displayedPayments = this.filteredPayments.slice(startIndex, endIndex);
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
  exportCSV(): void {
    this.isExporting = true;
    this.cdr.markForCheck();
    
    this.paymentService.exportToCSV(this.filteredPayments);
    
    setTimeout(() => {
      this.isExporting = false;
      this.cdr.markForCheck();
    }, 500);
  }

  /**
   * Export current view to PDF
   */
  exportPDF(): void {
    this.isExporting = true;
    this.cdr.markForCheck();
    
    this.paymentService.exportToPDF(this.filteredPayments);
    
    setTimeout(() => {
      this.isExporting = false;
      this.cdr.markForCheck();
    }, 500);
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
   * Get CSS class for payment status
   */
  getPaymentStatusClass(status: PaymentStatus): string {
    const map: Record<PaymentStatus, string> = {
      'SUCCESS': 'status-success',
      'PENDING': 'status-pending',
      'FAILED': 'status-failed'
    };
    return map[status] || '';
  }

  /**
   * Get CSS class for settlement status
   */
  getSettlementStatusClass(status: SettlementStatus): string {
    const map: Record<SettlementStatus, string> = {
      'SETTLED': 'status-success',
      'IN_PROGRESS': 'status-warning',
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
