const Product = require('../models/Product');
const mongoose = require('mongoose');

// @route   POST /api/products
// @access  Private (shop only)
const createProduct = async (req, res, next) => {
  try {
    const { name, price, category, description, specs, images, stock, condition, deliveryEstimate } = req.body;

    const product = await Product.create({
      shop: req.user._id,
      name,
      price,
      category,
      description,
      specs,
      images,
      stock,
      condition,
      deliveryEstimate
    });

    res.status(201).json({ product });
  } catch (error) {
    next(error);
  }
};

// @route   PUT /api/products/:id
// @access  Private (shop only, must own the product)
const updateProduct = async (req, res, next) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) {
      return res.status(404).json({ message: 'Product not found' });
    }
    if (product.shop.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'You do not have permission to edit this product' });
    }

    const allowedFields = ['name', 'price', 'category', 'description', 'specs', 'images', 'stock', 'condition', 'deliveryEstimate', 'isActive'];
    allowedFields.forEach((field) => {
      if (req.body[field] !== undefined) {
        product[field] = req.body[field];
      }
    });

    await product.save();
    res.status(200).json({ product });
  } catch (error) {
    next(error);
  }
};

// @route   DELETE /api/products/:id
// @access  Private (shop only, must own the product)
const deleteProduct = async (req, res, next) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) {
      return res.status(404).json({ message: 'Product not found' });
    }
    if (product.shop.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'You do not have permission to delete this product' });
    }

    await product.deleteOne();
    res.status(200).json({ message: 'Product deleted successfully' });
  } catch (error) {
    next(error);
  }
};

// @route   GET /api/products/mine
// @access  Private (shop only)
const getMyProducts = async (req, res, next) => {
  try {
    const products = await Product.find({ shop: req.user._id }).sort({ createdAt: -1 });
    res.status(200).json({ products });
  } catch (error) {
    next(error);
  }
};

// @route   GET /api/products
// @access  Public (clients browse all active products)
// Query params: category, search, shop, page, limit
const getProducts = async (req, res, next) => {
  try {
    const { category, search, shop, page = 1, limit = 20 } = req.query;
    const query = { isActive: true };

    if (category && category !== 'All') {
      query.category = category;
    }
    if (shop) {
      if (!mongoose.Types.ObjectId.isValid(shop)) {
        return res.status(400).json({ message: 'Invalid shop id' });
      }
      query.shop = shop;
    }
    if (search) {
      query.$text = { $search: search };
    }

    const pageNum = Math.max(parseInt(page, 10) || 1, 1);
    const limitNum = Math.min(Math.max(parseInt(limit, 10) || 20, 1), 50);

    const [products, total] = await Promise.all([
      Product.find(query)
        .select('-specs -description -images')
        .sort({ createdAt: -1 })
        .skip((pageNum - 1) * limitNum)
        .limit(limitNum)
        .populate('shop', 'businessName businessAddress'),
      Product.countDocuments(query)
    ]);

    res.status(200).json({
      products,
      pagination: { page: pageNum, limit: limitNum, total, pages: Math.ceil(total / limitNum) }
    });
  } catch (error) {
    next(error);
  }
};

// @route   GET /api/products/:id
// @access  Public
const getProductById = async (req, res, next) => {
  try {
    const product = await Product.findById(req.params.id).populate(
      'shop',
      'businessName businessAddress phone'
    );

    if (!product || !product.isActive) {
      return res.status(404).json({ message: 'Product not found' });
    }

    res.status(200).json({ product });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  createProduct,
  updateProduct,
  deleteProduct,
  getMyProducts,
  getProducts,
  getProductById
};
