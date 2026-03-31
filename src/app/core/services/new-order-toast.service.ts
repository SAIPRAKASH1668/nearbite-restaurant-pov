import { Injectable, NgZone } from '@angular/core';
import { Router } from '@angular/router';
import { IncomingOrder, OrderNotificationService } from './order-notification.service';
import { NotificationService } from '../../shared/components/notification/notification.service';

@Injectable({
  providedIn: 'root'
})
export class NewOrderToastService {
  private readonly ORDERS_ROUTE = '/dashboard/orders';

  constructor(
    private orderNotificationService: OrderNotificationService,
    private notificationService: NotificationService,
    private router: Router,
    private ngZone: NgZone
  ) {
    this.orderNotificationService.getNewOrders().subscribe((order) => {
      this.showOrderToast(order);
    });
  }

  private showOrderToast(order: IncomingOrder): void {
    if (!this.shouldShowToast()) {
      return;
    }

    this.notificationService.showOrderToast({
      orderNumber: order.orderNumber,
      amount: order.amount,
      itemCount: order.items.reduce((total, item) => total + item.quantity, 0),
      onClick: () => {
        void this.navigateToOrders();
      }
    });
  }

  private shouldShowToast(): boolean {
    const currentUrl = this.router.url.split('?')[0].replace(/\/+$/, '') || '/';
    return currentUrl.startsWith('/dashboard') && currentUrl !== this.ORDERS_ROUTE;
  }

  private async navigateToOrders(): Promise<void> {
    await this.ngZone.run(() => this.router.navigateByUrl(this.ORDERS_ROUTE));
  }
}
