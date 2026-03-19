import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable, of } from 'rxjs';
import { tap, catchError, map } from 'rxjs/operators';
import { environment } from '../../../environments/environment';

export interface GlobalConfig {
  /** Hike thresholds: default, below{N} */
  [key: string]: number | unknown;
}

interface HikeThreshold {
  type: 'below';
  threshold: number;
  cap: number;
}

@Injectable({
  providedIn: 'root'
})
export class ConfigService {
  private readonly API_BASE_URL = environment.apiUrl;

  /** Null = not yet fetched; undefined = fetch attempted but returned nothing */
  private cachedConfig: GlobalConfig | null = null;
  private configSubject = new BehaviorSubject<GlobalConfig | null>(null);
  public config$: Observable<GlobalConfig | null> = this.configSubject.asObservable();

  constructor(private http: HttpClient) {}

  /**
   * Fetch global config once per session. Subsequent calls return the cache.
   */
  loadConfig(): Observable<GlobalConfig | null> {
    if (this.cachedConfig !== null) {
      return of(this.cachedConfig);
    }

    return this.http
      .get<{ config: GlobalConfig }>(`${this.API_BASE_URL}/globalconfig`)
      .pipe(
        map(response => response.config ?? {}),
        tap(config => {
          this.cachedConfig = config;
          this.configSubject.next(config);
        }),
        catchError(() => {
          return of(null);
        })
      );
  }

  /**
   * Force-invalidate the session cache and re-fetch from the API.
   */
  reloadConfig(): Observable<GlobalConfig | null> {
    this.cachedConfig = null;
    return this.loadConfig();
  }

  /**
   * Given a restaurant (menu) price, return the maximum allowed hike %
   * based on the thresholds stored in global config.
   *
   * Config structure:
   *   "default"    → fallback cap when no below-rule matches
   *   "below{N}"   → applies when price ≤ N
   *
   * Matching: lowest matching threshold wins (most specific first).
   *
   * Example: { "default": 10, "below100": 20, "below50": 30 }
   *   price = 40  → below50  → 30
   *   price = 80  → below100 → 20
   *   price = 150 → default  → 10
   */
  getMaxHikeForPrice(price: number): number {
    const config = this.cachedConfig;
    if (!config) return 0;

    // Collect all below{N} rules, sorted ascending (lowest threshold first)
    const belowRules: HikeThreshold[] = [];

    for (const [key, value] of Object.entries(config)) {
      const belowMatch = key.match(/^below(\d+(?:\.\d+)?)$/i);
      if (belowMatch) {
        belowRules.push({ type: 'below', threshold: +belowMatch[1], cap: +(value as number) });
      }
    }

    belowRules.sort((a, b) => a.threshold - b.threshold);

    // Return cap for the lowest threshold that still covers the price
    for (const rule of belowRules) {
      if (price <= rule.threshold) return rule.cap;
    }

    // Fallback to default
    const def = this.cachedConfig?.['default'];
    return typeof def === 'number' ? def : 0;
  }

  /** Whether the config has been successfully cached this session. */
  get isLoaded(): boolean {
    return this.cachedConfig !== null;
  }

  /** Force re-fetch (alias kept for call-site compatibility). */
  reloadHikeConfig(): Observable<GlobalConfig | null> {
    return this.reloadConfig();
  }
}
