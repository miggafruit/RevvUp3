const Rating = require('../models/Rating');
const Order = require('../models/Order');
const Product = require('../models/Product');
const Service = require('../models/Service');

// Recomputes ratingAverage/ratingCount from the actual Rating documents
// rather than incrementing a running average on every new rating — an
// incremental update is one bug away from drifting from reality
// forever (e.g. a rating edited or deleted later), a fresh aggregate
// can't drift since it's always derived from the current real data.
const recalculateAggregate = async (itemType, itemId) => {
  const Model = itemType === 'product' ? Product : Service;
  const field = itemType === 'product' ? 'product' : 'service';

  const [result] = await Rating.aggregate([
    { $match: { [field]: itemId } },
    { $group: { _id: null, avg: { $avg: '$rating' }, count: { $sum: 1 } } }
  ]);

  await Model.findByIdAndUpdate(itemId, {
    ratingAverage: result ? Math.round(result.avg * 10) / 10 : 0,
    ratingCount: result ? result.count : 0
  });
};

// @route   POST /api/ratings
// @access  Private (client only)
// body: { orderId, itemType, itemId, rating, comment? }
const createRating = async (req, res, next) => {
  try {
    const { orderId, itemType, itemId, rating, comment } = req.body;

    if (!orderId || !itemType || !itemId || !rating) {
      return res.status(400).json({ message: 'orderId, itemType, itemId, and rating are required.' });
    }
    if (!['product', 'service'].includes(itemType)) {
      return res.status(400).json({ message: 'itemType must be "product" or "service".' });
    }
    const ratingNum = Number(rating);
    if (!Number.isInteger(ratingNum) || ratingNum < 1 || ratingNum > 5) {
      return res.status(400).json({ message: 'rating must be a whole number from 1 to 5.' });
    }

    const order = await Order.findById(orderId);
    if (!order) {
      return res.status(404).json({ message: 'Order not found.' });
    }
    if (order.client.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'You do not have permission to rate items on this order.' });
    }
    if (order.status !== 'completed') {
      return res.status(400).json({ message: 'You can only rate items from a completed order.' });
    }

    const orderItem = order.items.find(
      (item) =>
        item.itemType === itemType &&
        (itemType === 'product' ? item.product : item.service)?.toString() === itemId
    );
    if (!orderItem) {
      return res.status(400).json({ message: "This item isn't part of that order." });
    }

    let ratingDoc;
    try {
      ratingDoc = await Rating.create({
        client: req.user._id,
        order: orderId,
        itemType,
        [itemType]: itemId,
        seller: orderItem.sellerSnapshot,
        rating: ratingNum,
        comment: comment?.trim() || undefined
      });
    } catch (err) {
      if (err.code === 11000) {
        return res.status(409).json({ message: "You've already rated this item for this order." });
      }
      throw err;
    }

    await recalculateAggregate(itemType, itemId);

    res.status(201).json({ rating: ratingDoc });
  } catch (error) {
    next(error);
  }
};

// @route   GET /api/ratings?product=&service=&page=&limit=
// @access  Public
const getRatings = async (req, res, next) => {
  try {
    const { product, service, page = 1, limit = 20 } = req.query;
    if (!product && !service) {
      return res.status(400).json({ message: 'A product or service id is required.' });
    }

    const query = product ? { itemType: 'product', product } : { itemType: 'service', service };
    const pageNum = Math.max(parseInt(page, 10) || 1, 1);
    const limitNum = Math.min(Math.max(parseInt(limit, 10) || 20, 1), 50);

    const [ratings, total] = await Promise.all([
      Rating.find(query)
        .select('rating comment createdAt client')
        .populate('client', 'name')
        .sort({ createdAt: -1 })
        .skip((pageNum - 1) * limitNum)
        .limit(limitNum),
      Rating.countDocuments(query)
    ]);

    res.status(200).json({
      ratings,
      pagination: { page: pageNum, limit: limitNum, total, pages: Math.ceil(total / limitNum) }
    });
  } catch (error) {
    next(error);
  }
};

// @route   GET /api/ratings/mine?order=X
// @access  Private (client only)
// Lets the mobile app know which items on a specific order this client
// has already rated, so it can hide/disable "rate this" for items
// that are done rather than let a doomed submission hit the unique
// index and surface a confusing error.
const getMyRatingsForOrder = async (req, res, next) => {
  try {
    const { order } = req.query;
    if (!order) {
      return res.status(400).json({ message: 'An order id is required.' });
    }
    const ratings = await Rating.find({ client: req.user._id, order }).select('itemType product service rating');
    res.status(200).json({ ratings });
  } catch (error) {
    next(error);
  }
};

module.exports = { createRating, getRatings, getMyRatingsForOrder };
