const User = require('../models/User');
const Product = require('../models/Product');
const Service = require('../models/Service');

// @route   GET /api/businesses/shops
// @access  Public
// Query params: search, category, page, limit
const getShops = async (req, res, next) => {
  try {
    const { search, category, page = 1, limit = 20 } = req.query;
    const query = { role: 'shop' };

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

    const [shops, total] = await Promise.all([
      User.find(query)
        .select('name businessName businessAddress category createdAt')
        .sort({ createdAt: -1 })
        .skip((pageNum - 1) * limitNum)
        .limit(limitNum),
      User.countDocuments(query)
    ]);

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
    const shop = await User.findOne({ _id: req.params.id, role: 'shop' }).select(
      'name businessName businessAddress category createdAt'
    );

    if (!shop) {
      return res.status(404).json({ message: 'Shop not found' });
    }

    res.status(200).json({ shop });
  } catch (error) {
    next(error);
  }
};

// @route   GET /api/businesses/providers
// @access  Public
const getProviders = async (req, res, next) => {
  try {
    const { search, category, page = 1, limit = 20 } = req.query;
    const query = { role: 'service_provider' };

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

    const [providers, total] = await Promise.all([
      User.find(query)
        .select('name businessName businessAddress category createdAt')
        .sort({ createdAt: -1 })
        .skip((pageNum - 1) * limitNum)
        .limit(limitNum),
      User.countDocuments(query)
    ]);

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
    const provider = await User.findOne({ _id: req.params.id, role: 'service_provider' }).select(
      'name businessName businessAddress category createdAt'
    );

    if (!provider) {
      return res.status(404).json({ message: 'Service provider not found' });
    }

    res.status(200).json({ provider });
  } catch (error) {
    next(error);
  }
};

module.exports = { getShops, getShopById, getProviders, getProviderById };
