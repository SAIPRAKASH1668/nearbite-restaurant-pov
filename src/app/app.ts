import { Component, signal, OnInit } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { OrderNotificationModalComponent } from './shared/components/order-notification-modal/order-notification-modal.component';
import { NotificationComponent } from './shared/components/notification/notification.component';
import { OrderNotificationService } from './core/services/order-notification.service';
import { Capacitor } from '@capacitor/core';
import { StatusBar, Style } from '@capacitor/status-bar';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, OrderNotificationModalComponent, NotificationComponent],
  templateUrl: './app.html',
  styleUrl: './app.scss'
})
export class App implements OnInit {
  protected readonly title = signal('restaurant-dashboard');

  constructor(
    private orderNotificationService: OrderNotificationService
  ) {}

  ngOnInit(): void {
    // Fix status bar on Android — make it transparent so safe-area-inset-top works
    if (Capacitor.isNativePlatform()) {
      StatusBar.setOverlaysWebView({ overlay: true });
      StatusBar.setStyle({ style: Style.Light }); // dark icons on white navbar background
    }

    // Request notification permission
    this.orderNotificationService.requestNotificationPermission();
  }
}
