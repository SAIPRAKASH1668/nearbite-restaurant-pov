import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable, firstValueFrom } from 'rxjs';
import { tap, catchError } from 'rxjs/operators';
import { RestaurantContextService } from './restaurant-context.service';
import { environment } from '../../../environments/environment';
import { ShiftSchedule } from '../models/shift.model';

export interface AddOnOption {
  optionId: string;
  name: string;
  extraPrice: number;
}

export interface MenuItem {
  restaurant_id: string;
  itemId: string;
  itemName: string;
  /** Computed customer-facing price: restaurantPrice * (1 + hikePercentage / 100) */
  price: number;
  /** Menu / dine-in price set by the restaurant */
  restaurantPrice: number;
  /** Hike markup applied on top of restaurantPrice (%) */
  hikePercentage: number;
  category: string;
  subCategory?: string;
  isVeg: boolean;
  isAvailable: boolean;
  description: string;
  image: string[];
  addOnOptions?: AddOnOption[];
  shiftTimings?: ShiftSchedule[];
  // Server-computed availability fields
  shiftAvailable?: boolean;
  effectivelyAvailable?: boolean;
  nextAvailableAt?: string | null;
  // Theater (in-venue) ordering
  theaterMode?: boolean;
  inventoryCount?: number;
}

export interface MenuResponse {
  restaurantId: string;
  items: MenuItem[];
  total: number;
}

@Injectable({
  providedIn: 'root'
})
export class MenuService {
  private readonly API_BASE_URL = environment.apiUrl;
  
  private menuItemsSubject = new BehaviorSubject<MenuItem[]>([]);
  public menuItems$: Observable<MenuItem[]> = this.menuItemsSubject.asObservable();
  
  private loadingSubject = new BehaviorSubject<boolean>(false);
  public loading$: Observable<boolean> = this.loadingSubject.asObservable();

  constructor(
    private http: HttpClient,
    private restaurantContext: RestaurantContextService
  ) {}

  /** Synchronous snapshot of the current cached menu items. */
  get currentItems(): MenuItem[] {
    return this.menuItemsSubject.getValue();
  }

  /**
   * Ensures the menu cache is populated before returning.
   * Resolves immediately if the cache is already warm.
   * Safe to call multiple times — only one in-flight fetch runs at a time.
   */
  private menuLoadPromise: Promise<void> | null = null;

  ensureMenuLoaded(): Promise<void> {
    if (this.currentItems.length > 0) return Promise.resolve();
    if (this.menuLoadPromise) return this.menuLoadPromise;
    this.menuLoadPromise = firstValueFrom(
      this.http
        // mode=all so theater items show up in the restaurant management UI
        // (the public-facing /menu endpoint hides them by default).
        .get<MenuResponse>(`${this.API_BASE_URL}/restaurants/${this.restaurantContext.getRestaurantId()}/menu?mode=all`)
        .pipe(
          tap(response => {
            this.menuItemsSubject.next(response.items);
            this.loadingSubject.next(false);
          }),
          catchError(error => {
            this.loadingSubject.next(false);
            throw error;
          }),
        ),
    ).then(() => { this.menuLoadPromise = null; })
     .catch(() => { this.menuLoadPromise = null; });
    return this.menuLoadPromise;
  }

  /**
   * Fetch menu items from API
   */
  fetchMenuItems(): void {
    const restaurantId = this.restaurantContext.getRestaurantId();
    this.loadingSubject.next(true);
    
    // mode=all so theater items show up in the restaurant management UI
    // (the public-facing /menu endpoint hides them by default).
    this.http.get<MenuResponse>(`${this.API_BASE_URL}/restaurants/${restaurantId}/menu?mode=all`)
      .pipe(
        tap(response => {
          this.menuItemsSubject.next(response.items);
          this.loadingSubject.next(false);
        }),
        catchError(error => {
          this.loadingSubject.next(false);
          throw error;
        })
      )
      .subscribe({
        error: (err) => {
          console.error('❌ Subscription error:', err);
          this.loadingSubject.next(false);
        }
      });
  }

