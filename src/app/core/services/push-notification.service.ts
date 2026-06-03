import { HttpClient } from '@angular/common/http';
import { Injectable, NgZone } from '@angular/core';
import { Router } from '@angular/router';
import { App as CapacitorApp } from '@capacitor/app';
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
  private readonly CRITICAL_CHANNEL_ID = 'new_orders_critical';
  private readonly TOKEN_STORAGE_KEY = 'nearbite_fcm_token';
  private readonly VIEW_ONLY_KEY = 'nearbite_notification_mode';
  private readonly DEVICE_REGISTERED_KEY = 'nearbite_fcm_device_registered';
  private readonly LAST_SYNC_AT_KEY = 'nearbite_fcm_last_sync_at';
  /** Force a re-upload if the last successful sync is older than this. FCM
   *  rotates tokens silently every ~weeks; we treat 24h as "must reconfirm". */
  private readonly STALE_SYNC_MS = 24 * 60 * 60 * 1000;
  /** Upload retry plan: 1s → 3s → 8s. Sequence chosen to ride out transient
   *  network blips without blocking app boot more than a few seconds. */
  private readonly UPLOAD_RETRY_DELAYS_MS = [1000, 3000, 8000];
  private initialized = false;
  private foregroundListenerAttached = false;
  private syncInFlight: Promise<void> | null = null;

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
    await this.syncTokenForRestaurant(restaurantId, { force: true });
  }

  /**
   * Trigger a real FCM push to every token registered for this restaurant.
   * Used by the Settings 'Test Notification' button so operators get instant
   * ground truth that the pipeline is wired correctly.
   */
  async sendTestNotification(restaurantId?: string): Promise<{
    tokenCount: number;
    successCount: number;
    failureCount: number;
    invalidTokensRemoved: number;
  }> {
    const resolvedRestaurantId = restaurantId || this.restaurantContext.getRestaurantId();
    if (!resolvedRestaurantId) {
      throw new Error('No restaurant context');
    }
    return firstValueFrom(
      this.http.post<{
        tokenCount: number;
        successCount: number;
        failureCount: number;
        invalidTokensRemoved: number;
      }>(`${this.API_BASE_URL}/restaurants/${resolvedRestaurantId}/test-notification`, {})
    );
  }

  async initialize(): Promise<void> {
    if (!Capacitor.isNativePlatform() || this.initialized) {
      return;
    }

    this.initialized = true;

    await PushNotifications.removeAllListeners();
    await this.addListeners();
    await this.createOrderChannel();
    this.attachForegroundListener();

    await this.ensurePermissionAndRegister({ promptIfDenied: false });
  }

  /**
   * Re-prompts permission, registers with FCM, and syncs token. Safe to call
   * any number of times — short-circuits when already granted.
   *
   * `promptIfDenied=true` re-asks even when the OS state is 'denied'. Android
   * 13 dialog can be re-shown; on iOS the call is a no-op past denial (the
   * user must visit Settings).
   */
  async ensurePermissionAndRegister(
    { promptIfDenied = false }: { promptIfDenied?: boolean } = {}
  ): Promise<{ granted: boolean }> {
    if (!Capacitor.isNativePlatform()) {
      return { granted: false };
    }

    let status = await PushNotifications.checkPermissions();

    if (status.receive === 'prompt' || (promptIfDenied && status.receive === 'denied')) {
      status = await PushNotifications.requestPermissions();
    }

    if (status.receive !== 'granted') {
      console.warn('[push] permission not granted:', status.receive);
      return { granted: false };
    }

    try {
      await PushNotifications.register();
    } catch (err) {
      console.error('[push] PushNotifications.register() failed', err);
    }
    await this.syncTokenForRestaurant();
    return { granted: true };
  }

  /**
   * Idempotent. Coalesces concurrent callers into a single in-flight upload
   * and short-circuits if the last successful sync is still fresh (<24h).
   * Retries on network/HTTP failure with backoff, and on terminal failure
   * beacons the backend so we can spot client-side breakage in CloudWatch.
   */
  async syncTokenForRestaurant(
    restaurantId?: string,
    opts: { force?: boolean } = {}
  ): Promise<void> {
    if (!Capacitor.isNativePlatform() || this.isViewOnlyMode()) {
      return;
    }

    const token = localStorage.getItem(this.TOKEN_STORAGE_KEY);
    const resolvedRestaurantId = restaurantId || this.restaurantContext.getRestaurantId();
    if (!token || !resolvedRestaurantId) {
      return;
    }

    if (!opts.force && this.isRecentlySynced()) {
      return;
    }

    if (this.syncInFlight) {
      return this.syncInFlight;
    }

    this.syncInFlight = this.uploadTokenWithRetries(resolvedRestaurantId, token)
      .finally(() => { this.syncInFlight = null; });
    return this.syncInFlight;
  }

  private isRecentlySynced(): boolean {
    const raw = localStorage.getItem(this.LAST_SYNC_AT_KEY);
    if (!raw) return false;
    const at = Number(raw);
    if (!Number.isFinite(at)) return false;
    return (Date.now() - at) < this.STALE_SYNC_MS;
  }

  private async uploadTokenWithRetries(restaurantId: string, token: string): Promise<void> {
    let lastErr: any = null;
    let lastStatus: number | undefined;

    for (let attempt = 0; attempt < this.UPLOAD_RETRY_DELAYS_MS.length + 1; attempt++) {
      try {
        await firstValueFrom(
          this.http.post(
            `${this.API_BASE_URL}/restaurants/${restaurantId}/fcm-token`,
            { fcmToken: token }
          )
        );
        localStorage.setItem(this.DEVICE_REGISTERED_KEY, 'true');
        localStorage.setItem(this.LAST_SYNC_AT_KEY, String(Date.now()));
        return;
      } catch (error: any) {
        lastErr = error;
        lastStatus = typeof error?.status === 'number' ? error.status : undefined;

        // Don't burn retries on a 4xx — backend rejected the token (validation
        // failure, expired auth, wrong restaurant). Beacon and bail.
        if (lastStatus && lastStatus >= 400 && lastStatus < 500) {
          break;
        }

        const delay = this.UPLOAD_RETRY_DELAYS_MS[attempt];
        if (delay === undefined) break;
        await new Promise(r => setTimeout(r, delay));
      }
    }

    console.error('[push] Failed to sync restaurant FCM token after retries', lastErr);
    this.beaconUploadFailure(restaurantId, token, lastErr, lastStatus);
  }

  private beaconUploadFailure(
    restaurantId: string,
    token: string,
    error: any,
    httpStatus: number | undefined
  ): void {
    // Best-effort — never await, never throw, never retry. Pure CloudWatch
    // signal so we can see "device X failed to register" in logs.
    try {
      const payload = {
        reason: String(error?.message || error?.name || error?.statusText || 'unknown').slice(0, 200),
        httpStatus: httpStatus ?? null,
        attempt: this.UPLOAD_RETRY_DELAYS_MS.length + 1,
        tokenSuffix: token.length >= 8 ? token.slice(-8) : token,
        platform: Capacitor.getPlatform(),
      };
      this.http
        .post(`${this.API_BASE_URL}/restaurants/${restaurantId}/fcm-token-failure`, payload)
        .subscribe({ error: () => undefined });
    } catch {
      /* swallow — beacon is non-essential */
    }
  }

  private attachForegroundListener(): void {
    if (this.foregroundListenerAttached) return;
    this.foregroundListenerAttached = true;

    void CapacitorApp.addListener('appStateChange', ({ isActive }: { isActive: boolean }) => {
      if (!isActive) return;
      // App came back to foreground — re-confirm we still hold the active
      // FCM token. Handles: token rotated in background, OS revoked
      // permission since last launch, last sync went stale (>24h).
      this.ngZone.run(() => {
        void this.ensurePermissionAndRegister({ promptIfDenied: false });
      });
    });
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
    localStorage.removeItem(this.LAST_SYNC_AT_KEY);

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
      const prev = localStorage.getItem(this.TOKEN_STORAGE_KEY);
      const rotated = prev !== token.value;
      localStorage.setItem(this.TOKEN_STORAGE_KEY, token.value);
      if (rotated) {
        // Clear stamp so the next sync isn't short-circuited by the staleness
        // window — a new token MUST upload immediately.
        localStorage.removeItem(this.LAST_SYNC_AT_KEY);
      }
      console.log('[push] FCM registration token received', { rotated });
      void this.syncTokenForRestaurant(undefined, { force: rotated });
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
    await PushNotifications.deleteChannel({ id: this.CRITICAL_CHANNEL_ID }).catch(() => undefined);

    // Legacy silent channel. Kept for in-process data-handler refreshes when
    // OrderPollingService is alive and owns the ring loop. Importance 3 =
    // DEFAULT (shown silently in shade).
    await PushNotifications.createChannel({
      id: this.CHANNEL_ID,
      name: 'New Orders',
      description: 'Incoming order alerts (sound handled by YumDude Partner service)',
      importance: 3,
      visibility: 1,
      vibration: false,
      lights: true,
      lightColor: '#F97316',
      sound: 'default'
    });

    // Critical channel used by the backend FCM notification block. Importance 5
    // = HIGH (heads-up + sound + lockscreen). This is the path that fires when
    // the app process is dead or the foreground OrderPollingService has been
    // killed by an OEM task manager — Play Services renders the notification
    // directly so the operator still hears the ring.
    // Requires `telephone_ring` resource at android/app/src/main/res/raw/telephone_ring.<ext>.
    await PushNotifications.createChannel({
      id: this.CRITICAL_CHANNEL_ID,
      name: 'New Orders (Critical)',
      description: 'High-priority new-order alerts that ring even when the app is closed',
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
