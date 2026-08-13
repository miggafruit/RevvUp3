const User = require('../models/User');
const Ride = require('../models/Ride');
const Delivery = require('../models/Delivery');
const Order = require('../models/Order');
const Product = require('../models/Product');
const Service = require('../models/Service');
const Promotion = require('../models/Promotion');
const PayoutEntry = require('../models/PayoutEntry');
const { sendPushNotifications } = require('../utils/pushNotifications');
const { clientRoomId } = require('../utils/socketHelpers');
const { buildSearchRegex } = require('../utils/searchHelpers');

// @route   GET /api/admin/kyc/queue
// @access  Private (admin only)
// Returns full KYC documents (including images) for every account with
// kycStatus: 'pending' — deliberately NOT going through toSafeObject(),
// which strips documents down to just a count, since an admin actually
// needs to see the images to review them.
const getKycQueue = async (req, res, next) => {
  try {
    const users = await User.find({ kycStatus: 'pending' })
      .select('name email phone role businessName businessAddress category kycDocuments createdAt')
      .sort({ createdAt: 1 }); // oldest first — first submitted, first reviewed

    res.status(200).json({ users });
  } catch (error) {
    next(error);
  }
};

// @route   GET /api/admin/kyc/:userId
// @access  Private (admin only)
// Full detail for one account's KYC submission — used when an admin
// taps into a specific queue item.
const getKycDetail = async (req, res, next) => {
  try {
    const user = await User.findById(req.params.userId).select(
      'name email phone role businessName businessAddress category kycDocuments kycStatus createdAt'
    );
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    res.status(200).json({ user });
  } catch (error) {
    next(error);
  }
};

