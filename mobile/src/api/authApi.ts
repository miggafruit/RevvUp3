import apiClient from './client';
import {
  AuthResponse,
  LoginPayload,
  RegisterPayload,
  User,
  KycDocument,
  ForgotPasswordPayload,
  ResetPasswordPayload
} from '../types/auth';

export const registerUser = async (payload: RegisterPayload): Promise<AuthResponse> => {
  const { data } = await apiClient.post<AuthResponse>('/auth/register', payload);
  return data;
};

export const loginUser = async (payload: LoginPayload): Promise<AuthResponse> => {
  const { data } = await apiClient.post<AuthResponse>('/auth/login', payload);
  return data;
};

export const logoutUser = async (): Promise<void> => {
  await apiClient.post('/auth/logout');
};

export const getCurrentUser = async (): Promise<User> => {
  const { data } = await apiClient.get<{ user: User }>('/auth/me');
  return data.user;
};

export interface UpdateProfilePayload {
  businessName?: string;
  businessAddress?: string;
  category?: string;
  isDriver?: boolean;
  roadsideServices?: string[];
  vehicleDetails?: { make: string; model: string; licensePlate: string };
}

export const updateProfile = async (payload: UpdateProfilePayload): Promise<User> => {
  const { data } = await apiClient.patch<{ user: User }>('/auth/me', payload);
  return data.user;
};

export const resubmitKyc = async (kycDocuments: KycDocument[]): Promise<User> => {
  const { data } = await apiClient.post<{ user: User }>('/auth/kyc/resubmit', { kycDocuments });
  return data.user;
};

export const forgotPassword = async (payload: ForgotPasswordPayload): Promise<{ message: string }> => {
  const { data } = await apiClient.post<{ message: string }>('/auth/forgot-password', payload);
  return data;
};

export const resetPassword = async (payload: ResetPasswordPayload): Promise<{ message: string }> => {
  const { data } = await apiClient.post<{ message: string }>('/auth/reset-password', payload);
  return data;
};