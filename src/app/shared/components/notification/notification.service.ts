import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { Notification, NotificationType } from './notification.model';

@Injectable({
  providedIn: 'root'
})
export class NotificationService {
  private notificationsSubject = new BehaviorSubject<Notification[]>([]);
  public notifications$: Observable<Notification[]> = this.notificationsSubject.asObservable();

  private defaultDuration = 5000; // 5 seconds

  show(type: NotificationType, message: string, duration?: number): void {
    const notification: Notification = {
      id: this.generateId(),
      type,
      message,
      duration: duration || this.defaultDuration,
      timestamp: Date.now()
    };

    const currentNotifications = this.notificationsSubject.value;
    this.notificationsSubject.next([...currentNotifications, notification]);

    // Auto-remove after duration
    setTimeout(() => {
      this.remove(notification.id);
    }, notification.duration);
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
      currentNotifications.filter(notification => notification.id !== id)
    );
  }

  clear(): void {
    this.notificationsSubject.next([]);
  }

  private generateId(): string {
    return `notification-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
}
