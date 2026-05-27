import { Component, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
import { combineLatest, Subscription } from 'rxjs';

/**
 * Public-facing landing page hosted at `/linktree` (and `/linktree/:restaurantId`).
 *
 * Acts as the bridge between a printed/shared QR code and the YumDude
 * customer app:
 *
 *   - With a restaurantId (`/linktree/RES-xxx`): attempts to deep-link into
 *     the customer app's theater flow via `rork-app://theater/{id}`. If the
 *     app isn't installed, falls back to the App Store / Play Store.
 *   - Without a restaurantId (`/linktree`): a plain "download YumDude"
 *     landing card with store badges + helpful secondary links (restaurant
 *     login, terms, etc.).
 *
 * Why this lives in the restaurant POV app: yumdude.com is the public domain
 * we already control via the Angular app's existing deploy pipeline (AWS
 * Amplify). Adding this route means no new hosting infra.
 *
 * Once Universal Links / App Links are configured for yumdude.com, the OS
 * will hand off to the customer app silently — this page never even renders
 * on installed devices. Until then, the explicit deep-link attempt below is
 * what makes the QR "open the app" feel work.
 */
@Component({
  selector: 'app-linktree',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './linktree.component.html',
  styleUrl: './linktree.component.scss',
})
export class LinktreeComponent implements OnInit, OnDestroy {
  // ── Store links ─────────────────────────────────────────────────────────
  // Fill these in once the app is on the stores. The Android URL works as-is
  // (it just resolves to a "not found" page until the listing is live).
  readonly IOS_APP_STORE_URL =
    'https://apps.apple.com/app/idREPLACE_ME';
  readonly ANDROID_PLAY_STORE_URL =
    'https://play.google.com/store/apps/details?id=app.rork.honesteats';
  readonly APP_SCHEME = 'rork-app://theater';
  /** How long we wait (ms) for the OS to switch apps before bouncing to the store on iOS. */
  readonly APP_NOT_INSTALLED_TIMEOUT_MS = 1500;

  // ── State ───────────────────────────────────────────────────────────────
  restaurantId: string | null = null;
  theatreName: string | null = null;
  isIOS = false;
  isAndroid = false;
  isMobile = false;

  /** Drives the three visual states of the page. */
  uiState: 'opening' | 'install-prompt' | 'desktop' | 'landing' = 'opening';

  private routeSub?: Subscription;
  private didLeavePage = false;
  private fallbackTimer?: ReturnType<typeof setTimeout>;
  private autoStoreBounceTimer?: ReturnType<typeof setTimeout>;

  constructor(
    private route: ActivatedRoute,
    private cdr: ChangeDetectorRef,
  ) {}

  ngOnInit(): void {
    // Track whether the browser was backgrounded — strong signal the OS
    // handed off to the customer app. If so, abort the store fallback so
    // we don't yank the user away from a successful deep link.
    document.addEventListener('visibilitychange', this.onVisibilityChange);
    window.addEventListener('pagehide', this.onPageHide);
    window.addEventListener('blur', this.onBlur);

    const ua = (typeof navigator !== 'undefined' && navigator.userAgent) || '';
    this.isAndroid = /android/i.test(ua);
    this.isIOS = /iPad|iPhone|iPod/.test(ua) && !(window as any).MSStream;
    this.isMobile = this.isAndroid || this.isIOS;

    this.routeSub = combineLatest([this.route.paramMap, this.route.queryParamMap]).subscribe(([params, query]) => {
      const raw = params.get('restaurantId') || '';
      this.restaurantId = raw ? raw.trim() : null;
      const theatreName = query.get('theatreName') || query.get('theaterName') || '';
      this.theatreName = theatreName ? theatreName.trim() : null;
      this.startFlow();
    });
  }

  ngOnDestroy(): void {
    this.routeSub?.unsubscribe();
    document.removeEventListener('visibilitychange', this.onVisibilityChange);
    window.removeEventListener('pagehide', this.onPageHide);
    window.removeEventListener('blur', this.onBlur);
    if (this.fallbackTimer) clearTimeout(this.fallbackTimer);
    if (this.autoStoreBounceTimer) clearTimeout(this.autoStoreBounceTimer);
  }

  /** Single entry point that decides what UI to show and whether to attempt a deep link. */
  private startFlow(): void {
    if (!this.isMobile) {
      // Generic landing — no deep link attempt, just store + nav links.
      this.uiState = 'desktop';
      this.cdr.detectChanges();
      return;
    }

    if (!this.isMobile) {
      // Desktop visitor with a restaurantId in the URL — we still can't
      // open the mobile app, so we just tell them to scan from a phone.
      this.uiState = 'desktop';
      this.cdr.detectChanges();
      return;
    }

    // Mobile with restaurantId: attempt the deep link, then fall back.
    this.uiState = 'opening';
    this.cdr.detectChanges();
    this.attemptDeepLink();
    this.scheduleStoreFallback();
  }

  /** Build the raw deep link target — exposed to the template for the "Open in YumDude" CTA. */
  get deeplink(): string {
    const path = this.restaurantId ? `/${encodeURIComponent(this.restaurantId)}` : '';
    const query = this.metadataQueryString;
    return `${this.APP_SCHEME}${path}${query ? `?${query}` : ''}`;
  }

  private get metadataQueryString(): string {
    const params = new URLSearchParams();
    if (this.theatreName) params.set('theatreName', this.theatreName);
    return params.toString();
  }

  /** Re-trigger the deep link attempt — used by the "Try again" button in the install prompt. */
  retryDeepLink(): void {
    this.didLeavePage = false;
    this.uiState = 'opening';
    this.cdr.detectChanges();
    this.attemptDeepLink();
    this.scheduleStoreFallback();
  }

  /** Pick the right store URL for the current device. */
  get currentStoreUrl(): string {
    if (this.isIOS) return this.IOS_APP_STORE_URL;
    return this.ANDROID_PLAY_STORE_URL;
  }

  private attemptDeepLink(): void {
    if (this.isAndroid) {
      // intent:// has a built-in S.browser_fallback_url, so Android handles
      // both "open app" and "send to Play Store" in one shot — no JS timer
      // race required.
      const path = this.restaurantId ? `/${encodeURIComponent(this.restaurantId)}` : '';
      const query = this.metadataQueryString;
      const intentUrl =
        `intent://theater${path}${query ? `?${query}` : ''}` +
        `#Intent;scheme=rork-app;package=app.rork.honesteats;` +
        `S.browser_fallback_url=${encodeURIComponent(this.ANDROID_PLAY_STORE_URL)};end`;
      window.location.replace(intentUrl);
    } else if (this.isIOS) {
      window.location.href = this.deeplink;
    }
  }

  private scheduleStoreFallback(): void {
    if (this.fallbackTimer) clearTimeout(this.fallbackTimer);
    this.fallbackTimer = setTimeout(() => {
      if (this.didLeavePage) return; // App opened — stand down.
      this.uiState = 'install-prompt';
      this.cdr.detectChanges();
      if (this.isIOS) {
        // Give the user a beat to read the prompt, then auto-bounce to the
        // App Store. Android's intent:// already handled this natively.
        this.autoStoreBounceTimer = setTimeout(() => {
          if (!this.didLeavePage) window.location.href = this.IOS_APP_STORE_URL;
        }, 1200);
      }
    }, this.APP_NOT_INSTALLED_TIMEOUT_MS);
  }

  private onVisibilityChange = (): void => {
    if (document.hidden) this.didLeavePage = true;
  };

  private onPageHide = (): void => {
    this.didLeavePage = true;
  };

  private onBlur = (): void => {
    this.didLeavePage = true;
  };
}
