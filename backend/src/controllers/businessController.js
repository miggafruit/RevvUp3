const { visibleProviderFilter } = require('../utils/sellerVisibility');
const { rankedPage, splitUsers, isActiveDoc } = require('../utils/rewardsRanking');
const User = require('../models/User');
const Product = require('../models/Product');
const Service = require('../models/Service');

// @route   GET /api/businesses/shops
// @access  Public
// Query params: search, category, page, limit
const getShops = async (req, res, next) => {
  try {
    const { search, category, page = 1, limit = 20 } = req.query;
    // Only list shops that have actually passed KYC — previously any
    // newly registered shop account was immediately public here with
    // full visibility, regardless of whether verification had even
    // been submitted, let alone approved.
    const query = { role: 'shop', kycStatus: 'approved' };

    if (search) {
      query.$or = [
        { businessName: { $regex: search, $options: 'i' } },
        { category: { $regex: search, $options: 'i' } }
      ];
    }
    if (category && category !== 'All') {
      query.category = category;
    }

    const pageNum = Math.max(parseInt(page, 10) || 1, 1);
    const limitNum = Math.min(Math.max(parseInt(limit, 10) || 20, 1), 50);

    // Rewards-programme shops first, then the rest.
    const { filterA, filterB } = splitUsers(query);
    const { items: rankedShops, total } = await rankedPage({
      runFind: (f, skip, lim) =>
        User.find(f).select('name businessName businessAddress category profilePhoto createdAt').sort({ createdAt: -1 }).skip(skip).limit(lim),
      runCount: (f) => User.countDocuments(f),
      filterA,
      filterB,
      skip: (pageNum - 1) * limitNum,
      limit: limitNum
    });
    const shops = rankedShops.map((r) => r.doc);
    const rewardsFlags = new Map(rankedShops.map((r) => [r.doc._id.toString(), r.rewardsActive]));

    // Attach a quick product count + one thumbnail per shop for the card view
    const shopIds = shops.map((s) => s._id);
    const productAggregates = await Product.aggregate([
      { $match: { shop: { $in: shopIds }, isActive: true } },
      {
        $group: {
          _id: '$shop',
          productCount: { $sum: 1 },
          avgRating: { $avg: '$ratingAverage' },
          thumbnail: { $first: '$images' }
        }
      }
    ]);

    const aggregateMap = new Map(productAggregates.map((a) => [a._id.toString(), a]));

    const shopsWithMeta = shops.map((shop) => {
      const agg = aggregateMap.get(shop._id.toString());
      return {
        ...shop.toObject(),
        rewardsActive: rewardsFlags.get(shop._id.toString()) || false,
        productCount: agg?.productCount || 0,
        rating: agg?.avgRating ? Math.round(agg.avgRating * 10) / 10 : null,
        thumbnail: agg?.thumbnail?.[0] || null
      };
    });

    res.status(200).json({
      shops: shopsWithMeta,
      pagination: { page: pageNum, limit: limitNum, total, pages: Math.ceil(total / limitNum) }
    });
  } catch (error) {
    next(error);
  }
};

// @route   GET /api/businesses/shops/:id
// @access  Public
const getShopById = async (req, res, next) => {
  try {
    const shop = await User.findOne({ _id: req.params.id, role: 'shop', kycStatus: 'approved' }).select(
      'name businessName businessAddress category profilePhoto qualifications portfolioImages profileVideoUrl createdAt rewardsProgram'
    );

    if (!shop) {
      return res.status(404).json({ message: 'Shop not found' });
    }

    const shopOut = shop.toObject();
    shopOut.rewardsActive = isActiveDoc(shop);
    delete shopOut.rewardsProgram;
    res.status(200).json({ shop: shopOut });
  } catch (error) {
    next(error);
  }
};

// @route   GET /api/businesses/providers
// @access  Public
const getProviders = async (req, res, next) => {
  try {
    const { search, category, page = 1, limit = 20 } = req.query;
    // Same fix as getShops above — service providers must be
    // KYC-approved before they're publicly listed.
    const query = { ...visibleProviderFilter() };

    if (search) {
      // $and keeps the clearance $or from visibleProviderFilter intact.
      query.$and = [
        {
          $or: [
            { businessName: { $regex: search, $options: 'i' } },
            { category: { $regex: search, $options: 'i' } }
          ]
        }
      ];
    }
    if (category && category !== 'All') {
      query.category = category;
    }

    const pageNum = Math.max(parseInt(page, 10) || 1, 1);
    const limitNum = Math.min(Math.max(parseInt(limit, 10) || 20, 1), 50);

    const { filterA, filterB } = splitUsers(query);
    const { items: rankedProviders, total } = await rankedPage({
      runFind: (f, skip, lim) =>
        User.find(f).select('name businessName businessAddress category profilePhoto createdAt').sort({ createdAt: -1 }).skip(skip).limit(lim),
      runCount: (f) => User.countDocuments(f),
      filterA,
      filterB,
      skip: (pageNum - 1) * limitNum,
      limit: limitNum
    });
    const providers = rankedProviders.map((r) => r.doc);
    const rewardsFlags = new Map(rankedProviders.map((r) => [r.doc._id.toString(), r.rewardsActive]));

    const providerIds = providers.map((p) => p._id);
    const serviceAggregates = await Service.aggregate([
      { $match: { provider: { $in: providerIds }, isActive: true } },
      {
        $group: {
          _id: '$provider',
          serviceCount: { $sum: 1 },
          avgRating: { $avg: '$ratingAverage' },
          thumbnail: { $first: '$images' }
        }
      }
    ]);

    const aggregateMap = new Map(serviceAggregates.map((a) => [a._id.toString(), a]));

    const providersWithMeta = providers.map((provider) => {
      const agg = aggregateMap.get(provider._id.toString());
      return {
        ...provider.toObject(),
        rewardsActive: rewardsFlags.get(provider._id.toString()) || false,
        serviceCount: agg?.serviceCount || 0,
        rating: agg?.avgRating ? Math.round(agg.avgRating * 10) / 10 : null,
        thumbnail: agg?.thumbnail?.[0] || null
      };
    });

    res.status(200).json({
      providers: providersWithMeta,
      pagination: { page: pageNum, limit: limitNum, total, pages: Math.ceil(total / limitNum) }
    });
  } catch (error) {
    next(error);
  }
};

// @route   GET /api/businesses/providers/:id
// @access  Public
const getProviderById = async (req, res, next) => {
  try {
    const provider = await User.findOne({ _id: req.params.id, ...visibleProviderFilter() }).select(
      'name businessName businessAddress category profilePhoto qualifications portfolioImages profileVideoUrl createdAt rewardsProgram'
    );

    if (!provider) {
      return res.status(404).json({ message: 'Service provider not found' });
    }

    const providerOut = provider.toObject();
    providerOut.rewardsActive = isActiveDoc(provider);
    delete providerOut.rewardsProgram;
    res.status(200).json({ provider: providerOut });
  } catch (error) {
    next(error);
  }
};

module.exports = { getShops, getShopById, getProviders, getProviderById };
