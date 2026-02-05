// ============================================================
// BACKEND INTEGRATION GUIDE
// Step-by-step changes to connect to real APIs
// ============================================================

/**
 * STEP 1: Update payment.service.ts
 * Replace mock methods with HTTP calls
 */

// BEFORE (Mock):
// --------------
import { Injectable } from '@angular/core';
import { Observable, of } from 'rxjs';

private generateMockPayments(): Payment[] {
  // ... 150 lines of mock data generation
}

getPayments(): Observable<Payment[]> {
  return of(this.generateMockPayments());
}


// AFTER (Real API):
// -----------------
import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

constructor(private http: HttpClient) {}

// Remove generateMockPayments() entirely

/**
 * Get payments from backend API
 * Endpoint: GET /api/restaurants/{restaurantId}/payments
 */
getPayments(): Observable<Payment[]> {
  const restaurantId = this.getRestaurantId(); // From auth service
  return this.http.get<Payment[]>(`${environment.apiUrl}/restaurants/${restaurantId}/payments`);
}

/**
 * Get filtered payments with query parameters
 * Endpoint: GET /api/restaurants/{restaurantId}/payments?startDate=...&endDate=...
 */
getFilteredPayments(filters: PaymentFilters): Observable<Payment[]> {
  const restaurantId = this.getRestaurantId();
  
  // Build query params
  let params = new HttpParams();
  if (filters.startDate) params = params.set('startDate', filters.startDate);
  if (filters.endDate) params = params.set('endDate', filters.endDate);
  if (filters.paymentStatus?.length) {
    params = params.set('paymentStatus', filters.paymentStatus.join(','));
  }
  if (filters.settlementStatus?.length) {
    params = params.set('settlementStatus', filters.settlementStatus.join(','));
  }
  if (filters.paymentMethod?.length) {
    params = params.set('paymentMethod', filters.paymentMethod.join(','));
  }
  
  return this.http.get<Payment[]>(
    `${environment.apiUrl}/restaurants/${restaurantId}/payments`,
    { params }
  );
}

/**
 * Get earnings summary
 * Endpoint: GET /api/restaurants/{restaurantId}/payments/summary
 */
getEarningsSummary(): Observable<EarningsSummary> {
  const restaurantId = this.getRestaurantId();
  return this.http.get<EarningsSummary>(
    `${environment.apiUrl}/restaurants/${restaurantId}/payments/summary`
  );
}

/**
 * Get commission breakdown
 * Endpoint: GET /api/restaurants/{restaurantId}/payments/commission
 */
getCommissionBreakdown(filters: PaymentFilters = {}): Observable<CommissionBreakdown> {
  const restaurantId = this.getRestaurantId();
  
  let params = new HttpParams();
  if (filters.startDate) params = params.set('startDate', filters.startDate);
  if (filters.endDate) params = params.set('endDate', filters.endDate);
  
  return this.http.get<CommissionBreakdown>(
    `${environment.apiUrl}/restaurants/${restaurantId}/payments/commission`,
    { params }
  );
}

/**
 * Get status counts
 * Endpoint: GET /api/restaurants/{restaurantId}/payments/status-counts
 */
getStatusCounts(filters: PaymentFilters = {}): Observable<PaymentStatusCounts> {
  const restaurantId = this.getRestaurantId();
  
  let params = new HttpParams();
  if (filters.startDate) params = params.set('startDate', filters.startDate);
  if (filters.endDate) params = params.set('endDate', filters.endDate);
  
  return this.http.get<PaymentStatusCounts>(
    `${environment.apiUrl}/restaurants/${restaurantId}/payments/status-counts`,
    { params }
  );
}

/**
 * Get available filter options from backend
 * Endpoint: GET /api/payment-methods
 */
getPaymentMethods(): Observable<PaymentMethod[]> {
  return this.http.get<PaymentMethod[]>(`${environment.apiUrl}/payment-methods`);
}

getPaymentStatuses(): Observable<PaymentStatus[]> {
  return this.http.get<PaymentStatus[]>(`${environment.apiUrl}/payment-statuses`);
}

getSettlementStatuses(): Observable<SettlementStatus[]> {
  return this.http.get<SettlementStatus[]>(`${environment.apiUrl}/settlement-statuses`);
}

/**
 * Export payments (backend generates file)
 * Endpoint: POST /api/restaurants/{restaurantId}/payments/export
 */
exportPaymentsCSV(filters: PaymentFilters): Observable<Blob> {
  const restaurantId = this.getRestaurantId();
  
  return this.http.post(
    `${environment.apiUrl}/restaurants/${restaurantId}/payments/export/csv`,
    filters,
    { responseType: 'blob' }
  );
}

