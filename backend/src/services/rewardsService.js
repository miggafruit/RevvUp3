const User = require('../models/User');
const RewardTransaction = require('../models/RewardTransaction');
const { pointsForAmount, pointsToRand, round2 } = require('../config/rewards');
const { sendPushNotifications } = require('../utils/pushNotifications');
const { reportSilentFailure } = require('../utils/reportSilentFailure');

const sellerOf = (order) => order.items[0]?.sellerSnapshot;

// Takes points off the client's balance in ONE atomic database step, and only
// if they have enough — two simultaneous checkouts can never spend the same
// points twice. Returns false when the balance is too low.
const reservePoints = async (userId, points) => {
  if (!points || points <= 0) return true;
  const updated = await User.findOneAndUpdate(
    { _id: userId, rewardPoints: { $gte: points } },
    { $inc: { rewardPoints: -points } },
    { new: true }
  ).select('rewardPoints');
  return !!updated;
};

const giveBackPoints = async (userId, points) => {
  if (!points || points <= 0) return;
  await User.findByIdAndUpdate(userId, { $inc: { rewardPoints: points } });
};

// Ledger row for points spent on an order (created once the order exists).
const recordRedemption = async (order, sellerName) => {
  if (!order.pointsRedeemed) return;
  try {
    const user = await User.findById(order.client).select('rewardPoints');
    await RewardTransaction.create({
      user: order.client,
      type: 'redeem',
      points: order.pointsRedeemed,
      valueRand: order.pointsValue,
      order: order._id,
      seller: sellerOf(order),
      sellerName,
      balanceAfter: user?.rewardPoints
    });
  } catch (err) {
    if (err.code !== 11000) reportSilentFailure(err, 'rewards-redeem-ledger', { orderId: String(order._id) });
  }
};

// Declined / cancelled before the work happened: points go back, once.
const refundRedemption = async (order) => {
  if (!order.pointsRedeemed) return;
  try {
    await RewardTransaction.create({
      user: order.client,
      type: 'redeem_refund',
      points: order.pointsRedeemed,
      valueRand: order.pointsValue,
      order: order._id,
      seller: sellerOf(order)
    });
  } catch (err) {
    if (err.code === 11000) return; // already refunded
    throw err;
  }
  await giveBackPoints(order.client, order.pointsRedeemed);
};

// Called once an order is FINAL (both sides confirmed / delivered). Credits the
// client with 2% back if the seller was in the programme when they ordered.
const awardPointsForOrder = async (order, io) => {
  if (!order.rewardsEligible) return 0;
  const itemsSubtotal = round2(order.totalAmount - (order.deliveryFee || 0));
  const base = Math.max(0, round2(itemsSubtotal - (order.pointsValue || 0)));
  const points = pointsForAmount(base);
  if (points <= 0) return 0;

  let tx;
  try {
    const seller = await User.findById(sellerOf(order)).select('businessName name');
    tx = await RewardTransaction.create({
      user: order.client,
      type: 'earn',
      points,
      valueRand: pointsToRand(points),
      order: order._id,
      seller: sellerOf(order),
      sellerName: seller?.businessName || seller?.name
    });
  } catch (err) {
    if (err.code === 11000) return 0; // already awarded
    reportSilentFailure(err, 'rewards-award', { orderId: String(order._id) });
    return 0;
  }

  const client = await User.findByIdAndUpdate(order.client, { $inc: { rewardPoints: points } }, { new: true }).select(
    'rewardPoints pushToken'
  );
  tx.balanceAfter = client?.rewardPoints;
  await tx.save();
  order.pointsEarned = points;
  await order.save();

  io?.to(`client_${order.client}`).emit('points_earned', {
    transactionId: tx._id.toString(),
    orderId: order._id.toString(),
    points,
    valueRand: tx.valueRand,
    balance: client?.rewardPoints,
    sellerName: tx.sellerName
  });
  if (client) {
    sendPushNotifications([client], {
      title: `🎉 You earned ${points} points!`,
      body: `That's R${tx.valueRand.toFixed(2)} back. You now have ${client.rewardPoints} points to spend with participating providers.`,
      data: { type: 'points_earned', orderId: order._id.toString() }
    });
  }
  return points;
};

module.exports = { reservePoints, giveBackPoints, recordRedemption, refundRedemption, awardPointsForOrder };
