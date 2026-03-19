import { Injectable, NgZone } from '@angular/core';
import { Client, IMessage } from '@stomp/stompjs';
import SockJS from 'sockjs-client';
import { Subject, Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

/**
 * WebSocket Service for real-time order updates
 * Connects to Spring Boot backend via STOMP over SockJS
 */
@Injectable({
  providedIn: 'root'
})
export class WebSocketService {
  private stompClient: Client | null = null;
  private orderSubject = new Subject<any>();
  public messages$ = this.orderSubject.asObservable(); // Public observable for messages
  private connected = false;

  constructor(private ngZone: NgZone) {}

  /**
   * Connect to WebSocket server
   * Endpoint: ws://localhost:8080/ws/orders
   */
  connect(): void {
    if (this.connected) {
      return;
    }

    // Create STOMP client with SockJS
    this.stompClient = new Client({
      webSocketFactory: () => new SockJS(environment.wsUrl),
      debug: environment.production ? () => {} : (str) => { console.log('STOMP:', str); },
      reconnectDelay: 5000,
      heartbeatIncoming: 4000,
      heartbeatOutgoing: 4000,
      onConnect: () => {
        this.connected = true;
        
        this.stompClient?.subscribe('/topic/orders', (message: IMessage) => {
          this.ngZone.run(() => {
            const order = JSON.parse(message.body);
            this.orderSubject.next(order);
          });
        });
      },
      onDisconnect: () => {
        this.connected = false;
      },
      onStompError: (frame) => {
        console.error('❌ STOMP Error:', frame);
      }
    });

    // Activate connection
    this.stompClient.activate();
  }

  /**
   * Disconnect from WebSocket server
   */
  disconnect(): void {
    if (this.stompClient) {
      this.stompClient.deactivate();
      this.connected = false;
    }
  }

  /**
   * Get observable for incoming orders
   * Subscribe to this in components to receive real-time orders
   */
  getOrders(): Observable<any> {
    return this.orderSubject.asObservable();
  }

  /**
   * Check if connected
   */
  isConnected(): boolean {
    return this.connected;
  }
}
