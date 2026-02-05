import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable, interval, Subscription } from 'rxjs';
import { catchError, tap } from 'rxjs/operators';
import { Order, OrdersResponse, OrderStatus, UpdateOrderStatusRequest, UpdateOrderStatusResponse } from '../models/order.model';
import { RestaurantContextService } from './restaurant-context.service';
import { WebSocketService } from './websocket.service';

@Injectable({
  providedIn: 'root'
})
export class OrderService {
  private readonly API_BASE_URL = 'https://w02o2vcti9.execute-api.ap-south-1.amazonaws.com/default/api/v1';
  private readonly POLLING_INTERVAL = 30000; // 30 seconds fallback polling
  
  private ordersSubject = new BehaviorSubject<Order[]>([]);
  public orders$: Observable<Order[]> = this.ordersSubject.asObservable();
  
  private loadingSubject = new BehaviorSubject<boolean>(false);
  public loading$: Observable<boolean> = this.loadingSubject.asObservable();
  
  private pollingSubscription?: Subscription;
  private webSocketSubscription?: Subscription;

  constructor(
    private http: HttpClient,
    private restaurantContext: RestaurantContextService,
    private webSocketService: WebSocketService
  ) {
    this.initializeOrderSync();
  }

  /**
   * Initialize order synchronization (REST + WebSocket)
   */
  private initializeOrderSync(): void {
    // Don't auto-fetch on service initialization to avoid race conditions
    // Components should call fetchOrders() when they're ready
    
    // Subscribe to WebSocket for real-time updates
    this.subscribeToWebSocket();
    
    // Setup fallback polling in case WebSocket fails
    this.setupPolling();
  }

  /**
   * Fetch all orders from REST API
   */
  fetchOrders(): void {
    const restaurantId = this.restaurantContext.getRestaurantId();
    this.loadingSubject.next(true);
    
    this.http.get<OrdersResponse>(`${this.API_BASE_URL}/orders?restaurantId=${restaurantId}`)
      .pipe(
        tap(response => {
          console.log('✓ Orders fetched successfully:', response);
          this.ordersSubject.next(response.orders);
          this.loadingSubject.next(false);
        }),
        catchError(error => {
          console.error('❌ Error fetching orders:', error);
          this.loadingSubject.next(false);
          throw error;
        })
      )
      .subscribe({
        error: (err) => {
          console.error('❌ Subscription error:', err);
          this.loadingSubject.next(false);
        }
      });
  }

  /**
   * Subscribe to WebSocket for real-time new orders
   */
  private subscribeToWebSocket(): void {
    this.webSocketSubscription = this.webSocketService.messages$.subscribe(
      (message: any) => {
        if (message.type === 'NEW_ORDER' || message.type === 'ORDER_UPDATE') {
          const newOrder = message.data as Order;
          this.addOrUpdateOrder(newOrder);
        }
      }
    );
  }

  /**
   * Add or update order in local state (handles deduplication)
   * @param order - Order to add or update
   */
  private addOrUpdateOrder(order: Order): void {
    const currentOrders = this.ordersSubject.value;
    const existingIndex = currentOrders.findIndex(o => o.orderId === order.orderId);
    
    if (existingIndex !== -1) {
      // Update existing order
      const updatedOrders = [...currentOrders];
      updatedOrders[existingIndex] = order;
      this.ordersSubject.next(updatedOrders);
    } else {
      // Add new order at the beginning (newest first)
      this.ordersSubject.next([order, ...currentOrders]);
    }
  }

  /**
   * Update order status
   * @param orderId - Order ID to update
   * @param status - New status
   * @returns Observable of updated order
   */
  updateOrderStatus(orderId: string, status: OrderStatus): Observable<UpdateOrderStatusResponse> {
    const payload: UpdateOrderStatusRequest = { status };
    
    return this.http.put<UpdateOrderStatusResponse>(
      `${this.API_BASE_URL}/orders/${orderId}/status`,
      payload
    ).pipe(
      tap(updatedOrder => {
        // Optimistic update: immediately update local state
        this.addOrUpdateOrder(updatedOrder);
      }),
      catchError(error => {
        console.error('Error updating order status:', error);
        // Refresh orders to get correct state
        this.fetchOrders();
        throw error;
      })
    );
  }

  /**
   * Setup polling as fallback mechanism
   */
  private setupPolling(): void {
    this.pollingSubscription = interval(this.POLLING_INTERVAL).subscribe(() => {
      // Only poll if WebSocket is disconnected
      if (!this.webSocketService.isConnected()) {
        console.log('WebSocket disconnected, using polling fallback');
        this.fetchOrders();
      }
    });
  }

  /**
   * Get orders by status
   * @param status - Filter by status
   * @returns Observable of filtered orders
   */
  getOrdersByStatus(status: OrderStatus): Observable<Order[]> {
    return new Observable(observer => {
      this.orders$.subscribe(orders => {
        observer.next(orders.filter(order => order.status === status));
      });
    });
  }

  /**
   * Get order statistics
   * @returns Statistics object
   */
  getOrderStats(): { pending: number; confirmed: number; preparing: number; ready: number; total: number } {
    const orders = this.ordersSubject.value;
    return {
      pending: orders.filter(o => o.status === OrderStatus.PENDING).length,
      confirmed: orders.filter(o => o.status === OrderStatus.CONFIRMED).length,
      preparing: orders.filter(o => o.status === OrderStatus.PREPARING).length,
      ready: orders.filter(o => o.status === OrderStatus.READY).length,
      total: orders.length
    };
  }

  /**
   * Cleanup subscriptions
   */
  ngOnDestroy(): void {
    this.pollingSubscription?.unsubscribe();
    this.webSocketSubscription?.unsubscribe();
  }
}
