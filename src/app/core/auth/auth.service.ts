import { Injectable } from '@angular/core';
import { Router } from '@angular/router';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { BehaviorSubject, Observable, catchError, map, of } from 'rxjs';
import { RestaurantContextService } from '../services/restaurant-context.service';
import { environment } from '../../../environments/environment';

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
  private readonly API_BASE_URL = environment.apiUrl;

  constructor(
    private router: Router,
    private http: HttpClient,
    private restaurantContext: RestaurantContextService
  ) {
    const storedUser = localStorage.getItem(this.STORAGE_KEY);
    this.currentUserSubject = new BehaviorSubject<User | null>(
      storedUser ? JSON.parse(storedUser) : null
    );
    this.currentUser = this.currentUserSubject.asObservable();

    if (this.currentUserSubject.value?.restaurantId) {
      this.restaurantContext.setRestaurantId(this.currentUserSubject.value.restaurantId);
    }
  }

  public get currentUserValue(): User | null {
    return this.currentUserSubject.value;
  }

  public get isAuthenticated(): boolean {
    return !!this.currentUserSubject.value && !!localStorage.getItem(this.TOKEN_STORAGE_KEY);
  }

  login(username: string, password: string): Observable<{ success: boolean; message?: string }> {
    return this.http.post<RestaurantLoginResponse>(`${this.API_BASE_URL}/restaurants/login`, {
      username,
      password
    }).pipe(
      map((response) => {
        const user: User = { ...response };

        localStorage.setItem(this.STORAGE_KEY, JSON.stringify(user));
        localStorage.setItem(this.TOKEN_STORAGE_KEY, response.token);
        this.restaurantContext.setRestaurantId(response.restaurantId);
        this.currentUserSubject.next(user);

        return { success: true };
      }),
      catchError((error: HttpErrorResponse) => {
        const message = error.status === 401
          ? 'Invalid username or password. Please try again.'
          : (error.error?.message || 'Login failed. Please try again later.');
        return of({ success: false, message });
      })
    );
  }

  getToken(): string | null {
    return localStorage.getItem(this.TOKEN_STORAGE_KEY);
  }

  logout(): void {
    localStorage.removeItem(this.STORAGE_KEY);
    localStorage.removeItem(this.TOKEN_STORAGE_KEY);
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
