import apiClient from './client';
import { AuthResponse } from '../types/admin';

export const loginAdmin = async (email: string, password: string): Promise<AuthResponse> => {
  const { data } = await apiClient.post<AuthResponse>('/auth/login', { email, password });
  return data;
};
