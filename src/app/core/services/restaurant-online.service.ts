import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, Subject, of } from 'rxjs';
import { map, catchError } from 'rxjs/operators';
import { HttpClient } from '@angular/common/http';
import { RestaurantContextService } from './restaurant-context.service';

import { environment } from '../../../environments/environment';

const STORAGE_KEY = 'yumdude_restaurant_online';
const API_BASE = environment.apiUrl;

@Injectable({
  providedIn: 'root'
})
export class RestaurantOnlineService {
  /** Current online/offline state — initialised from localStorage while API loads */
  private _isOnline$ = new BehaviorSubject<boolean>(
    localStorage.getItem(STORAGE_KEY) === 'true'
  );
  readonly isOnline$ = this._isOnline$.asObservable();

  /** True once the first API response has been received */
  private _loaded$ = new BehaviorSubject<boolean>(false);
  readonly loaded$ = this._loaded$.asObservable();

  /** Emits whenever the "going online" splash animation should play */
  private _animateTrigger$ = new Subject<void>();
  readonly animateTrigger$ = this._animateTrigger$.asObservable();

  get isOnline(): boolean {
    return this._isOnline$.value;
  }

  get isLoaded(): boolean {
    return this._loaded$.value;
  }

  constructor(
    private http: HttpClient,
    private restaurantContext: RestaurantContextService
  ) {
    this.loadFromApi();
  }

  /**
   * Fetch the real isOpen value from the database.
   * Called on service creation and on every route change via the navbar.
   */
  loadFromApi(): void {
    const restaurantId = this.restaurantContext.getRestaurantId();
    if (!restaurantId) {
      // Not logged in yet — mark loaded so the UI can proceed
      this._loaded$.next(true);
      return;
    }

    this.http.get<any>(`${API_BASE}/restaurants/${restaurantId}`).subscribe({
      next: (res) => {
        const online = !!res.isOpen;
        this._persist(online);
        this._isOnline$.next(online);
        this._loaded$.next(true);
      },
      error: () => {
        // Fallback to localStorage value if API fails
        console.warn('Could not fetch restaurant status from API — using cached value');
        this._loaded$.next(true);
      }
    });
  }

  /** Called when the restaurant goes online — sets state AND fires animation */
  goOnline(): void {
    this._updateApi(true);
    this._persist(true);
    this._isOnline$.next(true);
    this._animateTrigger$.next();
  }

  /** Set state without animation (e.g. toggle OFF, logout) */
  setOnline(value: boolean): void {
    this._updateApi(value);
    this._persist(value);
    this._isOnline$.next(value);
  }

  /** Fire animation without changing state */
  triggerAnimation(): void {
    this._animateTrigger$.next();
  }

  /** Persist isOpen to the database via API */
  private _updateApi(value: boolean): void {
    const restaurantId = this.restaurantContext.getRestaurantId();
    if (!restaurantId) return;

    this.http.put(`${API_BASE}/restaurants/${restaurantId}`, { isOpen: value }).subscribe({
      next: () => {},
      error: () => {}
    });
  }

  /** Cache value in localStorage as offline fallback */
  private _persist(value: boolean): void {
    localStorage.setItem(STORAGE_KEY, String(value));
  }

  // ── Operating Hours ───────────────────────────────────────────────────────

  /**
   * Fetch opensAt and closesAt from the restaurant table.
   * Returns empty strings if unavailable.
   */
  fetchOperatingHours(): Observable<{ opensAt: string; closesAt: string }> {
    const restaurantId = this.restaurantContext.getRestaurantId();
    if (!restaurantId) {
      return of({ opensAt: '', closesAt: '' });
    }
    return this.http.get<any>(`${API_BASE}/restaurants/${restaurantId}`).pipe(
      map((res: any) => ({
        opensAt:  res.opensAt  || '',
        closesAt: res.closesAt || ''
      })),
      catchError(() => of({ opensAt: '', closesAt: '' }))
    );
  }

  /**
   * Persist opensAt and closesAt to the restaurant table.
   * Matches the AWS PUT /restaurants/{id} API which accepts opensAt / closesAt.
   */
  updateOperatingHours(opensAt: string, closesAt: string): Observable<any> {
    const restaurantId = this.restaurantContext.getRestaurantId();
    if (!restaurantId) return of(null);
    return this.http.put(`${API_BASE}/restaurants/${restaurantId}`, { opensAt, closesAt });
  }

  /**
   * Fetch average order preparation time (in minutes).
   */
  fetchAvgPreparationTime(): Observable<number | null> {
    const restaurantId = this.restaurantContext.getRestaurantId();
    if (!restaurantId) {
      return of(null);
    }
    return this.http.get<any>(`${API_BASE}/restaurants/${restaurantId}`).pipe(
      map((res: any) => {
        const value = res?.avgPreparationTime;
        if (value === undefined || value === null || value === '') return null;
        const num = Number(value);
        return Number.isFinite(num) ? Math.round(num) : null;
      }),
      catchError(() => of(null))
    );
  }

  /**
   * Persist average order preparation time (in minutes).
   */
  updateAvgPreparationTime(avgPreparationTime: number): Observable<any> {
    const restaurantId = this.restaurantContext.getRestaurantId();
    if (!restaurantId) return of(null);
    return this.http.put(`${API_BASE}/restaurants/${restaurantId}`, { avgPreparationTime });
  }
}
