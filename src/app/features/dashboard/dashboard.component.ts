import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DashboardService, DashboardStats, RecentOrder } from './dashboard.service';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.scss'
})
export class DashboardComponent implements OnInit {
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
}
