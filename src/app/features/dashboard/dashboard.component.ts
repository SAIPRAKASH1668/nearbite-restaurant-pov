import { Component, OnInit, ViewChild, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { DashboardService, DashboardStats, RecentOrder } from './dashboard.service';
import { FinancialDashboardModalComponent } from '../payments/financial-dashboard-modal.component';
import { forkJoin } from 'rxjs';
import { finalize } from 'rxjs/operators';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, RouterLink, FinancialDashboardModalComponent],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.scss'
})
export class DashboardComponent implements OnInit {
  
  @ViewChild(FinancialDashboardModalComponent) financialModal!: FinancialDashboardModalComponent;
  
  stats: DashboardStats | null = null;
  recentOrders: RecentOrder[] = [];
  isLoading = true;
  Math = Math;

  // Header display
  greeting = '';
  todayDate = '';

  // Decorative skeleton bars for chart (heights in %)
  chartBars: number[] = [42, 68, 55, 80, 63, 90, 74];
  chartLabels: string[] = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

  // Mobile accordion state for recent orders
  expandedOrderId: string | null = null;

  constructor(
    private dashboardService: DashboardService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.setGreeting();
    this.loadData();
  }

  private setGreeting(): void {
    const hour = new Date().getHours();
    if (hour < 12)      this.greeting = 'Good morning';
    else if (hour < 17) this.greeting = 'Good afternoon';
    else                this.greeting = 'Good evening';

    this.todayDate = new Date().toLocaleDateString('en-IN', {
      weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
    });
  }

  loadData(): void {
    this.isLoading = true;
    this.cdr.detectChanges();

    // Wait for both API calls to complete before hiding loader
    forkJoin({
      stats: this.dashboardService.getStats(),
      orders: this.dashboardService.getRecentOrders()
    })
    .pipe(
      finalize(() => {
        this.isLoading = false;
        this.cdr.detectChanges();
      })
    )
    .subscribe({
      next: (result) => {
        this.stats = result.stats;
        this.recentOrders = result.orders;
      },
      error: () => {
      }
    });
  }

  getStatusClass(status: string): string {
    const statusMap: { [key: string]: string } = {
      'new': 'status-new',
      'preparing': 'status-preparing',
      'ready': 'status-warning',
      'completed': 'status-completed'
    };
    return statusMap[status] || '';
  }

  getStatusLabel(status: string): string {
    return status.charAt(0).toUpperCase() + status.slice(1);
  }

  toggleAccordion(orderNumber: string): void {
    this.expandedOrderId = this.expandedOrderId === orderNumber ? null : orderNumber;
  }

  openFinancialDashboard(): void {
    this.financialModal.open();
  }
}
