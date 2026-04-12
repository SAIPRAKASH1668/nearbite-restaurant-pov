import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, of, forkJoin } from 'rxjs';
import { map, catchError } from 'rxjs/operators';
import { jsPDF } from 'jspdf';
import { environment } from '../../../environments/environment';
import { 
  Payment, 
  EarningsSummary, 
  CommissionBreakdown, 
  PaymentStatusCounts,
  PaymentFilters,
  PaymentMethod,
  PaymentStatus,
  SettlementStatus,
  RestaurantEarning,
  EarningsHistoryResponse,
  SettleEarningsRequest,
  SettleEarningsResponse
} from '../models/payment.model';
import { FileExportService } from './file-export.service';

interface BackendOrderRevenue {
  customerPaidFoodValue?: number;
  platformRevenue?: {
    foodCommission?: number;
  };
}

interface BackendOrder {
  orderId: string;
  createdAt: string;
  foodTotal?: number;
  revenue?: BackendOrderRevenue;
}

interface BackendOrdersResponse {
  orders: BackendOrder[];
  total: number;
}

interface RestaurantFinancialData {
  history: RestaurantEarning[];
  payments: Payment[];
  earningsSummary: EarningsSummary;
  commissionBreakdown: CommissionBreakdown;
  statusCounts: PaymentStatusCounts;
}

@Injectable({
  providedIn: 'root'
})
export class PaymentService {
  
  private readonly API_BASE_URL = environment.apiUrl;
  private mockRestaurantId = 'REST_001';
  private cachedMockPayments: Payment[] | null = null;

  constructor(
    private http: HttpClient,
    private fileExportService: FileExportService
  ) {}

  /**
   * Get available payment methods
   * In production: fetch from backend API
   */
  getPaymentMethods(): Observable<PaymentMethod[]> {
    return of(['UPI', 'CARD', 'WALLET', 'NETBANKING']);
  }

  /**
   * Get available payment statuses
   * In production: fetch from backend API
   */
  getPaymentStatuses(): Observable<PaymentStatus[]> {
    return of(['INITIATED', 'SUCCESS', 'FAILED', 'REFUNDED']);
  }

  /**
   * Get available settlement statuses
   * In production: fetch from backend API
   */
  getSettlementStatuses(): Observable<SettlementStatus[]> {
    return of(['NOT_INITIATED', 'IN_PROGRESS', 'SETTLED']);
  }

