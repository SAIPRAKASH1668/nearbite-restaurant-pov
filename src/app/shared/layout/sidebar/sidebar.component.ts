import { Component, Output, EventEmitter, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
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
  
  isCollapsed = false;
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
    { label: 'Support', icon: 'fa-headset', route: '/dashboard/support' }
  ];

  constructor(
    private authService: AuthService,
    private router: Router,
    private orderNotificationService: OrderNotificationService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
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
