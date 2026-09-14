// Platform commission on ride fares and marketplace order totals.
//
// Set to 0 deliberately — there is no business-approved commission
// rate to put here, and inventing one (10%? 15%? 20%?) would be just
// as fake as the placeholder pricing elsewhere in this codebase. At
// 0%, drivers/sellers are paid the full fare/total, same as the
// behavior this replaces, so turning this on later is a config change
// here, not a data-model or payout-flow change (see applyCommission
// below, which is already wired into every payout site).
//
// Once a real rate is decided, set PLATFORM_COMMISSION_RATE between 0
// and 1 (e.g. 0.15 for 15%) and every payout + the admin revenue
// breakdown will reflect it automatically.
const PLATFORM_COMMISSION_RATE = 0;

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
