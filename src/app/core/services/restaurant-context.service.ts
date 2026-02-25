import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class RestaurantContextService {
  private readonly STORAGE_KEY = 'nearbite_restaurant_id';

  private restaurantIdSubject = new BehaviorSubject<string>(localStorage.getItem(this.STORAGE_KEY) || '');
  public restaurantId$: Observable<string> = this.restaurantIdSubject.asObservable();

  constructor() {}

  /**
   * Get the current restaurant ID
   * @returns Restaurant ID string
   */
  getRestaurantId(): string {
    return this.restaurantIdSubject.value;
  }

  /**
   * Set restaurant ID (will be called by login service in future)
   * @param restaurantId - The restaurant ID from login response
   */
  setRestaurantId(restaurantId: string): void {
    this.restaurantIdSubject.next(restaurantId);
    localStorage.setItem(this.STORAGE_KEY, restaurantId);
  }

  /**
   * Clear restaurant context (for logout)
   */
  clearContext(): void {
    localStorage.removeItem(this.STORAGE_KEY);
    this.restaurantIdSubject.next('');
  }
}
