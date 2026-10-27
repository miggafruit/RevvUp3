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

export const markDelivered = async (deliveryId: string, code: string): Promise<Delivery> => {
  const { data } = await apiClient.post(`/deliveries/${deliveryId}/delivered`, { code });
  return data.delivery;
};

export const confirmReturned = async (deliveryId: string): Promise<Delivery> => {
  const { data } = await apiClient.post(`/deliveries/${deliveryId}/confirm-returned`);
  return data.delivery;
};

export const getDeliveryByOrder = async (orderId: string): Promise<Delivery> => {
  const { data } = await apiClient.get(`/deliveries/order/${orderId}`);
  return data.delivery;
};
// TEMPORARY tester-only: advances a delivery one step with a simulated driver.
// The server rejects this for anyone not on the test allowlist.
export const testAdvanceDelivery = async (deliveryId: string): Promise<Delivery> => {
  const { data } = await apiClient.post(`/deliveries/${deliveryId}/test-advance`);
  return data.delivery;
};
