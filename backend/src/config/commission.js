// Platform commission on ride fares, delivery fees and marketplace order
// totals: 8%, as decided by the business. Applied at the single choke point
// (applyCommission) that every payout site goes through, for card AND cash
// orders. Set PLATFORM_COMMISSION_RATE in the environment (0-1) only if the
// rate ever has to change without a redeploy of code.
const envRate = parseFloat(process.env.PLATFORM_COMMISSION_RATE);
const PLATFORM_COMMISSION_RATE = Number.isFinite(envRate) && envRate >= 0 && envRate < 1 ? envRate : 0.08;

/**
 * Splits a gross amount into what the platform keeps and what actually
 * gets paid out to the driver/seller. Rounded to the nearest cent
 * (2 decimal places) so payoutAmount + platformCut always reconciles
 * exactly back to grossAmount.
 */
const applyCommission = (grossAmount) => {
  const platformCut = Math.round(grossAmount * PLATFORM_COMMISSION_RATE * 100) / 100;
  const payoutAmount = Math.round((grossAmount - platformCut) * 100) / 100;
  return { grossAmount, platformCut, payoutAmount };
};

module.exports = { PLATFORM_COMMISSION_RATE, applyCommission };
