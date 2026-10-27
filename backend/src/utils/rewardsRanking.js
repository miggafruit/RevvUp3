const User = require('../models/User');

// Rewards-programme sellers are listed FIRST, everyone else after, and
// pagination stays correct across the boundary (page 2 may start in the middle
// of the participants or in the rest).
const activeRewardsSellerIds = () =>
  User.find({ 'rewardsProgram.activeUntil': { $gt: new Date() } }).distinct('_id');

/**
 * runFind(filter, skip, limit) -> array of docs
 * runCount(filter) -> number
 * Returns { items: [{ doc, rewardsActive }], total }.
 */
const rankedPage = async ({ runFind, runCount, filterA, filterB, skip, limit }) => {
  const [countA, countB] = await Promise.all([runCount(filterA), runCount(filterB)]);
  let items = [];
  if (skip < countA) {
    const docsA = await runFind(filterA, skip, limit);
    items = docsA.map((doc) => ({ doc, rewardsActive: true }));
  }
  if (items.length < limit) {
    const skipB = Math.max(0, skip - countA);
    const docsB = await runFind(filterB, skipB, limit - items.length);
    items = items.concat(docsB.map((doc) => ({ doc, rewardsActive: false })));
  }
  return { items, total: countA + countB };
};

// Splits a query whose `field` is { $in: ids } into participant / non-participant halves.
const splitBySeller = (query, field, rewardIds) => {
  const rewardSet = new Set(rewardIds.map(String));
  const ids = query[field].$in;
  return {
    filterA: { ...query, [field]: { $in: ids.filter((id) => rewardSet.has(String(id))) } },
    filterB: { ...query, [field]: { $in: ids.filter((id) => !rewardSet.has(String(id))) } }
  };
};

// For User queries (shops / providers list).
const splitUsers = (query) => {
  const now = new Date();
  return {
    filterA: { ...query, 'rewardsProgram.activeUntil': { $gt: now } },
    filterB: { ...query, $nor: [...(query.$nor || []), { 'rewardsProgram.activeUntil': { $gt: now } }] }
  };
};

const isActiveDoc = (user) => !!(user?.rewardsProgram?.activeUntil && new Date(user.rewardsProgram.activeUntil) > new Date());

module.exports = { activeRewardsSellerIds, rankedPage, splitBySeller, splitUsers, isActiveDoc };
