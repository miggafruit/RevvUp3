export interface Spec {
  key: string;
  value: string;
}

export interface Product {
  _id: string;
  shop: { _id: string; businessName?: string; businessAddress?: string; phone?: string } | string;
  name: string;
  price: number;
  category: string;
  description: string;
  specs: Spec[];
  images: string[];
  thumbnail?: string | null;
  stock: number;
  condition: 'Brand New' | 'Used' | 'Refurbished';
  deliveryEstimate: string;
  isActive: boolean;
  ratingAverage: number;
  ratingCount: number;
  createdAt: string;
}

export interface Service {
  _id: string;
  provider: { _id: string; businessName?: string; businessAddress?: string; phone?: string } | string;
  name: string;
  price: number;
  category: string;
  description: string;
  specs: Spec[];
  images: string[];
  thumbnail?: string | null;
  durationEstimate: string;
  availability: 'Available' | 'Booked Out' | 'By Appointment';
  isActive: boolean;
  ratingAverage: number;
  ratingCount: number;
  createdAt: string;
}

export interface ShopListing {
  _id: string;
  name: string;
  businessName: string;
  businessAddress: string;
  category?: string;
  productCount: number;
  rating: number | null;
  thumbnail: string | null;
}

export interface ProviderListing {
  _id: string;
  name: string;
  businessName: string;
  businessAddress: string;
  category?: string;
  serviceCount: number;
  rating: number | null;
  thumbnail: string | null;
}

export interface CartItem {
  _id: string;
  itemType: 'product' | 'service';
  product?: Product;
  service?: Service;
  quantity: number;
}

export interface Cart {
  _id?: string;
  client?: string;
  items: CartItem[];
}

export interface Order {
  _id: string;
  client: string | { _id: string; name: string; phone: string };
  items: Array<{
    itemType: 'product' | 'service';
    product?: string;
    service?: string;
    nameSnapshot: string;
    priceSnapshot: number;
    sellerSnapshot: string;
    quantity: number;
    lineTotal: number;
  }>;
  totalAmount: number;
  deliveryFee?: number;
  deliveryAddress: string;
  contactPhone: string;
  status: 'pending' | 'confirmed' | 'completed' | 'cancelled';
  notes?: string;
  paymentReference?: string;
  paymentStatus?: 'pending' | 'paid' | 'failed';
  createdAt: string;
}

export interface Promotion {
  _id: string;
  seller: string | { _id: string; businessName?: string; businessAddress?: string; category?: string };
  sellerRole: 'shop' | 'service_provider';
  title: string;
  description: string;
  image?: string | null;
  tier: '7_days' | '14_days' | '30_days';
  price: number;
  paymentReference?: string;
  paymentStatus: 'pending' | 'paid';
  startDate?: string;
  endDate?: string;
  createdAt: string;
}

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  pages: number;
}