import { HttpClient } from '@angular/common/http';
import { Injectable, NgZone } from '@angular/core';
import { Router } from '@angular/router';
import { Capacitor } from '@capacitor/core';
import {
  ActionPerformed,
  PushNotificationSchema,
  PushNotifications,
  Token
} from '@capacitor/push-notifications';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../environments/environment';
import { RestaurantContextService } from './restaurant-context.service';
import { OrderService } from './order.service';

@Injectable({
  providedIn: 'root'
})
export class PushNotificationService {
  private readonly API_BASE_URL = environment.apiUrl;
  private readonly CHANNEL_ID = 'new_orders';
  private readonly TOKEN_STORAGE_KEY = 'nearbite_fcm_token';
  private readonly VIEW_ONLY_KEY = 'nearbite_notification_mode';
  private readonly DEVICE_REGISTERED_KEY = 'nearbite_fcm_device_registered';
  private initialized = false;

  constructor(
    private http: HttpClient,
    private orderService: OrderService,
    private restaurantContext: RestaurantContextService,
    private router: Router,
    private ngZone: NgZone
  ) {}

  isViewOnlyMode(): boolean {
    return localStorage.getItem(this.VIEW_ONLY_KEY) === 'view_only';
  }

  setViewOnlyMode(): void {
    localStorage.setItem(this.VIEW_ONLY_KEY, 'view_only');
    localStorage.removeItem(this.DEVICE_REGISTERED_KEY);
  }

  clearViewOnlyMode(): void {
    localStorage.removeItem(this.VIEW_ONLY_KEY);
  }

  isDeviceRegistered(): boolean {
    return localStorage.getItem(this.DEVICE_REGISTERED_KEY) === 'true';
  }

  clearDeviceRegistered(): void {
    localStorage.removeItem(this.DEVICE_REGISTERED_KEY);
  }

  async checkRemoteTokenExists(restaurantId: string): Promise<boolean> {
    if (!Capacitor.isNativePlatform()) {
      return false;
    }
    try {
      const result = await firstValueFrom(
        this.http.get<{ hasActiveToken: boolean }>(
          `${this.API_BASE_URL}/restaurants/${restaurantId}/fcm-token-status`
        )
      );
      return result.hasActiveToken === true;
    } catch {
      return false;
    }
  }

  /**
   * Returns true if this device's FCM token is still the active one on the backend.
   * Returns true (safe default) if no local token exists or request fails.
   */
  async checkIsActiveNotifier(restaurantId: string): Promise<boolean> {
    if (!Capacitor.isNativePlatform()) {
      return true;
    }
    const localToken = localStorage.getItem(this.TOKEN_STORAGE_KEY);
    if (!localToken) {
      return true;
    }
    try {
      const result = await firstValueFrom(
        this.http.get<{ hasActiveToken: boolean; isThisDeviceActive?: boolean }>(
          `${this.API_BASE_URL}/restaurants/${restaurantId}/fcm-token-status`,
          { headers: { 'X-Device-FCM-Token': localToken } }
        )
      );
      // If backend returned the comparison, use it; otherwise assume active
      return result.isThisDeviceActive !== false;
    } catch {
      return true;
    }
  }

  async takeOverNotifications(restaurantId?: string): Promise<void> {
    this.clearViewOnlyMode();
    await this.syncTokenForRestaurant(restaurantId);
  }

  async initialize(): Promise<void> {
    if (!Capacitor.isNativePlatform() || this.initialized) {
      return;
    }

    this.initialized = true;

    await PushNotifications.removeAllListeners();
    await this.addListeners();
    await this.createOrderChannel();

    let permissionStatus = await PushNotifications.checkPermissions();

    if (permissionStatus.receive === 'prompt') {
      permissionStatus = await PushNotifications.requestPermissions();
    }

    if (permissionStatus.receive !== 'granted') {
      console.warn('Push notifications permission was not granted');
      return;
    }

    await PushNotifications.register();
    await this.syncTokenForRestaurant();
  }

  async syncTokenForRestaurant(restaurantId?: string): Promise<void> {
    if (this.isViewOnlyMode()) {
      return;
    }

    if (!Capacitor.isNativePlatform()) {
      return;
    }

    const token = localStorage.getItem(this.TOKEN_STORAGE_KEY);
    const resolvedRestaurantId = restaurantId || this.restaurantContext.getRestaurantId();

    if (!token || !resolvedRestaurantId) {
      return;
    }

    try {
      await firstValueFrom(
        this.http.post(
          `${this.API_BASE_URL}/restaurants/${resolvedRestaurantId}/fcm-token`,
          { fcmToken: token }
        )
      );
      localStorage.setItem(this.DEVICE_REGISTERED_KEY, 'true');
    } catch (error) {
      console.error('Failed to sync restaurant FCM token', error);
    }
  }

  clearTokenForRestaurant(restaurantId?: string): void {
    if (!Capacitor.isNativePlatform()) {
      localStorage.removeItem(this.TOKEN_STORAGE_KEY);
      return;
    }

    const resolvedRestaurantId = restaurantId || this.restaurantContext.getRestaurantId();
    const token = localStorage.getItem(this.TOKEN_STORAGE_KEY) || undefined;

    PushNotifications.unregister().catch(() => undefined);
    localStorage.removeItem(this.TOKEN_STORAGE_KEY);
    localStorage.removeItem(this.VIEW_ONLY_KEY);
    localStorage.removeItem(this.DEVICE_REGISTERED_KEY);

    if (!resolvedRestaurantId) {
      return;
    }

    this.http.delete(`${this.API_BASE_URL}/restaurants/${resolvedRestaurantId}/fcm-token`, {
      body: token ? { fcmToken: token } : {}
    })
      .subscribe({
        error: (error) => {
          console.error('Failed to clear restaurant FCM token', error);
        }
      });
  }

  private async addListeners(): Promise<void> {
    await PushNotifications.addListener('registration', (token: Token) => {
      localStorage.setItem(this.TOKEN_STORAGE_KEY, token.value);
      console.log('FCM registration token received');
      void this.syncTokenForRestaurant();
    });

    await PushNotifications.addListener('registrationError', (error) => {
      console.error('Push registration error', error);
    });

    await PushNotifications.addListener(
      'pushNotificationReceived',
      (notification: PushNotificationSchema) => {
        this.ngZone.run(() => {
          this.handleNotificationReceived(notification);
        });
      }
    );

    await PushNotifications.addListener(
      'pushNotificationActionPerformed',
      (action: ActionPerformed) => {
        this.ngZone.run(() => {
          this.handleNotificationAction(action);
        });
      }
    );
  }

  private async createOrderChannel(): Promise<void> {
    if (Capacitor.getPlatform() !== 'android') {
      return;
    }

    await PushNotifications.deleteChannel({ id: this.CHANNEL_ID }).catch(() => undefined);

    await PushNotifications.createChannel({
      id: this.CHANNEL_ID,
      name: 'New Orders',
      description: 'Urgent alerts for newly confirmed restaurant orders',
      importance: 5,
      visibility: 1,
      vibration: true,
      lights: true,
      lightColor: '#F97316',
      sound: 'telephone_ring'
    });
  }

  private handleNotificationReceived(_notification: PushNotificationSchema): void {
    this.orderService.fetchOrders({ announceNewOrders: true });
  }

  private handleNotificationAction(_action: ActionPerformed): void {
    this.router.navigateByUrl('/dashboard/orders').catch(() => undefined);
    this.orderService.fetchOrders({ suppressNewOrderEffects: true });
  }
}
