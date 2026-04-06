import { Routes } from '@angular/router';
import { authGuard } from './core/guards/auth.guard';
import { loginGuard } from './core/guards/login.guard';
import { LoginComponent } from './features/login/login.component';
import { LandingComponent } from './features/landing/landing.component';
import { AppLayoutComponent } from './shared/layout/app-layout/app-layout.component';
import { DashboardComponent } from './features/dashboard/dashboard.component';
import { OrdersComponent } from './features/orders/orders.component';
import { MenuComponent } from './features/menu/menu.component';
import { ReportsComponent } from './features/reports/reports.component';
import { PaymentsComponent } from './features/payments/payments.component';
import { ReviewsComponent } from './features/reviews/reviews.component';
import { SettingsComponent } from './features/settings/settings.component';
import { SupportComponent } from './features/support/support.component';
import { GoOnlineComponent } from './features/go-online/go-online.component';
import { PrinterSettingsComponent } from './features/printer-settings/printer-settings.component';
import { TermsComponent } from './features/terms/terms.component';

export const routes: Routes = [
  {
    path: '',
    component: LandingComponent,
    canActivate: [loginGuard]
  },
  {
    path: 'terms',
    component: TermsComponent
  },
  {
    path: 'login',
    component: LoginComponent,
    canActivate: [loginGuard]
  },
  {
    path: 'dashboard',
    component: AppLayoutComponent,
    canActivate: [authGuard],
    children: [
      {
        path: '',
        component: DashboardComponent
      },
      {
        path: 'welcome',
        component: GoOnlineComponent
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
      },
      {
        path: 'printer-settings',
        component: PrinterSettingsComponent
      }
    ]
  },
  {
    path: '**',
    redirectTo: ''
  }
];
