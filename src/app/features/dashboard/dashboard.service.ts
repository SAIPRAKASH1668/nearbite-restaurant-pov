import { Injectable } from '@angular/core';
import { Observable, of } from 'rxjs';
import { delay } from 'rxjs/operators';

export interface DashboardStats {
  todayOrders: number;
  todayRevenue: number;
  avgOrderValue: number;
  pendingOrders: number;
}

export interface RecentOrder {
  id: string;
  orderNumber: string;
  customerName: string;
  items: number;
  amount: number;
  status: 'new' | 'preparing' | 'ready' | 'completed';
  time: string;
}

@Injectable({
  providedIn: 'root'
})
export class DashboardService {
  getStats(): Observable<DashboardStats> {
    const stats: DashboardStats = {
      todayOrders: 48,
      todayRevenue: 12450,
      avgOrderValue: 259,
      pendingOrders: 5
    };
    return of(stats).pipe(delay(500));
  }

  getRecentOrders(): Observable<RecentOrder[]> {
    const orders: RecentOrder[] = [
      {
        id: '1',
        orderNumber: '#ORD-1234',
        customerName: 'Rajesh Kumar',
        items: 3,
        amount: 450,
        status: 'new',
        time: '2 mins ago'
      },
      {
        id: '2',
        orderNumber: '#ORD-1233',
        customerName: 'Priya Sharma',
        items: 2,
        amount: 320,
        status: 'preparing',
        time: '8 mins ago'
      },
      {
        id: '3',
        orderNumber: '#ORD-1232',
        customerName: 'Amit Patel',
        items: 4,
        amount: 580,
        status: 'preparing',
        time: '15 mins ago'
      },
      {
        id: '4',
        orderNumber: '#ORD-1231',
        customerName: 'Sneha Reddy',
        items: 1,
        amount: 180,
        status: 'ready',
        time: '22 mins ago'
      },
      {
        id: '5',
        orderNumber: '#ORD-1230',
        customerName: 'Vikas Singh',
        items: 5,
        amount: 750,
        status: 'completed',
        time: '35 mins ago'
      }
    ];
    return of(orders).pipe(delay(500));
  }
}
