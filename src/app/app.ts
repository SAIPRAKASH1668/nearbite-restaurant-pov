import { Component, signal, OnInit, ApplicationRef, NgZone } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { OrderNotificationModalComponent } from './shared/components/order-notification-modal/order-notification-modal.component';
import { NotificationComponent } from './shared/components/notification/notification.component';
import { WebSocketService } from './core/services/websocket.service';
import { OrderNotificationService, IncomingOrder } from './core/services/order-notification.service';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, OrderNotificationModalComponent, NotificationComponent],
  templateUrl: './app.html',
  styleUrl: './app.scss'
})
export class App implements OnInit {
  protected readonly title = signal('restaurant-dashboard');

  constructor(
    private webSocketService: WebSocketService,
    private orderNotificationService: OrderNotificationService,
    private ngZone: NgZone,
    private appRef: ApplicationRef
  ) {}

  ngOnInit(): void {
    console.log('🚀 App component initialized - WebSocket connection starting...');
    
    // Request notification permission
    this.orderNotificationService.requestNotificationPermission();

    // Connect to WebSocket globally
    this.webSocketService.connect();

    // Subscribe to incoming orders and broadcast to notification service
    this.webSocketService.getOrders().subscribe((backendOrder: any) => {
      console.log('🔔 [APP COMPONENT] New order received globally:', backendOrder);

      // Run inside Angular zone and trigger change detection
      this.ngZone.run(() => {
        // Transform backend order to frontend format
        const order: IncomingOrder = {
          orderId: backendOrder.orderId || backendOrder.id,
          orderNumber: backendOrder.orderId || `#${backendOrder.orderId}`,
          customerName: backendOrder.customerName,
          items: backendOrder.items ? backendOrder.items.map((item: string) => ({ 
            name: item, 
            quantity: 1 
          })) : [],
          amount: backendOrder.totalAmount || 0,
          status: backendOrder.status || 'NEW',
          createdAt: backendOrder.createdAt || new Date().toISOString(),
          time: 'Just now'
        };

        console.log('📢 [APP COMPONENT] Broadcasting order to notification service:', order);
        
        // Notify globally
        this.orderNotificationService.notifyNewOrder(order);
        
        // Force change detection
        this.appRef.tick();
      });
    });
  }
}
