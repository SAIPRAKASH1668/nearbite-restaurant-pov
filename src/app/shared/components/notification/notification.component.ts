import { Component, OnInit, OnDestroy, ChangeDetectionStrategy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Subscription } from 'rxjs';
import { NotificationService } from './notification.service';
import { Notification, NotificationType } from './notification.model';
import { trigger, transition, style, animate } from '@angular/animations';

@Component({
  selector: 'app-notification',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './notification.component.html',
  styleUrl: './notification.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  animations: [
    trigger('toastMotion', [
      transition(':enter', [
        style({ transform: 'translateY(28px) scale(0.94)', opacity: 0 }),
        animate(
          '360ms cubic-bezier(0.22, 1, 0.36, 1)',
          style({ transform: 'translateY(0) scale(1)', opacity: 1 })
        )
      ]),
      transition(':leave', [
        animate(
          '220ms ease-out',
          style({ transform: 'translateY(18px) scale(0.97)', opacity: 0 })
        )
      ])
    ])
  ]
})
export class NotificationComponent implements OnInit, OnDestroy {
  notifications: Notification[] = [];
  private subscription?: Subscription;

  NotificationType = NotificationType;

  constructor(
    private notificationService: NotificationService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.subscription = this.notificationService.notifications$.subscribe(
      notifications => {
        this.notifications = notifications;
        this.cdr.markForCheck();
      }
    );
  }

  ngOnDestroy(): void {
    this.subscription?.unsubscribe();
  }

  removeNotification(id: string): void {
    this.notificationService.remove(id);
  }

  onNotificationClick(notification: Notification): void {
    if (!notification.action?.onClick) {
      return;
    }

    notification.action.onClick();
    this.notificationService.remove(notification.id);
  }

  getIcon(type: NotificationType): string {
    switch (type) {
      case NotificationType.SUCCESS:
        return 'fa-check-circle';
      case NotificationType.ERROR:
        return 'fa-times-circle';
      case NotificationType.WARNING:
        return 'fa-exclamation-triangle';
      case NotificationType.INFO:
        return 'fa-info-circle';
      default:
        return 'fa-bell';
    }
  }

  getNotificationIcon(notification: Notification): string {
    return notification.iconClass || this.getIcon(notification.type);
  }
}
