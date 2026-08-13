import apiClient from './client';
import { Order } from '../types/marketplace';

export interface CheckoutPayload {
  deliveryAddress: string;
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

export const completeServiceOrder = async (orderId: string): Promise<Order> => {
  const { data } = await apiClient.patch(`/orders/${orderId}/complete`, {});
  return data.order;
};

export const payOrder = async (orderId: string, paymentReference: string): Promise<Order> => {
  const { data } = await apiClient.post(`/orders/${orderId}/pay`, { paymentReference });
  return data.order;
};