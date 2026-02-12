/**
 * MenuItem Model - Synced with AWS MenuItem model
 * Restaurant menu items with pricing
 */

/**
 * MenuItem interface matching AWS DynamoDB MenuItem model
 */
export interface MenuItem {
  // Primary keys
  restaurantId: string;
  itemId: string;
  
  // Item details
  itemName: string;
  price: number; // Customer-facing price
  restaurantPrice?: number; // Restaurant's price (before platform markup)
  category?: string;
  description?: string;
  image?: string;
  
  // Availability
  isAvailable: boolean;
  isVeg?: boolean;
}

/**
 * Menu category for organizing items
 */
export interface MenuCategory {
  categoryId: string;
  categoryName: string;
  displayOrder: number;
  items: MenuItem[];
}

/**
 * Menu item with quantity (for cart/order)
 */
export interface MenuItemWithQuantity extends MenuItem {
  quantity: number;
  totalPrice: number;
}