// @route   PATCH /api/admin/kyc/:userId
// @access  Private (admin only)
// body: { status: 'approved' | 'rejected', note? }
const reviewKyc = async (req, res, next) => {
  try {
    const { status, note } = req.body;
    if (!['approved', 'rejected'].includes(status)) {
      return res.status(400).json({ message: "status must be 'approved' or 'rejected'" });
    }

    const user = await User.findById(req.params.userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    if (user.kycStatus !== 'pending') {
      return res.status(400).json({ message: `This account's KYC is already "${user.kycStatus}", not pending.` });
    }

    user.kycStatus = status;
    user.kycReviewNote = note || undefined;
    user.kycReviewedAt = new Date();
    user.kycReviewedBy = req.user._id;
    await user.save();

    sendPushNotifications([user], {
      title: status === 'approved' ? "You're verified!" : 'Verification update needed',
      body:
        status === 'approved'
          ? 'Your account is now verified and ready to accept jobs.'
          : "Your verification wasn't approved this time. Open the app to see why and resubmit.",
      data: { type: 'kyc_reviewed', status }
    });

    res.status(200).json({ user: user.toSafeObject() });
  } catch (error) {
    next(error);
  }
};

// @route   GET /api/admin/overview
// @access  Private (admin only)
// Cheap counts for a dashboard landing page — not meant to be a deep
// analytics endpoint, just "what needs my attention right now."
const getOverview = async (req, res, next) => {
  try {
    const [
      totalClients,
      totalShops,
      totalProviders,
      pendingKyc,
      activeRides,
      activeDeliveries,
      pendingOrders,
      totalProducts,
      totalServices
    ] = await Promise.all([
      User.countDocuments({ role: 'client' }),
      User.countDocuments({ role: 'shop' }),
      User.countDocuments({ role: 'service_provider' }),
      User.countDocuments({ kycStatus: 'pending' }),
      Ride.countDocuments({ status: { $in: ['pending', 'accepted', 'in_progress'] } }),
      Delivery.countDocuments({ status: { $in: ['pending', 'accepted', 'picked_up'] } }),
      Order.countDocuments({ status: 'pending' }),
      Product.countDocuments({ isActive: true }),
      Service.countDocuments({ isActive: true })
    ]);

    res.status(200).json({
      users: { clients: totalClients, shops: totalShops, serviceProviders: totalProviders },
      pendingKyc,
      activeRides,
      activeDeliveries,
      pendingOrders,
      totalProducts,
      totalServices
    });
  } catch (error) {
    next(error);
  }
};

// @route   GET /api/admin/users?role=&search=&page=&limit=
// @access  Private (admin only)
const getUsers = async (req, res, next) => {
  try {
    const { role, search, page = 1, limit = 20 } = req.query;
    const query = {};

    if (role && role !== 'all') {
      query.role = role;
    }
    if (search) {
      const regex = buildSearchRegex(search);
      query.$or = [{ name: regex }, { email: regex }, { businessName: regex }, { phone: regex }];
    }

    const pageNum = Math.max(parseInt(page, 10) || 1, 1);
    const limitNum = Math.min(Math.max(parseInt(limit, 10) || 20, 1), 50);

    const [users, total] = await Promise.all([
      User.find(query)
        .select('name email phone role businessName category isDriver roadsideServices kycStatus isOnline createdAt')
        .sort({ createdAt: -1 })
        .skip((pageNum - 1) * limitNum)
        .limit(limitNum),
      User.countDocuments(query)
    ]);

    res.status(200).json({
      users,
      pagination: { page: pageNum, limit: limitNum, total, pages: Math.ceil(total / limitNum) }
    });
  } catch (error) {
    next(error);
  }
};

// @route   GET /api/admin/users/:id
// @access  Private (admin only)
// Full detail, including active rides/orders — useful for support and
// dispute resolution, not just a bigger version of the list row.
const getUserDetail = async (req, res, next) => {
  try {
    const user = await User.findById(req.params.id).select('-password -refreshToken');
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const [rideCount, orderCount] = await Promise.all([
      Ride.countDocuments({ $or: [{ client: user._id }, { 'driver.driver_id': user._id }] }),
      Order.countDocuments({ $or: [{ client: user._id }, { 'items.sellerSnapshot': user._id }] })
    ]);

    res.status(200).json({ user, rideCount, orderCount });
  } catch (error) {
    next(error);
  }
};

// @route   GET /api/admin/rides?status=&page=&limit=
// @access  Private (admin only)
const getRides = async (req, res, next) => {
  try {
    const { status, page = 1, limit = 20 } = req.query;
    const query = {};
    if (status && status !== 'all') {
      query.status = status;
    }

    const pageNum = Math.max(parseInt(page, 10) || 1, 1);
    const limitNum = Math.min(Math.max(parseInt(limit, 10) || 20, 1), 50);

    const [rides, total] = await Promise.all([
      Ride.find(query)
        .sort({ createdAt: -1 })
        .skip((pageNum - 1) * limitNum)
        .limit(limitNum)
        .populate('client', 'name phone'),
      Ride.countDocuments(query)
    ]);

    res.status(200).json({
      rides,
      pagination: { page: pageNum, limit: limitNum, total, pages: Math.ceil(total / limitNum) }
    });
  } catch (error) {
    next(error);
  }
};

// @route   GET /api/admin/rides/:id
// @access  Private (admin only)
const getRideDetail = async (req, res, next) => {
  try {
    const ride = await Ride.findById(req.params.id).populate('client', 'name phone email');
    if (!ride) {
      return res.status(404).json({ message: 'Ride not found' });
    }
    res.status(200).json({ ride });
  } catch (error) {
    next(error);
  }
};

// @route   PATCH /api/admin/rides/:id/cancel
// @access  Private (admin only)
// body: { reason? }
// Deliberately separate from ehailingController.cancelRequest — that
// one enforces isClientOwner/isAssignedDriver, which don't apply here.
// An admin can cancel any ride regardless of who's on it, for support
// and dispute resolution.
const adminCancelRide = async (req, res, next) => {
  try {
    const ride = await Ride.findById(req.params.id).populate('client', 'name phone pushToken');
    if (!ride) {
      return res.status(404).json({ message: 'Ride not found' });
    }
    if (['completed', 'cancelled'].includes(ride.status)) {
      return res.status(400).json({ message: `Can't cancel from status "${ride.status}".` });
    }

    ride.status = 'cancelled';
    ride.cancelledBy = 'admin';
    ride.cancelReason = req.body.reason || 'Cancelled by an administrator.';
    await ride.save();

    if (ride.driver?.driver_id) {
      await User.findByIdAndUpdate(ride.driver.driver_id, { isAvailable: true });
    }

    const io = req.app.get('io');
    const clientId = clientRoomId(ride);
    if (io) {
      io.to(`client_${clientId}`).emit('assigned_request_cancelled', { request_id: ride._id.toString() });
      if (ride.driver?.driver_id) {
        io.to(`driver_${ride.driver.driver_id}`).emit('assigned_request_cancelled', { request_id: ride._id.toString() });
      }
    }
    sendPushNotifications([ride.client], {
      title: 'Request cancelled',
      body: 'This request was cancelled by support.',
      data: { type: 'request_cancelled', rideId: ride._id.toString() }
    });

    res.status(200).json({ ride });
  } catch (error) {
    next(error);
  }
};

// @route   GET /api/admin/orders?status=&page=&limit=
// @access  Private (admin only)
const getOrders = async (req, res, next) => {
  try {
    const { status, page = 1, limit = 20 } = req.query;
    const query = {};
    if (status && status !== 'all') {
      query.status = status;
    }

    const pageNum = Math.max(parseInt(page, 10) || 1, 1);
    const limitNum = Math.min(Math.max(parseInt(limit, 10) || 20, 1), 50);

    const [orders, total] = await Promise.all([
      Order.find(query)
        .sort({ createdAt: -1 })
        .skip((pageNum - 1) * limitNum)
        .limit(limitNum)
        .populate('client', 'name phone'),
      Order.countDocuments(query)
    ]);

    res.status(200).json({
      orders,
      pagination: { page: pageNum, limit: limitNum, total, pages: Math.ceil(total / limitNum) }
    });
  } catch (error) {
    next(error);
  }
};

// @route   GET /api/admin/orders/:id
// @access  Private (admin only)
const getOrderDetail = async (req, res, next) => {
  try {
    const order = await Order.findById(req.params.id).populate('client', 'name phone email');
    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }
    res.status(200).json({ order });
  } catch (error) {
    next(error);
  }
};

