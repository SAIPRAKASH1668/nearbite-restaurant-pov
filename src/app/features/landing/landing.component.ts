import { Component, OnInit, OnDestroy, HostListener, AfterViewInit, ChangeDetectionStrategy, ChangeDetectorRef, NgZone } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { LoginComponent } from '../login/login.component';

@Component({
  selector: 'app-landing',
  standalone: true,
  imports: [CommonModule, LoginComponent],
  templateUrl: './landing.component.html',
  styleUrl: './landing.component.scss',
  changeDetection: ChangeDetectionStrategy.Default
})
export class LandingComponent implements OnInit, AfterViewInit, OnDestroy {
  // Navbar state
  isScrolled = false;
  activeSection = 'home';
  
  // Navbar height for scroll offset
  private readonly NAVBAR_HEIGHT = 70;
  // Additional spacing from navbar when scrolling to sections (reduced to show divider)
  private readonly SECTION_SPACING = 20;
  
  // Navigation sections
  sections = [
    { id: 'home', label: 'Home' },
    { id: 'about', label: 'About Us' },
    { id: 'screenshots', label: 'App Preview' },
    { id: 'register-restaurant', label: 'For Restaurants' },
    { id: 'download-app', label: 'Download App' },
    { id: 'register-rider', label: 'For Riders' }
  ];

  // Features for Customers
  customerFeatures = [
    {
      title: 'Discover Nearby Restaurants',
      description: 'Browse hundreds of local restaurants offering diverse cuisines.',
      icon: 'fa-map-marker-alt'
    },
    {
      title: 'Easy Ordering Experience',
      description: 'Simple, intuitive interface for placing orders in seconds.',
      icon: 'fa-mobile-alt'
    },
    {
      title: 'Real-Time Tracking',
      description: 'Track your order from preparation to your doorstep.',
      icon: 'fa-route'
    },
    {
      title: 'Fast & Reliable Delivery',
      description: 'Get your food delivered hot and fresh by our trusted Dudes.',
      icon: 'fa-shipping-fast'
    }
  ];

  // Features for Restaurants
  restaurantFeatures = [
    {
      title: 'Expand Customer Reach',
      description: 'Connect with thousands of hungry customers in your area.',
      icon: 'fa-users'
    },
    {
      title: 'Manage Orders Seamlessly',
      description: 'Accept, prepare, and track orders with our intuitive dashboard.',
      icon: 'fa-clipboard-list'
    },
    {
      title: 'Transparent Settlements',
      description: 'Clear financial reporting with timely payments.',
      icon: 'fa-chart-line'
    },
    {
      title: 'Dedicated Partner Dashboard',
      description: 'Comprehensive tools to manage menu, pricing, and analytics.',
      icon: 'fa-tachometer-alt'
    }
  ];

  // Features for Riders
  riderFeatures = [
    {
      title: 'Flexible Earning Opportunities',
      description: 'Work on your own schedule and maximize your earnings.',
      icon: 'fa-wallet'
    },
    {
      title: 'Easy Order Acceptance',
      description: 'View order details and accept deliveries with a single tap.',
      icon: 'fa-check-circle'
    },
    {
      title: 'Optimized Delivery Routes',
      description: 'Smart routing to help you complete more deliveries efficiently.',
      icon: 'fa-map-marked-alt'
    },
    {
      title: 'Dedicated Support',
      description: 'Get assistance from the YumDude team whenever you need it.',
      icon: 'fa-headset'
    }
  ];

  // Restaurant Registration Steps
  restaurantSteps = [
    {
      number: 1,
      title: 'Contact YumDude Team',
      description: 'Reach out to us via our official phone number or contact form.'
    },
    {
      number: 2,
      title: 'Submit Documents',
      description: 'Provide required restaurant documents for verification.'
    },
    {
      number: 3,
      title: 'Receive Credentials',
      description: 'Get your login credentials after approval within 24-48 hours.'
    },
    {
      number: 4,
      title: 'Start Accepting Orders',
      description: 'Manage your menu and start receiving orders immediately.'
    }
  ];

