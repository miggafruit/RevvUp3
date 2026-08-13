import apiClient from './client';
import { Service, PaginationMeta, Spec } from '../types/marketplace';

export interface ServiceListParams {
  category?: string;
  search?: string;
  provider?: string;
  page?: number;
  limit?: number;
}

export const getServices = async (
  params: ServiceListParams = {}
): Promise<{ services: Service[]; pagination: PaginationMeta }> => {
  const { data } = await apiClient.get('/services', { params });
  return data;
};

export const getServiceById = async (id: string): Promise<Service> => {
  const { data } = await apiClient.get(`/services/${id}`);
  return data.service;
};

export const getMyServices = async (): Promise<Service[]> => {
  const { data } = await apiClient.get('/services/mine');
  return data.services;
};

export interface ServiceInput {
  name: string;
  price: number;
  category: string;
  description: string;
  specs: Spec[];
  images: string[];
  durationEstimate: string;
  availability: 'Available' | 'Booked Out' | 'By Appointment';
}

export const createService = async (payload: ServiceInput): Promise<Service> => {
  const { data } = await apiClient.post('/services', payload);
  return data.service;
};

export const updateService = async (id: string, payload: Partial<ServiceInput>): Promise<Service> => {
  const { data } = await apiClient.put(`/services/${id}`, payload);
  return data.service;
};

export const deleteService = async (id: string): Promise<void> => {
  await apiClient.delete(`/services/${id}`);
};
