const mongoose = require('mongoose');
const Cart = require('../models/Cart');
const Order = require('../models/Order');
const { verifyPaystackTransaction } = require('../utils/paystack');
const { createDeliveryForOrder } = require('./deliveryController');
const { getDeliveryFee } = require('../config/deliveryPricing');
const { createPayoutEntry } = require('../utils/payouts');

// @route   POST /api/orders/checkout
// @access  Private (client only)
// body: { deliveryAddress, contactPhone, notes }
// No payment is taken here — the order is created unpaid and pending. Payment
// only happens once the seller accepts (see payOrder below).
const checkout = async (req, res, next) => {
  try {
    const { deliveryAddress, contactPhone, notes } = req.body;

    if (!deliveryAddress || !contactPhone) {
      return res.status(400).json({ message: 'Delivery address and contact phone are required' });
    }

    const cart = await Cart.findOne({ client: req.user._id })
      .populate('items.product')
      .populate('items.service');

    if (!cart || cart.items.length === 0) {
      return res.status(400).json({ message: 'Your cart is empty' });
    }

    const orderItems = [];
    for (const cartItem of cart.items) {
      const sourceDoc = cartItem.itemType === 'product' ? cartItem.product : cartItem.service;

      if (!sourceDoc || !sourceDoc.isActive) {
        return res.status(400).json({
          message: `One of the items in your cart (${cartItem.itemType}) is no longer available. Please remove it and try again.`
        });
      }

      if (cartItem.itemType === 'product' && sourceDoc.stock < cartItem.quantity) {
        return res.status(400).json({
          message: `Not enough stock for "${sourceDoc.name}". Only ${sourceDoc.stock} left.`
        });
      }

      const sellerSnapshot = cartItem.itemType === 'product' ? sourceDoc.shop : sourceDoc.provider;

      orderItems.push({
        itemType: cartItem.itemType,
        product: cartItem.itemType === 'product' ? sourceDoc._id : undefined,
        service: cartItem.itemType === 'service' ? sourceDoc._id : undefined,
        nameSnapshot: sourceDoc.name,
        priceSnapshot: sourceDoc.price,
        sellerSnapshot,
        quantity: cartItem.quantity,
        lineTotal: sourceDoc.price * cartItem.quantity
      });
    }

    const subtotal = orderItems.reduce((sum, item) => sum + item.lineTotal, 0);
    const hasProductItems = orderItems.some((item) => item.itemType === 'product');
    const deliveryFee = getDeliveryFee(hasProductItems);
    const totalAmount = subtotal + deliveryFee;

    const order = await Order.create({
      client: req.user._id,
      items: orderItems,
      totalAmount,
      deliveryFee,
      deliveryAddress,
      contactPhone,
      notes,
      status: 'pending',
      paymentStatus: 'pending'
    });

    // Stock is reserved at submission time (before the seller has even seen
    // it) so two clients can't both order the last unit while one is pending.
    // Declining releases it back — see updateOrderStatus below.
    const Product = require('../models/Product');
    await Promise.all(
      orderItems
        .filter((item) => item.itemType === 'product')
        .map((item) =>
          Product.findByIdAndUpdate(item.product, { $inc: { stock: -item.quantity } })
        )
    );

    cart.items = [];
    await cart.save();

    res.status(201).json({ order });
  } catch (error) {
    next(error);
  }
};

// @route   GET /api/orders/mine
// @access  Private (client only)
const getMyOrders = async (req, res, next) => {
  try {
    const orders = await Order.find({ client: req.user._id }).sort({ createdAt: -1 });
    res.status(200).json({ orders });
  } catch (error) {
    next(error);
  }
};

// @route   GET /api/orders/incoming
// @access  Private (shop or service_provider)
const getIncomingOrders = async (req, res, next) => {
  try {
    const orders = await Order.find({ 'items.sellerSnapshot': req.user._id })
      .sort({ createdAt: -1 })
      .populate('client', 'name phone');

    const filtered = orders.map((order) => ({
      _id: order._id,
      client: order.client,
      deliveryAddress: order.deliveryAddress,
      contactPhone: order.contactPhone,
      status: order.status,
      paymentStatus: order.paymentStatus,
      createdAt: order.createdAt,
      items: order.items.filter((item) => item.sellerSnapshot.toString() === req.user._id.toString())
    }));

    res.status(200).json({ orders: filtered });
  } catch (error) {
    next(error);
  }
};

// @route   GET /api/orders/:id
// @access  Private (owner client or a seller with items in it)
const getOrderById = async (req, res, next) => {
  try {
    const order = await Order.findById(req.params.id).populate('client', 'name phone');
    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }

    const isOwner = order.client._id.toString() === req.user._id.toString();
    const isSeller = order.items.some((item) => item.sellerSnapshot.toString() === req.user._id.toString());

    if (!isOwner && !isSeller) {
      return res.status(403).json({ message: 'You do not have permission to view this order' });
    }

    res.status(200).json({ order });
  } catch (error) {
    next(error);
  }
};