// @route   GET /api/admin/revenue
// @access  Private (admin only)
// Aggregates across the three places money actually changes hands:
// ride fares, order payments, and promotion payments. None of these
// models track a dedicated "paidAt" timestamp, so updatedAt is used as
// a proxy for when each became paid — reasonable in practice since
// setting paymentStatus: 'paid' is the last write in each flow, but
// worth knowing as an approximation, not an exact ledger.
const getRevenue = async (req, res, next) => {
  try {
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startOfWeek = new Date(startOfToday.getTime() - 6 * 24 * 60 * 60 * 1000);
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    const sumPaid = async (Model, amountField, since) => {
      const match = { paymentStatus: 'paid' };
      if (since) match.updatedAt = { $gte: since };
      const [result] = await Model.aggregate([
        { $match: match },
        { $group: { _id: null, total: { $sum: `$${amountField}` } } }
      ]);
      return result?.total || 0;
    };

    const [
      ridesTotal, ridesToday, ridesWeek, ridesMonth,
      ordersTotal, ordersToday, ordersWeek, ordersMonth,
      promotionsTotal, promotionsToday, promotionsWeek, promotionsMonth
    ] = await Promise.all([
      sumPaid(Ride, 'fare'), sumPaid(Ride, 'fare', startOfToday), sumPaid(Ride, 'fare', startOfWeek), sumPaid(Ride, 'fare', startOfMonth),
      sumPaid(Order, 'totalAmount'), sumPaid(Order, 'totalAmount', startOfToday), sumPaid(Order, 'totalAmount', startOfWeek), sumPaid(Order, 'totalAmount', startOfMonth),
      sumPaid(Promotion, 'price'), sumPaid(Promotion, 'price', startOfToday), sumPaid(Promotion, 'price', startOfWeek), sumPaid(Promotion, 'price', startOfMonth)
    ]);

    // 30-day daily series, one bucket per source, merged by date — for
    // a simple bar chart. No charting library, plain numbers the
    // frontend renders as CSS bars.
    const dailySeriesFor = async (Model, amountField) =>
      Model.aggregate([
        { $match: { paymentStatus: 'paid', updatedAt: { $gte: thirtyDaysAgo } } },
        {
          $group: {
            _id: { $dateToString: { format: '%Y-%m-%d', date: '$updatedAt' } },
            total: { $sum: `$${amountField}` }
          }
        }
      ]);

    const [rideSeries, orderSeries, promotionSeries] = await Promise.all([
      dailySeriesFor(Ride, 'fare'),
      dailySeriesFor(Order, 'totalAmount'),
      dailySeriesFor(Promotion, 'price')
    ]);

    const dailyMap = {};
    [rideSeries, orderSeries, promotionSeries].forEach((series) => {
      series.forEach((day) => {
        dailyMap[day._id] = (dailyMap[day._id] || 0) + day.total;
      });
    });
    const dailySeries = Object.entries(dailyMap)
      .map(([date, total]) => ({ date, total }))
      .sort((a, b) => a.date.localeCompare(b.date));

    res.status(200).json({
      total: ridesTotal + ordersTotal + promotionsTotal,
      today: ridesToday + ordersToday + promotionsToday,
      week: ridesWeek + ordersWeek + promotionsWeek,
      month: ridesMonth + ordersMonth + promotionsMonth,
      bySource: {
        rides: ridesTotal,
        orders: ordersTotal,
        promotions: promotionsTotal
      },
      dailySeries
    });
  } catch (error) {
    next(error);
  }
};

