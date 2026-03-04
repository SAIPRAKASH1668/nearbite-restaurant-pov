import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, of, forkJoin } from 'rxjs';
import { map, catchError } from 'rxjs/operators';
import { RestaurantContextService } from '../../core/services/restaurant-context.service';
import { Order, OrderStatus } from '../../core/models/order.model';

export interface DashboardStats {
  todayOrders: number;
  todayRevenue: number;
  avgOrderValue: number;
  pendingOrders: number;
  ordersChangePercent: number;
  revenueChangePercent: number;
  avgOrderValueChangePercent: number;
}

export interface RecentOrder {
  id: string;
  orderNumber: string;
  customerName: string;
  items: number;
  amount: number;
  status: 'new' | 'preparing' | 'ready' | 'completed';
  time: string;
}

interface OrdersResponse {
  orders: Order[];
  total: number;
}

@Injectable({
  providedIn: 'root'
})
export class DashboardService {
  private readonly API_BASE_URL = 'https://api.dev.yumdude.com/api/v1';

  constructor(
    private http: HttpClient,
    private restaurantContext: RestaurantContextService
  ) {}

  /**
   * Get dashboard stats from real AWS data
   */
  getStats(): Observable<DashboardStats> {
    const restaurantId = this.restaurantContext.getRestaurantId();
    console.log('DashboardService.getStats: Starting with restaurantId:', restaurantId);
    
    return this.http.get<OrdersResponse>(`${this.API_BASE_URL}/orders`, {
      params: { restaurantId }
    }).pipe(
      map(response => {
        console.log('DashboardService.getStats: Received response:', response);
        const orders = response.orders;
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        const yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1);
        
        // Filter today's orders
        const todayOrders = orders.filter(order => {
          const orderDate = new Date(order.createdAt);
          orderDate.setHours(0, 0, 0, 0);
          return orderDate.getTime() === today.getTime();
        });
        
        // Filter yesterday's orders
        const yesterdayOrders = orders.filter(order => {
          const orderDate = new Date(order.createdAt);
          orderDate.setHours(0, 0, 0, 0);
          return orderDate.getTime() === yesterday.getTime();
        });
        
        // Calculate today's revenue from successful orders
        const todayRevenue = todayOrders
          .filter(order => order.status !== OrderStatus.CANCELLED)
          .reduce((sum, order) => sum + order.grandTotal, 0);
        
        // Calculate yesterday's revenue
        const yesterdayRevenue = yesterdayOrders
          .filter(order => order.status !== OrderStatus.CANCELLED)
          .reduce((sum, order) => sum + order.grandTotal, 0);
        
        // Calculate average order values
        const avgOrderValue = todayOrders.length > 0 
          ? todayRevenue / todayOrders.length 
          : 0;
        
        const yesterdayAvgOrderValue = yesterdayOrders.length > 0
          ? yesterdayRevenue / yesterdayOrders.length
          : 0;
        
        // Count pending orders (PENDING, INITIATED, or CONFIRMED status)
        const pendingOrders = orders.filter(order => 
          order.status === OrderStatus.PENDING || 
          order.status === OrderStatus.INITIATED ||
          order.status === OrderStatus.CONFIRMED
        ).length;
        
        // Calculate percentage changes
        const ordersChangePercent = this.calculatePercentChange(todayOrders.length, yesterdayOrders.length);
        const revenueChangePercent = this.calculatePercentChange(todayRevenue, yesterdayRevenue);
        const avgOrderValueChangePercent = this.calculatePercentChange(avgOrderValue, yesterdayAvgOrderValue);
        
        const stats = {
          todayOrders: todayOrders.length,
          todayRevenue: Math.round(todayRevenue),
          avgOrderValue: Math.round(avgOrderValue),
          pendingOrders,
          ordersChangePercent,
          revenueChangePercent,
          avgOrderValueChangePercent
        };
        console.log('DashboardService.getStats: Computed stats:', stats);
        return stats;
      }),
      catchError(error => {
        console.error('DashboardService.getStats: Error fetching dashboard stats:', error);
        // Return default values on error
        return of({
          todayOrders: 0,
          todayRevenue: 0,
          avgOrderValue: 0,
          pendingOrders: 0,
          ordersChangePercent: 0,
          revenueChangePercent: 0,
          avgOrderValueChangePercent: 0
        });
      })
    );
  }

  /**
   * Get recent orders from real AWS data
   */
  getRecentOrders(): Observable<RecentOrder[]> {
    const restaurantId = this.restaurantContext.getRestaurantId();
    console.log('DashboardService.getRecentOrders: Starting with restaurantId:', restaurantId);
    
    return this.http.get<OrdersResponse>(`${this.API_BASE_URL}/orders`, {
      params: { restaurantId }
    }).pipe(
      map(response => {
        console.log('DashboardService.getRecentOrders: Received response:', response);
        // Sort by createdAt descending and take first 5
        const recentOrders = response.orders
          .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
          .slice(0, 5);
        
        const orders = recentOrders.map(order => ({
          id: order.orderId,
          orderNumber: order.orderId,
          customerName: this.maskPhoneNumber(order.customerPhone),
          items: order.items.length,
          amount: order.grandTotal,
          status: this.mapOrderStatus(order.status),
          time: this.getRelativeTime(order.createdAt)
        }));
        console.log('DashboardService.getRecentOrders: Mapped orders:', orders);
        return orders;
      }),
      catchError(error => {
        console.error('DashboardService.getRecentOrders: Error fetching recent orders:', error);
        return of([]);
      })
    );
  }

  /**
   * Mask phone number for privacy
   * e.g., +919876543210 -> +91****3210
   */
  private maskPhoneNumber(phone: string): string {
    if (!phone || phone.length < 8) return 'Customer';
    const visibleStart = phone.slice(0, 3);
    const visibleEnd = phone.slice(-4);
    return `${visibleStart}****${visibleEnd}`;
  }

  /**
   * Calculate percentage change between two values
   * Returns positive for increase, negative for decrease
   */
  private calculatePercentChange(current: number, previous: number): number {
    if (previous === 0) {
      return current > 0 ? 100 : 0;
    }
    const change = ((current - previous) / previous) * 100;
    return Math.round(change * 10) / 10; // Round to 1 decimal place
  }

  /**
   * Map AWS order status to dashboard status
   */
  private mapOrderStatus(status: OrderStatus): 'new' | 'preparing' | 'ready' | 'completed' {
    switch (status) {
      case OrderStatus.PENDING:
      case OrderStatus.INITIATED:
      case OrderStatus.CONFIRMED:
        return 'new';
      case OrderStatus.ACCEPTED:
      case OrderStatus.PREPARING:
        return 'preparing';
      case OrderStatus.READY_FOR_PICKUP:
      case OrderStatus.AWAITING_RIDER_ASSIGNMENT:
      case OrderStatus.OFFERED_TO_RIDER:
      case OrderStatus.RIDER_ASSIGNED:
        return 'ready';
      case OrderStatus.PICKED_UP:
      case OrderStatus.OUT_FOR_DELIVERY:
      case OrderStatus.DELIVERED:
        return 'completed';
      default:
        return 'new';
    }
  }

  /**
   * Get relative time string
   */
  private getRelativeTime(dateString: string): string {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);
    
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins} min${diffMins > 1 ? 's' : ''} ago`;
    if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
    if (diffDays < 7) return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
    return date.toLocaleDateString();
  }
}
