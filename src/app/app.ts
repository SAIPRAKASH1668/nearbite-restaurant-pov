import { Component, OnInit, signal } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { Capacitor } from '@capacitor/core';
import { StatusBar, Style } from '@capacitor/status-bar';
import { NewOrderToastService } from './core/services/new-order-toast.service';
import { OrderNotificationService } from './core/services/order-notification.service';
import { PushNotificationService } from './core/services/push-notification.service';
import { NotificationComponent } from './shared/components/notification/notification.component';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, NotificationComponent],
  templateUrl: './app.html',
  styleUrl: './app.scss'
})
export class App implements OnInit {
  protected readonly title = signal('restaurant-dashboard');

  constructor(
    private newOrderToastService: NewOrderToastService,
    private orderNotificationService: OrderNotificationService,
    private pushNotificationService: PushNotificationService
  ) {}

  ngOnInit(): void {
    void this.newOrderToastService;

    if (Capacitor.isNativePlatform()) {
      StatusBar.setOverlaysWebView({ overlay: true });
      StatusBar.setStyle({ style: Style.Light });
      this.pushNotificationService.initialize().catch((error) => {
        console.error('PushNotificationService initialization failed', error);
      });
      return;
    }

    this.orderNotificationService.requestNotificationPermission();
  }
}
