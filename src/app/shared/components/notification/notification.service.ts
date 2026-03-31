import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { Notification, NotificationType } from './notification.model';

interface OrderToastConfig {
  orderNumber: string;
  amount: number;
  itemCount: number;
  onClick?: () => void;
}

@Injectable({
  providedIn: 'root'
})
export class NotificationService {
  private notificationsSubject = new BehaviorSubject<Notification[]>([]);
  public notifications$: Observable<Notification[]> = this.notificationsSubject.asObservable();

  private defaultDuration = 60000;

  show(type: NotificationType, message: string, duration?: number): void {
    this.showToast({
      type,
      message,
      duration
    });
  }

  showToast(notification: Omit<Notification, 'id' | 'timestamp'>): void {
    const toast: Notification = {
      id: this.generateId(),
      duration: notification.duration || this.defaultDuration,
      timestamp: Date.now(),
      ...notification
    };

    const currentNotifications = this.notificationsSubject.value;
    this.notificationsSubject.next([...currentNotifications, toast]);

    setTimeout(() => {
      this.remove(toast.id);
    }, toast.duration);
  }

  showOrderToast(config: OrderToastConfig): void {
    const itemLabel = config.itemCount === 1 ? '1 item' : `${config.itemCount} items`;
    const amountLabel = new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0
    }).format(config.amount);
    const orderTail = this.getOrderTail(config.orderNumber);

    this.showToast({
      type: NotificationType.INFO,
      variant: 'order',
      badge: amountLabel,
      title: 'New order',
      message: `${itemLabel} • #${orderTail}`,
      caption: 'Tap to open Orders',
      iconClass: 'fa-receipt',
      action: {
        onClick: config.onClick,
        ariaLabel: `Open orders for order ${config.orderNumber}`
      },
      duration: 60000
    });
  }

  success(message: string, duration?: number): void {
    this.show(NotificationType.SUCCESS, message, duration);
  }

  error(message: string, duration?: number): void {
    this.show(NotificationType.ERROR, message, duration);
  }

  warning(message: string, duration?: number): void {
    this.show(NotificationType.WARNING, message, duration);
  }

  info(message: string, duration?: number): void {
    this.show(NotificationType.INFO, message, duration);
  }

  remove(id: string): void {
    const currentNotifications = this.notificationsSubject.value;
    this.notificationsSubject.next(
      currentNotifications.filter((notification) => notification.id !== id)
    );
  }

  clear(): void {
    this.notificationsSubject.next([]);
  }

  private generateId(): string {
    return `notification-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
  }

  private getOrderTail(orderNumber: string): string {
    const compactValue = (orderNumber || '').replace(/[^a-zA-Z0-9]/g, '');
    const tail = compactValue.slice(-4);
    return tail || '----';
  }
}
