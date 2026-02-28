import { Component, OnInit, OnDestroy, ChangeDetectorRef, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Router, NavigationEnd } from '@angular/router';
import { Subscription, filter, distinctUntilChanged } from 'rxjs';
import { AuthService, User } from '../../../core/auth/auth.service';
import { RestaurantContextService } from '../../../core/services/restaurant-context.service';
import { RestaurantOnlineService } from '../../../core/services/restaurant-online.service';
import { RestaurantStatusToggleComponent } from '../../components/restaurant-status-toggle/restaurant-status-toggle.component';

interface Notification {
  id: string;
  title: string;
  message: string;
  time: string;
  read: boolean;
  type: 'order' | 'payment' | 'review' | 'system';
}

@Component({
  selector: 'app-navbar',
  standalone: true,
  imports: [CommonModule, RestaurantStatusToggleComponent],
  templateUrl: './navbar.component.html',
  styleUrl: './navbar.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class NavbarComponent implements OnInit, OnDestroy {
  private readonly API_BASE_URL = 'api/v1';
  currentUser: User | null = null;
  restaurantName: string = '';
  ownerName: string = '';
  showUserMenu = false;
  showNotifications = false;
  isRestaurantOpen: boolean = false;
  notifications: Notification[] = [
    {
      id: '1',
      title: 'New Order Received',
      message: 'Order #ORD-1236 from Rahul Mehta',
      time: '2 mins ago',
      read: false,
      type: 'order'
    },
    {
      id: '2',
      title: 'Payment Received',
      message: 'Payment of ₹850 received for Order #ORD-1234',
      time: '15 mins ago',
      read: false,
      type: 'payment'
    },
    {
      id: '3',
      title: 'New Review',
      message: 'You received a 5-star review from Priya Sharma',
      time: '1 hour ago',
      read: false,
      type: 'review'
    },
    {
      id: '4',
      title: 'Menu Update',
      message: 'Successfully updated Butter Chicken availability',
      time: '2 hours ago',
      read: true,
      type: 'system'
    },
    {
      id: '5',
      title: 'Order Completed',
      message: 'Order #ORD-1230 marked as completed',
      time: '3 hours ago',
      read: true,
      type: 'order'
    }
  ];

  private onlineSub!: Subscription;
  private navSub!: Subscription;
  private restaurantIdSub!: Subscription;

  constructor(
    private authService: AuthService,
    private http: HttpClient,
    private restaurantContext: RestaurantContextService,
    private onlineService: RestaurantOnlineService,
    private router: Router,
    private cdr: ChangeDetectorRef
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
      .subscribe(() => {
        this.onlineService.loadFromApi();
        this.fetchRestaurantName();
      });
    // Fetch name as soon as the restaurant ID is available (handles race on first load)
    this.restaurantIdSub = this.restaurantContext.restaurantId$
      .pipe(distinctUntilChanged(), filter(id => !!id))
      .subscribe(() => this.fetchRestaurantName());
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

  get unreadCount(): number {
    return this.notifications.filter(n => !n.read).length;
  }

  toggleNotifications(): void {
    this.showNotifications = !this.showNotifications;
    if (this.showUserMenu) this.showUserMenu = false;
  }

  toggleUserMenu(): void {
    this.showUserMenu = !this.showUserMenu;
    if (this.showNotifications) this.showNotifications = false;
  }

  markAsRead(id: string): void {
    const notification = this.notifications.find(n => n.id === id);
    if (notification) {
      notification.read = true;
    }
  }

  markAllRead(): void {
    this.notifications.forEach(n => n.read = true);
  }

  logout(): void {
    this.showUserMenu = false;
    this.onlineService.setOnline(false); // reset offline state before leaving
    this.authService.logout();
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
          // Went offline — navigate to welcome screen (deselects all sidebar items)
          this.router.navigate(['/dashboard/welcome']);
        }
        console.log(`✅ Restaurant is now ${status ? 'Online' : 'Offline'}`);
      },
      error: (error) => {
        console.error('Failed to update restaurant status:', error);
        // Revert the toggle on error
        this.onlineService.setOnline(!status);
      }
    });
  }

  ngOnDestroy(): void {
    this.onlineSub?.unsubscribe();
    this.navSub?.unsubscribe();
    this.restaurantIdSub?.unsubscribe();
  }
}
