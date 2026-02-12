/**
 * Rider Model - Synced with AWS Rider model
 * Operational rider tracking for real-time location updates
 * Note: This is separate from User with role=RIDER
 */

/**
 * Rider interface matching AWS DynamoDB Rider model
 * Used for real-time location tracking and order assignment
 */
export interface Rider {
  // Primary key
  riderId: string;
  phone: string;
  
  // Real-time location
  lat: number;
  lng: number;
  speed?: number; // km/h
  heading?: number; // degrees
  timestamp: number; // Unix timestamp in milliseconds
  
  // Geohash for location-based queries
  geohash4Char?: string;
  geohash5Char?: string;
  geohash6Char?: string;
  geohash7Char?: string;
  
  // Status
  isActive: boolean;
  workingOnOrder?: string; // orderId if currently on delivery
}

/**
 * Extended rider interface for UI display
 * Combines operational Rider data with User data
 */
export interface RiderDetail extends Rider {
  firstName?: string;
  lastName?: string;
  rating?: number;
  totalDeliveries?: number;
}

/**
 * Rider location update (for real-time tracking)
 */
export interface RiderLocationUpdate {
  riderId: string;
  lat: number;
  lng: number;
  speed?: number;
  heading?: number;
  timestamp: number;
}
