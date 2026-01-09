import { Component, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { OrderNotificationService } from '../../core/services/order-notification.service';
import { Subscription } from 'rxjs';

type OrderStatus = 'PENDING_RESTAURANT_ACCEPTANCE' | 'ACCEPTED' | 'IN_PREPARATION' | 'READY_FOR_PICKUP' | 'DELIVERED' | 'CANCELLED_BY_CUSTOMER' | 'CANCELLED_BY_RESTAURANT' | 'CANCELLED_BY_SYSTEM';

interface Order {
  id: string;
  orderNumber: string;
  customerName: string;
  items: { name: string; quantity: number }[];
  amount: number;
  status: OrderStatus;
  time: string;
  deliveryPartner?: string;
  isPickedUp?: boolean;
}

@Component({
  selector: 'app-orders',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './orders.component.html',
  styleUrl: './orders.component.scss'
})
export class OrdersComponent implements OnInit, OnDestroy {
  activeTab: 'new' | 'preparing' | 'ready' | 'completed' | 'cancelled' = 'new';
  readyFilter: 'all' | 'awaiting' | 'picked-up' = 'all';
  expandedOrder: Order | null = null;
  private acceptedSubscription?: Subscription;
  private rejectedSubscription?: Subscription;
  private newOrderSubscription?: Subscription;

  constructor(
    private orderNotificationService: OrderNotificationService,
    private cdr: ChangeDetectorRef
  ) {}

  newOrders: Order[] = [
    {
      id: '1',
      orderNumber: '#ORD-1234',
      customerName: 'Rajesh Kumar',
      items: [
        { name: 'Butter Chicken', quantity: 2 },
        { name: 'Naan', quantity: 4 }
      ],
      amount: 450,
      status: 'PENDING_RESTAURANT_ACCEPTANCE',
      time: '2 mins ago'
    },
    {
      id: '2',
      orderNumber: '#ORD-1235',
      customerName: 'Priya Sharma',
      items: [
        { name: 'Paneer Tikka', quantity: 1 },
        { name: 'Dal Makhani', quantity: 1 }
      ],
      amount: 380,
      status: 'PENDING_RESTAURANT_ACCEPTANCE',
      time: '5 mins ago'
    }
  ];

  preparingOrders: Order[] = [
    {
      id: '3',
      orderNumber: '#ORD-1233',
      customerName: 'Amit Patel',
      items: [
        { name: 'Biryani', quantity: 2 },
        { name: 'Raita', quantity: 2 }
      ],
      amount: 560,
      status: 'ACCEPTED',
      time: '10 mins ago'
    },
    {
      id: '6',
      orderNumber: '#ORD-1232',
      customerName: 'Kavita Nair',
      items: [
        { name: 'Chicken Curry', quantity: 1 },
        { name: 'Rice', quantity: 1 }
      ],
      amount: 320,
      status: 'IN_PREPARATION',
      time: '15 mins ago'
    }
  ];

  readyOrders: Order[] = [
    {
      id: '7',
      orderNumber: '#ORD-1231',
      customerName: 'Arun Kumar',
      items: [
        { name: 'Pizza', quantity: 1 },
        { name: 'Garlic Bread', quantity: 1 }
      ],
      amount: 450,
      status: 'READY_FOR_PICKUP',
      time: '18 mins ago',
      deliveryPartner: 'Rahul Verma',
      isPickedUp: false
    },
    {
      id: '10',
      orderNumber: '#ORD-1226',
      customerName: 'Deepak Singh',
      items: [
        { name: 'Burger', quantity: 2 },
        { name: 'Fries', quantity: 1 }
      ],
      amount: 380,
      status: 'READY_FOR_PICKUP',
      time: '22 mins ago',
      deliveryPartner: 'Suresh Kumar',
      isPickedUp: true
    },
    {
      id: '11',
      orderNumber: '#ORD-1225',
      customerName: 'Anita Desai',
      items: [
        { name: 'Pasta', quantity: 1 }
      ],
      amount: 250,
      status: 'READY_FOR_PICKUP',
      time: '25 mins ago',
      isPickedUp: false
    }
  ];

  completedOrders: Order[] = [
    {
      id: '4',
      orderNumber: '#ORD-1230',
      customerName: 'Sneha Reddy',
      items: [
        { name: 'Masala Dosa', quantity: 2 },
        { name: 'Filter Coffee', quantity: 2 }
      ],
      amount: 280,
      status: 'DELIVERED',
      time: '25 mins ago'
    },
    {
      id: '5',
      orderNumber: '#ORD-1229',
      customerName: 'Vikas Singh',
      items: [
        { name: 'Thali', quantity: 1 }
      ],
      amount: 350,
      status: 'DELIVERED',
      time: '45 mins ago'
    }
  ];

  cancelledOrders: Order[] = [
    {
      id: '8',
      orderNumber: '#ORD-1228',
      customerName: 'Rohit Sharma',
      items: [
        { name: 'Burger', quantity: 2 }
      ],
      amount: 240,
      status: 'CANCELLED_BY_CUSTOMER',
      time: '1 hour ago'
    },
    {
      id: '9',
      orderNumber: '#ORD-1227',
      customerName: 'Meera Joshi',
      items: [
        { name: 'Pasta', quantity: 1 }
      ],
      amount: 180,
      status: 'CANCELLED_BY_RESTAURANT',
      time: '2 hours ago'
    }
  ];

  setActiveTab(tab: 'new' | 'preparing' | 'ready' | 'completed' | 'cancelled'): void {
    this.activeTab = tab;
  }

  setReadyFilter(filter: 'all' | 'awaiting' | 'picked-up'): void {
    this.readyFilter = filter;
  }

  expandOrder(order: Order): void {
    this.expandedOrder = order;
  }

  closeExpandedOrder(): void {
    this.expandedOrder = null;
  }

  getStatusLabel(status: OrderStatus): string {
    const statusMap: Record<OrderStatus, string> = {
      'PENDING_RESTAURANT_ACCEPTANCE': 'New Order',
      'ACCEPTED': 'Accepted',
      'IN_PREPARATION': 'Preparing',
      'READY_FOR_PICKUP': 'Ready',
      'DELIVERED': 'Completed',
      'CANCELLED_BY_CUSTOMER': 'Cancelled',
      'CANCELLED_BY_RESTAURANT': 'Cancelled',
      'CANCELLED_BY_SYSTEM': 'Cancelled'
    };
    return statusMap[status] || status;
  }

  getOrders(): Order[] {
    let orders: Order[] = [];
    switch (this.activeTab) {
      case 'new':
        orders = this.newOrders;
        break;
      case 'preparing':
        orders = this.preparingOrders;
        break;
      case 'ready':
        orders = this.readyOrders;
        // Apply filter for ready tab
        if (this.readyFilter === 'awaiting') {
          orders = orders.filter(o => !o.isPickedUp);
        } else if (this.readyFilter === 'picked-up') {
          orders = orders.filter(o => o.isPickedUp);
        }
        break;
      case 'completed':
        orders = this.completedOrders;
        break;
      case 'cancelled':
        orders = this.cancelledOrders;
        break;
      default:
        orders = [];
    }
    return orders;
  }

  acceptOrder(orderId: string): void {
    console.log('Accept order:', orderId);
    alert('Order accepted!');
  }

  rejectOrder(orderId: string): void {
    if (confirm('Are you sure you want to reject this order?')) {
      console.log('Reject order:', orderId);
    }
  }

  markReady(orderId: string): void {
    console.log('Mark ready:', orderId);
    alert('Order marked as ready!');
  }

  ngOnInit(): void {
    // Initialize the count with existing orders
    this.orderNotificationService.updateNewOrdersCount(this.newOrders.length);
    
    // Subscribe to new orders from global notification service
    this.newOrderSubscription = this.orderNotificationService.getNewOrders().subscribe(
      (incomingOrder) => {
        console.log('📥 [ORDERS COMPONENT] Adding new order to list:', incomingOrder);
        
        // Transform to Order format
        const newOrder: Order = {
          id: incomingOrder.orderId,
          orderNumber: incomingOrder.orderNumber,
          customerName: incomingOrder.customerName,
          items: incomingOrder.items,
          amount: incomingOrder.amount,
          status: 'PENDING_RESTAURANT_ACCEPTANCE',
          time: incomingOrder.time
        };

        // Add to new orders array at the beginning
        this.newOrders = [newOrder, ...this.newOrders];
        this.orderNotificationService.updateNewOrdersCount(this.newOrders.length);
        this.cdr.detectChanges();
        
        console.log('✅ [ORDERS COMPONENT] Order added. Total new orders:', this.newOrders.length);
      }
    );

    // Subscribe to accepted orders from global notification service
    this.acceptedSubscription = this.orderNotificationService.getAcceptedOrders().subscribe(
      (orderId: string) => {
        console.log('✅ Order accepted in orders component:', orderId);
        this.moveOrderToAccepted(orderId);
      }
    );

    // Subscribe to rejected orders from global notification service
    this.rejectedSubscription = this.orderNotificationService.getRejectedOrders().subscribe(
      (orderId: string) => {
        console.log('❌ Order rejected in orders component:', orderId);
        this.moveOrderToCancelled(orderId);
      }
    );
  }

  ngOnDestroy(): void {
    if (this.newOrderSubscription) {
      this.newOrderSubscription.unsubscribe();
    }
    if (this.acceptedSubscription) {
      this.acceptedSubscription.unsubscribe();
    }
    if (this.rejectedSubscription) {
      this.rejectedSubscription.unsubscribe();
    }
  }

  /**
   * Move order from new to preparing (accepted)
   */
  private moveOrderToAccepted(orderId: string): void {
    const orderIndex = this.newOrders.findIndex(o => o.id === orderId || o.orderNumber === orderId);
    if (orderIndex !== -1) {
      const order = this.newOrders[orderIndex];
      order.status = 'ACCEPTED';
      this.preparingOrders = [order, ...this.preparingOrders];
      this.newOrders.splice(orderIndex, 1);
      this.orderNotificationService.updateNewOrdersCount(this.newOrders.length);
      this.cdr.detectChanges();
    }
  }

  /**
   * Move order to cancelled
   */
  private moveOrderToCancelled(orderId: string): void {
    const orderIndex = this.newOrders.findIndex(o => o.id === orderId || o.orderNumber === orderId);
    if (orderIndex !== -1) {
      const order = this.newOrders[orderIndex];
      order.status = 'CANCELLED_BY_RESTAURANT';
      this.cancelledOrders = [order, ...this.cancelledOrders];
      this.newOrders.splice(orderIndex, 1);
      this.orderNotificationService.updateNewOrdersCount(this.newOrders.length);
      this.cdr.detectChanges();
    }
  }

  private showNotification(order: Order): void {
    // Browser notification handled globally now
  }
}