  /**
   * Generate realistic mock payment data for the last 90 days
   * Production-ready data structure with enhanced realism
   * NOTE: Data is cached to ensure consistency across multiple calls
   */
  private generateMockPayments(): Payment[] {
    // Return cached data if already generated
    if (this.cachedMockPayments) {
      return this.cachedMockPayments;
    }

    const payments: Payment[] = [];
    const paymentMethods: PaymentMethod[] = ['UPI', 'CARD', 'WALLET', 'NETBANKING'];
    const gateways = ['Razorpay', 'Paytm', 'PhonePe'];

    // Generate 150 transactions over 90 days for better data density
    for (let i = 0; i < 150; i++) {
      const daysAgo = Math.floor(Math.random() * 90);
      const date = new Date();
      date.setDate(date.getDate() - daysAgo);
      
      // More varied order amounts (150-2500)
      const grossAmount = Math.floor(Math.random() * 2350) + 150;
      const commissionRate = 0.18; // 18% platform commission
      const commissionAmount = Math.round(grossAmount * commissionRate);
      const taxAmount = Math.round(commissionAmount * 0.18); // 18% GST on commission
      const netPayoutAmount = grossAmount - commissionAmount - taxAmount;

      // Payment method distribution (realistic for India):
      // 50% UPI, 30% Card, 15% Wallet, 5% Netbanking
      const methodRand = Math.random();
      let paymentMethod: PaymentMethod;
      if (methodRand < 0.50) {
        paymentMethod = 'UPI';
      } else if (methodRand < 0.80) {
        paymentMethod = 'CARD';
      } else if (methodRand < 0.95) {
        paymentMethod = 'WALLET';
      } else {
        paymentMethod = 'NETBANKING';
      }
      
      // Realistic status distribution for RESTAURANT VIEW:
      // - 92% SUCCESS (completed orders with successful payment)
      // - 7% INITIATED (payment started but not completed)
      // - 1% FAILED (rare cases: chargebacks, refunds, disputes - order was delivered but payment disputed later)
      let paymentStatus: PaymentStatus;
      const statusRand = Math.random();
      if (statusRand < 0.92) {
        paymentStatus = 'SUCCESS';
      } else if (statusRand < 0.99) {
        paymentStatus = 'INITIATED';
      } else {
        // FAILED in restaurant context means:
        // - Customer initiated chargeback after receiving order
        // - Refund processed (order cancelled after preparation)
        // - Payment dispute (fraud, card stolen)
        // Restaurant delivered/prepared but payment was reversed
        paymentStatus = 'FAILED';
      }

      // Enhanced settlement logic with more realistic timelines
      let settlementStatus: SettlementStatus;
      
      if (paymentStatus === 'SUCCESS') {
        // Successful payments follow a settlement cycle
        if (daysAgo >= 7) {
          // Old payments (>7 days): 95% settled, 5% in progress
          settlementStatus = Math.random() > 0.05 ? 'SETTLED' : 'IN_PROGRESS';
        } else if (daysAgo >= 3) {
          // Recent payments (3-7 days): 40% settled, 50% in progress, 10% not initiated
          const settleRand = Math.random();
          if (settleRand < 0.40) {
            settlementStatus = 'SETTLED';
          } else if (settleRand < 0.90) {
            settlementStatus = 'IN_PROGRESS';
          } else {
            settlementStatus = 'NOT_INITIATED';
          }
        } else {
          // Very recent payments (<3 days): 70% not initiated, 30% in progress
          settlementStatus = Math.random() > 0.30 ? 'NOT_INITIATED' : 'IN_PROGRESS';
        }
      } else if (paymentStatus === 'INITIATED') {
        // INITIATED = Payment started but not completed yet, or payment gateway still processing
        // Settlement can't start until payment is confirmed
        settlementStatus = 'NOT_INITIATED';
      } else {
        // FAILED = Chargebacks, refunds, or payment disputes
        // For chargebacks: settlement was SETTLED but then reversed (restaurant loses money)
        // For refunds/disputes: never gets settled
        settlementStatus = 'NOT_INITIATED';
      }

      // Calculate settlement date for settled transactions
      // Typically 3-5 days after transaction date
      const settlementDate = settlementStatus === 'SETTLED' 
        ? new Date(date.getTime() + (3 + Math.floor(Math.random() * 3)) * 24 * 60 * 60 * 1000).toISOString()
        : undefined;

      // Select appropriate payment gateway
      let paymentGateway: string;
      if (paymentMethod === 'NETBANKING') {
        paymentGateway = ['Razorpay', 'Paytm'][Math.floor(Math.random() * 2)];
      } else if (paymentMethod === 'UPI') {
        paymentGateway = ['Razorpay', 'PhonePe', 'Paytm'][Math.floor(Math.random() * 3)];
      } else if (paymentMethod === 'CARD') {
        paymentGateway = ['Razorpay', 'Paytm'][Math.floor(Math.random() * 2)];
      } else {
        paymentGateway = ['Paytm', 'PhonePe'][Math.floor(Math.random() * 2)];
      }

      payments.push({
        id: `PAY_${String(i + 1).padStart(4, '0')}`,
        restaurantId: this.mockRestaurantId,
        orderId: `ORD_${String(Math.floor(Math.random() * 10000)).padStart(4, '0')}`,
        grossAmount,
        commissionAmount,
        taxAmount,
        netPayoutAmount,
        paymentMethod,
        paymentGateway,
        transactionId: `TXN_${Date.now()}_${Math.floor(Math.random() * 100000)}_${i}`,
        paymentStatus,
        settlementStatus,
        settlementDate,
        createdAt: date.toISOString()
      });
    }

    // Sort by date descending (newest first)
    const sortedPayments = payments.sort((a, b) => 
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );

    // Cache the generated data for consistency
    this.cachedMockPayments = sortedPayments;

    return sortedPayments;
  }

  /**
   * Get all payments (mock data)
   */
  getPayments(): Observable<Payment[]> {
    return of(this.generateMockPayments());
  }

