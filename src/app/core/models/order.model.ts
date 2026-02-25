export interface OrderItem {
  itemId: string;
  name: string;
  quantity: number;
  price: number;
}

export enum OrderStatus {
  // Restaurant statuses
  INITIATED = 'INITIATED',
  PENDING = 'PENDING',
  CONFIRMED = 'CONFIRMED',
  ACCEPTED = 'ACCEPTED',
  
  // Order assignment statuses
  PREPARING = 'PREPARING',
  READY_FOR_PICKUP = 'READY_FOR_PICKUP',
  AWAITING_RIDER_ASSIGNMENT = 'AWAITING_RIDER_ASSIGNMENT',
  OFFERED_TO_RIDER = 'OFFERED_TO_RIDER',
  
  // Rider statuses
  RIDER_ASSIGNED = 'RIDER_ASSIGNED',
  PICKED_UP = 'PICKED_UP',
  OUT_FOR_DELIVERY = 'OUT_FOR_DELIVERY',
  DELIVERED = 'DELIVERED',
  CANCELLED = 'CANCELLED'
}

export interface Order {
  orderId: string;
  customerPhone: string;
  restaurantId: string;
  items: OrderItem[];
  foodTotal: number;
  deliveryFee: number;
  platformFee: number;
  grandTotal: number;
  status: OrderStatus;
  riderId: string | null;
  createdAt: string;
  restaurantName: string;
  restaurantImage: string;
  deliveryAddress: string;
  formattedAddress: string;
  addressId: string;
  cancellationReason?: string;
  acceptedAt?: string;
  pickupOtp?: string; // 4-digit OTP for restaurant to verify with rider during pickup
  deliveryOtp?: string; // 4-digit OTP for customer to verify with rider during delivery
}

export interface OrdersResponse {
  orders: Order[];
  total: number;
}

export interface UpdateOrderStatusRequest {
  status: OrderStatus;
  cancellationReason?: string;
}

export interface UpdateOrderStatusResponse extends Order {}
