import { Routes } from '@angular/router';
import { authGuard } from './core/guards/auth.guard';
import { loginGuard } from './core/guards/login.guard';
import { LoginComponent } from './features/login/login.component';
import { AppLayoutComponent } from './shared/layout/app-layout/app-layout.component';
import { DashboardComponent } from './features/dashboard/dashboard.component';
import { OrdersComponent } from './features/orders/orders.component';
import { MenuComponent } from './features/menu/menu.component';
import { ReportsComponent } from './features/reports/reports.component';
import { PaymentsComponent } from './features/payments/payments.component';
import { ReviewsComponent } from './features/reviews/reviews.component';
import { SettingsComponent } from './features/settings/settings.component';
import { SupportComponent } from './features/support/support.component';

export const routes: Routes = [
  {
    path: 'login',
    component: LoginComponent,
    canActivate: [loginGuard]
  },
  {
    path: '',
    component: AppLayoutComponent,
    canActivate: [authGuard],
    children: [
      {
        path: '',
        redirectTo: 'dashboard',
        pathMatch: 'full'
      },
      {
        path: 'dashboard',
        component: DashboardComponent
      },
      {
        path: 'orders',
        component: OrdersComponent
      },
      {
        path: 'menu',
        component: MenuComponent
      },
      {
        path: 'reports',
        component: ReportsComponent
      },
      {
        path: 'payments',
        component: PaymentsComponent
      },
      {
        path: 'reviews',
        component: ReviewsComponent
      },
      {
        path: 'settings',
        component: SettingsComponent
      },
      {
        path: 'support',
        component: SupportComponent
      }
    ]
  },
  {
    path: '**',
    redirectTo: 'dashboard'
  }
];
