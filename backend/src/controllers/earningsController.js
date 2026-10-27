const mongoose = require('mongoose');
const PayoutEntry = require('../models/PayoutEntry');
const Order = require('../models/Order');

const startOf = (unit) => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  if (unit === 'week') d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); // Monday
  if (unit === 'month') d.setDate(1);
  return d;
};

// @route   GET /api/earnings/summary
// @access  Private (shop / service_provider — drivers included)
//
// Everything is derived from the payout ledger, which is only written when a
// sale is FINAL (client AND provider/driver both confirmed), so these numbers
// move exactly when a sale truly completes.
//  - netEarned:     what you've made after RevvUp's 8%
//  - dueNow:        what RevvUp still owes you at the next settlement (can be
//                   negative if you collected cash and owe commission)
//  - paidOut:       already settled to your bank account
//  - cashCommissionOwed: 8% you owe on jobs you were paid for in cash
const getSummary = async (req, res, next) => {
  try {
    const me = new mongoose.Types.ObjectId(req.user._id);

    const [totals, byStatus, periods, recent, pendingOrders] = await Promise.all([
      PayoutEntry.aggregate([
        { $match: { recipient: me } },
        {
          $group: {
            _id: null,
            gross: { $sum: { $ifNull: ['$grossAmount', '$amount'] } },
            commission: { $sum: { $ifNull: ['$platformCut', 0] } },
            net: { $sum: '$amount' },
            count: { $sum: 1 }
          }
        }
      ]),
      PayoutEntry.aggregate([
        { $match: { recipient: me } },
        { $group: { _id: '$status', total: { $sum: '$amount' } } }
      ]),
      Promise.all(
        ['today', 'week', 'month'].map(async (unit) => {
          const [r] = await PayoutEntry.aggregate([
            { $match: { recipient: me, createdAt: { $gte: startOf(unit === 'today' ? 'day' : unit) } } },
            { $group: { _id: null, gross: { $sum: { $ifNull: ['$grossAmount', '$amount'] } }, net: { $sum: '$amount' } } }
          ]);
          return [unit, { gross: r?.gross || 0, net: r?.net || 0 }];
        })
      ),
      PayoutEntry.find({ recipient: me }).sort({ createdAt: -1 }).limit(40),
      // Work in progress: accepted jobs that are not final yet.
      Order.find({
        'items.sellerSnapshot': me,
        status: 'confirmed',
        finalizedAt: { $exists: false }
      })
        .select('totalAmount deliveryFee amountDue paymentMethod providerCompletedAt clientConfirmedAt items.itemType createdAt')
        .sort({ createdAt: -1 })
        .limit(30)
    ]);

    const owed = byStatus.find((s) => s._id === 'owed')?.total || 0;
    const paid = byStatus.find((s) => s._id === 'paid')?.total || 0;

    const cashOwedRows = await PayoutEntry.aggregate([
      { $match: { recipient: me, sourceType: 'cash_settlement', status: 'owed', amount: { $lt: 0 } } },
      { $group: { _id: null, total: { $sum: '$amount' } } }
    ]);

    // Resolve the order behind each ledger row for a human-readable list.
    const orderIds = recent.filter((r) => r.sourceType !== 'ride_fare').map((r) => r.sourceId);
    const orders = await Order.find({ _id: { $in: orderIds } }).select('paymentMethod items.nameSnapshot totalAmount');
    const orderMap = new Map(orders.map((o) => [o._id.toString(), o]));

    const round = (n) => Math.round((n || 0) * 100) / 100;
    res.status(200).json({
      totals: {
        grossSales: round(totals[0]?.gross),
        commission: round(totals[0]?.commission),
        netEarned: round(totals[0]?.net),
        completedSales: totals[0]?.count || 0
      },
      dueNow: round(owed),
      paidOut: round(paid),
      cashCommissionOwed: round(Math.abs(cashOwedRows[0]?.total || 0)),
      periods: Object.fromEntries(periods.map(([k, v]) => [k, { gross: round(v.gross), net: round(v.net) }])),
      inProgress: pendingOrders.map((o) => ({
        orderId: o._id,
        amount: round(o.totalAmount - (o.deliveryFee || 0)),
        paymentMethod: o.paymentMethod,
        waitingFor: !o.providerCompletedAt ? 'provider' : 'client'
      })),
      recent: recent.map((r) => {
        const order = orderMap.get(r.sourceId.toString());
        return {
          id: r._id,
          sourceType: r.sourceType,
          description:
            r.sourceType === 'cash_settlement'
              ? 'Cash job — commission due'
              : r.sourceType === 'delivery_fee'
              ? 'Delivery'
              : r.sourceType === 'ride_fare'
              ? 'Roadside job'
              : order?.items?.map((i) => i.nameSnapshot).join(', ') || 'Sale',
          paymentMethod: order?.paymentMethod,
          gross: round(r.grossAmount ?? r.amount),
          commission: round(r.platformCut),
          cashHeld: round(r.cashHeld),
          net: round(r.amount),
          status: r.status,
          createdAt: r.createdAt
        };
      })
    });
  } catch (error) {
    next(error);
  }
};

module.exports = { getSummary };
