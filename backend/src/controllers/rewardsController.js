const User = require('../models/User');
const RewardTransaction = require('../models/RewardTransaction');
const RewardsPayment = require('../models/RewardsPayment');
const { verifyPaystackTransaction } = require('../utils/paystack');
const { amountMatchesExpected } = require('../utils/paymentVerification');
const { isTestReference, isTestPaymentAllowedFor, buildTestVerification } = require('../utils/testPayments');
const { reportSilentFailure } = require('../utils/reportSilentFailure');
const {
  REWARD_RATE,
  POINT_VALUE_RAND,
  PROGRAMME_FEE_RAND,
  PROGRAMME_PERIOD_DAYS,
  pointsToRand,
  isRewardsActive
} = require('../config/rewards');

const DAY_MS = 24 * 60 * 60 * 1000;

// @route   GET /api/rewards/summary
// @access  Private (any logged-in user; clients are the main audience)
// Balance, recent activity, and any 'earn' rows whose celebration the app has
// not shown yet (so a celebration is never lost if the live event was missed).
const getSummary = async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id).select('rewardPoints');
    const [recent, unseen] = await Promise.all([
      RewardTransaction.find({ user: req.user._id }).sort({ createdAt: -1 }).limit(30),
      RewardTransaction.find({ user: req.user._id, type: 'earn', seenAt: { $exists: false } }).sort({ createdAt: 1 }).limit(10)
    ]);
    const points = user?.rewardPoints || 0;
    res.status(200).json({
      points,
      valueRand: pointsToRand(points),
      pointValueRand: POINT_VALUE_RAND,
      rewardRate: REWARD_RATE,
      recent,
      unseen
    });
  } catch (error) {
    next(error);
  }
};

// @route   POST /api/rewards/seen
// body: { ids: [transactionId] }
const markSeen = async (req, res, next) => {
  try {
    const ids = Array.isArray(req.body.ids) ? req.body.ids : [];
    await RewardTransaction.updateMany({ _id: { $in: ids }, user: req.user._id }, { $set: { seenAt: new Date() } });
    res.status(200).json({ success: true });
  } catch (error) {
    next(error);
  }
};

// @route   GET /api/rewards/program
// @access  Private (shop / service_provider)
const getProgram = async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id).select('rewardsProgram');
    const history = await RewardsPayment.find({ seller: req.user._id }).sort({ createdAt: -1 }).limit(12);
    res.status(200).json({
      active: isRewardsActive(user),
      activeUntil: user.rewardsProgram?.activeUntil || null,
      feeRand: PROGRAMME_FEE_RAND,
      periodDays: PROGRAMME_PERIOD_DAYS,
      rewardRate: REWARD_RATE,
      history
    });
  } catch (error) {
    next(error);
  }
};

// @route   POST /api/rewards/program/pay
// @access  Private (shop / service_provider)
// body: { paymentReference }
// Buys (or renews) one membership period. Renewing early ADDS time on to the
// current expiry, so nobody loses days by paying early.
const payForProgram = async (req, res, next) => {
  try {
    const { paymentReference } = req.body;
    if (!paymentReference) return res.status(400).json({ message: 'Payment reference is required' });

    let verification;
    if (isTestReference(paymentReference)) {
      if (!isTestPaymentAllowedFor(req.user)) {
        return res.status(403).json({ message: 'Test payments are not enabled for this account.' });
      }
      verification = buildTestVerification('rewardsSellerId', req.user._id, PROGRAMME_FEE_RAND);
    } else {
      try {
        verification = await verifyPaystackTransaction(paymentReference);
      } catch (verifyError) {
        reportSilentFailure(verifyError, 'paystack-verification', { rewardsSeller: String(req.user._id), paymentReference });
        return res.status(402).json({ message: 'Could not verify payment. Please try again.' });
      }
    }

    if (!verification || verification.status !== 'success') {
      return res.status(402).json({ message: 'Payment was not successful' });
    }
    if (verification.metadata?.rewardsSellerId !== req.user._id.toString()) {
      return res.status(402).json({ message: 'This payment reference does not match your account.' });
    }
    if (!amountMatchesExpected(verification.amount, PROGRAMME_FEE_RAND)) {
      return res.status(402).json({ message: `The payment amount must be R${PROGRAMME_FEE_RAND}.` });
    }

    const user = await User.findById(req.user._id).select('rewardsProgram');
    const now = new Date();
    const start = isRewardsActive(user, now) ? new Date(user.rewardsProgram.activeUntil) : now;
    const end = new Date(start.getTime() + PROGRAMME_PERIOD_DAYS * DAY_MS);

    try {
      await RewardsPayment.create({
        seller: req.user._id,
        amount: PROGRAMME_FEE_RAND,
        paymentReference,
        periodStart: start,
        periodEnd: end
      });
    } catch (err) {
      if (err.code === 11000) return res.status(400).json({ message: 'This payment has already been used.' });
      throw err;
    }

    user.rewardsProgram = { activeUntil: end };
    await user.save();

    res.status(200).json({ active: true, activeUntil: end });
  } catch (error) {
    next(error);
  }
};

module.exports = { getSummary, markSeen, getProgram, payForProgram };
