import { Component, OnInit, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DashboardService, DashboardStats, RecentOrder } from './dashboard.service';
import { FinancialDashboardModalComponent } from '../payments/financial-dashboard-modal.component';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, FinancialDashboardModalComponent],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.scss'
})
export class DashboardComponent implements OnInit {
  
  @ViewChild(FinancialDashboardModalComponent) financialModal!: FinancialDashboardModalComponent;
  
  stats: DashboardStats | null = null;
  recentOrders: RecentOrder[] = [];
  isLoading = true;

  constructor(private dashboardService: DashboardService) {}

  ngOnInit(): void {
    this.loadData();
  }

  loadData(): void {
    this.dashboardService.getStats().subscribe(stats => {
      this.stats = stats;
    });

    this.dashboardService.getRecentOrders().subscribe(orders => {
      this.recentOrders = orders;
      this.isLoading = false;
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

  openFinancialDashboard(): void {
    this.financialModal.open();
  }
}
