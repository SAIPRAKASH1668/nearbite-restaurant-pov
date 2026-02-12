/**
 * Address Model - Synced with AWS Address model
 * Customer delivery addresses with geolocation
 */

/**
 * Address interface matching AWS DynamoDB Address model
 */
export interface Address {
  // Primary keys
  phone: string;
  addressId: string;
  
  // Address details
  label: string; // "Home", "Work", "Other"
  address: string; // User-entered address details
  
  // Geolocation
  lat: number;
  lng: number;
  geohash?: string;
  
  // Google Maps data (optional)
  geocodedAddress?: string; // Short address from Google Maps
  formattedAddress?: string; // Full detailed address from Google Maps
  placeId?: string; // Google Maps place ID
  components?: AddressComponents; // Structured address components
}

/**
 * Address components from Google Maps
 */
export interface AddressComponents {
  road?: string;
  neighbourhood?: string;
  suburb?: string;
  city?: string;
  state?: string;
  postcode?: string;
  country?: string;
}

/**
 * Extended address interface for UI display
 */
export interface AddressDetail extends Address {
  isDefault?: boolean;
  distance?: number; // Distance from restaurant (calculated)
}
