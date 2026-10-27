const PayoutEntry = require('../models/PayoutEntry');
const { applyCommission } = require('../config/commission');
const { reportSilentFailure } = require('./reportSilentFailure');

/**
 * Creates a payout ledger entry from a gross amount, deducting
 * platform commission first (see config/commission.js — currently 0%,
 * so amount === grossAmount until a real rate is set). Never throws —
 * same principle as sendPushNotifications: a bookkeeping side-effect
 * should never be able to break the actual ride/order/delivery flow
 * it's attached to. Silently no-ops on a duplicate (the unique index
 * on sourceType + sourceId + recipient already prevents
 * double-crediting the same event twice — this just means a retried
 * request doesn't crash instead of being correctly ignored).
 */
const createPayoutEntry = async ({ recipient, amount: grossAmount, sourceType, sourceId, cashHeld = 0 }) => {
  if (!grossAmount || grossAmount <= 0) return; // nothing owed, nothing to record
  const { platformCut, payoutAmount: afterCommission } = applyCommission(grossAmount);
  // If the provider already took cash from the client, that cash is netted off
  // what RevvUp owes them. A cash job therefore usually becomes a NEGATIVE
  // entry (the provider owes RevvUp its commission).
  const payoutAmount = Math.round((afterCommission - cashHeld) * 100) / 100;
  if (payoutAmount === 0) return;
  if (payoutAmount < 0 && !cashHeld) return;
  try {
    await PayoutEntry.create({
      recipient,
      amount: payoutAmount,
      grossAmount,
      platformCut,
      cashHeld: cashHeld || undefined,
      sourceType,
      sourceId
    });
  } catch (err) {
    if (err.code !== 11000) {
      console.warn('[payouts] Failed to create payout entry:', err.message);
      // This is real money the platform now silently doesn't know it
      // owes someone — a driver/seller could complete real work and
      // never get paid because this write failed, with no trace of it
      // anywhere except this log line. Reported with full context so
      // the specific missing entry can be manually recreated once
      // someone's alerted, rather than only discovered by a future
      // audit (or a driver complaint) with no idea what amount is missing.
      reportSilentFailure(err, 'payouts', { recipient, sourceType, sourceId, payoutAmount, platformCut });
    }
  }
};

module.exports = { createPayoutEntry };
