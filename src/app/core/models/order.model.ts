export interface OrderItem {
  itemId: string;
  name: string;
  quantity: number;
  price: number;
}

export enum OrderStatus {
  PENDING = 'PENDING',
  CONFIRMED = 'CONFIRMED',
  PREPARING = 'PREPARING',
  READY = 'READY',
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
}

export interface OrdersResponse {
  orders: Order[];
  total: number;
}

export interface UpdateOrderStatusRequest {
  status: OrderStatus;
}

export interface UpdateOrderStatusResponse extends Order {}
