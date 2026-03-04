import { Component, Input, Output, EventEmitter, OnInit, OnDestroy, ChangeDetectorRef, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink, RouterLinkActive } from '@angular/router';
import { AuthService } from '../../../core/auth/auth.service';
import { OrderNotificationService } from '../../../core/services/order-notification.service';
import { Subscription } from 'rxjs';

interface NavItem {
  label: string;
  icon: string;
  route: string;
  badge?: number;
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

  constructor(
    private authService: AuthService,
    private router: Router,
    private orderNotificationService: OrderNotificationService,
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
  }

  ngOnDestroy(): void {
    if (this.newOrderSubscription) {
      this.newOrderSubscription.unsubscribe();
    }
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
