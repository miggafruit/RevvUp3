// Delivery fee = tier base fee + (tier rate per km x road distance from the
// shop to the drop-off address). The tier is picked from the TOTAL weight of
// the physical products in the order (weightKg x quantity, summed).
//
//   Tier 1: under 8 kg            R35 base + R5/km
//   Tier 2: 8 kg up to 35 kg      R50 base + R7/km
//   Tier 3: above 35 kg           R80 base + R10/km
//
// Boundaries: exactly 8 kg is Tier 2; exactly 35 kg is still Tier 2
// ("above 35 kg" is Tier 3). Services never trigger delivery, so they carry
// no delivery fee.
const DELIVERY_TIERS = [
  { tier: 1, label: 'Under 8 kg', maxKgExclusive: 8, baseFee: 35, perKm: 5 },
  { tier: 2, label: '8 kg to 35 kg', maxKgInclusive: 35, baseFee: 50, perKm: 7 },
  { tier: 3, label: 'Over 35 kg', baseFee: 80, perKm: 10 }
];

const getWeightTier = (totalKg) => {
  if (totalKg < 8) return DELIVERY_TIERS[0];
  if (totalKg <= 35) return DELIVERY_TIERS[1];
  return DELIVERY_TIERS[2];
};

// Rounded to the nearest cent so the Paystack amount (in cents) is exact.
const calculateDeliveryFee = (totalKg, distanceKm) => {
  const tier = getWeightTier(totalKg);
  const fee = tier.baseFee + tier.perKm * distanceKm;
  return {
    tier: tier.tier,
    tierLabel: tier.label,
    baseFee: tier.baseFee,
    perKm: tier.perKm,
    fee: Math.round(fee * 100) / 100
  };
};

module.exports = { DELIVERY_TIERS, getWeightTier, calculateDeliveryFee };
