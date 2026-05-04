import { Component, OnInit, signal } from '@angular/core';
import { Router, RouterOutlet } from '@angular/router';
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
    private router: Router,
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

      // Register the global hook that MainActivity calls via evaluateJavascript
      // when the restaurant owner unlocks the phone from the alarm screen.
      // Also handle the case where MainActivity fired the JS call before Angular
      // had fully bootstrapped (pending flag set by the native side).
      (window as any)['__yumdude_open_orders'] = () => {
        void this.router.navigateByUrl('/dashboard/orders');
      };
      if ((window as any)['__yumdude_open_orders_pending']) {
        delete (window as any)['__yumdude_open_orders_pending'];
        void this.router.navigateByUrl('/dashboard/orders');
      }

      return;
    }

    this.orderNotificationService.requestNotificationPermission();
  }
}
