import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, Subscription, interval } from 'rxjs';
import { catchError, tap } from 'rxjs/operators';
import { environment } from '../../../environments/environment';
import {
  Order,
  OrdersResponse,
  OrderStatus,
  UpdateOrderStatusRequest,
  UpdateOrderStatusResponse
} from '../models/order.model';
import { IncomingOrder, OrderNotificationService } from './order-notification.service';
import { RestaurantContextService } from './restaurant-context.service';
import { SoundService } from './sound.service';

@Injectable({
  providedIn: 'root'
})
export class OrderService {
  private readonly API_BASE_URL = environment.apiUrl;
  private readonly POLLING_INTERVAL = 20000;

  private ordersSubject = new BehaviorSubject<Order[]>([]);
  public orders$: Observable<Order[]> = this.ordersSubject.asObservable();

  private loadingSubject = new BehaviorSubject<boolean>(false);
  public loading$: Observable<boolean> = this.loadingSubject.asObservable();

  private pollingSubscription?: Subscription;

  constructor(
    private http: HttpClient,
    private restaurantContext: RestaurantContextService,
    private soundService: SoundService,
    private orderNotificationService: OrderNotificationService
  ) {
    this.initializeOrderSync();
  }

  private initializeOrderSync(): void {
    this.setupPolling();
  }

  fetchOrders(options?: { announceNewOrders?: boolean; suppressNewOrderEffects?: boolean }): void {
    const restaurantId = this.restaurantContext.getRestaurantId();

    if (!restaurantId) {
      this.loadingSubject.next(false);
      this.ordersSubject.next([]);
      return;
    }

    this.loadingSubject.next(true);

    const existingIds = new Set(this.ordersSubject.value.map((order) => order.orderId));
    const isInitialFetch = existingIds.size === 0;

    this.http.get<OrdersResponse>(`${this.API_BASE_URL}/orders?restaurantId=${restaurantId}`)
      .pipe(
        tap((response) => {
          const visibleOrders = this.filterRestaurantVisibleOrders(response.orders);

          if (!options?.suppressNewOrderEffects) {
            if (isInitialFetch) {
              // On startup: ring only for CONFIRMED orders placed today
              const pendingConfirmed = visibleOrders.filter(
                (order) => order.status === OrderStatus.CONFIRMED && this.isToday(order.createdAt)
              );
              if (pendingConfirmed.length > 0) {
                this.soundService.playNewOrderAlarm();
              }
            } else {
              // On subsequent fetches: detect brand-new CONFIRMED orders placed today
              const newConfirmedOrders = visibleOrders.filter((order) =>
                !existingIds.has(order.orderId) &&
                order.status === OrderStatus.CONFIRMED &&
                this.isToday(order.createdAt)
              );
              if (newConfirmedOrders.length > 0) {
                this.soundService.playNewOrderAlarm();
                newConfirmedOrders.forEach((order) => {
                  this.orderNotificationService.notifyNewOrder(
                    this.mapIncomingOrder(order),
                    { playInAppSound: false, showSystemNotification: false }
                  );
                });
              }
            }
          }

          // Fix: stop the alarm on this device if no CONFIRMED orders from today remain.
          // This handles the case where another device already accepted the order —
          // the next poll will see zero CONFIRMED orders and kill the ring here too.
          const hasConfirmedToday = visibleOrders.some(
            (order) => order.status === OrderStatus.CONFIRMED && this.isToday(order.createdAt)
          );
          if (!hasConfirmedToday && this.soundService.isAlarmPlaying()) {
            this.soundService.stopAlarm();
          }

          this.ordersSubject.next(visibleOrders);
          this.loadingSubject.next(false);
        }),
        catchError((error) => {
          this.loadingSubject.next(false);
          throw error;
        })
      )
      .subscribe({
        error: () => {
          this.loadingSubject.next(false);
        }
      });
  }

  private filterRestaurantVisibleOrders(orders: Order[]): Order[] {
    return orders.filter((order) => order.status !== OrderStatus.INITIATED);
  }

