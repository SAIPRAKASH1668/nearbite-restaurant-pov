import { Component, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';

@Component({
  selector: 'app-landing',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './landing.component.html',
  styleUrl: './landing.component.scss'
})
export class LandingComponent {
  isScrolled = false;
  isMobileMenuOpen = false;

  readonly navLinks = [
    { id: 'difference',  label: 'How It Works' },
    { id: 'restaurants', label: 'For Restaurants' },
    { id: 'customers',   label: 'For Customers' },
    { id: 'app-preview', label: 'App' }
  ];

  readonly heroStats = [
    { value: '0%',   label: 'Hidden Fees' },
    { value: '5K+',  label: 'Restaurants' },
    { value: '50K+', label: 'Happy Users' }
  ];

  readonly problems = [
    { icon: 'fa-chart-line',         text: 'High commissions eating restaurant profits' },
    { icon: 'fa-eye',                text: 'Hidden surge fees surprising customers' },
    { icon: 'fa-hand-holding-heart', text: 'Restaurant exploitation by platforms' }
  ];

  readonly solutions = [
    { icon: 'fa-percent',       text: 'Low commission model — restaurants keep more' },
    { icon: 'fa-shield-halved', text: 'Transparent pricing — no hidden charges' },
    { icon: 'fa-users',         text: 'Partner-first approach — your growth matters' }
  ];

  readonly restaurantFeatures = [
    { icon: 'fa-percent',      title: 'Lowest Commission Rates', description: 'Keep more of what you earn. Our commission is designed to help you grow, not drain your profits.' },
    { icon: 'fa-bolt',         title: 'Faster Payouts',          description: 'Get paid faster with our streamlined payout system. No waiting weeks for your money.' },
    { icon: 'fa-bullhorn',     title: 'Marketing Support',       description: 'Free marketing tools and promotions to help you reach new customers in your area.' },
    { icon: 'fa-chart-column', title: 'Transparent Analytics',   description: 'Real-time dashboard with clear insights into orders, revenue, and customer behavior.' }
  ];

  readonly customerFeatures = [
    { icon: 'fa-dollar-sign', title: 'No Artificial Price Inflation', description: 'What the restaurant charges is what you pay. Transparent menu pricing always.' },
    { icon: 'fa-truck',       title: 'Honest Delivery Charges',       description: 'Clear, upfront delivery fees. No surprise surge pricing during peak hours.' },
    { icon: 'fa-store',       title: 'Best Local Restaurants',        description: 'Discover hidden gems in your neighborhood. We empower the best local joints.' },
    { icon: 'fa-clock',       title: 'Fast Delivery',                 description: 'Optimized delivery routes mean your food arrives hot and fresh, every time.' }
  ];

  readonly appHighlights = [
    { icon: 'fa-location-dot', text: 'Real-time order tracking with live map' },
    { icon: 'fa-clock',        text: 'Estimated delivery time you can trust' },
    { icon: 'fa-star',         text: 'Curated restaurant recommendations' }
  ];

  readonly testimonials = [
    {
      name: 'Priya Sharma',
      role: 'Owner, Spice Garden',
      type: 'Restaurant',
      avatar: '🧑‍🍳',
      text: "YumDude's low commission model helped us increase profits by 35%. Finally, a platform that actually cares about restaurant partners."
    },
    {
      name: 'Rahul Mehta',
      role: 'Regular Customer',
      type: 'Customer',
      avatar: '😊',
      text: "No hidden charges, no surprise fees. I can see exactly what I'm paying for. Switched from other apps and never looked back!"
    },
    {
      name: 'Anita Desai',
      role: 'Owner, Biryani Blues',
      type: 'Restaurant',
      avatar: '👩‍🍳',
      text: 'The analytics dashboard is incredible. I can track everything in real-time and the payout speed is unmatched. This is the future.'
    }
  ];

  readonly stars = [1, 2, 3, 4, 5];

  readonly footerCols = [
    { title: 'Company',      links: [
      { label: 'About Us', route: null },
      { label: 'Careers', route: null },
      { label: 'Blog', route: null },
      { label: 'Press', route: null }
    ]},
    { title: 'For Partners', links: [
      { label: 'Register Restaurant', route: null },
      { label: 'Partner Dashboard', route: null },
      { label: 'Commission Rates', route: null },
      { label: 'Support', route: null }
    ]},
    { title: 'Support',      links: [
      { label: 'Help Center', route: null },
      { label: 'Contact Us', route: null },
      { label: 'Privacy Policy', route: null },
      { label: 'Terms of Service', route: '/terms' }
    ]}
  ];

  constructor(private router: Router) {}

  @HostListener('window:scroll', [])
  onWindowScroll(): void {
    const scrollTop = window.scrollY || document.documentElement.scrollTop || document.body.scrollTop || 0;
    this.isScrolled = scrollTop > 20;
  }

  scrollToSection(sectionId: string, event?: Event): void {
    if (event) event.preventDefault();
    this.closeMobileMenu();
    const el = document.getElementById(sectionId);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }

  toggleMobileMenu(): void {
    this.isMobileMenuOpen = !this.isMobileMenuOpen;
    document.body.style.overflow = this.isMobileMenuOpen ? 'hidden' : '';
  }

  closeMobileMenu(): void {
    this.isMobileMenuOpen = false;
    document.body.style.overflow = '';
  }

  navigateToLogin(event?: Event): void {
    if (event) event.preventDefault();
    this.closeMobileMenu();
    this.router.navigate(['/login']);
  }

  getCurrentYear(): number {
    return new Date().getFullYear();
  }
}
