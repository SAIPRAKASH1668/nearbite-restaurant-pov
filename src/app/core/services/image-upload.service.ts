import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map, of, tap } from 'rxjs';
import { environment } from '../../../environments/environment';

/** Shape returned by POST /api/v1/images/upload */
export interface ImageUploadResponse {
  bucket: string;
  entity: string;
  restaurantId: string;
  itemId?: string | null;
  total: number;
  images: Array<{ key: string; url: string }>;
}

interface CacheEntry {
  urls: string[];
  ts: number;
}

@Injectable({
  providedIn: 'root'
})
export class ImageUploadService {
  private readonly API_BASE_URL = environment.apiUrl;
  private readonly CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

  private cache = new Map<string, CacheEntry>();

  constructor(private http: HttpClient) {}

  /**
   * Upload restaurant images to S3.
   * Returns the upload response containing CDN URLs.
   */
  uploadRestaurantImages(restaurantId: string, listBase64: string[]): Observable<ImageUploadResponse> {
    return this.http.post<ImageUploadResponse>(`${this.API_BASE_URL}/images/upload`, {
      listBase64,
      entity: 'RESTAURANT',
      restaurantId
    });
  }

  /**
   * Upload per-menu-item images to S3.
   */
  uploadItemImages(restaurantId: string, itemId: string, listBase64: string[]): Observable<ImageUploadResponse> {
    return this.http.post<ImageUploadResponse>(`${this.API_BASE_URL}/images/upload`, {
      listBase64,
      entity: 'ITEM',
      restaurantId,
      itemId
    });
  }

  /**
   * Fetch the current restaurantImage list from the restaurant record.
   * Returns cached result if still fresh (5 min TTL). Pass forceRefresh=true
   * to bypass the cache (e.g. the Refresh button).
   */
  getRestaurantImages(restaurantId: string, forceRefresh = false): Observable<string[]> {
    const cached = this.cache.get(restaurantId);
    if (!forceRefresh && cached && Date.now() - cached.ts < this.CACHE_TTL_MS) {
      return of(cached.urls);
    }

    return this.http
      .get<any>(`${this.API_BASE_URL}/restaurants/${restaurantId}`)
      .pipe(
        map(res => {
          const raw = res?.restaurantImage;
          if (Array.isArray(raw)) return raw.filter((u: any) => typeof u === 'string' && u.trim());
          if (typeof raw === 'string' && raw.trim()) return [raw];
          return [];
        }),
        tap(urls => this.cache.set(restaurantId, { urls, ts: Date.now() }))
      );
  }

  /**
   * Persist the full restaurantImage array to the restaurant record.
   * Invalidates the cache so the next getRestaurantImages() fetches fresh data.
   */
  saveRestaurantImages(restaurantId: string, urls: string[]): Observable<any> {
    this.cache.delete(restaurantId); // invalidate before PUT
    return this.http
      .put(`${this.API_BASE_URL}/restaurants/${restaurantId}`, { restaurantImage: urls })
      .pipe(tap(() => this.cache.set(restaurantId, { urls, ts: Date.now() }))); // warm cache with new data
  }

  /** Manually clear cache for a restaurant (e.g. on logout). */
  clearCache(restaurantId?: string): void {
    if (restaurantId) this.cache.delete(restaurantId);
    else this.cache.clear();
  }

  /**
   * Convert a File to a base64 data URI string.
   */
  fileToBase64(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }
}

