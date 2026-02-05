import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable } from 'rxjs';
import { tap, catchError } from 'rxjs/operators';
import { RestaurantContextService } from './restaurant-context.service';

export interface MenuItem {
  restaurant_id: string;
  itemId: string;
  itemName: string;
  price: number;
  category: string;
  isVeg: boolean;
  isAvailable: boolean;
  description: string;
  image: string;
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
  private readonly API_BASE_URL = 'https://w02o2vcti9.execute-api.ap-south-1.amazonaws.com/default/api/v1';
  
  private menuItemsSubject = new BehaviorSubject<MenuItem[]>([]);
  public menuItems$: Observable<MenuItem[]> = this.menuItemsSubject.asObservable();
  
  private loadingSubject = new BehaviorSubject<boolean>(false);
  public loading$: Observable<boolean> = this.loadingSubject.asObservable();

  constructor(
    private http: HttpClient,
    private restaurantContext: RestaurantContextService
  ) {}

  /**
   * Fetch menu items from API
   */
  fetchMenuItems(): void {
    const restaurantId = this.restaurantContext.getRestaurantId();
    this.loadingSubject.next(true);
    
    this.http.get<MenuResponse>(`${this.API_BASE_URL}/restaurants/${restaurantId}/menu`)
      .pipe(
        tap(response => {
          console.log('✓ Menu items fetched successfully:', response);
          this.menuItemsSubject.next(response.items);
          this.loadingSubject.next(false);
        }),
        catchError(error => {
          console.error('❌ Error fetching menu items:', error);
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
   * Add new menu item
   */
  addMenuItem(itemData: Partial<MenuItem>): Observable<MenuItem> {
    const restaurantId = this.restaurantContext.getRestaurantId();
    return this.http.post<MenuItem>(
      `${this.API_BASE_URL}/restaurants/${restaurantId}/menu`,
      {
        name: itemData.itemName,
        price: itemData.price,
        category: itemData.category,
        isVeg: itemData.isVeg,
        isAvailable: itemData.isAvailable,
        description: itemData.description,
        image: itemData.image
      }
    ).pipe(
      tap(() => {
        console.log('✅ Menu item added successfully');
        // Refresh menu items to get the latest list
        this.fetchMenuItems();
      }),
      catchError(error => {
        console.error('❌ Error adding menu item:', error);
        throw error;
      })
    );
  }

  /**
   * Update existing menu item
   */
  updateMenuItem(itemId: string, itemData: Partial<MenuItem>): Observable<MenuItem> {
    const restaurantId = this.restaurantContext.getRestaurantId();
    return this.http.put<MenuItem>(
      `${this.API_BASE_URL}/restaurants/${restaurantId}/menu/${itemId}`,
      {
        name: itemData.itemName,
        price: itemData.price,
        category: itemData.category,
        isVeg: itemData.isVeg,
        isAvailable: itemData.isAvailable,
        description: itemData.description,
        image: itemData.image
      }
    ).pipe(
      tap(() => {
        console.log('✅ Menu item updated successfully');
        // Refresh menu items to get the latest list
        this.fetchMenuItems();
      }),
      catchError(error => {
        console.error('❌ Error updating menu item:', error);
        throw error;
      })
    );
  }
}
