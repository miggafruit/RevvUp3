export interface Delivery {
  _id: string;
  order: string;
  client: string;
  shop: string;
  pickupAddress: string;
  pickupPhone?: string;
  dropoffAddress: string;
  dropoffPhone: string;
  items: Array<{ nameSnapshot: string; quantity: number }>;
  totalAmount: number;
  status: 'pending' | 'accepted' | 'picked_up' | 'delivered' | 'cancelled';
  driver?: {
    driver_id: string;
    driver_name: string;
    driver_phone: string;
    driver_vehicle: string;
    driver_location?: { latitude: number; longitude: number };
  };
  createdAt: string;
  acceptedAt?: string;
  pickedUpAt?: string;
  deliveredAt?: string;
}