// @route   GET /api/admin/payouts
// @access  Private (admin only)
// Grouped by recipient — an admin doing an actual payout run thinks
// in terms of "how much do I owe this person in total," not
// individual ride/order entries one at a time.
const getPayoutSummary = async (req, res, next) => {
  try {
    const summary = await PayoutEntry.aggregate([
      { $match: { status: 'owed' } },
      { $group: { _id: '$recipient', totalOwed: { $sum: '$amount' }, entryCount: { $sum: 1 } } },
      { $sort: { totalOwed: -1 } }
    ]);

    const recipientIds = summary.map((s) => s._id);
    const users = await User.find({ _id: { $in: recipientIds } }).select('name email phone role businessName');
    const userMap = new Map(users.map((u) => [u._id.toString(), u]));

    const result = summary.map((s) => ({
      recipient: userMap.get(s._id.toString()) || null,
      recipientId: s._id,
      totalOwed: s.totalOwed,
      entryCount: s.entryCount
    }));

    res.status(200).json({ payouts: result });
  } catch (error) {
    next(error);
  }
};

// @route   GET /api/admin/payouts/:recipientId
// @access  Private (admin only)
const getPayoutDetail = async (req, res, next) => {
  try {
    const recipient = await User.findById(req.params.recipientId).select('name email phone role businessName');
    if (!recipient) {
      return res.status(404).json({ message: 'User not found' });
    }
    const entries = await PayoutEntry.find({ recipient: req.params.recipientId }).sort({ createdAt: -1 });
    res.status(200).json({ recipient, entries });
  } catch (error) {
    next(error);
  }
};

// @route   PATCH /api/admin/payouts/:recipientId/mark-paid
// @access  Private (admin only)
// body: { note? }
// Marks every currently-owed entry for this recipient as paid, in one
// action — matching how an actual payout run works (you send someone
// their outstanding balance as one transfer, not one line item at a
// time). This is a record of a transfer that already happened outside
// the app, not a trigger for one.
const markPayoutsPaid = async (req, res, next) => {
  try {
    const { note } = req.body;
    const result = await PayoutEntry.updateMany(
      { recipient: req.params.recipientId, status: 'owed' },
      { status: 'paid', paidAt: new Date(), paidBy: req.user._id, note: note || undefined }
    );

    if (result.matchedCount === 0) {
      return res.status(400).json({ message: 'Nothing currently owed to this recipient.' });
    }

    res.status(200).json({ updatedCount: result.modifiedCount });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getKycQueue,
  getKycDetail,
  reviewKyc,
  getOverview,
  getUsers,
  getUserDetail,
  getRides,
  getRideDetail,
  adminCancelRide,
  getOrders,
  getOrderDetail,
  getRevenue,
  getPayoutSummary,
  getPayoutDetail,
  markPayoutsPaid
};