  /**
   * Update menu item availability
   */
  updateItemAvailability(itemId: string, isAvailable: boolean): Observable<any> {
    const restaurantId = this.restaurantContext.getRestaurantId();
    return this.http.put(
      `${this.API_BASE_URL}/restaurants/${restaurantId}/menu/${itemId}/availability`,
      { isAvailable }
    ).pipe(
      tap(() => {
        // Update local state
        const currentItems = this.menuItemsSubject.value;
        const updatedItems = currentItems.map(item =>
          item.itemId === itemId ? { ...item, isAvailable } : item
        );
        this.menuItemsSubject.next(updatedItems);
      }),
      catchError(error => {
        console.error('❌ Error updating item availability:', error);
        throw error;
      })
    );
  }

  /**
   * Add new menu item (no auto-refresh — use in sequential flows like create→upload→update).
   */
  addMenuItemRaw(itemData: Partial<MenuItem>): Observable<MenuItem> {
    const restaurantId = this.restaurantContext.getRestaurantId();
    return this.http.post<MenuItem>(
      `${this.API_BASE_URL}/restaurants/${restaurantId}/menu`,
      {
        name: itemData.itemName,
        restaurantPrice: itemData.restaurantPrice,
        hikePercentage: itemData.hikePercentage ?? 0,
        category: itemData.category,
        subCategory: itemData.subCategory,
        isVeg: itemData.isVeg,
        isAvailable: itemData.isAvailable,
        description: itemData.description,
        image: itemData.image,
        addOnOptions: itemData.addOnOptions ?? [],
        shiftTimings: itemData.shiftTimings ?? []
      }
    ).pipe(
      catchError(error => {
        console.error('❌ Error adding menu item (raw):', error);
        throw error;
      })
    );
  }

  /**
   * Add new menu item
   */
  addMenuItem(itemData: Partial<MenuItem>): Observable<MenuItem> {
    const restaurantId = this.restaurantContext.getRestaurantId();
    return this.http.post<MenuItem>(
      `${this.API_BASE_URL}/restaurants/${restaurantId}/menu`,
      {
        name: itemData.itemName,
        restaurantPrice: itemData.restaurantPrice,
        hikePercentage: itemData.hikePercentage ?? 0,
        category: itemData.category,
        subCategory: itemData.subCategory,
        isVeg: itemData.isVeg,
        isAvailable: itemData.isAvailable,
        description: itemData.description,
        image: itemData.image,
        addOnOptions: itemData.addOnOptions ?? [],
        shiftTimings: itemData.shiftTimings ?? []
      }
    ).pipe(
      tap(() => {
        this.fetchMenuItems();
      }),
      catchError(error => {
        throw error;
      })
    );
  }

  /**   * Apply shift timings to all items in a category in bulk.
   * Pass shiftTimings: [] to clear restrictions for the category.
   */
  bulkCategoryShiftTimings(category: string, shiftTimings: ShiftSchedule[]): Observable<any> {
    const restaurantId = this.restaurantContext.getRestaurantId();
    return this.http.post(
      `${this.API_BASE_URL}/restaurants/${restaurantId}/menu/category-shifts`,
      { category, shiftTimings }
    ).pipe(
      tap(() => { this.fetchMenuItems(); }),
      catchError(error => { throw error; })
    );
  }

  /**   * Apply bulk price hike (%) to all menu items of this restaurant.
   */
  bulkPriceHike(percentage: number): Observable<{ restaurantId: string; percentage: number; updatedCount: number; items: any[] }> {
    const restaurantId = this.restaurantContext.getRestaurantId();
    return this.http.post<any>(
      `${this.API_BASE_URL}/restaurants/${restaurantId}/menu/price-hike`,
      { percentage }
    ).pipe(
      tap(() => {
        this.fetchMenuItems();
      }),
      catchError(error => {
        console.error('❌ Error applying price hike:', error);
        throw error;
      })
    );
  }

