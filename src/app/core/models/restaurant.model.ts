/**
 * Restaurant Model - Synced with AWS Restaurant model
 * Location-based restaurant model with geohash indexing
 */

/**
 * Restaurant interface matching AWS DynamoDB Restaurant model
 */
export interface Restaurant {
  // Primary keys
  restaurantId: string;
  locationId: string;
  
  // Basic info
  name: string;
  ownerId: string;
  
  // Location
  lat: number;
  lng: number;
  
  // Geohash for location-based queries (7 precision levels)
  geohash4Char?: string;
  geohash5Char?: string;
  geohash6Char?: string;
  geohash7Char?: string;
  
  // Operational status
  isOpen: boolean;
  
  // Restaurant details
  cuisine: string[]; // Array of cuisine types
  rating?: number;
  
  // Timestamps (optional in base model)
  createdAt?: string;
  updatedAt?: string;
}

/**
 * Extended restaurant interface for UI display
 * Includes additional fields that may be fetched from other sources
 */
export interface RestaurantDetail extends Restaurant {
  description?: string;
  address?: string;
  phoneNumber?: string;
  email?: string;
  logo?: string;
  coverImage?: string;
  avgPreparationTime?: number; // minutes
  minimumOrderValue?: number;
  deliveryRadius?: number; // km
  packagingCharges?: number;
  totalRatings?: number;
  isPureVeg?: boolean;
}
