import { Component, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { RestaurantOnlineService } from '../../core/services/restaurant-online.service';

@Component({
  selector: 'app-go-online',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './go-online.component.html',
  styleUrl: './go-online.component.scss'
})
export class GoOnlineComponent implements OnInit, OnDestroy {
  isGoingOnline = false;
  /** True while waiting for the API to return the real isOpen value */
  isLoading = true;

  private loadedSub?: Subscription;
  private safetyTimer?: ReturnType<typeof setTimeout>;

  constructor(
    private onlineService: RestaurantOnlineService,
    private router: Router,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    // If API result already available, act immediately
    if (this.onlineService.isLoaded) {
      this._applyLoadedState();
      return;
    }

    // Wait for the API call in the service to complete
    this.loadedSub = this.onlineService.loaded$.subscribe(loaded => {
      if (!loaded) return;
      this._applyLoadedState();
    });

    // Safety fallback: never show spinner for more than 3s
    this.safetyTimer = setTimeout(() => {
      if (this.isLoading) {
        this.isLoading = false;
        this.cdr.markForCheck();
      }
    }, 3000);
  }

  private _applyLoadedState(): void {
    this.isLoading = false;
    this.cdr.markForCheck();
    if (this.onlineService.isOnline) {
      this.router.navigate(['/dashboard']);
    }
  }

  ngOnDestroy(): void {
    this.loadedSub?.unsubscribe();
    if (this.safetyTimer) clearTimeout(this.safetyTimer);
  }

  goLive(): void {
    if (this.isGoingOnline) return;
    this.isGoingOnline = true;

    // Trigger the premium splash animation and mark as online in DB
    this.onlineService.goOnline();

    // Navigate to dashboard slightly after animation starts
    setTimeout(() => {
      this.router.navigate(['/dashboard']);
    }, 400);
  }
}
