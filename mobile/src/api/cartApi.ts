import apiClient from './client';
import { Cart } from '../types/marketplace';

export const getCart = async (): Promise<{ cart: Cart; subtotal: number; deliveryFee: number; total: number }> => {
  const { data } = await apiClient.get('/cart');
  return data;
};

export const addItemToCart = async (
  itemType: 'product' | 'service',
  itemId: string,
  quantity: number = 1
): Promise<Cart> => {
  const { data } = await apiClient.post('/cart/items', { itemType, itemId, quantity });
  return data.cart;
};

export const updateCartItem = async (cartItemId: string, quantity: number): Promise<Cart> => {
  const { data } = await apiClient.put(`/cart/items/${cartItemId}`, { quantity });
  return data.cart;
};

export const removeCartItem = async (cartItemId: string): Promise<Cart> => {
  const { data } = await apiClient.delete(`/cart/items/${cartItemId}`);
  return data.cart;
};

export const clearCart = async (): Promise<void> => {
  await apiClient.delete('/cart');
};
