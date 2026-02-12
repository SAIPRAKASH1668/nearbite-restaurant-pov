import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { AuthService, User } from '../../../core/auth/auth.service';
import { RestaurantContextService } from '../../../core/services/restaurant-context.service';
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
  styleUrl: './navbar.component.scss'
})
export class NavbarComponent implements OnInit {
  private readonly API_BASE_URL = 'api/v1';
  currentUser: User | null = null;
  showUserMenu = false;
  showNotifications = false;
  isRestaurantOpen: boolean = true;
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

  constructor(
    private authService: AuthService,
    private http: HttpClient,
    private restaurantContext: RestaurantContextService
  ) {}

  ngOnInit(): void {
    this.authService.currentUser.subscribe(user => {
      this.currentUser = user;
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
    this.authService.logout();
  }

  onRestaurantStatusChange(status: boolean): void {
    const restaurantId = this.restaurantContext.getRestaurantId();
    
    this.http.put(`${this.API_BASE_URL}/restaurants/${restaurantId}`, {
      isOpen: status
    }).subscribe({
      next: () => {
        this.isRestaurantOpen = status;
        console.log(`✅ Restaurant is now ${status ? 'Online' : 'Offline'}`);
      },
      error: (error) => {
        console.error('Failed to update restaurant status:', error);
        // Revert the toggle on error
        this.isRestaurantOpen = !status;
      }
    });
  }
}
