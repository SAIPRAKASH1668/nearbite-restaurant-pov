import { Component, OnInit, OnDestroy, ChangeDetectorRef, ChangeDetectionStrategy, Output, EventEmitter, ElementRef, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Router, RouterLink, NavigationEnd } from '@angular/router';
import { Subscription, filter, distinctUntilChanged } from 'rxjs';
import { AuthService, User } from '../../../core/auth/auth.service';
import { RestaurantContextService } from '../../../core/services/restaurant-context.service';
import { RestaurantOnlineService } from '../../../core/services/restaurant-online.service';
import { SoundService } from '../../../core/services/sound.service';
import { environment } from '../../../../environments/environment';
import { RestaurantStatusToggleComponent } from '../../components/restaurant-status-toggle/restaurant-status-toggle.component';

@Component({
  selector: 'app-navbar',
  standalone: true,
  imports: [CommonModule, RouterLink, RestaurantStatusToggleComponent],
  templateUrl: './navbar.component.html',
  styleUrl: './navbar.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class NavbarComponent implements OnInit, OnDestroy {
  private readonly API_BASE_URL = environment.apiUrl;
  @Output() hamburgerClick = new EventEmitter<void>();
  currentUser: User | null = null;
  restaurantName: string = '';
  ownerName: string = '';
  showUserMenu = false;
  isRestaurantOpen: boolean = false;
  currentPageTitle = 'Dashboard';

  isAlarmRinging = false;
  isAlarmMuted = false;

  private onlineSub!: Subscription;
  private navSub!: Subscription;
  private restaurantIdSub!: Subscription;
  private ringSub!: Subscription;
  private muteSub!: Subscription;

  constructor(
    private authService: AuthService,
    private http: HttpClient,
    private restaurantContext: RestaurantContextService,
    private onlineService: RestaurantOnlineService,
    private soundService: SoundService,
    private router: Router,
    private cdr: ChangeDetectorRef,
    private elementRef: ElementRef<HTMLElement>
  ) {}

  ngOnInit(): void {
    this.authService.currentUser.subscribe(user => {
      this.currentUser = user;
      this.cdr.markForCheck();
    });
    // Keep toggle in sync with shared service
    this.onlineSub = this.onlineService.isOnline$.subscribe(online => {
      this.isRestaurantOpen = online;
      this.cdr.markForCheck();
    });
    // Refresh online status + restaurant name on every route navigation
    this.navSub = this.router.events
      .pipe(filter(e => e instanceof NavigationEnd))
      .subscribe((event) => {
        const nav = event as NavigationEnd;
        this.currentPageTitle = this.getPageTitle(nav.urlAfterRedirects);
        // Collapse account dropdown only after successful navigation.
        this.showUserMenu = false;
        this.onlineService.loadFromApi();
        this.fetchRestaurantName();
        this.cdr.markForCheck();
      });
    // Fetch name as soon as the restaurant ID is available (handles race on first load)
    this.restaurantIdSub = this.restaurantContext.restaurantId$
      .pipe(distinctUntilChanged(), filter(id => !!id))
      .subscribe(() => this.fetchRestaurantName());

    this.ringSub = this.soundService.ringing$.subscribe(ringing => {
      this.isAlarmRinging = ringing;
      this.cdr.markForCheck();
    });
    this.muteSub = this.soundService.muted$.subscribe(muted => {
      this.isAlarmMuted = muted;
      this.cdr.markForCheck();
    });
  }

  fetchRestaurantName(): void {
    const restaurantId = this.restaurantContext.getRestaurantId();
    if (!restaurantId) return;
    this.http.get<any>(`${this.API_BASE_URL}/restaurants/${restaurantId}`).subscribe({
      next: (response) => {
        this.restaurantName = response.name || 'Restaurant';
        this.ownerName = response.ownerName || response.managerName || 'Owner';
        this.cdr.markForCheck();
      },
      error: (error) => {
        console.error('Failed to fetch restaurant details:', error);
        this.restaurantName = 'Restaurant';
        this.ownerName = 'Owner';
        this.cdr.markForCheck();
      }
    });
  }

  toggleUserMenu(event?: Event): void {
    event?.stopPropagation();
    this.showUserMenu = !this.showUserMenu;
    this.cdr.markForCheck();
  }

  logout(): void {
    this.showUserMenu = false;
    this.onlineService.setOnline(false);
    this.authService.logout();
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    if (!this.showUserMenu) {
      return;
    }

    const target = event.target as Node | null;
    if (target && this.elementRef.nativeElement.contains(target)) {
      return;
    }

    this.showUserMenu = false;
    this.cdr.markForCheck();
  }

  private getPageTitle(url: string): string {
    if (url.includes('/orders'))   return 'Orders';
    if (url.includes('/menu'))     return 'Menu';
    if (url.includes('/reports'))  return 'Reports';
    if (url.includes('/payments')) return 'Payments';
    if (url.includes('/reviews'))  return 'Reviews';
    if (url.includes('/settings')) return 'Settings';
    if (url.includes('/support'))  return 'Support';
    if (url.includes('/welcome'))  return 'Welcome';
    return 'Dashboard';
  }

  onRestaurantStatusChange(status: boolean): void {
    const restaurantId = this.restaurantContext.getRestaurantId();

    this.http.put(`${this.API_BASE_URL}/restaurants/${restaurantId}`, {
      isOpen: status
    }).subscribe({
      next: () => {
        this.onlineService.setOnline(status);
        if (status) {
          // Fire the premium splash animation
          this.onlineService.triggerAnimation();
        } else {
          this.router.navigate(['/dashboard/welcome']);
        }
      },
      error: (error) => {
        console.error('Failed to update restaurant status:', error);
        // Revert the toggle on error
        this.onlineService.setOnline(!status);
      }
    });
  }

  muteAlarm(): void {
    this.soundService.muteAlarm();
  }

  ngOnDestroy(): void {
    this.onlineSub?.unsubscribe();
    this.navSub?.unsubscribe();
    this.restaurantIdSub?.unsubscribe();
    this.ringSub?.unsubscribe();
    this.muteSub?.unsubscribe();
  }
}
