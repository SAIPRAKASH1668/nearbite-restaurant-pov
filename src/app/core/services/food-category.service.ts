import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable, of } from 'rxjs';
import { tap, catchError, map } from 'rxjs/operators';
import { environment } from '../../../environments/environment';

export interface FoodCategoryRow {
  category: string;
  subCategory: string;
  imageUrl: string;
}

interface FoodCategoryResponse {
  items: FoodCategoryRow[];
  total: number;
}

@Injectable({
  providedIn: 'root'
})
export class FoodCategoryService {
  private readonly API_BASE_URL = environment.apiUrl;

  /** category name → sorted subcategory names */
  private categoryMap: Record<string, string[]> = {};
  private loaded = false;

  private categoryMapSubject = new BehaviorSubject<Record<string, string[]>>({});
  public categoryMap$: Observable<Record<string, string[]>> = this.categoryMapSubject.asObservable();

  constructor(private http: HttpClient) {}

  /**
   * Fetch all food categories once per session. Subsequent calls return cached data.
   */
  load(): Observable<Record<string, string[]>> {
    if (this.loaded) {
      return of(this.categoryMap);
    }

    return this.http
      .get<FoodCategoryResponse>(`${this.API_BASE_URL}/food-categories`)
      .pipe(
        map(response => this._buildMap(response.items ?? [])),
        tap(map => {
          this.categoryMap = map;
          this.loaded = true;
          this.categoryMapSubject.next(map);
        }),
        catchError(() => {
          return of({} as Record<string, string[]>);
        })
      );
  }

  /** Force-reload from API, busting the session cache. */
  reload(): Observable<Record<string, string[]>> {
    this.loaded = false;
    this.categoryMap = {};
    return this.load();
  }

  /** Sorted list of unique category names. */
  getCategories(): string[] {
    return Object.keys(this.categoryMap).sort();
  }

  /** Sorted subcategory names for a given category. */
  getSubCategories(category: string): string[] {
    return this.categoryMap[category] ?? [];
  }

  /** The full category → subcategories map. */
  getMap(): Record<string, string[]> {
    return this.categoryMap;
  }

  get isLoaded(): boolean {
    return this.loaded;
  }

  private _buildMap(rows: FoodCategoryRow[]): Record<string, string[]> {
    const map: Record<string, string[]> = {};
    for (const row of rows) {
      const cat = row.category?.trim();
      const sub = row.subCategory?.trim();
      if (!cat) continue;
      if (!map[cat]) map[cat] = [];
      if (sub && !map[cat].includes(sub)) {
        map[cat].push(sub);
      }
    }
    // Sort subcategories within each category
    for (const cat of Object.keys(map)) {
      map[cat].sort();
    }
    return map;
  }
}
