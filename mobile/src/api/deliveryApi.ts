import apiClient from './client';
import { Delivery } from '../types/delivery';

export const getPendingDeliveries = async (): Promise<Delivery[]> => {
  const { data } = await apiClient.get('/deliveries/pending');
  return data.deliveries;
};

export const getMyActiveDelivery = async (): Promise<Delivery | null> => {
  const { data } = await apiClient.get('/deliveries/my-active');
  return data.delivery;
};

export const acceptDelivery = async (
  deliveryId: string,
  payload?: { driver_vehicle?: string; driver_location?: { latitude: number; longitude: number } }
): Promise<Delivery> => {
  const { data } = await apiClient.post(`/deliveries/${deliveryId}/accept`, payload || {});
  return data.delivery;
};

export const updateDeliveryLocation = async (
  deliveryId: string,
  location: { latitude: number; longitude: number }
): Promise<void> => {
  await apiClient.post(`/deliveries/${deliveryId}/location`, location);
};

export const markPickedUp = async (deliveryId: string): Promise<Delivery> => {
  const { data } = await apiClient.post(`/deliveries/${deliveryId}/picked-up`);
  return data.delivery;
};

export const markDelivered = async (deliveryId: string): Promise<Delivery> => {
  const { data } = await apiClient.post(`/deliveries/${deliveryId}/delivered`);
  return data.delivery;
};

export const getDeliveryByOrder = async (orderId: string): Promise<Delivery> => {
  const { data } = await apiClient.get(`/deliveries/order/${orderId}`);
  return data.delivery;
};