  /**
   * Get filtered payments based on criteria
   */
  getFilteredPayments(filters: PaymentFilters): Observable<Payment[]> {
    let payments = this.generateMockPayments();

    if (filters.startDate) {
      const startDate = new Date(filters.startDate);
      payments = payments.filter(p => new Date(p.createdAt) >= startDate);
    }

    if (filters.endDate) {
      const endDate = new Date(filters.endDate);
      endDate.setHours(23, 59, 59, 999); // End of day
      payments = payments.filter(p => new Date(p.createdAt) <= endDate);
    }

    if (filters.paymentStatus && filters.paymentStatus.length > 0) {
      payments = payments.filter(p => filters.paymentStatus!.includes(p.paymentStatus));
    }

    if (filters.settlementStatus && filters.settlementStatus.length > 0) {
      payments = payments.filter(p => filters.settlementStatus!.includes(p.settlementStatus));
    }

    if (filters.paymentMethod && filters.paymentMethod.length > 0) {
      payments = payments.filter(p => filters.paymentMethod!.includes(p.paymentMethod));
    }

    return of(payments);
  }

  /**
   * Calculate earnings summary for dashboard cards
   * NOTE: These use FIXED time ranges (today, week, month, ALL pending)
   * Independent of filter selection
   */
  getEarningsSummary(): Observable<EarningsSummary> {
    const payments = this.generateMockPayments();
    const now = new Date();
    
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const weekStart = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    // Today's earnings: All successful payments from today
    const todayEarnings = payments
      .filter(p => p.paymentStatus === 'SUCCESS' && new Date(p.createdAt) >= todayStart)
      .reduce((sum, p) => sum + p.netPayoutAmount, 0);

    // This week's earnings: All successful payments from last 7 days
    const weekEarnings = payments
      .filter(p => p.paymentStatus === 'SUCCESS' && new Date(p.createdAt) >= weekStart)
      .reduce((sum, p) => sum + p.netPayoutAmount, 0);

    // This month's earnings: All successful payments from current month
    const monthEarnings = payments
      .filter(p => p.paymentStatus === 'SUCCESS' && new Date(p.createdAt) >= monthStart)
      .reduce((sum, p) => sum + p.netPayoutAmount, 0);

    // Pending settlements: ALL unpaid money across entire period (90 days)
    // This is money you've EARNED but haven't RECEIVED yet
    const pendingSettlements = payments
      .filter(p => p.settlementStatus !== 'SETTLED' && p.paymentStatus === 'SUCCESS')
      .reduce((sum, p) => sum + p.netPayoutAmount, 0);

    return of({
      todayEarnings,
      weekEarnings,
      monthEarnings,
      pendingSettlements
    });
  }

  /**
   * Calculate commission breakdown for selected period
   * NOTE: This respects the filter date range (default: last 30 days)
   * Shows ALL successful payments in range (settled + unsettled)
   */
  getCommissionBreakdown(filters: PaymentFilters = {}): Observable<CommissionBreakdown> {
    const payments = this.generateMockPayments();
    let filteredPayments = payments;

    if (filters.startDate || filters.endDate) {
      if (filters.startDate) {
        filteredPayments = filteredPayments.filter(p => 
          new Date(p.createdAt) >= new Date(filters.startDate!)
        );
      }
      if (filters.endDate) {
        const endDate = new Date(filters.endDate!);
        endDate.setHours(23, 59, 59, 999);
        filteredPayments = filteredPayments.filter(p => 
          new Date(p.createdAt) <= endDate
        );
      }
    }

    // Only count successful payments for commission breakdown
    const successfulPayments = filteredPayments.filter(p => p.paymentStatus === 'SUCCESS');

    const grossRevenue = successfulPayments.reduce((sum, p) => sum + p.grossAmount, 0);
    const platformCommission = successfulPayments.reduce((sum, p) => sum + p.commissionAmount, 0);
    const taxCharges = successfulPayments.reduce((sum, p) => sum + p.taxAmount, 0);
    
    // Net Payout = Total earnings in date range (includes settled + unsettled)
    const netPayout = successfulPayments.reduce((sum, p) => sum + p.netPayoutAmount, 0);
    const commissionPercentage = grossRevenue > 0 ? (platformCommission / grossRevenue) * 100 : 0;

    return of({
      grossRevenue,
      platformCommission,
      taxCharges,
      netPayout,
      commissionPercentage
    });
  }

