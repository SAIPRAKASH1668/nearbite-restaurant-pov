import { Component, NgZone, OnInit, signal } from '@angular/core';
import { Router, RouterOutlet } from '@angular/router';
import { App as CapacitorApp } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';
import { StatusBar, Style } from '@capacitor/status-bar';
import { AppUpdateService } from './core/services/app-update.service';
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
  protected readonly updateState;

  constructor(
    private router: Router,
    private ngZone: NgZone,
    private appUpdateService: AppUpdateService,
    private newOrderToastService: NewOrderToastService,
    private orderNotificationService: OrderNotificationService,
    private pushNotificationService: PushNotificationService
  ) {
    this.updateState = this.appUpdateService.state;
  }

  ngOnInit(): void {
    void this.newOrderToastService;

    if (Capacitor.isNativePlatform()) {
      this.appUpdateService.initialize().catch((error) => {
        console.error('AppUpdateService initialization failed', error);
      });
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

      this.registerDeepLinkHandler();

      return;
    }

    this.orderNotificationService.requestNotificationPermission();
  }

  /**
   * Route Android App Link / iOS Universal Link taps (e.g. the ntfy "new
   * order" notification opening https://www.yumdude.com/dashboard/orders) to
   * the matching in-app route. Handles both warm opens (`appUrlOpen`) and a
   * cold start where the deep link launched the app (`getLaunchUrl`).
   */
  private registerDeepLinkHandler(): void {
    void CapacitorApp.addListener('appUrlOpen', ({ url }) => {
      this.ngZone.run(() => this.openDeepLink(url));
    });

    void CapacitorApp.getLaunchUrl().then((launch) => {
      if (launch?.url) {
        this.ngZone.run(() => this.openDeepLink(launch.url));
      }
    });
  }

  private openDeepLink(url: string): void {
    let path: string;
    try {
      const parsed = new URL(url);
      path = parsed.pathname + parsed.search;
    } catch {
      return; // malformed deep link — ignore
    }
    // Only follow our own dashboard deep links; never navigate to arbitrary URLs.
    if (path.startsWith('/dashboard')) {
      void this.router.navigateByUrl(path);
    }
  }

  protected async startRequiredUpdate(): Promise<void> {
    await this.appUpdateService.startRequiredUpdate();
  }

  protected async openInstallPermissionSettings(): Promise<void> {
    await this.appUpdateService.openInstallPermissionSettings();
  }

  protected async retryUpdateCheck(): Promise<void> {
    await this.appUpdateService.checkForRequiredUpdate();
  }

  protected updateButtonLabel(): string {
    const state = this.updateState();
    if (state.status === 'downloading') {
      return state.progressPercent === undefined
        ? 'Downloading...'
        : `Downloading ${state.progressPercent}%`;
    }
    if (state.status === 'installing') {
      return 'Installer opened';
    }
    return 'Update now';
  }
}