exportPaymentsPDF(filters: PaymentFilters): Observable<Blob> {
  const restaurantId = this.getRestaurantId();
  
  return this.http.post(
    `${environment.apiUrl}/restaurants/${restaurantId}/payments/export/pdf`,
    filters,
    { responseType: 'blob' }
  );
}

/**
 * Helper to get restaurant ID from auth service
 */
private getRestaurantId(): string {
  // Get from AuthService or token
  // return this.authService.getCurrentRestaurantId();
  return 'REST_001'; // Temporary - replace with actual auth
}


// ============================================================
// STEP 2: Update environment.ts files
// ============================================================

// environment.ts (development)
export const environment = {
  production: false,
  apiUrl: 'http://localhost:8080/api/v1', // Your local backend
  apiTimeout: 30000
};

// environment.prod.ts (production)
export const environment = {
  production: true,
  apiUrl: 'https://api.nearbite.com/api/v1', // Production backend
  apiTimeout: 30000
};


// ============================================================
// STEP 3: Add HttpClient to app.config.ts
// ============================================================

// app.config.ts
import { ApplicationConfig } from '@angular/core';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { authInterceptor } from './core/interceptors/auth.interceptor';

export const appConfig: ApplicationConfig = {
  providers: [
    provideHttpClient(
      withInterceptors([authInterceptor]) // Add auth token to requests
    ),
    // ... other providers
  ]
};


// ============================================================
// STEP 4: Create auth interceptor (add JWT token)
// ============================================================

// src/app/core/interceptors/auth.interceptor.ts
import { HttpInterceptorFn } from '@angular/common/http';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  // Get token from localStorage or AuthService
  const token = localStorage.getItem('auth_token');
  
  if (token) {
    // Clone request and add Authorization header
    const cloned = req.clone({
      headers: req.headers.set('Authorization', `Bearer ${token}`)
    });
    return next(cloned);
  }
  
  return next(req);
};


// ============================================================
// STEP 5: Update export methods to use backend
// ============================================================

// In payment.service.ts, update these methods:

exportToCSV(payments: Payment[]): void {
  // BEFORE: Client-side CSV generation
  
  // AFTER: Download from backend
  const filters = this.getCurrentFilters(); // Store current filters
  
  this.exportPaymentsCSV(filters).subscribe({
    next: (blob) => {
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `payments-${Date.now()}.csv`;
      link.click();
      window.URL.revokeObjectURL(url);
    },
    error: (error) => {
      console.error('Export failed:', error);
      // Show error toast/notification
    }
  });
}

exportToPDF(payments: Payment[]): void {
  // BEFORE: Client-side text generation
  
  // AFTER: Download from backend
  const filters = this.getCurrentFilters();
  
  this.exportPaymentsPDF(filters).subscribe({
    next: (blob) => {
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `payments-report-${Date.now()}.pdf`;
      link.click();
      window.URL.revokeObjectURL(url);
    },
    error: (error) => {
      console.error('Export failed:', error);
    }
  });
}


// ============================================================
// STEP 6: OPTIONAL - Server-side pagination (for 10,000+ records)
// ============================================================

// If backend supports pagination, update the model:
export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    currentPage: number;
    pageSize: number;
    totalItems: number;
    totalPages: number;
  };
}

// Update service method:
getFilteredPayments(
  filters: PaymentFilters,
  page: number = 1,
  pageSize: number = 15
): Observable<PaginatedResponse<Payment>> {
  const restaurantId = this.getRestaurantId();
  
  let params = new HttpParams()
    .set('page', page.toString())
    .set('pageSize', pageSize.toString());
    
  if (filters.startDate) params = params.set('startDate', filters.startDate);
  // ... add other filters
  
  return this.http.get<PaginatedResponse<Payment>>(
    `${environment.apiUrl}/restaurants/${restaurantId}/payments`,
    { params }
  );
}

// Update component to use server-side pagination:
loadData(): void {
  this.paymentService.getFilteredPayments(
    this.filters,
    this.pagination.currentPage,
    this.pagination.pageSize
  ).subscribe(response => {
    this.allPayments = response.data;
    this.filteredPayments = response.data;
    this.pagination = response.pagination;
    this.displayedPayments = response.data; // Already paginated by server
  });
}


// ============================================================
// BACKEND API ENDPOINTS EXPECTED
// ============================================================

/**
 * GET /api/restaurants/{restaurantId}/payments
 * Query params: ?startDate=2024-01-01&endDate=2024-01-31&paymentStatus=SUCCESS,PENDING
 * Response: Payment[]
 */

