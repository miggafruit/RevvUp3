const Promotion = require('../models/Promotion');
const PROMOTION_TIERS = require('../config/promotionTiers');
const { verifyPaystackTransaction } = require('../utils/paystack');
const { buildSearchRegex } = require('../utils/searchHelpers');

// @route   POST /api/promotions
// @access  Private (shop or service_provider)
// body: { title, description, image?, tier }
const createPromotion = async (req, res, next) => {
  try {
    const { title, description, image, tier } = req.body;

    if (!title || !title.trim()) {
      return res.status(400).json({ message: 'Please provide a title' });
    }
    if (!description || !description.trim()) {
      return res.status(400).json({ message: 'Please provide a description' });
    }
    if (!PROMOTION_TIERS[tier]) {
      return res.status(400).json({ message: 'Please select a valid duration' });
    }

    const promotion = await Promotion.create({
      seller: req.user._id,
      sellerRole: req.user.role,
      title: title.trim(),
      description: description.trim(),
      image: image || undefined,
      tier,
      price: PROMOTION_TIERS[tier].price, // server-computed, never trusts client
      paymentStatus: 'pending'
    });

    res.status(201).json({ promotion });
  } catch (error) {
    next(error);
  }
};

// @route   POST /api/promotions/:id/pay
// @access  Private (owner only)
// body: { paymentReference }
const payPromotion = async (req, res, next) => {
  try {
    const { paymentReference } = req.body;
    if (!paymentReference) {
      return res.status(400).json({ message: 'Payment reference is required' });
    }

    const promotion = await Promotion.findById(req.params.id);
    if (!promotion) {
      return res.status(404).json({ message: 'Promotion not found' });
    }

    if (promotion.seller.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'You do not have permission to pay for this promotion' });
    }
    if (promotion.paymentStatus === 'paid') {
      return res.status(400).json({ message: 'This promotion has already been paid for' });
    }

    let verification;
    try {
      verification = await verifyPaystackTransaction(paymentReference);
    } catch (verifyError) {
      console.error('Paystack verification request failed:', verifyError?.response?.data || verifyError.message);
      return res.status(402).json({ message: 'Could not verify payment. Please try again.' });
    }

    if (!verification || verification.status !== 'success') {
      return res.status(402).json({ message: 'Payment was not successful' });
    }

    // See orderController.payOrder for why this check exists.
    if (verification.metadata?.promotionId !== promotion._id.toString()) {
      return res.status(402).json({ message: 'This payment reference does not match this promotion.' });
    }

    const expectedAmountInCents = Math.round(promotion.price * 100);
    if (verification.amount !== expectedAmountInCents) {
      return res.status(402).json({ message: "Payment amount does not match this promotion's price" });
    }

    const tierConfig = PROMOTION_TIERS[promotion.tier];
    const now = new Date();
    const endDate = new Date(now.getTime() + tierConfig.days * 24 * 60 * 60 * 1000);

    promotion.paymentStatus = 'paid';
    promotion.paymentReference = paymentReference;
    promotion.startDate = now;
    promotion.endDate = endDate;
    await promotion.save();

    res.status(200).json({ promotion });
  } catch (error) {
    next(error);
  }
};

// @route   GET /api/promotions
// @access  Public
// query: { search? }
// Only ever returns promotions that are paid AND not yet expired.
const getPromotions = async (req, res, next) => {
  try {
    const { search } = req.query;
    const now = new Date();

    const filter = {
      paymentStatus: 'paid',
      endDate: { $gt: now }
    };

    if (search) {
      const regex = buildSearchRegex(search);
      filter.$or = [{ title: regex }, { description: regex }];
    }

    const promotions = await Promotion.find(filter)
      .sort({ createdAt: -1 })
      .populate('seller', 'businessName businessAddress category');

    res.status(200).json({ promotions });
  } catch (error) {
    next(error);
  }
};

// @route   GET /api/promotions/mine
// @access  Private (shop or service_provider)
const getMyPromotions = async (req, res, next) => {
  try {
    const promotions = await Promotion.find({ seller: req.user._id }).sort({ createdAt: -1 });
    res.status(200).json({ promotions });
  } catch (error) {
    next(error);
  }
};

// @route   GET /api/promotions/active-seller-ids
// @access  Public
// Powers the green "has a promotion" dot on shop/provider cards without
// requiring changes to the existing business listing endpoints.
const getActiveSellerIds = async (req, res, next) => {
  try {
    const now = new Date();
    const sellerIds = await Promotion.find({ paymentStatus: 'paid', endDate: { $gt: now } }).distinct('seller');
    res.status(200).json({ sellerIds: sellerIds.map((id) => id.toString()) });
  } catch (error) {
    next(error);
  }
};

// @route   GET /api/promotions/:id
// @access  Private (owner only) — used by the payment screen to re-fetch price/status
const getPromotionById = async (req, res, next) => {
  try {
    const promotion = await Promotion.findById(req.params.id);
    if (!promotion) {
      return res.status(404).json({ message: 'Promotion not found' });
    }
    if (promotion.seller.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'You do not have permission to view this promotion' });
    }
    res.status(200).json({ promotion });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  createPromotion,
  payPromotion,
  getPromotions,
  getMyPromotions,
  getActiveSellerIds,
  getPromotionById
};