// @route   PUT /api/orders/:id/status
// @access  Private (shop or service_provider with items in this order)
// body: { status: 'confirmed' | 'cancelled' }
// Runs before any payment exists, so declining never needs a refund — it just
// releases the reserved stock.
const updateOrderStatus = async (req, res, next) => {
  try {
    const { status } = req.body;
    if (!['confirmed', 'cancelled'].includes(status)) {
      return res.status(400).json({ message: "Status must be 'confirmed' or 'cancelled'" });
    }

    const order = await Order.findById(req.params.id);
    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }

    const isSeller = order.items.some((item) => item.sellerSnapshot.toString() === req.user._id.toString());
    if (!isSeller) {
      return res.status(403).json({ message: 'You do not have permission to update this order' });
    }

    if (order.status !== 'pending') {
      return res.status(400).json({ message: `This order is already ${order.status} and can no longer be updated` });
    }

    // NOTE: status is order-wide, not per-seller. If a cart ever mixes items
    // from multiple sellers, accepting/declining affects the whole order.
    // Fine for single-seller carts (the common case) — revisit if that changes.
    order.status = status;

    if (status === 'cancelled') {
      const Product = require('../models/Product');
      await Promise.all(
        order.items
          .filter((item) => item.itemType === 'product')
          .map((item) => Product.findByIdAndUpdate(item.product, { $inc: { stock: item.quantity } }))
      );
    }

    await order.save();

    res.status(200).json({ order });
  } catch (error) {
    next(error);
  }
};

// @route   PATCH /api/orders/:id/complete
// @access  Private (seller only — the provider/shop on this order)
//
// Closes a real gap: product orders reach 'completed' automatically
// through the delivery flow (see deliveryController.markDelivered),
// but there was no equivalent for orders containing only services —
// nothing anywhere ever moved those out of 'confirmed', which also
// meant they could never be rated (ratings require status:
// 'completed'). Deliberately restricted to orders with zero product
// items — an order with any physical product still completes via
// delivery, not this, to avoid two different code paths racing to
// decide when the same order is "done."
//
// Requires paymentStatus 'paid' before allowing this — this is the
// actual payment gate for marketplace services: a provider can't mark
// their own work done (and unlock the client's ability to rate it)
// until payment has actually gone through.
const completeServiceOrder = async (req, res, next) => {
  try {
    const order = await Order.findById(req.params.id);
    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }

    const isSeller = order.items.some((item) => item.sellerSnapshot.toString() === req.user._id.toString());
    if (!isSeller) {
      return res.status(403).json({ message: 'You do not have permission to update this order' });
    }

    const hasProductItems = order.items.some((item) => item.itemType === 'product');
    if (hasProductItems) {
      return res.status(400).json({
        message: 'This order includes physical products and completes automatically once delivered, not manually.'
      });
    }

    if (order.status !== 'confirmed') {
      return res.status(400).json({ message: `Can't complete an order from status "${order.status}".` });
    }
    if (order.paymentStatus !== 'paid') {
      return res.status(400).json({ message: 'This order needs to be paid before it can be marked complete.' });
    }

    order.status = 'completed';
    await order.save();

    const sellerId = order.items[0]?.sellerSnapshot;
    if (sellerId && order.totalAmount > 0) {
      await createPayoutEntry({
        recipient: sellerId,
        amount: order.totalAmount, // no delivery fee ever applies to service-only orders
        sourceType: 'order_seller_share',
        sourceId: order._id
      });
    }

    res.status(200).json({ order });
  } catch (error) {
    next(error);
  }
};

// @route   POST /api/orders/:id/pay
// @access  Private (client only, must own the order)
// body: { paymentReference }
// Only usable once the seller has accepted (status === 'confirmed'). This is
// the only place a payment is ever taken in the order lifecycle.
const payOrder = async (req, res, next) => {
  try {
    const { paymentReference } = req.body;
    if (!paymentReference) {
      return res.status(400).json({ message: 'Payment reference is required' });
    }

    const order = await Order.findById(req.params.id);
    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }

    if (order.client.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'You do not have permission to pay for this order' });
    }

    if (order.status === 'pending') {
      return res.status(400).json({ message: 'The seller has not accepted this order yet' });
    }
    if (order.status === 'cancelled') {
      return res.status(400).json({ message: 'This order was declined and can no longer be paid' });
    }
    if (order.paymentStatus === 'paid') {
      return res.status(400).json({ message: 'This order has already been paid' });
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

    // Confirms this reference was actually generated for THIS order —
    // without this, amount-matching alone doesn't stop someone reusing
    // a real, successful reference (their own from a different order,
    // or one from elsewhere) against an unrelated order of the same
    // price. The unique index on paymentReference (see Order.js) is
    // the other half of this: it stops the same reference being used
    // twice, this stops it being used for the wrong thing the first time.
    if (verification.metadata?.orderId !== order._id.toString()) {
      return res.status(402).json({ message: 'This payment reference does not match this order.' });
    }

    const expectedAmountInCents = Math.round(order.totalAmount * 100);
    if (verification.amount !== expectedAmountInCents) {
      return res.status(402).json({ message: "Payment amount does not match this order's total" });
    }

    order.paymentStatus = 'paid';
    order.paymentReference = paymentReference;
    await order.save();

    // Order is now both accepted and paid — this is the moment a physical
    // delivery job (if the order has any products) gets created and pushed
    // out to all online drivers.
    try {
      const io = req.app.get('io');
      await createDeliveryForOrder(order, io);
    } catch (deliveryError) {
      // A delivery-creation failure should never block a successful payment
      // from being recorded — log it and let the order stand as paid.
      console.error(`Failed to create delivery for order ${order._id}:`, deliveryError);
    }

    res.status(200).json({ order });
  } catch (error) {
    next(error);
  }
};

module.exports = { checkout, getMyOrders, getIncomingOrders, getOrderById, updateOrderStatus, completeServiceOrder, payOrder };