import { Injectable } from '@angular/core';
import { Router } from '@angular/router';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { BehaviorSubject, Observable, catchError, of, switchMap } from 'rxjs';
import { Capacitor, registerPlugin } from '@capacitor/core';
import { RestaurantContextService } from '../services/restaurant-context.service';
import { PushNotificationService } from '../services/push-notification.service';
import { RuntimeEnvironmentService } from '../services/runtime-environment.service';

interface OrderPollingPlugin {
  startPolling(options: { restaurantId: string; authToken: string; apiBaseUrl: string }): Promise<void>;
  stopPolling(): Promise<void>;
}
const OrderPolling = registerPlugin<OrderPollingPlugin>('OrderPolling');

export interface User {
  token: string;
  restaurantId: string;
  name?: string;
  restaurantName?: string;
  [key: string]: unknown;
}

interface RestaurantLoginResponse {
  token: string;
  restaurantId: string;
  [key: string]: unknown;
}

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private currentUserSubject: BehaviorSubject<User | null>;
  public currentUser: Observable<User | null>;
  private readonly STORAGE_KEY = 'nearbite_user';
  private readonly TOKEN_STORAGE_KEY = 'nearbite_auth_token';

  constructor(
    private router: Router,
    private http: HttpClient,
    private restaurantContext: RestaurantContextService,
    private pushNotificationService: PushNotificationService,
    private runtimeEnvironmentService: RuntimeEnvironmentService
  ) {
    const storedUser = localStorage.getItem(this.STORAGE_KEY);
    this.currentUserSubject = new BehaviorSubject<User | null>(
      storedUser ? JSON.parse(storedUser) : null
    );
    this.currentUser = this.currentUserSubject.asObservable();

    if (this.currentUserSubject.value?.restaurantId) {
      this.restaurantContext.setRestaurantId(this.currentUserSubject.value.restaurantId);

      // Resume native polling for persisted sessions (app restarted while logged in).
      // Safe to call on web — registerPlugin returns a no-op proxy when plugin is absent.
      if (Capacitor.isNativePlatform()) {
        const token = localStorage.getItem(this.TOKEN_STORAGE_KEY);
        if (token) {
          void OrderPolling.startPolling({
            restaurantId: this.currentUserSubject.value.restaurantId,
            authToken:    token,
            apiBaseUrl:   this.runtimeEnvironmentService.getApiBaseUrl(),
          });
        }
      }
    }
  }

  public get currentUserValue(): User | null {
    return this.currentUserSubject.value;
  }

  public get isAuthenticated(): boolean {
    return !!this.currentUserSubject.value && !!localStorage.getItem(this.TOKEN_STORAGE_KEY);
  }

  login(username: string, password: string): Observable<{ success: boolean; message?: string; fcmConflict?: boolean }> {
    const targetEnvironment = this.runtimeEnvironmentService.resolveEnvironmentForUsername(username);
    this.runtimeEnvironmentService.setActiveEnvironment(targetEnvironment);

    return this.http.post<RestaurantLoginResponse>(`${this.runtimeEnvironmentService.getApiBaseUrl()}/restaurants/login`, {
      username,
      password
    }).pipe(
      switchMap((response) => {
        const user: User = { ...response };

        localStorage.setItem(this.STORAGE_KEY, JSON.stringify(user));
        localStorage.setItem(this.TOKEN_STORAGE_KEY, response.token);
        this.restaurantContext.setRestaurantId(response.restaurantId);
        this.currentUserSubject.next(user);

        // Start native background polling service (Android foreground service).
        // This is a no-op on platforms without the OrderPolling plugin (web/iOS).
        if (Capacitor.isNativePlatform()) {
          void OrderPolling.startPolling({
            restaurantId: response.restaurantId,
            authToken:    response.token,
            apiBaseUrl:   this.runtimeEnvironmentService.getApiBaseUrl(),
          });
        }

        // Re-sync this device token on every login so multiple devices can receive notifications.
        if (this.pushNotificationService.isDeviceRegistered()) {
          void this.pushNotificationService.syncTokenForRestaurant(response.restaurantId);
          return of({ success: true as const });
        }

        // No takeover conflict flow: always best-effort sync unless user explicitly enabled view-only mode.
        void this.pushNotificationService.syncTokenForRestaurant(response.restaurantId);
        return of({ success: true as const, fcmConflict: false });
      }),
      catchError((error: HttpErrorResponse) => {
        const message = error.status === 401
          ? 'Invalid username or password. Please try again.'
          : (error.error?.message || 'Login failed. Please try again later.');
        return of({ success: false as const, message });
      })
    );
  }

  getToken(): string | null {
    return localStorage.getItem(this.TOKEN_STORAGE_KEY);
  }

  logout(): void {
    const restaurantId = this.currentUserSubject.value?.restaurantId;
    this.pushNotificationService.clearTokenForRestaurant(restaurantId);

    // Stop the native background polling service so it doesn't ring after logout.
    if (Capacitor.isNativePlatform()) {
      void OrderPolling.stopPolling();
    }

    localStorage.removeItem(this.STORAGE_KEY);
    localStorage.removeItem(this.TOKEN_STORAGE_KEY);
    this.runtimeEnvironmentService.resetToDefault();
    this.restaurantContext.clearContext();
    this.currentUserSubject.next(null);
    this.router.navigate(['/login']);
  }

  forgotPassword(email: string): Observable<{ success: boolean; message: string }> {
    return new Observable(observer => {
      setTimeout(() => {
        observer.next({
          success: true,
          message: 'Password reset instructions have been sent to your email.'
        });
        observer.complete();
      }, 1000);
    });
  }
}