  /**
   * Get payment and settlement status counts
   */
  getStatusCounts(filters: PaymentFilters = {}): Observable<PaymentStatusCounts> {
    const payments = this.generateMockPayments();
    let filteredPayments = payments;

    if (filters.startDate || filters.endDate) {
      if (filters.startDate) {
        filteredPayments = filteredPayments.filter(p => 
          new Date(p.createdAt) >= new Date(filters.startDate!)
        );
      }
      if (filters.endDate) {
        const endDate = new Date(filters.endDate!);
        endDate.setHours(23, 59, 59, 999);
        filteredPayments = filteredPayments.filter(p => 
          new Date(p.createdAt) <= endDate
        );
      }
    }

    return of({
      successful: filteredPayments.filter(p => p.paymentStatus === 'SUCCESS').length,
      pending: filteredPayments.filter(p => p.paymentStatus === 'INITIATED').length,
      failed: filteredPayments.filter(p => p.paymentStatus === 'FAILED').length,
      notInitiatedSettlements: filteredPayments.filter(p => p.settlementStatus === 'NOT_INITIATED').length,
      inProgressSettlements: filteredPayments.filter(p => p.settlementStatus === 'IN_PROGRESS').length,
      settledSettlements: filteredPayments.filter(p => p.settlementStatus === 'SETTLED').length
    });
  }

  /**
   * Export payments to CSV format
   */
  exportToCSV(payments: Payment[]): void {
    const headers = [
      'Date',
      'Order ID',
      'Menu Order Value',
      'Commission',
      'Net Payout',
      'Settlement Status',
      'Transaction ID'
    ];

    const rows = payments.map(p => [
      new Date(p.createdAt).toLocaleDateString('en-IN'),
      p.orderId,
      p.grossAmount.toFixed(2),
      p.commissionAmount.toFixed(2),
      p.netPayoutAmount.toFixed(2),
      p.settlementStatus,
      p.transactionId
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.join(','))
    ].join('\n');

    this.downloadFile(csvContent, 'payments-export.csv', 'text/csv');
  }

  /**
   * Export payments to PDF format (simplified - in production use a library like jsPDF)
   */
  exportToPDF(payments: Payment[]): void {
    // For production, integrate jsPDF or similar library
    // This is a simplified text-based export for now
    
    let content = 'FINANCIAL DASHBOARD REPORT\n';
    content += '='.repeat(80) + '\n\n';
    content += `Generated: ${new Date().toLocaleString('en-IN')}\n`;
    content += `Total Transactions: ${payments.length}\n\n`;
    
    const totalGross = payments.reduce((sum, p) => sum + p.grossAmount, 0);
    const totalCommission = payments.reduce((sum, p) => sum + p.commissionAmount, 0);
    const totalNet = payments.reduce((sum, p) => sum + p.netPayoutAmount, 0);
    
    content += `Total Gross Revenue: ₹${totalGross.toFixed(2)}\n`;
    content += `Total Platform Commission: ₹${totalCommission.toFixed(2)}\n`;
    content += `Total Net Payout: ₹${totalNet.toFixed(2)}\n\n`;
    content += '='.repeat(80) + '\n\n';
    
    payments.forEach(p => {
      content += `Date: ${new Date(p.createdAt).toLocaleDateString('en-IN')}\n`;
      content += `Order: ${p.orderId}\n`;
      content += `Gross: ₹${p.grossAmount} | Commission: ₹${p.commissionAmount} | Net: ₹${p.netPayoutAmount}\n`;
      content += `Settlement: ${p.settlementStatus}\n`;
      content += '-'.repeat(80) + '\n';
    });

    this.downloadFile(content, 'payments-report.txt', 'text/plain');
  }

  /**
   * Helper to trigger file download
   */
  private downloadFile(content: string, filename: string, mimeType: string): void {
    const blob = new Blob([content], { type: mimeType });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
  }