  /**
   * Update existing menu item (triggers a full menu refresh on success).
   */
  updateMenuItem(itemId: string, itemData: Partial<MenuItem>): Observable<MenuItem> {
    const restaurantId = this.restaurantContext.getRestaurantId();
    return this.http.put<MenuItem>(
      `${this.API_BASE_URL}/restaurants/${restaurantId}/menu/${itemId}`,
      this._buildItemPayload(itemData)
    ).pipe(
      tap(() => {
        this.fetchMenuItems();
      }),
      catchError(error => {
        throw error;
      })
    );
  }

  /**
   * Update a menu item WITHOUT triggering an automatic menu refresh.
   * Use this for batch operations where a single refresh will be done at the end.
   */
  updateMenuItemSilent(itemId: string, itemData: Partial<MenuItem>): Observable<MenuItem> {
    const restaurantId = this.restaurantContext.getRestaurantId();
    return this.http.put<MenuItem>(
      `${this.API_BASE_URL}/restaurants/${restaurantId}/menu/${itemId}`,
      this._buildItemPayload(itemData)
    ).pipe(
      catchError(error => {
        throw error;
      })
    );
  }

  private _buildItemPayload(itemData: Partial<MenuItem>): object {
    const payload: Record<string, any> = {
      name: itemData.itemName,
      restaurantPrice: itemData.restaurantPrice,
      hikePercentage: itemData.hikePercentage,
      category: itemData.category,
      subCategory: itemData.subCategory,
      isVeg: itemData.isVeg,
      isAvailable: itemData.isAvailable,
      description: itemData.description,
      image: itemData.image,
      addOnOptions: itemData.addOnOptions ?? [],
      shiftTimings: itemData.shiftTimings ?? []
    };
    // Pass theater fields through only when explicitly set, so partial updates
    // (e.g. toggling availability) don't wipe stored values.
    if (typeof itemData.theaterMode === 'boolean') payload['theaterMode'] = itemData.theaterMode;
    if (typeof itemData.inventoryCount === 'number') payload['inventoryCount'] = itemData.inventoryCount;
    return payload;
  }

  /** Toggle theaterMode (per-item flag for in-venue inventory tracking). */
  updateTheaterMode(itemId: string, theaterMode: boolean): Observable<MenuItem> {
    const restaurantId = this.restaurantContext.getRestaurantId();
    return this.http.put<MenuItem>(
      `${this.API_BASE_URL}/restaurants/${restaurantId}/menu/${itemId}`,
      { theaterMode }
    ).pipe(
      tap(() => {
        const items = this.menuItemsSubject.value.map(it =>
          it.itemId === itemId ? { ...it, theaterMode } : it
        );
        this.menuItemsSubject.next(items);
      }),
      catchError(error => { throw error; })
    );
  }

  /** Set inventoryCount for a theater item (absolute set, not increment). */
  setInventoryCount(itemId: string, inventoryCount: number): Observable<MenuItem> {
    const restaurantId = this.restaurantContext.getRestaurantId();
    return this.http.put<MenuItem>(
      `${this.API_BASE_URL}/restaurants/${restaurantId}/menu/${itemId}`,
      { inventoryCount }
    ).pipe(
      tap(() => {
        const items = this.menuItemsSubject.value.map(it =>
          it.itemId === itemId ? { ...it, inventoryCount } : it
        );
        this.menuItemsSubject.next(items);
      }),
      catchError(error => { throw error; })
    );
  }

  /** Restock by N (additive). Reads current count and PUTs new total. */
  restockBy(itemId: string, addBy: number): Observable<MenuItem> {
    const current = this.menuItemsSubject.value.find(it => it.itemId === itemId);
    const nextCount = Math.max(0, (current?.inventoryCount ?? 0) + addBy);
    return this.setInventoryCount(itemId, nextCount);
  }
}
