/**
 * User Model - Synced with AWS User model
 * Unified customer and rider model with role-based differentiation
 */

// User roles from AWS
export enum UserRole {
  CUSTOMER = 'CUSTOMER',
  RIDER = 'RIDER'
}

// Rider status from AWS User model
export enum RiderStatus {
  SIGNUP_DONE = 'SIGNUP_DONE',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED'
}

/**
 * Base User interface matching AWS DynamoDB Users table structure
 */
export interface User {
  // Primary key
  phone: string;
  role: UserRole;
  
  // Basic info
  firstName?: string;
  lastName?: string;
  email?: string;
  address?: string;
  dateOfBirth?: string;
  
  // Rider-specific fields (only when role = RIDER)
  riderId?: string;
  aadharNumber?: string;
  aadharImageUrl?: string;
  panNumber?: string;
  panImageUrl?: string;
  riderStatus?: RiderStatus;
  rejectionReason?: string;
  approvedAt?: string;
  
  // Account status
  isActive: boolean;
  createdAt: string;
  
  // FCM for notifications
  fcmToken?: string;
  fcmTokenUpdatedAt?: string;
}

/**
 * Customer-specific interface (User with role=CUSTOMER)
 */
export interface Customer extends User {
  role: UserRole.CUSTOMER;
}

/**
 * Rider user interface (User with role=RIDER)
 */
export interface RiderUser extends User {
  role: UserRole.RIDER;
  riderId: string;
  riderStatus: RiderStatus;
}
