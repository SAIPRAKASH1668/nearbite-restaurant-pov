import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class RestaurantContextService {
  // Hardcoded restaurant ID - simulating login response
  // In production, this will be set from actual login API response
  private readonly RESTAURANT_ID = 'RES-1767795059270-5036';
  
  private restaurantIdSubject = new BehaviorSubject<string>(this.RESTAURANT_ID);
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
  }

  /**
   * Clear restaurant context (for logout)
   */
  clearContext(): void {
    // Don't clear in development - keep hardcoded value
    // In production, this would clear the ID
    // this.restaurantIdSubject.next('');
  }
}
