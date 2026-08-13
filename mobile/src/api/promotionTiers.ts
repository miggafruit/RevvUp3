// Keep this in sync with backend/config/promotionTiers.js — this copy is for
// display only; the server always computes the real price independently.
export type PromotionTier = '7_days' | '14_days' | '30_days';

export const PROMOTION_TIERS: Record<PromotionTier, { days: number; price: number; label: string }> = {
  '7_days': { days: 7, price: 150, label: '7 Days' },
  '14_days': { days: 14, price: 250, label: '14 Days' },
  '30_days': { days: 30, price: 450, label: '30 Days' }
};