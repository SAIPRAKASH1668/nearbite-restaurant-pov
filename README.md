# NearBite Restaurant Partner Dashboard

A premium, production-ready Restaurant Partner Dashboard for the NearBite food delivery platform. Built with Angular 21, this application provides restaurant owners and managers with a comprehensive interface to manage orders, menus, payments, and analytics.

## 🚀 Features

### Authentication
- **Secure Login System** with dummy credentials for testing
- Protected routes with Auth Guards
- Session management with local storage
- Elegant login UI with animations

### Dashboard
- **Real-time KPI Cards**: Today's Orders, Revenue, Average Order Value, Pending Orders
- **Analytics Charts**: Revenue overview and order distribution (placeholder for future integration)
- **Recent Orders**: Quick view of latest orders with status badges
- **Responsive Design**: Works seamlessly across devices

### Order Management
- **Tabbed Interface**: New Orders, Preparing, Completed
- **Order Cards**: Detailed order information with customer details
- **Action Buttons**: Accept, Reject, Mark Ready functionality
- **Real-time Updates**: Visual indicators for order status

### Menu Management
- **Category Filtering**: All, Main Course, Starters, Breads, Desserts, Beverages
- **Item Cards**: Visual menu items with pricing
- **Availability Toggle**: Easy on/off switches for each item
- **Add New Items**: Quick action button for adding menu items

### Additional Modules
- **Reports & Analytics**: Business performance tracking
- **Payments**: Earnings and payout management
- **Reviews & Ratings**: Customer feedback management
- **Settings**: Restaurant configuration
- **Support**: Help desk and customer support

## 🎨 Design System

