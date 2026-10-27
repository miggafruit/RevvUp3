// Rewards programme settings. Everything here is a business decision — change
// the numbers here, nowhere else.
//
//  - Clients earn REWARD_RATE (2%) of what they pay at a PARTICIPATING seller
//    (a shop or provider that has an active R150/month membership).
//  - The reward is funded by RevvUp out of its 8% commission.
//  - Points are stored as whole points; 1 point is worth POINT_VALUE_RAND.
//  - Points can only be redeemed on SERVICES from participating service
//    providers.
const REWARD_RATE = 0.02;
const POINT_VALUE_RAND = 0.1; // 10 points = R1
const PROGRAMME_FEE_RAND = 150;
const PROGRAMME_PERIOD_DAYS = 30;
const REDEEMABLE_SELLER_ROLES = ['service_provider'];

const round2 = (n) => Math.round(n * 100) / 100;

// Whole points earned on an amount (rounded down — never over-credit).
const pointsForAmount = (amountRand) =>
  Math.max(0, Math.floor((amountRand * REWARD_RATE) / POINT_VALUE_RAND + 1e-9));

const pointsToRand = (points) => round2(points * POINT_VALUE_RAND);

const isRewardsActive = (user, now = new Date()) =>
  !!(user?.rewardsProgram?.activeUntil && new Date(user.rewardsProgram.activeUntil) > now);

module.exports = {
  REWARD_RATE,
  POINT_VALUE_RAND,
  PROGRAMME_FEE_RAND,
  PROGRAMME_PERIOD_DAYS,
  REDEEMABLE_SELLER_ROLES,
  pointsForAmount,
  pointsToRand,
  isRewardsActive,
  round2
};