  async exportToCSVFile(payments: Payment[]): Promise<void> {
    const headers = [
      'Date',
      'Order ID',
      'Menu Order Value',
      'Commission',
      'Net Payout',
      'Settlement Status',
      'Transaction ID'
    ];

    const rows = payments.map((payment) => [
      new Date(payment.createdAt).toLocaleDateString('en-IN'),
      payment.orderId,
      payment.grossAmount.toFixed(2),
      payment.commissionAmount.toFixed(2),
      payment.netPayoutAmount.toFixed(2),
      payment.settlementStatus,
      payment.transactionId
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map((row) => row.map((cell) => this.escapeCsvCell(cell)).join(','))
    ].join('\n');

    await this.fileExportService.exportTextFile(csvContent, {
      fileName: this.buildExportFileName('financial-dashboard', 'csv'),
      mimeType: 'text/csv;charset=utf-8',
      title: 'Financial Dashboard CSV',
      dialogTitle: 'Share financial dashboard CSV'
    });
  }

  async exportToPDFFile(payments: Payment[]): Promise<void> {
    const totalGross = payments.reduce((sum, payment) => sum + payment.grossAmount, 0);
    const totalCommission = payments.reduce((sum, payment) => sum + payment.commissionAmount, 0);
    const totalNet = payments.reduce((sum, payment) => sum + payment.netPayoutAmount, 0);

    const pdf = new jsPDF({
      unit: 'pt',
      format: 'a4'
    });
    const margin = 40;
    const pageHeight = pdf.internal.pageSize.getHeight();
    const pageWidth = pdf.internal.pageSize.getWidth();
    let y = margin;

    const addLine = (text: string, fontSize = 10, weight: 'normal' | 'bold' = 'normal') => {
      if (y > pageHeight - margin) {
        pdf.addPage();
        y = margin;
      }

      pdf.setFont('helvetica', weight);
      pdf.setFontSize(fontSize);
      pdf.text(text, margin, y);
      y += fontSize + 8;
    };

    const addWrappedLine = (text: string, fontSize = 10) => {
      const lines = pdf.splitTextToSize(text, pageWidth - margin * 2);
      lines.forEach((line: string) => addLine(line, fontSize));
    };

    addLine('Financial Dashboard Report', 18, 'bold');
    addLine(`Generated: ${new Date().toLocaleString('en-IN')}`, 10);
    addLine(`Total Transactions: ${payments.length}`, 10);
    addLine(`Total Gross Revenue: Rs.${totalGross.toFixed(2)}`, 10);
    addLine(`Total Platform Commission: Rs.${totalCommission.toFixed(2)}`, 10);
    addLine(`Total Net Payout: Rs.${totalNet.toFixed(2)}`, 10);
    y += 6;

    payments.forEach((payment, index) => {
      if (y > pageHeight - 120) {
        pdf.addPage();
        y = margin;
      }

      pdf.setDrawColor(220, 220, 220);
      pdf.line(margin, y, pageWidth - margin, y);
      y += 14;

      addLine(`${index + 1}. Order ${payment.orderId}`, 11, 'bold');
      addWrappedLine(
        `Date: ${new Date(payment.createdAt).toLocaleDateString('en-IN')} | Transaction: ${payment.transactionId}`,
        9
      );
      addWrappedLine(
        `Menu Value: Rs.${payment.grossAmount.toFixed(2)} | Commission: Rs.${payment.commissionAmount.toFixed(2)} | Net: Rs.${payment.netPayoutAmount.toFixed(2)}`,
        9
      );
      addWrappedLine(
        `Settlement Status: ${payment.settlementStatus}`,
        9
      );
      y += 4;
    });

    const blob = new Blob([pdf.output('arraybuffer')], {
      type: 'application/pdf'
    });

    await this.fileExportService.exportBlob(blob, {
      fileName: this.buildExportFileName('financial-dashboard', 'pdf'),
      mimeType: 'application/pdf',
      title: 'Financial Dashboard PDF',
      dialogTitle: 'Share financial dashboard PDF'
    });
  }

  private buildExportFileName(prefix: string, extension: string): string {
    const dateStamp = new Date().toISOString().split('T')[0];
    return `${prefix}-${dateStamp}.${extension}`;
  }

  private escapeCsvCell(value: string): string {
    return `"${value.replace(/"/g, '""')}"`;
  }

  // ============================================
  // AWS Restaurant Earnings API Integration
  // ============================================

  /**
   * Get restaurant earnings history from AWS backend
   */
  getRestaurantEarnings(
    restaurantId: string, 
    startDate: string, 
    endDate: string
  ): Observable<EarningsHistoryResponse> {
    const params = new HttpParams()
      .set('startDate', startDate)
      .set('endDate', endDate);
      
    return this.http.get<EarningsHistoryResponse>(
      `${this.API_BASE_URL}/restaurants/${restaurantId}/earnings/history`,
      { params }
    ).pipe(
      catchError(error => {
        console.error('Error fetching restaurant earnings:', error);
        // Return empty response on error
        return of({
          restaurantId,
          startDate,
          endDate,
          totalOrders: 0,
          totalEarnings: 0,
          history: []
        });
      })
    );
  }

  getRestaurantFinancialData(
    restaurantId: string,
    startDate: string,
    endDate: string
  ): Observable<RestaurantFinancialData> {
    return forkJoin({
      earningsResponse: this.getRestaurantEarnings(restaurantId, startDate, endDate),
      orders: this.getRestaurantOrders(restaurantId)
    }).pipe(
      map(({ earningsResponse, orders }) => {
        const financialByOrderId = this.buildFinancialByOrderId(orders);
        const payments = this.convertEarningsToPayments(earningsResponse.history, financialByOrderId);

        return {
          history: earningsResponse.history,
          payments,
          earningsSummary: this.calculateEarningsSummaryFromAWS(earningsResponse.history),
          commissionBreakdown: this.calculateCommissionFromAWS(payments),
          statusCounts: this.calculateStatusCountsFromAWS(earningsResponse.history)
        };
      })
    );
  }

  private getRestaurantOrders(restaurantId: string): Observable<BackendOrder[]> {
    return this.http.get<BackendOrdersResponse>(
      `${this.API_BASE_URL}/orders`,
      { params: { restaurantId } }
    ).pipe(
      map((response) => response.orders || []),
      catchError((error) => {
        console.error('Error fetching restaurant orders for financial mapping:', error);
        return of([]);
      })
    );
  }

  private buildFinancialByOrderId(orders: BackendOrder[]): Map<string, { menuOrderValue: number; commissionAmount: number }> {
    const financialByOrderId = new Map<string, { menuOrderValue: number; commissionAmount: number }>();

    orders.forEach((order) => {
      if (!order.orderId) {
        return;
      }

      const revenue = order.revenue || {};
      const menuOrderValue = Number(revenue.customerPaidFoodValue ?? order.foodTotal ?? 0) || 0;
      const commissionAmount = Number(revenue.platformRevenue?.foodCommission ?? 0) || 0;

      financialByOrderId.set(order.orderId, {
        menuOrderValue,
        commissionAmount
      });
    });

    return financialByOrderId;
  }

  /**
   * Settle restaurant earnings for specific orders
   */
  settleRestaurantEarnings(
    restaurantId: string,
    request: SettleEarningsRequest
  ): Observable<SettleEarningsResponse> {
    return this.http.post<SettleEarningsResponse>(
      `${this.API_BASE_URL}/restaurants/${restaurantId}/earnings/settle`,
      request
    ).pipe(
      catchError(error => {
        console.error('Error settling restaurant earnings:', error);
        throw error;
      })
    );
  }

  /**
   * Convert AWS restaurant earnings to Payment format for display
   */
  convertEarningsToPayments(
    earnings: RestaurantEarning[],
    financialByOrderId: Map<string, { menuOrderValue: number; commissionAmount: number }> = new Map()
  ): Payment[] {
    return earnings.map(e => {
      const financial = financialByOrderId.get(e.orderId);
      const grossAmount = financial?.menuOrderValue ?? 0;
      const commissionAmount = financial?.commissionAmount ?? 0;
      const taxAmount = 0;
      const netPayoutAmount = e.totalEarnings;

      // Determine settlement status with IN_PROGRESS support
      let settlementStatus: SettlementStatus;
      if (e.settled) {
        settlementStatus = 'SETTLED';
      } else {
        // Check if order is recent (less than 3 days old)
        const createdDate = new Date(e.createdAt);
        const daysSinceCreated = (Date.now() - createdDate.getTime()) / (1000 * 60 * 60 * 24);
        
        if (daysSinceCreated >= 3) {
          // Orders older than 3 days should be IN_PROGRESS if not settled
          settlementStatus = 'IN_PROGRESS';
        } else {
          // Recent orders (< 3 days) are NOT_INITIATED
          settlementStatus = 'NOT_INITIATED';
        }
      }

      // Vary payment methods for realism (based on Indian market distribution)
      // 50% UPI, 30% CARD, 15% WALLET, 5% NETBANKING
      const hash = e.orderId.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
      let paymentMethod: PaymentMethod;
      const methodIndex = hash % 100;
      if (methodIndex < 50) {
        paymentMethod = 'UPI';
      } else if (methodIndex < 80) {
        paymentMethod = 'CARD';
      } else if (methodIndex < 95) {
        paymentMethod = 'WALLET';
      } else {
        paymentMethod = 'NETBANKING';
      }

      return {
        id: e.orderId,
        restaurantId: e.restaurantId,
        orderId: e.orderId,
        grossAmount: grossAmount,
        commissionAmount: commissionAmount,
        taxAmount: taxAmount,
        netPayoutAmount: netPayoutAmount,
        paymentMethod: paymentMethod,
        paymentGateway: 'Razorpay',
        transactionId: e.orderId,
        paymentStatus: 'SUCCESS', // Earnings only track successful payments
        settlementStatus: settlementStatus,
        settlementDate: e.settledAt || undefined,
        createdAt: e.createdAt
      };
    });
  }

  /**
   * Calculate earnings summary from AWS data
   */
  calculateEarningsSummaryFromAWS(earnings: RestaurantEarning[]): EarningsSummary {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
    const monthAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);

    const todayEarnings = earnings
      .filter(e => {
        const earningDate = new Date(e.createdAt);
        return earningDate >= today && earningDate < new Date(today.getTime() + 24 * 60 * 60 * 1000);
      })
      .reduce((sum, e) => sum + e.totalEarnings, 0);

    const weekEarnings = earnings
      .filter(e => new Date(e.createdAt) >= weekAgo)
      .reduce((sum, e) => sum + e.totalEarnings, 0);

    const monthEarnings = earnings
      .filter(e => new Date(e.createdAt) >= monthAgo)
      .reduce((sum, e) => sum + e.totalEarnings, 0);

    const pendingSettlements = earnings
      .filter(e => !e.settled)
      .reduce((sum, e) => sum + e.totalEarnings, 0);

    return {
      todayEarnings,
      weekEarnings,
      monthEarnings,
      pendingSettlements
    };
  }

