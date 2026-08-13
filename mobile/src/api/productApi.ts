import apiClient from './client';
import { Product, PaginationMeta, Spec } from '../types/marketplace';

export interface ProductListParams {
  category?: string;
  search?: string;
  shop?: string;
  page?: number;
  limit?: number;
}

export const getProducts = async (
  params: ProductListParams = {}
): Promise<{ products: Product[]; pagination: PaginationMeta }> => {
  const { data } = await apiClient.get('/products', { params });
  return data;
};

export const getProductById = async (id: string): Promise<Product> => {
  const { data } = await apiClient.get(`/products/${id}`);
  return data.product;
};

export const getMyProducts = async (): Promise<Product[]> => {
  const { data } = await apiClient.get('/products/mine');
  return data.products;
};

export interface ProductInput {
  name: string;
  price: number;
  category: string;
  description: string;
  specs: Spec[];
  images: string[];
  stock: number;
  condition: 'Brand New' | 'Used' | 'Refurbished';
  deliveryEstimate?: string;
}

export const createProduct = async (payload: ProductInput): Promise<Product> => {
  const { data } = await apiClient.post('/products', payload);
  return data.product;
};

export const updateProduct = async (id: string, payload: Partial<ProductInput>): Promise<Product> => {
  const { data } = await apiClient.put(`/products/${id}`, payload);
  return data.product;
};

export const deleteProduct = async (id: string): Promise<void> => {
  await apiClient.delete(`/products/${id}`);
};
