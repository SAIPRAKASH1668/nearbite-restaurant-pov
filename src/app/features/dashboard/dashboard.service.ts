import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable, of } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { environment } from '../../../environments/environment';
import { Order, OrderStatus } from '../../core/models/order.model';
import { RestaurantContextService } from '../../core/services/restaurant-context.service';

export interface DashboardStats {
  todayOrders: number;
  acceptedOrders: number;
  cancelledOrders: number;
  newOrders: number;
  preparingOrders: number;
  readyOrders: number;
  doneTodayOrders: number;
  todayRevenue: number;
  todayPayout: number;
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
  payout: number | null;
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
  private readonly API_BASE_URL = environment.apiUrl;

  constructor(
    private http: HttpClient,
    private restaurantContext: RestaurantContextService
  ) {}

  getStats(): Observable<DashboardStats> {
    const restaurantId = this.restaurantContext.getRestaurantId();

    return this.http.get<OrdersResponse>(`${this.API_BASE_URL}/orders`, {
      params: { restaurantId }
    }).pipe(
      map((response) => {
        const orders = this.filterRestaurantVisibleOrders(response.orders);
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1);

        const todayOrders = orders.filter((order) => {
          const orderDate = new Date(order.createdAt);
          orderDate.setHours(0, 0, 0, 0);
          return orderDate.getTime() === today.getTime();
        });

        const yesterdayOrders = orders.filter((order) => {
          const orderDate = new Date(order.createdAt);
          orderDate.setHours(0, 0, 0, 0);
          return orderDate.getTime() === yesterday.getTime();
        });

        const todayNonCancelledOrders = todayOrders.filter((order) => order.status !== OrderStatus.CANCELLED);
        const yesterdayNonCancelledOrders = yesterdayOrders.filter((order) => order.status !== OrderStatus.CANCELLED);

        const todayRevenue = todayNonCancelledOrders
          .reduce((sum, order) => sum + order.foodTotal, 0);

        const todayPayout = todayNonCancelledOrders
          .reduce((sum, order) => {
            const fp = order.revenue?.restaurantRevenue?.finalPayout;
            return sum + (fp != null ? fp : order.foodTotal);
          }, 0);

        const yesterdayRevenue = yesterdayNonCancelledOrders
          .reduce((sum, order) => sum + order.foodTotal, 0);

        const avgOrderValue = todayNonCancelledOrders.length > 0 ? todayRevenue / todayNonCancelledOrders.length : 0;
        const yesterdayAvgOrderValue = yesterdayNonCancelledOrders.length > 0
          ? yesterdayRevenue / yesterdayNonCancelledOrders.length
          : 0;

        const pendingOrders = todayOrders.filter((order) =>
          order.status === OrderStatus.PENDING || order.status === OrderStatus.CONFIRMED
        ).length;
        const preparingOrders = todayOrders.filter((order) =>
          order.status === OrderStatus.ACCEPTED || order.status === OrderStatus.PREPARING
        ).length;
        const readyOrders = todayOrders.filter((order) =>
          order.status === OrderStatus.READY_FOR_PICKUP ||
          order.status === OrderStatus.AWAITING_RIDER_ASSIGNMENT ||
          order.status === OrderStatus.OFFERED_TO_RIDER ||
          order.status === OrderStatus.RIDER_ASSIGNED ||
          order.status === OrderStatus.PICKED_UP ||
          order.status === OrderStatus.OUT_FOR_DELIVERY
        ).length;
        const doneTodayOrders = todayOrders.filter((order) => order.status === OrderStatus.DELIVERED).length;

        return {
          todayOrders: todayOrders.length,
          acceptedOrders: todayNonCancelledOrders.length,
          cancelledOrders: todayOrders.length - todayNonCancelledOrders.length,
          newOrders: pendingOrders,
          preparingOrders,
          readyOrders,
          doneTodayOrders,
          todayRevenue: Math.round(todayRevenue),
          todayPayout: Math.round(todayPayout),
          avgOrderValue: Math.round(avgOrderValue),
          pendingOrders,
          ordersChangePercent: this.calculatePercentChange(todayOrders.length, yesterdayOrders.length),
          revenueChangePercent: this.calculatePercentChange(todayRevenue, yesterdayRevenue),
          avgOrderValueChangePercent: this.calculatePercentChange(avgOrderValue, yesterdayAvgOrderValue)
        };
      }),
      catchError((error) => {
        console.error('DashboardService.getStats: Error fetching dashboard stats:', error);
        return of({
          todayOrders: 0,
          acceptedOrders: 0,
          cancelledOrders: 0,
          newOrders: 0,
          preparingOrders: 0,
          readyOrders: 0,
          doneTodayOrders: 0,
          todayRevenue: 0,
          todayPayout: 0,
          avgOrderValue: 0,
          pendingOrders: 0,
          ordersChangePercent: 0,
          revenueChangePercent: 0,
          avgOrderValueChangePercent: 0
        });
      })
    );
  }

  getRecentOrders(): Observable<RecentOrder[]> {
    const restaurantId = this.restaurantContext.getRestaurantId();

    return this.http.get<OrdersResponse>(`${this.API_BASE_URL}/orders`, {
      params: { restaurantId }
    }).pipe(
      map((response) => {
        const recentOrders = this.filterRestaurantVisibleOrders(response.orders)
          .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
          .slice(0, 5);

        return recentOrders.map((order) => ({
          id: order.orderId,
          orderNumber: order.orderId,
          customerName: this.maskPhoneNumber(order.customerPhone),
          items: order.items.length,
          amount: order.foodTotal,
          payout: order.revenue?.restaurantRevenue?.finalPayout ?? null,
          status: this.mapOrderStatus(order.status),
          time: this.getRelativeTime(order.createdAt)
        }));
      }),
      catchError((error) => {
        console.error('DashboardService.getRecentOrders: Error fetching recent orders:', error);
        return of([]);
      })
    );
  }

  private filterRestaurantVisibleOrders(orders: Order[]): Order[] {
    return orders.filter((order) => order.status !== OrderStatus.INITIATED);
  }

  private maskPhoneNumber(phone: string): string {
    if (!phone || phone.length < 8) return 'Customer';
    const visibleStart = phone.slice(0, 3);
    const visibleEnd = phone.slice(-4);
    return `${visibleStart}****${visibleEnd}`;
  }

  private calculatePercentChange(current: number, previous: number): number {
    if (previous === 0) {
      return current > 0 ? 100 : 0;
    }

    const change = ((current - previous) / previous) * 100;
    return Math.round(change * 10) / 10;
  }

  private mapOrderStatus(status: OrderStatus): 'new' | 'preparing' | 'ready' | 'completed' {
    switch (status) {
      case OrderStatus.PENDING:
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