### Theme
- **Primary Gradient**: Dark Red (#8B1E1E to #B02121)
- **Background**: Dark charcoal/near-black (#0F0F0F)
- **Accent**: Warm orange (#D97642)
- **Typography**: Poppins font family (300, 400, 500, 600, 700)

### Components
- Card-based layouts with soft shadows
- Rounded corners (4px - 24px)
- Elegant gradients and transitions
- Dark theme optimized for extended use
- Icon integration with Font Awesome 6.5

### SCSS Architecture
```
src/styles/
├── _variables.scss    # Design tokens, colors, spacing, typography
├── _mixins.scss       # Reusable component styles and utilities
└── styles.scss        # Global styles and animations
```

## 📁 Project Structure

```
nearbite_restaurant_pov/
├── src/
│   ├── app/
│   │   ├── core/                    # Core functionality
│   │   │   ├── auth/
│   │   │   │   └── auth.service.ts  # Authentication service
│   │   │   └── guards/
│   │   │       ├── auth.guard.ts    # Route protection
│   │   │       └── login.guard.ts   # Login redirect
│   │   │
│   │   ├── features/                # Feature modules
│   │   │   ├── dashboard/
│   │   │   │   ├── dashboard.component.ts
│   │   │   │   ├── dashboard.component.html
│   │   │   │   ├── dashboard.component.scss
│   │   │   │   └── dashboard.service.ts
│   │   │   ├── login/
│   │   │   │   ├── login.component.ts
│   │   │   │   ├── login.component.html
│   │   │   │   └── login.component.scss
│   │   │   ├── orders/
│   │   │   ├── menu/
│   │   │   ├── reports/
│   │   │   ├── payments/
│   │   │   ├── reviews/
│   │   │   ├── settings/
│   │   │   └── support/
│   │   │
│   │   ├── shared/                  # Shared components
│   │   │   └── layout/
│   │   │       ├── app-layout/      # Main layout wrapper
│   │   │       ├── sidebar/         # Collapsible sidebar
│   │   │       ├── navbar/          # Top navigation bar
│   │   │       └── footer/          # Footer component
│   │   │
│   │   ├── app.ts                   # Root component
│   │   ├── app.html
│   │   ├── app.routes.ts            # Routing configuration
│   │   └── app.config.ts
│   │
│   ├── styles/                      # Global styles
│   │   ├── _variables.scss
│   │   ├── _mixins.scss
│   │   └── styles.scss
│   │
│   ├── index.html                   # Main HTML with font imports
│   └── main.ts
│
├── package.json
├── angular.json
├── tsconfig.json
└── README.md
```

## 🛠️ Technology Stack

- **Framework**: Angular 21.0
- **Language**: TypeScript (with strict mode)
- **Styling**: SCSS with custom design system
- **Icons**: Font Awesome 6.5
- **Fonts**: Poppins (Google Fonts)
- **State Management**: RxJS Observables
- **Routing**: Angular Router with Guards

## 📦 Installation & Running

### Prerequisites
- Node.js (v18 or higher)
- npm (v9 or higher)

### Steps

1. **Install dependencies**
   ```bash
   npm install
   ```

2. **Start development server**
   ```bash
   npm start
   ```
   or
   ```bash
   ng serve
   ```

3. **Open browser**
   Navigate to `http://localhost:4200`

## 🔐 Demo Credentials

Use these credentials to test the application:

| Username | Password |
|----------|----------|
| demo@restaurant.com | demo123 |
| admin@nearbite.com | admin123 |
| 9876543210 | demo123 |

## 🎯 Key Features Implemented

### 1. **Global Font Setup (Poppins)**
- ✅ Google Fonts link in index.html
- ✅ Global font-family applied in styles.scss
- ✅ All components inherit Poppins
- ✅ Multiple font weights (300-700)

### 2. **Design System**
- ✅ Comprehensive SCSS variables
- ✅ Reusable mixins for components
- ✅ Consistent color palette
- ✅ Spacing and typography scales
- ✅ Animation keyframes

### 3. **Authentication**
- ✅ Login page with validation
- ✅ Dummy AuthService with hardcoded credentials
- ✅ AuthGuard for protected routes
- ✅ LoginGuard to prevent authenticated users from accessing login
- ✅ Session persistence with localStorage

### 4. **Layout Components**
- ✅ Collapsible sidebar with animations
- ✅ Top navbar with search and user menu
- ✅ Footer with links
- ✅ Responsive design

### 5. **Feature Modules**
- ✅ Dashboard with KPI cards and charts
- ✅ Orders with tabbed interface
- ✅ Menu with category filters
- ✅ Placeholder components for Reports, Payments, Reviews, Settings, Support

### 6. **UI/UX Excellence**
- ✅ Card-based layouts
- ✅ Smooth transitions and animations
- ✅ Hover effects
- ✅ Status badges
- ✅ Icon integration
- ✅ Dark theme optimized for readability

## 🚦 Available Scripts

```bash
# Start development server
npm start

# Build for production
npm run build

# Run tests
npm test

# Watch build
npm run watch
```

## 📱 Responsive Design

The application is fully responsive and works across:
- **Desktop**: Full sidebar and feature-rich interface
- **Tablet**: Adjusted layouts with collapsible sidebar
- **Mobile**: Optimized mobile navigation and compact views

## 🎨 Design Tokens

### Colors
```scss
Primary: #8B1E1E → #B02121 (gradient)
Background: #0F0F0F
Card: #1E1E1E
Accent: #D97642
Success: #2ECC71
Error: #E74C3C
Warning: #F39C12
```

### Typography
```scss
Font Family: 'Poppins', sans-serif
Sizes: 12px - 36px
Weights: 300, 400, 500, 600, 700
```

### Spacing
```scss
xs: 4px, sm: 8px, md: 16px
lg: 24px, xl: 32px, 2xl: 48px
```

## 🔮 Future Enhancements

- Integration with real backend APIs
- Real-time order notifications
- Advanced analytics with chart libraries (Chart.js, D3.js)
- Image upload for menu items
- Multi-language support
- Print order receipts
- Advanced filtering and search
- Bulk operations
- Export reports to PDF/Excel

## 👨‍💻 Development Notes

### Code Quality
- Strict TypeScript mode enabled
- Strongly typed interfaces
- No business logic in templates
- Separation of concerns
- Reusable components and services

### Best Practices
- Standalone components (Angular 21)
- Reactive forms
- Observable-based state management
- Lazy loading ready structure
- SCSS modular architecture

## 📄 License

This project is created for demonstration purposes.

## 🤝 Support

For questions or issues, please contact the NearBite development team.

---

**Built with ❤️ using Angular 21 | © 2026 NearBite**
