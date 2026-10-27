import apiClient from './client';

export interface RewardTx {
  _id: string;
  type: 'earn' | 'redeem' | 'redeem_refund';
  points: number;
  valueRand: number;
  sellerName?: string;
  balanceAfter?: number;
  createdAt: string;
}

export interface RewardsSummary {
  points: number;
  valueRand: number;
  pointValueRand: number;
  rewardRate: number;
  recent: RewardTx[];
  unseen: RewardTx[];
}

export interface RewardsProgram {
  active: boolean;
  activeUntil: string | null;
  feeRand: number;
  periodDays: number;
  rewardRate: number;
  history: Array<{ _id: string; amount: number; periodStart: string; periodEnd: string; createdAt: string }>;
}

export const getRewardsSummary = async (): Promise<RewardsSummary> => {
  const { data } = await apiClient.get('/rewards/summary');
  return data;
};

export const markRewardsSeen = async (ids: string[]): Promise<void> => {
  await apiClient.post('/rewards/seen', { ids });
};

export const getRewardsProgram = async (): Promise<RewardsProgram> => {
  const { data } = await apiClient.get('/rewards/program');
  return data;
};

export const payForRewardsProgram = async (paymentReference: string): Promise<{ active: boolean; activeUntil: string }> => {
  const { data } = await apiClient.post('/rewards/program/pay', { paymentReference });
  return data;
};