  // Download App Steps
  downloadSteps = [
    {
      number: 1,
      title: 'Visit App Store',
      description: 'Go to Play Store or App Store on your device.'
    },
    {
      number: 2,
      title: 'Search YumDude',
      description: 'Search for "YumDude" in the store search bar.'
    },
    {
      number: 3,
      title: 'Download & Install',
      description: 'Download and install the app on your smartphone.'
    },
    {
      number: 4,
      title: 'Start Ordering',
      description: 'Browse restaurants and order your favorite meals.'
    }
  ];

  // Rider Registration Steps
  riderSteps = [
    {
      number: 1,
      title: 'Download Rider App',
      description: 'Download "YumDude Rider" from Play Store or App Store.'
    },
    {
      number: 2,
      title: 'Complete Registration',
      description: 'Fill in your details and upload required documents.'
    },
    {
      number: 3,
      title: 'Wait for Approval',
      description: 'Our team will verify your documents within 24-48 hours.'
    },
    {
      number: 4,
      title: 'Login & Start Earning',
      description: 'Accept deliveries and start earning on your schedule.'
    }
  ];

  // Screenshots - actual paths to uploaded images
  screenshots = [
    { src: 'screenshots/ss1.jpg', alt: 'Order Tracking' },
    { src: 'screenshots/ss2.jpg', alt: 'Restaurant Menu' },
    { src: 'screenshots/ss3.jpg', alt: 'Easy Checkout' },
    { src: 'screenshots/ss4.jpg', alt: 'Order History' }
  ];

  // IntersectionObserver
  private observer?: IntersectionObserver;
  private sectionObserver?: IntersectionObserver;

  constructor(
    private router: Router,
    private cdr: ChangeDetectorRef,
    private ngZone: NgZone
  ) {
  }

  ngOnInit(): void {
    // Scroll to top on component load
    window.scrollTo({ top: 0, behavior: 'instant' });
  }

  ngAfterViewInit(): void {
    // Delay to ensure DOM is ready
    setTimeout(() => {
      this.initIntersectionObserver();
      this.initSectionTracking();
    }, 100);
  }

  ngOnDestroy(): void {
    if (this.observer) {
      this.observer.disconnect();
    }
    if (this.sectionObserver) {
      this.sectionObserver.disconnect();
    }
  }

  @HostListener('window:scroll', [])
  onWindowScroll(): void {
    this.ngZone.run(() => {
      // Update navbar style based on scroll position
      this.isScrolled = window.scrollY > 50;

      // Fallback: Manually check which section is in view
      const scrollPosition = window.scrollY + this.NAVBAR_HEIGHT + 50;
      
      // Get all section IDs and check from bottom to top (reversed)
      const allSectionIds = [...this.sections.map(s => s.id), 'login'];
      let foundSection = 'home'; // Default to home
      
      for (const sectionId of allSectionIds) {
        const element = document.getElementById(sectionId);
        if (element) {
          const rect = element.getBoundingClientRect();
          const elementTop = rect.top + window.scrollY;
          
          // If we've scrolled past this section's start, it could be active
          if (scrollPosition >= elementTop) {
            foundSection = sectionId;
          }
        }
      }
      
      // Update active section if changed
      if (this.activeSection !== foundSection) {
        this.activeSection = foundSection;
        this.cdr.markForCheck();
      }
    });
  }

