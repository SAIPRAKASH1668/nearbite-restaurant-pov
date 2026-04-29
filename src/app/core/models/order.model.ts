export interface OrderItem {
  itemId: string;
  name: string;
  quantity: number;
  price: number;
  isVeg?: boolean; // true = veg, false = non-veg, undefined = unknown
  /** Key used by the backend API response */
  addOns?: { optionId: string; name: string; extraPrice: number }[];
  /** Legacy alias — kept for backwards compatibility */
  addOnOptions?: { optionId: string; name: string; extraPrice: number }[];
}

/** Revenue breakdown returned by the backend on each order */
export interface OrderRevenue {
  platformRevenue?: {
    foodCommission?    : number;
    platformFee?       : number;
    finalPayout?       : number;
    couponDiscount?    : number;
    itemCouponDiscount?: number;
  };
  restaurantRevenue?: {
    revenue?           : number;  // gross before coupon deductions
    finalPayout?       : number;  // net earnings (after commission + coupon deductions)
    couponDiscount?    : number;  // restaurant-issued order-level coupon
    itemCouponDiscount?: number;  // restaurant-issued item-level coupon
  };
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
  receiverPhone?: string;
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
  preparationTime?: number; // minutes, set by restaurant when accepting
  pickupOtp?: string; // 4-digit OTP for restaurant to verify with rider during pickup
  deliveryOtp?: string; // 4-digit OTP for customer to verify with rider during delivery
  /** Revenue breakdown — present once the order has been processed by the revenue calculator */
  revenue?: OrderRevenue;
}

export interface OrdersResponse {
  orders: Order[];
  total: number;
}

export interface UpdateOrderStatusRequest {
  status: OrderStatus;
  expectedCurrentStatus?: OrderStatus;
  cancellationReason?: string;
  preparationTime?: number; // minutes
}

export interface UpdateOrderStatusResponse extends Order {}
