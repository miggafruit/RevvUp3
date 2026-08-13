const Cart = require('../models/Cart');
const Product = require('../models/Product');
const Service = require('../models/Service');
const { getDeliveryFee } = require('../config/deliveryPricing');

const getOrCreateCart = async (clientId) => {
  let cart = await Cart.findOne({ client: clientId });
  if (!cart) {
    cart = await Cart.create({ client: clientId, items: [] });
  }
  return cart;
};

// Looks up which seller the cart's existing items actually belong to,
// by fetching whichever product/service is already in there — the
// cart itself doesn't store seller info directly, only item
// references, so this is a real (if small) lookup, not just reading a
// field.
const getCartSellerId = async (cart) => {
  const firstItem = cart.items[0];
  if (!firstItem) return null;

  const Model = firstItem.itemType === 'product' ? Product : Service;
  const doc = await Model.findById(firstItem[firstItem.itemType]).select(
    firstItem.itemType === 'product' ? 'shop' : 'provider'
  );
  if (!doc) return null;
  return (firstItem.itemType === 'product' ? doc.shop : doc.provider).toString();
};

// @route   GET /api/cart
// @access  Private (client only)
const getCart = async (req, res, next) => {
  try {
    const cart = await Cart.findOne({ client: req.user._id })
      .populate('items.product')
      .populate('items.service');

    if (!cart) {
      return res.status(200).json({ cart: { items: [] }, subtotal: 0, deliveryFee: 0, total: 0 });
    }

    const subtotal = cart.items.reduce((sum, item) => {
      const unitPrice = item.itemType === 'product' ? item.product?.price : item.service?.price;
      return sum + (unitPrice || 0) * item.quantity;
    }, 0);
    const hasProductItems = cart.items.some((item) => item.itemType === 'product');
    const deliveryFee = getDeliveryFee(hasProductItems);
    const total = subtotal + deliveryFee;

    res.status(200).json({ cart, subtotal, deliveryFee, total });
  } catch (error) {
    next(error);
  }
};

// @route   POST /api/cart/items
// @access  Private (client only)
// body: { itemType: 'product'|'service', itemId, quantity }
//
// Enforced here: every item in a cart must come from the same seller.
// checkout(), updateOrderStatus(), and createDeliveryForOrder() in
// orderController/deliveryController all assume a single-seller cart —
// updateOrderStatus's own comment says as much ("status is order-wide,
// not per-seller... fine for single-seller carts, revisit if that
// changes") — but nothing ever actually enforced it. A client browsing
// two different shops and adding one item from each would silently
// corrupt order fulfillment: the delivery would only reflect the first
// shop's pickup address, and one seller confirming/declining their
// item would incorrectly confirm/decline the other seller's item too.
const addItemToCart = async (req, res, next) => {
  try {
    const { itemType, itemId, quantity = 1 } = req.body;

    if (!['product', 'service'].includes(itemType)) {
      return res.status(400).json({ message: 'itemType must be "product" or "service"' });
    }
    if (!itemId) {
      return res.status(400).json({ message: 'itemId is required' });
    }

    const Model = itemType === 'product' ? Product : Service;
    const item = await Model.findById(itemId);
    if (!item || !item.isActive) {
      return res.status(404).json({ message: `${itemType} not found` });
    }

    const cart = await getOrCreateCart(req.user._id);

    if (cart.items.length > 0) {
      const newSellerId = (itemType === 'product' ? item.shop : item.provider).toString();
      const existingSellerId = await getCartSellerId(cart);
      if (existingSellerId && existingSellerId !== newSellerId) {
        return res.status(409).json({
          message:
            'Your cart already has items from a different shop or provider. Check out or clear your cart before adding items from someone else.'
        });
      }
    }

    const existingItem = cart.items.find(
      (ci) => ci.itemType === itemType && ci[itemType]?.toString() === itemId
    );

    if (existingItem) {
      existingItem.quantity += Number(quantity) || 1;
    } else {
      cart.items.push({
        itemType,
        [itemType]: itemId,
        quantity: Number(quantity) || 1
      });
    }

    await cart.save();
    await cart.populate('items.product');
    await cart.populate('items.service');

    res.status(200).json({ cart });
  } catch (error) {
    next(error);
  }
};

// @route   PUT /api/cart/items/:cartItemId
// @access  Private (client only)
// body: { quantity }
const updateCartItem = async (req, res, next) => {
  try {
    const { quantity } = req.body;
    if (!quantity || quantity < 1) {
      return res.status(400).json({ message: 'Quantity must be at least 1' });
    }

    const cart = await Cart.findOne({ client: req.user._id });
    if (!cart) {
      return res.status(404).json({ message: 'Cart not found' });
    }

    const item = cart.items.find((ci) => ci._id.toString() === req.params.cartItemId);
    if (!item) {
      return res.status(404).json({ message: 'Cart item not found' });
    }

    item.quantity = quantity;
    await cart.save();
    await cart.populate('items.product');
    await cart.populate('items.service');

    res.status(200).json({ cart });
  } catch (error) {
    next(error);
  }
};

// @route   DELETE /api/cart/items/:cartItemId
// @access  Private (client only)
const removeCartItem = async (req, res, next) => {
  try {
    const cart = await Cart.findOne({ client: req.user._id });
    if (!cart) {
      return res.status(404).json({ message: 'Cart not found' });
    }

    cart.items = cart.items.filter((ci) => ci._id.toString() !== req.params.cartItemId);
    await cart.save();
    await cart.populate('items.product');
    await cart.populate('items.service');

    res.status(200).json({ cart });
  } catch (error) {
    next(error);
  }
};

// @route   DELETE /api/cart
// @access  Private (client only)
const clearCart = async (req, res, next) => {
  try {
    const cart = await Cart.findOne({ client: req.user._id });
    if (cart) {
      cart.items = [];
      await cart.save();
    }
    res.status(200).json({ message: 'Cart cleared' });
  } catch (error) {
    next(error);
  }
};

module.exports = { getCart, addItemToCart, updateCartItem, removeCartItem, clearCart, getOrCreateCart };
