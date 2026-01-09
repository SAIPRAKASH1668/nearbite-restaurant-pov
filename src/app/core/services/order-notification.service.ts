import { Injectable } from '@angular/core';
import { Subject, Observable, BehaviorSubject } from 'rxjs';

export interface IncomingOrder {
  orderId: string;
  orderNumber: string;
  customerName: string;
  items: { name: string; quantity: number }[];
  amount: number;
  status: string;
  createdAt: string;
  time: string;
}

/**
 * Global Order Notification Service
 * Manages order notifications across the entire application
 */
@Injectable({
  providedIn: 'root'
})
export class OrderNotificationService {
  private newOrderSubject = new Subject<IncomingOrder>();
  private orderAcceptedSubject = new Subject<string>();
  private orderRejectedSubject = new Subject<string>();
  private newOrdersCountSubject = new BehaviorSubject<number>(0);
  
  private audioContext?: AudioContext;
  private notificationSound?: AudioBuffer;

  constructor() {
    this.initializeAudio();
  }

  /**
   * Initialize Web Audio API for notification sound
   */
  private initializeAudio(): void {
    try {
      this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      this.createNotificationSound();
    } catch (e) {
      console.warn('Web Audio API not supported', e);
    }
  }

  /**
   * Create a pleasant notification beep sound
   */
  private createNotificationSound(): void {
    if (!this.audioContext) return;

    const sampleRate = this.audioContext.sampleRate;
    const duration = 0.3;
    const buffer = this.audioContext.createBuffer(1, sampleRate * duration, sampleRate);
    const data = buffer.getChannelData(0);

    // Create a pleasant two-tone beep (like a doorbell)
    for (let i = 0; i < buffer.length; i++) {
      const t = i / sampleRate;
      const freq1 = 800; // First tone
      const freq2 = 1000; // Second tone
      
      if (t < 0.15) {
        data[i] = Math.sin(2 * Math.PI * freq1 * t) * Math.exp(-t * 3);
      } else {
        data[i] = Math.sin(2 * Math.PI * freq2 * (t - 0.15)) * Math.exp(-(t - 0.15) * 3);
      }
    }

    this.notificationSound = buffer;
  }

  /**
   * Play notification sound
   */
  playNotificationSound(): void {
    if (!this.audioContext || !this.notificationSound) return;

    const source = this.audioContext.createBufferSource();
    source.buffer = this.notificationSound;
    source.connect(this.audioContext.destination);
    source.start(0);
  }

  /**
   * Emit new order notification
   */
  notifyNewOrder(order: IncomingOrder): void {
    this.newOrderSubject.next(order);
    this.playNotificationSound();
    this.showBrowserNotification(order);
  }

  /**
   * Observable for new orders
   */
  getNewOrders(): Observable<IncomingOrder> {
    return this.newOrderSubject.asObservable();
  }

  /**
   * Notify order accepted
   */
  notifyOrderAccepted(orderId: string): void {
    this.orderAcceptedSubject.next(orderId);
  }

  /**
   * Observable for accepted orders
   */
  getAcceptedOrders(): Observable<string> {
    return this.orderAcceptedSubject.asObservable();
  }

  /**
   * Notify order rejected
   */
  notifyOrderRejected(orderId: string): void {
    this.orderRejectedSubject.next(orderId);
  }

  /**
   * Observable for rejected orders
   */
  getRejectedOrders(): Observable<string> {
    return this.orderRejectedSubject.asObservable();
  }

  /**
   * Update new orders count
   */
  updateNewOrdersCount(count: number): void {
    this.newOrdersCountSubject.next(count);
  }

  /**
   * Get new orders count observable
   */
  getNewOrdersCount(): Observable<number> {
    return this.newOrdersCountSubject.asObservable();
  }

  /**
   * Show browser notification
   */
  private showBrowserNotification(order: IncomingOrder): void {
    if ('Notification' in window && Notification.permission === 'granted') {
      const notification = new Notification('🔔 New Order Received!', {
        body: `${order.customerName} - ₹${order.amount}\n${order.items.length} items`,
        icon: '/favicon.ico',
        badge: '/favicon.ico',
        tag: order.orderId,
        requireInteraction: true,
        silent: false
      });

      notification.onclick = () => {
        window.focus();
        notification.close();
      };
    }
  }

  /**
   * Request notification permission
   */
  requestNotificationPermission(): void {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
  }
}
