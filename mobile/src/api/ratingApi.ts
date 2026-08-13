import apiClient from './client';

export interface CreateRatingPayload {
  orderId: string;
  itemType: 'product' | 'service';
  itemId: string;
  rating: number;
  comment?: string;
}

export interface MyRating {
  itemType: 'product' | 'service';
  product?: string;
  service?: string;
  rating: number;
}

export const createRating = async (payload: CreateRatingPayload) => {
  const { data } = await apiClient.post('/ratings', payload);
  return data.rating;
};

export const getMyRatingsForOrder = async (orderId: string): Promise<MyRating[]> => {
  const { data } = await apiClient.get('/ratings/mine', { params: { order: orderId } });
  return data.ratings;
};

export interface PublicRating {
  _id: string;
  rating: number;
  comment?: string;
  createdAt: string;
  client: { _id: string; name: string } | string;
}

export const getRatingsForItem = async (
  itemType: 'product' | 'service',
  itemId: string
): Promise<PublicRating[]> => {
  const params = itemType === 'product' ? { product: itemId } : { service: itemId };
  const { data } = await apiClient.get('/ratings', { params });
  return data.ratings;
};
