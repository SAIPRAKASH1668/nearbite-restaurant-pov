import { Injectable } from '@angular/core';
import { Observable, of } from 'rxjs';
import { 
  Payment, 
  EarningsSummary, 
  CommissionBreakdown, 
  PaymentStatusCounts,
  PaymentFilters,
  PaymentMethod,
  PaymentStatus,
  SettlementStatus
} from '../models/payment.model';

@Injectable({
  providedIn: 'root'
})
export class PaymentService {
  
  private mockRestaurantId = 'REST_001';
  private cachedMockPayments: Payment[] | null = null;

  constructor() {}

  /**
   * Get available payment methods
   * In production: fetch from backend API
   */
  getPaymentMethods(): Observable<PaymentMethod[]> {
    return of(['UPI', 'CARD', 'CASH', 'WALLET']);
  }

  /**
   * Get available payment statuses
   * In production: fetch from backend API
   */
  getPaymentStatuses(): Observable<PaymentStatus[]> {
    return of(['SUCCESS', 'PENDING', 'FAILED']);
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
    const paymentMethods: PaymentMethod[] = ['UPI', 'CARD', 'CASH', 'WALLET'];
    const gateways = ['Razorpay', 'Paytm', 'PhonePe', 'Cash'];

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
      // 50% UPI, 30% Card, 15% Wallet, 5% Cash
      const methodRand = Math.random();
      let paymentMethod: PaymentMethod;
      if (methodRand < 0.50) {
        paymentMethod = 'UPI';
      } else if (methodRand < 0.80) {
        paymentMethod = 'CARD';
      } else if (methodRand < 0.95) {
        paymentMethod = 'WALLET';
      } else {
        paymentMethod = 'CASH';
      }
      
      // Realistic status distribution for RESTAURANT VIEW:
      // - 92% SUCCESS (completed orders with successful payment)
      // - 7% PENDING (COD not collected yet, or payment gateway processing)
      // - 1% FAILED (rare cases: chargebacks, refunds, disputes - order was delivered but payment disputed later)
      let paymentStatus: PaymentStatus;
      const statusRand = Math.random();
      if (statusRand < 0.92) {
        paymentStatus = 'SUCCESS';
      } else if (statusRand < 0.99) {
        paymentStatus = 'PENDING';
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
      } else if (paymentStatus === 'PENDING') {
        // PENDING = Cash on Delivery (COD) not collected yet, or payment gateway still processing
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
      if (paymentMethod === 'CASH') {
        paymentGateway = 'Cash';
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
      pending: filteredPayments.filter(p => p.paymentStatus === 'PENDING').length,
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
      'Payment Method',
      'Gross Amount',
      'Commission',
      'Tax',
      'Net Payout',
      'Payment Status',
      'Settlement Status',
      'Transaction ID'
    ];

    const rows = payments.map(p => [
      new Date(p.createdAt).toLocaleDateString('en-IN'),
      p.orderId,
      p.paymentMethod,
      p.grossAmount.toFixed(2),
      p.commissionAmount.toFixed(2),
      p.taxAmount.toFixed(2),
      p.netPayoutAmount.toFixed(2),
      p.paymentStatus,
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
      content += `Order: ${p.orderId} | Method: ${p.paymentMethod}\n`;
      content += `Gross: ₹${p.grossAmount} | Commission: ₹${p.commissionAmount} | Net: ₹${p.netPayoutAmount}\n`;
      content += `Status: ${p.paymentStatus} | Settlement: ${p.settlementStatus}\n`;
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
}