  /**
   * Calculate commission breakdown from AWS data
   */
  calculateCommissionFromAWS(payments: Payment[]): CommissionBreakdown {
    const grossRevenue = payments.reduce((sum, payment) => sum + (payment.grossAmount || 0), 0);
    const platformCommission = payments.reduce((sum, payment) => sum + (payment.commissionAmount || 0), 0);
    const taxCharges = 0;
    const netPayout = payments.reduce((sum, payment) => sum + (payment.netPayoutAmount || 0), 0);
    const commissionPercentage = grossRevenue > 0 ? (platformCommission / grossRevenue) * 100 : 0;

    return {
      grossRevenue,
      platformCommission,
      taxCharges,
      netPayout,
      commissionPercentage
    };
  }

  /**
   * Calculate status counts from AWS data
   */
  calculateStatusCountsFromAWS(earnings: RestaurantEarning[]): PaymentStatusCounts {
    const successful = earnings.length;
    const pending = 0; // AWS only tracks completed orders
    const failed = 0;
    const notInitiatedSettlements = earnings.filter(e => !e.settled).length;
    const inProgressSettlements = 0; // Not tracked in current AWS model
    const settledSettlements = earnings.filter(e => e.settled).length;

    return {
      successful,
      pending,
      failed,
      notInitiatedSettlements,
      inProgressSettlements,
      settledSettlements
    };
  }
}
