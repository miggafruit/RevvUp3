import apiClient from './client';

export interface EarningsRow {
  id: string;
  sourceType: 'order_seller_share' | 'cash_settlement' | 'delivery_fee' | 'ride_fare';
  description: string;
  paymentMethod?: 'card' | 'cash' | 'points';
  gross: number;
  commission: number;
  cashHeld: number;
  net: number;
  status: 'owed' | 'paid';
  createdAt: string;
}

export interface EarningsSummary {
  totals: { grossSales: number; commission: number; netEarned: number; completedSales: number };
  dueNow: number;
  paidOut: number;
  cashCommissionOwed: number;
  periods: { today: { gross: number; net: number }; week: { gross: number; net: number }; month: { gross: number; net: number } };
  inProgress: Array<{ orderId: string; amount: number; paymentMethod: string; waitingFor: 'provider' | 'client' }>;
  recent: EarningsRow[];
}

export const getEarningsSummary = async (): Promise<EarningsSummary> => {
  const { data } = await apiClient.get('/earnings/summary');
  return data;
};
