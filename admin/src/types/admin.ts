export interface AdminUser {
  id: string;
  name: string;
  email: string;
  phone: string;
  role: 'client' | 'service_provider' | 'shop' | 'admin';
  businessName?: string;
  businessAddress?: string;
  category?: string;
  isDriver?: boolean;
  roadsideServices?: string[];
  waiverAccepted: boolean;
  kycStatus?: 'not_submitted' | 'pending' | 'approved' | 'rejected';
  kycDocumentCount?: number;
  createdAt: string;
}

export interface AuthResponse {
  user: AdminUser;
  accessToken: string;
  refreshToken: string;
}

export interface KycDocument {
  type: string;
  label: string;
  image: string;
}

export interface KycQueueItem {
  _id: string;
  name: string;
  email: string;
  phone: string;
  role: 'service_provider' | 'shop';
  businessName?: string;
  businessAddress?: string;
  category?: string;
  kycDocuments: KycDocument[];
  createdAt: string;
}

export interface Revenue {
  total: number;
  today: number;
  week: number;
  month: number;
  bySource: { rides: number; orders: number; promotions: number };
  dailySeries: { date: string; total: number }[];
}

export interface Overview {
  users: { clients: number; shops: number; serviceProviders: number };
  pendingKyc: number;
  activeRides: number;
  activeDeliveries: number;
  pendingOrders: number;
  totalProducts: number;
  totalServices: number;
}

export interface Pagination {
  page: number;
  limit: number;
  total: number;
  pages: number;
}

export interface UserListItem {
  _id: string;
  name: string;
  email: string;
  phone: string;
  role: 'client' | 'service_provider' | 'shop' | 'admin';
  businessName?: string;
  category?: string;
  isDriver?: boolean;
  roadsideServices?: string[];
  kycStatus?: string;
  isOnline?: boolean;
  createdAt: string;
}

export interface UserDetail extends UserListItem {
  businessAddress?: string;
  waiverAccepted: boolean;
  vehicleDetails?: { make: string; model: string; licensePlate: string };
  kycDocuments?: KycDocument[];
  kycReviewNote?: string;
  kycReviewedAt?: string;
}

export interface RideListItem {
  _id: string;
  id: string;
  client: { _id: string; name: string; phone: string } | string;
  serviceType: string;
  location: { address: string; latitude?: number; longitude?: number };
  destination?: { address: string; latitude?: number; longitude?: number };
  vehicleDetails?: { make: string; model: string; licensePlate: string };
  driver?: { driver_id: string; driver_name: string; driver_phone: string; driver_vehicle: string };
  status: 'pending' | 'accepted' | 'in_progress' | 'completed' | 'cancelled';
  fare?: number;
  paymentStatus: string;
  paymentMethod?: string;
  cancelledBy?: string;
  cancelReason?: string;
  createdAt: string;
}

export interface OrderItem {
  itemType: 'product' | 'service';
  nameSnapshot: string;
  priceSnapshot: number;
  quantity: number;
  lineTotal: number;
  sellerSnapshot: string;
}

export interface OrderListItem {
  _id: string;
  client: { _id: string; name: string; phone: string } | string;
  items: OrderItem[];
  totalAmount: number;
  deliveryFee?: number;
  deliveryAddress: string;
  contactPhone: string;
  status: 'pending' | 'confirmed' | 'completed' | 'cancelled';
  paymentStatus: string;
  createdAt: string;
}
