const Order = require('../models/Order');
const User = require('../models/User');
const { createPayoutEntry } = require('../utils/payouts');
const { sendPushNotifications } = require('../utils/pushNotifications');
const { awardPointsForOrder } = require('./rewardsService');
const { round2 } = require('../config/rewards');

// Seller dashboards listen for this on their personal socket room and refetch,
// so the earnings tab updates the moment a sale is final.
const emitEarningsUpdated = (io, recipientId, extra = {}) => {
  if (!recipientId) return;
  io?.to(`client_${recipientId}`).emit('earnings_updated', { at: new Date().toISOString(), ...extra });
};

/**
 * A SERVICE order becomes final only when BOTH sides have confirmed it
 * (provider: "job done" [+ cash received], client: "yes it was done" [+ cash
 * paid]). Then, exactly once:
 *   - status -> completed, paymentStatus -> paid
 *   - the provider's ledger entry is created (8% commission taken; for cash
 *     jobs the cash they already hold is netted off, so they owe RevvUp the
 *     commission)
 *   - the client's rewards points are awarded
 *   - both sides are notified live
 */
const finalizeServiceOrder = async (orderId, io) => {
  // Atomic claim: only one caller can finalize.
  const order = await Order.findOneAndUpdate(
    { _id: orderId, finalizedAt: { $exists: false }, providerCompletedAt: { $exists: true }, clientConfirmedAt: { $exists: true } },
    { $set: { status: 'completed', paymentStatus: 'paid', finalizedAt: new Date() } },
    { new: true }
  );
  if (!order) return null;

  const sellerId = order.items[0]?.sellerSnapshot;
  const amountDue = order.amountDue ?? order.totalAmount;
  const cashHeld = order.paymentMethod === 'cash' ? amountDue : 0;

  await createPayoutEntry({
    recipient: sellerId,
    amount: order.totalAmount, // no delivery fee on service-only orders
    sourceType: cashHeld > 0 ? 'cash_settlement' : 'order_seller_share',
    sourceId: order._id,
    cashHeld
  });

  const points = await awardPointsForOrder(order, io);

  emitEarningsUpdated(io, sellerId, { orderId: order._id.toString() });
  io?.to(`client_${order.client}`).emit('order_finalized', { orderId: order._id.toString(), points });

  const [seller, client] = await Promise.all([
    User.findById(sellerId).select('pushToken'),
    User.findById(order.client).select('pushToken')
  ]);
  if (seller) {
    sendPushNotifications([seller], {
      title: 'Sale completed',
      body: `Both sides confirmed R${round2(order.totalAmount)} — it's now in your earnings.`,
      data: { type: 'earnings_updated', orderId: order._id.toString() }
    });
  }
  if (client && !points) {
    sendPushNotifications([client], {
      title: 'Service completed',
      body: 'Thanks for confirming — you can now rate your provider.',
      data: { type: 'order_status_changed', orderId: order._id.toString(), status: 'completed' }
    });
  }
  return order;
};

// Product orders are final when the driver delivers with the client's code
// (that code IS the client's confirmation). The seller/driver payout entries
// are created in deliveryController; this adds the shared follow-ups.
const afterProductDelivered = async (order, io, { driverId } = {}) => {
  if (!order) return;
  await awardPointsForOrder(order, io);
  emitEarningsUpdated(io, order.items[0]?.sellerSnapshot, { orderId: order._id.toString() });
  if (driverId) emitEarningsUpdated(io, driverId, { orderId: order._id.toString() });
  io?.to(`client_${order.client}`).emit('order_finalized', { orderId: order._id.toString() });
};

module.exports = { finalizeServiceOrder, afterProductDelivered, emitEarningsUpdated };
