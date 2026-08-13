const PayoutEntry = require('../models/PayoutEntry');

/**
 * Creates a payout ledger entry. Never throws — same principle as
 * sendPushNotifications: a bookkeeping side-effect should never be
 * able to break the actual ride/order/delivery flow it's attached to.
 * Silently no-ops on a duplicate (the unique index on sourceType +
 * sourceId + recipient already prevents double-crediting the same
 * event twice — this just means a retried request doesn't crash
 * instead of being correctly ignored).
 */
const createPayoutEntry = async ({ recipient, amount, sourceType, sourceId }) => {
  if (!amount || amount <= 0) return; // nothing owed, nothing to record
  try {
    await PayoutEntry.create({ recipient, amount, sourceType, sourceId });
  } catch (err) {
    if (err.code !== 11000) {
      console.warn('[payouts] Failed to create payout entry:', err.message);
    }
  }
};

module.exports = { createPayoutEntry };
