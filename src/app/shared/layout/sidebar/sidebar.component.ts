import { Component, Input, Output, EventEmitter, OnInit, OnDestroy, ChangeDetectorRef, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink, RouterLinkActive } from '@angular/router';
import { AuthService } from '../../../core/auth/auth.service';
import { OrderNotificationService } from '../../../core/services/order-notification.service';
import { RestaurantInfoService } from '../../../core/services/restaurant-info.service';
import { Subscription } from 'rxjs';

interface NavItem {
  label: string;
  icon: string;
  route: string;
  badge?: number;
}

/**
 * Top-level nav entries that expand into a sub-list (e.g. Theater → Menu / Orders).
 * `children` are rendered as indented routes when the parent is expanded.
 * `visible` lets us conditionally hide the whole group at runtime (e.g. when
 * the restaurant hasn't opted into theater mode).
 */
interface NavGroup {
  label: string;
  icon: string;
  children: NavItem[];
  visible: boolean;
  expanded: boolean;
}

@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [CommonModule, RouterLink, RouterLinkActive],
  templateUrl: './sidebar.component.html',
  styleUrl: './sidebar.component.scss'
})
export class SidebarComponent implements OnInit, OnDestroy {
  @Output() sidebarToggle = new EventEmitter<boolean>();
  @Input() isMobileOpen = false;
  @Output() mobileClose = new EventEmitter<void>();
  
  isCollapsed = false;
  isTabletView = false;
  newOrdersCount = 0;
  private newOrderSubscription?: Subscription;
  
  navItems: NavItem[] = [
    { label: 'Dashboard', icon: 'fa-chart-line', route: '/dashboard' },
    { label: 'Orders', icon: 'fa-shopping-cart', route: '/dashboard/orders', badge: 0 },
    { label: 'Menu', icon: 'fa-utensils', route: '/dashboard/menu' },
    { label: 'Reports', icon: 'fa-chart-bar', route: '/dashboard/reports' },
    { label: 'Payments', icon: 'fa-credit-card', route: '/dashboard/payments' },
    { label: 'Reviews', icon: 'fa-star', route: '/dashboard/reviews' },
    { label: 'Settings', icon: 'fa-cog', route: '/dashboard/settings' },
    { label: 'Printer', icon: 'fa-print', route: '/dashboard/printer-settings' },
    { label: 'Support', icon: 'fa-headset', route: '/dashboard/support' }
  ];

  /** Sub-grouped nav (e.g. Theater → Menu / Orders). Rendered as a collapsible
   *  section in the sidebar, only when `visible` is true. */
  navGroups: NavGroup[] = [
    {
      label: 'Theater',
      icon: 'fa-couch',
      visible: false,         // flipped on once we learn the restaurant has theaterMode='AVAILABLE'
      expanded: true,         // default expanded so the children are discoverable
      children: [
        { label: 'Menu',   icon: 'fa-utensils',      route: '/dashboard/theater/menu' },
        { label: 'Orders', icon: 'fa-shopping-cart', route: '/dashboard/theater/orders' },
      ],
    },
  ];

  private restaurantInfoSub?: Subscription;

  constructor(
    private authService: AuthService,
    private router: Router,
    private orderNotificationService: OrderNotificationService,
    private restaurantInfo: RestaurantInfoService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    // Auto-collapse on tablet viewport (768–1023px); mobile uses overlay drawer
    this.checkViewport();
    if (this.isTabletView) {
      this.isCollapsed = true;
      this.sidebarToggle.emit(true);
    }
    // Subscribe to new orders count from service
    this.newOrderSubscription = this.orderNotificationService.getNewOrdersCount().subscribe((count) => {
      setTimeout(() => {
        this.newOrdersCount = count;
        this.updateOrdersBadge();
        this.cdr.detectChanges();
      }, 0);
    });

    // Reveal the Theater group only when the backend says this restaurant has
    // opted in. The service caches the response so this is essentially free
    // for the menu/orders pages that read it later.
    this.restaurantInfo.load().subscribe();
    this.restaurantInfoSub = this.restaurantInfo.info$.subscribe(() => {
      const isEnabled = this.restaurantInfo.isTheaterEnabled;
      this.navGroups.forEach((g) => {
        if (g.label === 'Theater') g.visible = isEnabled;
      });
      this.cdr.detectChanges();
    });
  }

  ngOnDestroy(): void {
    if (this.newOrderSubscription) {
      this.newOrderSubscription.unsubscribe();
    }
    if (this.restaurantInfoSub) {
      this.restaurantInfoSub.unsubscribe();
    }
  }

  /** Expand/collapse a sidebar group (e.g. Theater). */
  toggleGroup(group: NavGroup): void {
    group.expanded = !group.expanded;
  }

  /** Re-evaluate viewport on resize — collapse sidebar when entering tablet range */
  @HostListener('window:resize')
  onWindowResize(): void {
    this.checkViewport();
    // If we just entered or remain in tablet range while expanded, snap back to collapsed
    if (this.isTabletView && !this.isCollapsed) {
      this.isCollapsed = true;
      this.sidebarToggle.emit(true);
      this.cdr.detectChanges();
    }
  }

  private checkViewport(): void {
    this.isTabletView = window.innerWidth >= 768 && window.innerWidth < 1024;
  }
    

  private updateOrdersBadge(): void {
    const ordersItem = this.navItems.find(item => item.route === '/dashboard/orders');
    if (ordersItem) {
      ordersItem.badge = this.newOrdersCount > 0 ? this.newOrdersCount : undefined;
    }
  }

  toggleSidebar(): void {
    this.isCollapsed = !this.isCollapsed;
    this.sidebarToggle.emit(this.isCollapsed);
  }

  onLogoError(event: Event): void {
    const img = event.target as HTMLImageElement;
    const fallback = img.nextElementSibling as HTMLElement;
    if (img && fallback) {
      img.style.display = 'none';
      fallback.style.display = 'flex';
    }
  }

  logout(): void {
    if (confirm('Are you sure you want to logout?')) {
      this.authService.logout();
    }
  }
}