  /** Returns true if the ISO timestamp belongs to today (local time). */
  private isToday(timestamp: string): boolean {
    const orderDate = new Date(timestamp);
    const today = new Date();
    return (
      orderDate.getFullYear() === today.getFullYear() &&
      orderDate.getMonth() === today.getMonth() &&
      orderDate.getDate() === today.getDate()
    );
  }

  private mapIncomingOrder(order: Order): IncomingOrder {
    return {
      orderId: order.orderId,
      orderNumber: order.orderId,
      customerName: this.maskCustomerPhone(order.customerPhone),
      items: order.items.map((item) => ({
        name: item.name,
        quantity: item.quantity
      })),
      amount: order.grandTotal,
      status: order.status,
      createdAt: order.createdAt,
      time: this.getRelativeTime(order.createdAt)
    };
  }

  private maskCustomerPhone(phone: string): string {
    if (!phone || phone.length < 8) {
      return 'Customer';
    }

    const visibleStart = phone.slice(0, 3);
    const visibleEnd = phone.slice(-4);
    return `${visibleStart}****${visibleEnd}`;
  }

  private getRelativeTime(timestamp: string): string {
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

  private addOrUpdateOrder(order: Order): void {
    const currentOrders = this.ordersSubject.value;
    const existingIndex = currentOrders.findIndex((currentOrder) => currentOrder.orderId === order.orderId);

    if (order.status === OrderStatus.INITIATED) {
      if (existingIndex === -1) {
        return;
      }

      const updatedOrders = currentOrders.filter((currentOrder) => currentOrder.orderId !== order.orderId);
      this.ordersSubject.next(updatedOrders);
      return;
    }

    if (existingIndex !== -1) {
      const updatedOrders = [...currentOrders];
      updatedOrders[existingIndex] = order;
      this.ordersSubject.next(updatedOrders);
      return;
    }

    this.ordersSubject.next([order, ...currentOrders]);
  }

  updateOrderStatus(
    orderId: string,
    status: OrderStatus,
    additionalData?: Partial<UpdateOrderStatusRequest>
  ): Observable<UpdateOrderStatusResponse> {
    const payload: UpdateOrderStatusRequest = { status, ...additionalData };

    return this.http.put<UpdateOrderStatusResponse>(
      `${this.API_BASE_URL}/orders/${orderId}/status`,
      payload
    ).pipe(
      tap((updatedOrder) => {
        this.addOrUpdateOrder(updatedOrder);
      }),
      catchError((error) => {
        this.fetchOrders();
        throw error;
      })
    );
  }

  private setupPolling(): void {
    this.pollingSubscription = interval(this.POLLING_INTERVAL).subscribe(() => {
      this.fetchOrders();
    });
  }

  getOrdersByStatus(status: OrderStatus): Observable<Order[]> {
    return new Observable((observer) => {
      this.orders$.subscribe((orders) => {
        observer.next(orders.filter((order) => order.status === status));
      });
    });
  }

  getOrderStats(): {
    pending: number;
    confirmed: number;
    preparing: number;
    ready: number;
    total: number;
  } {
    const orders = this.ordersSubject.value;
    return {
      pending: orders.filter((order) => order.status === OrderStatus.PENDING).length,
      confirmed: orders.filter((order) =>
        order.status === OrderStatus.CONFIRMED || order.status === OrderStatus.ACCEPTED
      ).length,
      preparing: orders.filter((order) => order.status === OrderStatus.PREPARING).length,
      ready: orders.filter((order) =>
        order.status === OrderStatus.READY_FOR_PICKUP ||
        order.status === OrderStatus.AWAITING_RIDER_ASSIGNMENT ||
        order.status === OrderStatus.OFFERED_TO_RIDER ||
        order.status === OrderStatus.RIDER_ASSIGNED
      ).length,
      total: orders.length
    };
  }

  ngOnDestroy(): void {
    this.pollingSubscription?.unsubscribe();
  }
}
