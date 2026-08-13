export interface Ride {
  id: string;
  client: { _id: string; name: string; phone: string };
  driver?: {
    driver_id: string;
    driver_name: string;
    driver_phone: string;
    driver_vehicle: string;
    driver_location?: { latitude: number; longitude: number };
  };
  serviceType: string;
  location: { address: string; latitude?: number; longitude?: number };
  vehicleDetails?: { make: string; model: string; licensePlate: string };
  issueDescription?: string;
  forSomeoneElse?: boolean;
  beneficiaryName?: string;
  beneficiaryPhone?: string;
  status: 'pending' | 'accepted' | 'in_progress' | 'completed' | 'cancelled';
  fare?: number;
  distanceKm?: number;
  paymentStatus: 'pending' | 'paid' | 'failed';
  paymentMethod?: 'paystack' | 'cash';
  paymentReference?: string;
  createdAt: string;
  acceptedAt?: string;
  startedAt?: string;
  completedAt?: string;
}
