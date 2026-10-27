import apiClient from './client';
import { Order } from '../types/marketplace';

export interface CheckoutPayload {
  deliveryAddress?: string;
  serviceLocationType?: 'at_client' | 'at_provider';
  paymentMethod?: 'card' | 'cash';
  redeemPoints?: number;
  contactPhone: string;
  notes?: string;
}

export const checkout = async (payload: CheckoutPayload): Promise<Order> => {
  const { data } = await apiClient.post('/orders/checkout', payload);
  return data.order;
};

export const getMyOrders = async (): Promise<Order[]> => {
  const { data } = await apiClient.get('/orders/mine');
  return data.orders;
};

export const getIncomingOrders = async (): Promise<any[]> => {
  const { data } = await apiClient.get('/orders/incoming');
  return data.orders;
};

export const getOrderById = async (id: string): Promise<Order> => {
  const { data } = await apiClient.get(`/orders/${id}`);
  return data.order;
};

export const updateOrderStatus = async (
  orderId: string,
  status: 'confirmed' | 'cancelled'
): Promise<Order> => {
  const { data } = await apiClient.put(`/orders/${orderId}/status`, { status });
  return data.order;
};

// Provider side (step 1 of 2). For cash bookings pass cashReceived: true.
export const completeServiceOrder = async (orderId: string, cashReceived?: boolean): Promise<Order> => {
  const { data } = await apiClient.patch(`/orders/${orderId}/complete`, cashReceived ? { cashReceived: true } : {});
  return data.order;
};

// Client side (step 2 of 2). For cash bookings pass cashPaid: true.
export const confirmServiceOrder = async (orderId: string, cashPaid?: boolean): Promise<Order> => {
  const { data } = await apiClient.post(`/orders/${orderId}/confirm`, cashPaid ? { cashPaid: true } : {});
  return data.order;
};

export const payOrder = async (orderId: string, paymentReference: string): Promise<Order> => {
  const { data } = await apiClient.post(`/orders/${orderId}/pay`, { paymentReference });
  return data.order;
};
export interface DeliveryQuote {
  deliveryFee: number;
  distanceKm: number;
  tier: number | null;
  tierLabel?: string;
  baseFee?: number;
  perKm?: number;
  totalWeightKg: number;
  subtotal: number;
  total: number;
}

export const getDeliveryQuote = async (deliveryAddress: string): Promise<DeliveryQuote> => {
  const { data } = await apiClient.post('/orders/delivery-quote', { deliveryAddress });
  return data;
};
