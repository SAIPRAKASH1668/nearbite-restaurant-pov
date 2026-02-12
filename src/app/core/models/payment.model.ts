// ============================================
// Payment Model - Financial Transaction Types
// Synced with AWS Payment model
// ============================================

// Payment statuses from AWS Payment model
export type PaymentStatus = 'INITIATED' | 'SUCCESS' | 'FAILED' | 'REFUNDED';

// Payment methods from AWS Payment model
export type PaymentMethod = 'UPI' | 'CARD' | 'WALLET' | 'NETBANKING';

// Settlement status (restaurant-specific)
export type SettlementStatus = 'NOT_INITIATED' | 'IN_PROGRESS' | 'SETTLED';

export interface Payment {
  id: string;
  restaurantId: string;
  orderId: string;

  // Financial breakdown
  grossAmount: number;
  commissionAmount: number;
  taxAmount: number;
  netPayoutAmount: number;

  // Payment details
  paymentMethod: PaymentMethod;
  paymentGateway: string;
  transactionId: string;

  // Status tracking
  paymentStatus: PaymentStatus;
  settlementStatus: SettlementStatus;

  // Dates
  settlementDate?: string;
  createdAt: string;
}

// Aggregated financial statistics
export interface EarningsSummary {
  todayEarnings: number;
  weekEarnings: number;
  monthEarnings: number;
  pendingSettlements: number;
}

// Commission breakdown for display
export interface CommissionBreakdown {
  grossRevenue: number;
  platformCommission: number;
  taxCharges: number;
  netPayout: number;
  commissionPercentage: number;
}

// Status counters
export interface PaymentStatusCounts {
  successful: number;
  pending: number;
  failed: number;
  notInitiatedSettlements: number;
  inProgressSettlements: number;
  settledSettlements: number;
}

// Filter options for transaction table
export interface PaymentFilters {
  startDate?: string;
  endDate?: string;
  paymentStatus?: PaymentStatus[];
  settlementStatus?: SettlementStatus[];
  paymentMethod?: PaymentMethod[];
}

// Sort configuration
export interface SortConfig {
  field: keyof Payment;
  direction: 'asc' | 'desc';
}

// Pagination configuration
export interface PaginationConfig {
  currentPage: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
}
