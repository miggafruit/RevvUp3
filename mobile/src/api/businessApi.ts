import apiClient from './client';
import { ShopListing, ProviderListing, PaginationMeta } from '../types/marketplace';

export const getShops = async (
  params: { search?: string; category?: string; page?: number; limit?: number } = {}
): Promise<{ shops: ShopListing[]; pagination: PaginationMeta }> => {
  const { data } = await apiClient.get('/businesses/shops', { params });
  return data;
};

export const getProviders = async (
  params: { search?: string; category?: string; page?: number; limit?: number } = {}
): Promise<{ providers: ProviderListing[]; pagination: PaginationMeta }> => {
  const { data } = await apiClient.get('/businesses/providers', { params });
  return data;
};