/**
 * GET /api/restaurants/{restaurantId}/payments/summary
 * Response: {
 *   todayEarnings: number,
 *   weekEarnings: number,
 *   monthEarnings: number,
 *   pendingSettlements: number
 * }
 */

/**
 * GET /api/restaurants/{restaurantId}/payments/commission
 * Query params: ?startDate=...&endDate=...
 * Response: {
 *   grossRevenue: number,
 *   platformCommission: number,
 *   taxCharges: number,
 *   netPayout: number,
 *   commissionPercentage: number
 * }
 */

/**
 * GET /api/restaurants/{restaurantId}/payments/status-counts
 * Query params: ?startDate=...&endDate=...
 * Response: {
 *   successful: number,
 *   pending: number,
 *   failed: number,
 *   notInitiatedSettlements: number,
 *   inProgressSettlements: number,
 *   settledSettlements: number
 * }
 */

/**
 * GET /api/payment-methods
 * Response: ['UPI', 'CARD', 'CASH', 'WALLET']
 */

/**
 * POST /api/restaurants/{restaurantId}/payments/export/csv
 * Body: PaymentFilters
 * Response: File (application/csv)
 */

/**
 * POST /api/restaurants/{restaurantId}/payments/export/pdf
 * Body: PaymentFilters
 * Response: File (application/pdf)
 */


// ============================================================
// ERROR HANDLING
// ============================================================

// Add error handling in component:
loadData(): void {
  this.isLoading = true;
  
  this.paymentService.getFilteredPayments(this.filters).subscribe({
    next: (payments) => {
      this.allPayments = payments;
      this.filteredPayments = [...payments];
      this.applySorting();
      this.pagination.currentPage = 1;
      this.updatePagination();
      this.isLoading = false;
      this.cdr.markForCheck();
    },
    error: (error) => {
      console.error('Failed to load payments:', error);
      this.isLoading = false;
      // Show error toast/notification
      // this.toastService.error('Failed to load payment data');
      this.cdr.markForCheck();
    }
  });
}


// ============================================================
// AUTHENTICATION
// ============================================================

// Ensure restaurant ID comes from authenticated user:
import { Injectable } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private currentUser: any; // Replace with proper User interface
  
  getCurrentRestaurantId(): string {
    // Get from token or stored user object
    return this.currentUser?.restaurantId || '';
  }
  
  getAuthToken(): string {
    return localStorage.getItem('auth_token') || '';
  }
}

// Update payment.service.ts:
constructor(
  private http: HttpClient,
  private authService: AuthService
) {}

private getRestaurantId(): string {
  return this.authService.getCurrentRestaurantId();
}


// ============================================================
// TESTING THE INTEGRATION
// ============================================================

/**
 * 1. Start backend server
 * 2. Update environment.ts with correct API URL
 * 3. Login to get auth token
 * 4. Open financial dashboard modal
 * 5. Check browser Network tab for API calls
 * 6. Verify data loads correctly
 * 7. Test filters, pagination, exports
 */


// ============================================================
// MIGRATION CHECKLIST
// ============================================================

/*
✓ Create environment.ts with apiUrl
✓ Add HttpClient to app.config.ts
✓ Create auth interceptor for JWT token
✓ Update payment.service.ts methods (remove mock data)
✓ Add error handling in component
✓ Test with backend running
✓ Update export methods to use backend
✓ Add AuthService integration
✓ Test all filters work
✓ Test pagination
✓ Test exports (CSV/PDF)
✓ Add loading states
✓ Add error notifications
✓ Test with real restaurant data
*/


// ============================================================
// PERFORMANCE TIPS
// ============================================================

/**
 * 1. Use server-side pagination for >1000 records
 * 2. Add caching for filter options (payment methods, etc.)
 * 3. Debounce date range changes (wait 500ms before API call)
 * 4. Show loading skeleton instead of spinner
 * 5. Add retry logic for failed requests
 * 6. Use CDN for static assets
 * 7. Compress API responses (gzip)
 * 8. Add request timeouts
 */


// ============================================================
// SECURITY CONSIDERATIONS
// ============================================================

/**
 * 1. Always send JWT token in Authorization header
 * 2. Validate restaurantId on backend (don't trust frontend)
 * 3. Rate limit API endpoints
 * 4. Sanitize filter inputs
 * 5. Use HTTPS in production
 * 6. Don't expose sensitive data in URLs (use POST body)
 * 7. Implement CORS properly
 * 8. Add request signing for exports
 */
