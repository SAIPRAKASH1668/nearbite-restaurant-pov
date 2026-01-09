import { Injectable } from '@angular/core';
import { Router } from '@angular/router';
import { BehaviorSubject, Observable } from 'rxjs';

export interface User {
  id: string;
  name: string;
  email: string;
  restaurantName: string;
  role: string;
}

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private currentUserSubject: BehaviorSubject<User | null>;
  public currentUser: Observable<User | null>;
  private readonly STORAGE_KEY = 'nearbite_user';

  // Dummy credentials for testing
  private readonly VALID_CREDENTIALS = [
    { username: 'demo@restaurant.com', password: 'demo123' },
    { username: 'admin@nearbite.com', password: 'admin123' },
    { username: '9876543210', password: 'demo123' }
  ];

  constructor(private router: Router) {
    const storedUser = localStorage.getItem(this.STORAGE_KEY);
    this.currentUserSubject = new BehaviorSubject<User | null>(
      storedUser ? JSON.parse(storedUser) : null
    );
    this.currentUser = this.currentUserSubject.asObservable();
  }

  public get currentUserValue(): User | null {
    return this.currentUserSubject.value;
  }

  public get isAuthenticated(): boolean {
    return !!this.currentUserSubject.value;
  }

  login(username: string, password: string): Observable<{ success: boolean; message?: string }> {
    return new Observable(observer => {
      // Simulate API call delay
      setTimeout(() => {
        const validCredential = this.VALID_CREDENTIALS.find(
          cred => cred.username === username && cred.password === password
        );

        if (validCredential) {
          // Create dummy user object
          const user: User = {
            id: '1',
            name: 'Demo Restaurant Owner',
            email: validCredential.username,
            restaurantName: 'The Great Indian Kitchen',
            role: 'owner'
          };

          // Store user
          localStorage.setItem(this.STORAGE_KEY, JSON.stringify(user));
          this.currentUserSubject.next(user);

          observer.next({ success: true });
          observer.complete();
        } else {
          observer.next({
            success: false,
            message: 'Invalid username or password. Please try again.'
          });
          observer.complete();
        }
      }, 1000); // Simulate 1 second delay
    });
  }

  logout(): void {
    localStorage.removeItem(this.STORAGE_KEY);
    this.currentUserSubject.next(null);
    this.router.navigate(['/login']);
  }

  forgotPassword(email: string): Observable<{ success: boolean; message: string }> {
    return new Observable(observer => {
      setTimeout(() => {
        observer.next({
          success: true,
          message: 'Password reset instructions have been sent to your email.'
        });
        observer.complete();
      }, 1000);
    });
  }
}
