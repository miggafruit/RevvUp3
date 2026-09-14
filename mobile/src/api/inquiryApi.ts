import apiClient from './client';

export interface CreateInquiryPayload {
  shop: string;
  product?: string;
  vehicleMake: string;
  vehicleModel: string;
  vehicleYear: string;
  partName: string;
  quantity: string;
  additionalDetails?: string;
}

export type InquiryReplyType = 'available' | 'check_back' | 'not_available' | 'custom';

export interface Inquiry {
  _id: string;
  client: { _id: string; name: string; phone: string } | string;
  shop: { _id: string; businessName?: string } | string;
  product?: { _id: string; name: string } | string;
  vehicleMake: string;
  vehicleModel: string;
  vehicleYear: string;
  partName: string;
  quantity: string;
  additionalDetails?: string;
  status: 'new' | 'responded' | 'closed';
  replyType?: InquiryReplyType;
  responseMessage?: string;
  respondedAt?: string;
  createdAt: string;
}

export const createInquiry = (payload: CreateInquiryPayload) =>
  apiClient.post<{ success: boolean; data: Inquiry }>('/inquiries', payload).then((r) => r.data);

export const getInquiriesForShop = () =>
  apiClient.get<{ success: boolean; data: Inquiry[] }>('/inquiries/mine').then((r) => r.data);

export const getInquiriesForClient = () =>
  apiClient.get<{ success: boolean; data: Inquiry[] }>('/inquiries/sent').then((r) => r.data);

// Quick-reply: shops pick one of the canned options (or 'custom' with
// their own message) instead of only being able to flip a bare status
// flag with nothing for the client to actually read.
export const respondToInquiry = (id: string, replyType: InquiryReplyType, message?: string) =>
  apiClient.post<{ success: boolean; data: Inquiry }>(`/inquiries/${id}/respond`, { replyType, message }).then((r) => r.data);

export const closeInquiry = (id: string) =>
  apiClient.patch<{ success: boolean; data: Inquiry }>(`/inquiries/${id}/close`).then((r) => r.data);
