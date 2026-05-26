import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable, of } from 'rxjs';
import { catchError, tap, shareReplay } from 'rxjs/operators';
import { RestaurantContextService } from './restaurant-context.service';
import { environment } from '../../../environments/environment';

/**
 * Lightweight cache around `GET /restaurants/{id}`.
 *
 * Multiple components (sidebar, menu, theater pages) need to read the
 * restaurant's metadata — in particular `theaterMode` — to decide what UI
 * to render. Without a cache each component would re-fetch the same row.
 *
 * Behaviour:
 *   - First subscriber triggers the HTTP call.
 *   - All later subscribers get the cached value synchronously via
 *     `BehaviorSubject` and instantly via `shareReplay` on the observable.
 *   - Call `refresh()` after a known mutation (e.g. enabling theater mode
 *     from the admin tool) to bust the cache.
 */
export interface RestaurantInfo {
  restaurantId: string;
  name?: string;
  theaterMode?: string | null;
  // The endpoint returns many more fields; we only declare the ones we use.
  [key: string]: unknown;
}

@Injectable({ providedIn: 'root' })
export class RestaurantInfoService {
  private readonly API_BASE_URL = environment.apiUrl;

  private subject = new BehaviorSubject<RestaurantInfo | null>(null);
  /** Always-on stream — emits `null` until the first fetch completes. */
  readonly info$: Observable<RestaurantInfo | null> = this.subject.asObservable();

  private fetch$: Observable<RestaurantInfo | null> | null = null;

  constructor(
    private http: HttpClient,
    private restaurantContext: RestaurantContextService,
  ) {}

  /** Synchronous snapshot — `null` until the first fetch lands. */
  get current(): RestaurantInfo | null {
    return this.subject.value;
  }

  /** True when the restaurant has opted into theater (in-venue) ordering. */
  get isTheaterEnabled(): boolean {
    return String(this.current?.theaterMode || '').toUpperCase() === 'AVAILABLE';
  }

  /** Lazily fetch the restaurant once and cache it. Subsequent calls are free. */
  load(): Observable<RestaurantInfo | null> {
    if (this.subject.value) return of(this.subject.value);
    if (this.fetch$) return this.fetch$;

    const restaurantId = this.restaurantContext.getRestaurantId();
    if (!restaurantId) {
      this.subject.next(null);
      return of(null);
    }

    this.fetch$ = this.http
      .get<RestaurantInfo>(`${this.API_BASE_URL}/restaurants/${restaurantId}`)
      .pipe(
        tap((res) => this.subject.next(res || null)),
        catchError(() => {
          // Network/auth failure → emit null so consumers gracefully render
          // the non-theater UI rather than blocking.
          this.subject.next(null);
          return of(null);
        }),
        shareReplay(1),
      );
    return this.fetch$;
  }

  /** Force a re-fetch (e.g. after enabling/disabling theater mode). */
  refresh(): Observable<RestaurantInfo | null> {
    this.fetch$ = null;
    this.subject.next(null);
    return this.load();
  }
}
