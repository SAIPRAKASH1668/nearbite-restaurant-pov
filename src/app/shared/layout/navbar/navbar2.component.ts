import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AuthService, User } from '../../../core/auth/auth.service';

@Component({
  selector: 'app-navbar',
  standalone: true,
  imports: [CommonModule],
  template: `
    <header class="navbar">
      <div class="navbar-content">
        <div class="search-section">
          <div class="search-bar">
            <i class="fas fa-search search-icon"></i>
            <input type="text" placeholder="Search orders, menu items..." />
          </div>
        </div>
        <div class="navbar-actions">
          <button class="action-btn notification-btn">
            <i class="fas fa-bell"></i>
            <span class="badge">3</span>
          </button>
          <div class="user-menu" (click)="toggleUserMenu()">
            <div class="user-avatar">
              <i class="fas fa-user"></i>
            </div>
            <div class="user-info">
              <p class="user-name">{{ currentUser?.name }}</p>
              <p class="restaurant-name">{{ currentUser?.restaurantName }}</p>
            </div>
            <i class="fas fa-chevron-down dropdown-icon"></i>
            <div class="dropdown-menu" *ngIf="showUserMenu">
              <a href="#" class="dropdown-item">
                <i class="fas fa-user-circle"></i>
                <span>My Profile</span>
              </a>
              <a href="#" class="dropdown-item">
                <i class="fas fa-cog"></i>
                <span>Settings</span>
              </a>
              <div class="dropdown-divider"></div>
              <a href="#" class="dropdown-item" (click)="logout()">
                <i class="fas fa-sign-out-alt"></i>
                <span>Logout</span>
              </a>
            </div>
          </div>
        </div>
      </div>
    </header>
  `,
  styleUrls: ['./navbar.component.scss']
})
export class NavbarComponent implements OnInit {
  currentUser: User | null = null;
  showUserMenu = false;

  constructor(private authService: AuthService) {}

  ngOnInit(): void {
    this.authService.currentUser.subscribe(user => {
      this.currentUser = user;
    });
  }

  toggleUserMenu(): void {
    this.showUserMenu = !this.showUserMenu;
  }

  logout(): void {
    this.showUserMenu = false;
    this.authService.logout();
  }
}
