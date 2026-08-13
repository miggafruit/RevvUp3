import apiClient from './client';
import { Promotion } from '../types/marketplace';
import { PromotionTier } from '../api/promotionTiers';

export interface CreatePromotionPayload {
  title: string;
  description: string;
  image?: string;
  tier: PromotionTier;
}

export const createPromotion = async (payload: CreatePromotionPayload): Promise<Promotion> => {
  const { data } = await apiClient.post('/promotions', payload);
  return data.promotion;
};

export const payPromotion = async (promotionId: string, paymentReference: string): Promise<Promotion> => {
  const { data } = await apiClient.post(`/promotions/${promotionId}/pay`, { paymentReference });
  return data.promotion;
};

export const getPromotions = async (params?: { search?: string }): Promise<Promotion[]> => {
  const { data } = await apiClient.get('/promotions', { params });
  return data.promotions;
};

export const getMyPromotions = async (): Promise<Promotion[]> => {
  const { data } = await apiClient.get('/promotions/mine');
  return data.promotions;
};

export const getPromotionById = async (id: string): Promise<Promotion> => {
  const { data } = await apiClient.get(`/promotions/${id}`);
  return data.promotion;
};

export const getActiveSellerIds = async (): Promise<string[]> => {
  const { data } = await apiClient.get('/promotions/active-seller-ids');
  return data.sellerIds;
};