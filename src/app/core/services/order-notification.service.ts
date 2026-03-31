import { Injectable } from '@angular/core';
import { Capacitor } from '@capacitor/core';
import { BehaviorSubject, Observable, Subject } from 'rxjs';

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

export interface NewOrderNotificationOptions {
  playInAppSound?: boolean;
  showSystemNotification?: boolean;
}

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

  private initializeAudio(): void {
    try {
      const audioContextConstructor =
        window.AudioContext ||
        (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;

      if (!audioContextConstructor) {
        return;
      }

      this.audioContext = new audioContextConstructor();
      this.createNotificationSound();
    } catch (error) {
      console.warn('Web Audio API not supported', error);
    }
  }

  private createNotificationSound(): void {
    if (!this.audioContext) return;

    const sampleRate = this.audioContext.sampleRate;
    const duration = 0.3;
    const buffer = this.audioContext.createBuffer(1, sampleRate * duration, sampleRate);
    const data = buffer.getChannelData(0);

    for (let i = 0; i < buffer.length; i++) {
      const t = i / sampleRate;
      const freq1 = 800;
      const freq2 = 1000;

      if (t < 0.15) {
        data[i] = Math.sin(2 * Math.PI * freq1 * t) * Math.exp(-t * 3);
      } else {
        data[i] = Math.sin(2 * Math.PI * freq2 * (t - 0.15)) * Math.exp(-(t - 0.15) * 3);
      }
    }

    this.notificationSound = buffer;
  }

  playNotificationSound(): void {
    if (!this.audioContext || !this.notificationSound) return;

    const source = this.audioContext.createBufferSource();
    source.buffer = this.notificationSound;
    source.connect(this.audioContext.destination);
    source.start(0);
  }

  notifyNewOrder(order: IncomingOrder, options?: NewOrderNotificationOptions): void {
    const playInAppSound = options?.playInAppSound ?? !Capacitor.isNativePlatform();
    const showSystemNotification = options?.showSystemNotification ?? !Capacitor.isNativePlatform();

    this.newOrderSubject.next(order);

    if (playInAppSound) {
      this.playNotificationSound();
    }

    if (showSystemNotification) {
      this.showBrowserNotification(order);
    }
  }

  getNewOrders(): Observable<IncomingOrder> {
    return this.newOrderSubject.asObservable();
  }

  notifyOrderAccepted(orderId: string): void {
    this.orderAcceptedSubject.next(orderId);
  }

  getAcceptedOrders(): Observable<string> {
    return this.orderAcceptedSubject.asObservable();
  }

  notifyOrderRejected(orderId: string): void {
    this.orderRejectedSubject.next(orderId);
  }

  getRejectedOrders(): Observable<string> {
    return this.orderRejectedSubject.asObservable();
  }

  updateNewOrdersCount(count: number): void {
    this.newOrdersCountSubject.next(count);
  }

  getNewOrdersCount(): Observable<number> {
    return this.newOrdersCountSubject.asObservable();
  }

  private showBrowserNotification(order: IncomingOrder): void {
    if ('Notification' in window && Notification.permission === 'granted') {
      const notification = new Notification('New Order Received!', {
        body: `${order.customerName} - Rs.${order.amount}\n${order.items.length} items`,
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

  requestNotificationPermission(): void {
    if (Capacitor.isNativePlatform()) {
      return;
    }

    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
  }
}