  /**
   * Initialize IntersectionObserver for scroll animations
   */
  private initIntersectionObserver(): void {
    const options = {
      root: null,
      threshold: 0.15,
      rootMargin: '0px'
    };

    this.observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('visible');
        }
      });
    }, options);

    // Observe all elements with .animate-on-scroll class
    const elements = document.querySelectorAll('.animate-on-scroll');
    elements.forEach(el => this.observer?.observe(el));
  }

  /**
   * Initialize section tracking for active navigation highlight
   * Uses IntersectionObserver for accurate section detection
   */
  private initSectionTracking(): void {
    this.sectionObserver = new IntersectionObserver((entries) => {
      this.ngZone.run(() => {
        // Sort entries by their position on the page
        const sortedEntries = entries.sort((a, b) => {
          return a.boundingClientRect.top - b.boundingClientRect.top;
        });

        // Find the topmost intersecting section
        for (const entry of sortedEntries) {
          if (entry.isIntersecting) {
            const previousActive = this.activeSection;
            this.activeSection = entry.target.id;
            if (previousActive !== this.activeSection) {
              this.cdr.markForCheck();
            }
            break; // Only set the topmost section as active
          }
        }
      });
    }, {
      threshold: [0, 0.1, 0.3, 0.5],
      rootMargin: `-${this.NAVBAR_HEIGHT + 30}px 0px -60% 0px`
    });

    // Observe all sections
    const allSectionIds = [...this.sections.map(s => s.id), 'login'];
    allSectionIds.forEach(sectionId => {
      const element = document.getElementById(sectionId);
      if (element) {
        this.sectionObserver?.observe(element);
      }
    });
  }

  /**
   * Smooth scroll to section with proper navbar offset
   * Prevents default anchor behavior and uses custom scroll logic
   */
  scrollToSection(sectionId: string, event?: Event): void {
    const currentScrollPosition = window.pageYOffset || document.documentElement.scrollTop;
    
    // Prevent default anchor jump
    if (event) {
      event.preventDefault();
      event.stopPropagation();
    }

    // For sections other than home, try to scroll to the divider first
    let targetId = sectionId;
    if (sectionId !== 'home') {
      const dividerId = sectionId + '-divider';
      const dividerElement = document.getElementById(dividerId);
      if (dividerElement) {
        targetId = dividerId;
      }
    }

    const element = document.getElementById(targetId);
    
    if (element) {
      // Get element's absolute position from top of document
      const elementRect = element.getBoundingClientRect();
      const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
      const elementAbsoluteTop = elementRect.top + scrollTop;
      
      // If scrolling to a divider, use minimal spacing since divider has its own margin
      // If scrolling to a section, use full spacing
      const isDivider = targetId.includes('-divider');
      const spacing = isDivider ? 10 : this.SECTION_SPACING;
      const offsetPosition = elementAbsoluteTop - this.NAVBAR_HEIGHT - spacing;
      
      // Try document.documentElement.scrollTop for better compatibility
      try {
        document.documentElement.scrollTop = offsetPosition;
      } catch (e) {
        // Fallback to window.scrollTo
      }
      
      // Also try window.scrollTo
      window.scrollTo({
        top: offsetPosition,
        behavior: 'smooth'
      });

      // Check if scroll actually happened
      setTimeout(() => {
        const newScrollPosition = window.pageYOffset || document.documentElement.scrollTop;
        const scrollDifference = Math.abs(newScrollPosition - offsetPosition);
        
        if (scrollDifference > 100) {
          // Try alternative scrolling method
          element.scrollIntoView({ behavior: 'smooth', block: 'start' });
          
          // Adjust for navbar after scrollIntoView
          setTimeout(() => {
            const isDivider = targetId.includes('-divider');
            const spacing = isDivider ? 10 : this.SECTION_SPACING;
            const adjustment = -(this.NAVBAR_HEIGHT + spacing);
            window.scrollBy({
              top: adjustment,
              behavior: 'smooth'
            });
          }, 300);
        }
      }, 200);

      // Update active section immediately for better UX (use original sectionId, not divider)
      this.activeSection = sectionId;
    }
  }

  /**
   * Navigate to login section
   */
  navigateToLogin(event?: Event): void {
    this.scrollToSection('login', event);
  }

  /**
   * Navigate to download app section
   */
  navigateToDownload(event?: Event): void {
    this.scrollToSection('download-app', event);
  }

  /**
   * Navigate to register restaurant section
   */
  navigateToRegisterRestaurant(event?: Event): void {
    this.scrollToSection('register-restaurant', event);
  }

  /**
   * Get current year for footer
   */
  getCurrentYear(): number {
    return new Date().getFullYear();
  }
}
