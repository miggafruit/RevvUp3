export type UserRole = 'client' | 'service_provider' | 'shop';

export interface KycDocument {
  id: string;
  type:
    | 'id_document'
    | 'proof_of_address'
    | 'selfie'
    | 'drivers_license'
    | 'business_registration'
    | 'vehicle_registration'
    | 'other';
  label: string;
  image: string;
}

export type KycStatus = 'not_submitted' | 'pending' | 'approved' | 'rejected';

export interface VehicleDetails {
  make?: string;
  model?: string;
  licensePlate?: string;
}

export interface User {
  id: string;
  name: string;
  email: string;
  phone: string;
  role: UserRole;
  businessName?: string;
  businessAddress?: string;
  category?: string;
  isDriver?: boolean;
  roadsideServices?: string[];
  vehicleDetails?: VehicleDetails;
  waiverAccepted: boolean;
  kycStatus?: KycStatus;
  kycReviewNote?: string;
  kycDocumentCount?: number;
  createdAt: string;
}

export interface AuthResponse {
  user: User;
  accessToken: string;
  refreshToken: string;
}

export interface RegisterPayload {
  name: string;
  email: string;
  phone: string;
  password: string;
  role: UserRole;
  businessName?: string;
  businessAddress?: string;
  category?: string;
  waiverAccepted: boolean;
  kycDocuments?: KycDocument[];
  isDriver?: boolean;
  roadsideServices?: string[];
  vehicleDetails?: VehicleDetails;
}

export interface LoginPayload {
  email: string;
  password: string;
}

export interface ForgotPasswordPayload {
  email: string;
}

export interface ResetPasswordPayload {
  email: string;
  token: string;
  password: string;
}

export interface ApiErrorResponse {
  message: string;
}