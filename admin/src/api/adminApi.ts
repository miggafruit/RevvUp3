import apiClient from './client';
import {
  Overview,
  Revenue,
  KycQueueItem,
  UserListItem,
  UserDetail,
  RideListItem,
  OrderListItem,
  Pagination
} from '../types/admin';

export const getOverview = async (): Promise<Overview> => {
  const { data } = await apiClient.get<Overview>('/admin/overview');
  return data;
};

export const getRevenue = async (): Promise<Revenue> => {
  const { data } = await apiClient.get<Revenue>('/admin/revenue');
  return data;
};

export const getKycQueue = async (): Promise<KycQueueItem[]> => {
  const { data } = await apiClient.get<{ users: KycQueueItem[] }>('/admin/kyc/queue');
  return data.users;
};

export const getKycDetail = async (userId: string): Promise<KycQueueItem & { kycStatus: string }> => {
  const { data } = await apiClient.get<{ user: KycQueueItem & { kycStatus: string } }>(`/admin/kyc/${userId}`);
  return data.user;
};

export const reviewKyc = async (
  userId: string,
  status: 'approved' | 'rejected',
  note?: string
): Promise<void> => {
  await apiClient.patch(`/admin/kyc/${userId}`, { status, note });
};

export const getUsers = async (params: {
  role?: string;
  search?: string;
  page?: number;
}): Promise<{ users: UserListItem[]; pagination: Pagination }> => {
  const { data } = await apiClient.get('/admin/users', { params });
  return data;
};

export const getUserDetail = async (id: string): Promise<{ user: UserDetail; rideCount: number; orderCount: number }> => {
  const { data } = await apiClient.get(`/admin/users/${id}`);
  return data;
};

export const getRides = async (params: {
  status?: string;
  page?: number;
}): Promise<{ rides: RideListItem[]; pagination: Pagination }> => {
  const { data } = await apiClient.get('/admin/rides', { params });
  return data;
};

export const getRideDetail = async (id: string): Promise<RideListItem> => {
  const { data } = await apiClient.get(`/admin/rides/${id}`);
  return data.ride;
};

export const adminCancelRide = async (id: string, reason?: string): Promise<void> => {
  await apiClient.patch(`/admin/rides/${id}/cancel`, { reason });
};

export const getOrders = async (params: {
  status?: string;
  page?: number;
}): Promise<{ orders: OrderListItem[]; pagination: Pagination }> => {
  const { data } = await apiClient.get('/admin/orders', { params });
  return data;
};

export const getOrderDetail = async (id: string): Promise<OrderListItem> => {
  const { data } = await apiClient.get(`/admin/orders/${id}`);
  return data.order;
};
