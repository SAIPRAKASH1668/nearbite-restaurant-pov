import { Component, OnInit, OnDestroy, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterOutlet, RouterLink, RouterLinkActive, Router, NavigationStart } from '@angular/router';
import { SidebarComponent } from '../sidebar/sidebar.component';
import { NavbarComponent } from '../navbar/navbar.component';
import { FooterComponent } from '../footer/footer.component';
import { OnlineAnimationComponent } from '../../components/online-animation/online-animation.component';
import { OrderNotificationService } from '../../../core/services/order-notification.service';
import { Subscription } from 'rxjs';
import { filter } from 'rxjs/operators';

@Component({
  selector: 'app-layout',
  standalone: true,
  imports: [CommonModule, RouterOutlet, RouterLink, RouterLinkActive, SidebarComponent, NavbarComponent, FooterComponent, OnlineAnimationComponent],
  templateUrl: './app-layout.component.html',
  styleUrl: './app-layout.component.scss'
})
export class AppLayoutComponent implements OnInit, OnDestroy {
  isSidebarCollapsed = false;
  isMobileSidebarOpen = false;
  newOrdersCount = 0;

  private orderSub?: Subscription;

  constructor(private orderNotificationService: OrderNotificationService) {}

  ngOnInit(): void {
    this.orderSub = this.orderNotificationService.getNewOrdersCount()
      .subscribe(count => { this.newOrdersCount = count; });
  }

  ngOnDestroy(): void {
    this.orderSub?.unsubscribe();
  }

  onSidebarToggle(collapsed: boolean): void {
    this.isSidebarCollapsed = collapsed;
  }

  onHamburgerClick(): void {
    this.isMobileSidebarOpen = !this.isMobileSidebarOpen;
  }
}
