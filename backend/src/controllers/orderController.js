const mongoose = require('mongoose');
const Cart = require('../models/Cart');
const Delivery = require('../models/Delivery');
const Order = require('../models/Order');
const User = require('../models/User');
const { verifyPaystackTransaction } = require('../utils/paystack');
const { createDeliveryForOrder } = require('./deliveryController');
const { reservePoints, giveBackPoints, recordRedemption, refundRedemption } = require('../services/rewardsService');
const { finalizeServiceOrder } = require('../services/orderFinalization');
const { isRewardsActive, pointsToRand, REDEEMABLE_SELLER_ROLES, round2 } = require('../config/rewards');
const { isSellerVisible } = require('../utils/sellerVisibility');
const { getDeliveryQuote, QuoteError } = require('../utils/deliveryQuote');
const { createPayoutEntry } = require('../utils/payouts');
const { sendPushNotifications } = require('../utils/pushNotifications');
const { amountMatchesExpected } = require('../utils/paymentVerification');
const { isTestReference, isTestPaymentAllowedFor, buildTestVerification } = require('../utils/testPayments');
const { reportSilentFailure } = require('../utils/reportSilentFailure');

// @route   POST /api/orders/delivery-quote
// @access  Private (client only)
// body: { deliveryAddress } — prices delivery for the current cart so the
// checkout screen can show the real fee BEFORE the order is placed. The
// same calculation runs again inside checkout(), which is the one that counts.
const getCheckoutQuote = async (req, res, next) => {
  try {
    const { deliveryAddress } = req.body;
    const cart = await Cart.findOne({ client: req.user._id }).populate('items.product').populate('items.service');
    if (!cart || cart.items.length === 0) return res.status(400).json({ message: 'Your cart is empty' });

    const subtotal = cart.items.reduce((sum, i) => {
      const unit = i.itemType === 'product' ? i.product?.price : i.service?.price;
      return sum + (unit || 0) * i.quantity;
    }, 0);
    const productLines = cart.items
      .filter((i) => i.itemType === 'product' && i.product)
      .map((i) => ({ product: i.product, quantity: i.quantity }));

    if (productLines.length > 0 && (!deliveryAddress || !deliveryAddress.trim())) {
      return res.status(400).json({ message: 'Delivery address is required' });
    }
    const quote = await getDeliveryQuote({
      productLines,
      shopId: productLines[0]?.product.shop,
      deliveryAddress: (deliveryAddress || '').trim()
    });
    res.status(200).json({ ...quote, subtotal, total: Math.round((subtotal + quote.deliveryFee) * 100) / 100 });
  } catch (err) {
    if (err instanceof QuoteError) return res.status(err.status).json({ message: err.message });
    next(err);
  }
};

// @route   POST /api/orders/checkout
// @access  Private (client only)
// body: { deliveryAddress, contactPhone, notes }
// No payment is taken here — the order is created unpaid and pending. Payment
// only happens once the seller accepts (see payOrder below).
const checkout = async (req, res, next) => {
  try {
    let { deliveryAddress } = req.body;
    const { contactPhone, notes, serviceLocationType, paymentMethod: requestedMethod, redeemPoints } = req.body;

    // Meaning of "address" depends on what is being bought:
    //  - products: where the delivery driver drops the parcel
    //  - services (at_client): where the vehicle is / where the work happens,
    //    so the provider knows where to go
    //  - services (at_provider): the client brings the vehicle to the provider;
    //    the address is the provider's own, filled in below
    if (!contactPhone) {
      return res.status(400).json({ message: 'Contact phone is required' });
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

    // Re-check at purchase time: a seller may have been un-approved (or their
    // clearance lapsed) after the item went into the cart.
    const sellerIdsToCheck = [...new Set(orderItems.map((i) => i.sellerSnapshot.toString()))];
    const sellerDocs = await User.find({ _id: { $in: sellerIdsToCheck } }).select(
      'role kycStatus providerType isDriver roadsideServices policeClearance businessAddress businessName name rewardsProgram'
    );
    if (sellerDocs.length !== sellerIdsToCheck.length || sellerDocs.some((u) => !isSellerVisible(u))) {
      return res.status(400).json({
        message: 'This seller is not currently available. Please remove their items from your cart.'
      });
    }

    const isServiceOrder = !orderItems.some((i) => i.itemType === 'product');
    let resolvedLocationType;
    if (isServiceOrder) {
      resolvedLocationType = serviceLocationType === 'at_provider' ? 'at_provider' : 'at_client';
      if (resolvedLocationType === 'at_provider') {
        deliveryAddress = sellerDocs[0]?.businessAddress;
        if (!deliveryAddress) {
          return res.status(400).json({ message: 'This provider has no workshop address on file. Choose "come to my vehicle" instead.' });
        }
      } else if (!deliveryAddress || !deliveryAddress.trim()) {
        return res.status(400).json({ message: 'Please tell the provider where the vehicle is (the address the work should happen at).' });
      }
    } else if (!deliveryAddress || !deliveryAddress.trim()) {
      return res.status(400).json({ message: 'Delivery address is required' });
    }

    const subtotal = orderItems.reduce((sum, item) => sum + item.lineTotal, 0);
    const hasProductItems = orderItems.some((item) => item.itemType === 'product');
    let quote = { deliveryFee: 0 };
    if (hasProductItems) {
      const productLines = cart.items
        .filter((i) => i.itemType === 'product')
        .map((i) => ({ product: i.product, quantity: i.quantity }));
      try {
        quote = await getDeliveryQuote({
          productLines,
          shopId: productLines[0].product.shop,
          deliveryAddress
        });
      } catch (err) {
        if (err instanceof QuoteError) return res.status(err.status).json({ message: err.message });
        throw err;
      }
    }
    const deliveryFee = quote.deliveryFee;
    const totalAmount = Math.round((subtotal + deliveryFee) * 100) / 100;

    // ── Payment method + rewards points ──────────────────────────────────────
    const seller = sellerDocs[0];
    if (requestedMethod === 'cash' && !isServiceOrder) {
      return res.status(400).json({ message: 'Cash is only available for service bookings. Products are paid by card in the app.' });
    }
    const pointsRequested = Math.max(0, Math.floor(Number(redeemPoints) || 0));
    let pointsValue = 0;
    if (pointsRequested > 0) {
      if (!isServiceOrder || !REDEEMABLE_SELLER_ROLES.includes(seller.role)) {
        return res.status(400).json({ message: 'Points can only be used on services from participating providers.' });
      }
      if (!isRewardsActive(seller)) {
        return res.status(400).json({ message: 'This provider is not part of the rewards programme, so points cannot be used here.' });
      }
      pointsValue = pointsToRand(pointsRequested);
      if (pointsValue > totalAmount) {
        return res.status(400).json({ message: 'You are using more points than this booking costs.' });
      }
      const reserved = await reservePoints(req.user._id, pointsRequested);
      if (!reserved) {
        return res.status(400).json({ message: "You don't have enough points for that." });
      }
    }
    const amountDue = round2(totalAmount - pointsValue);
    const paymentMethod = amountDue === 0 ? 'points' : requestedMethod === 'cash' ? 'cash' : 'card';

    let order;
    try {
      order = await Order.create({
      client: req.user._id,
      items: orderItems,
      totalAmount,
      paymentMethod,
      pointsRedeemed: pointsRequested,
      pointsValue,
      amountDue,
      rewardsEligible: isRewardsActive(seller),
      deliveryFee,
      deliveryDistanceKm: quote.distanceKm,
      deliveryTier: quote.tier || undefined,
      totalWeightKg: quote.totalWeightKg,
      deliveryAddress,
      serviceLocationType: resolvedLocationType,
      contactPhone,
      notes,
      status: 'pending',
      paymentStatus: 'pending'
      });
    } catch (createError) {
      await giveBackPoints(req.user._id, pointsRequested);
      throw createError;
    }
    await recordRedemption(order, seller.businessName || seller.name);

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

    // Previously silent — sellers had no way of knowing a new order had
    // come in except by manually opening the app and checking, which is
    // exactly what testers flagged ("notifications are non-existent").
    const sellerIds = [...new Set(orderItems.map((item) => item.sellerSnapshot.toString()))];
    const sellers = await User.find({ _id: { $in: sellerIds } }).select('pushToken');
    sendPushNotifications(sellers, {
      title: 'New order received',
      body: isServiceOrder
        ? resolvedLocationType === 'at_provider'
          ? 'New booking — the client will bring their vehicle to your workshop. Open the app to accept or decline.'
          : `New booking — the client needs you to come to their vehicle at ${deliveryAddress}. Open the app to accept or decline.`
        : `You have a new order with ${orderItems.length} item${orderItems.length === 1 ? '' : 's'} — open the app to accept or decline.`,
      data: { type: 'new_order', orderId: order._id.toString() }
    });

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

    const deliveries = await Delivery.find({ order: { $in: orders.map((o) => o._id) } }).select('order status');
    const deliveryByOrder = new Map(deliveries.map((d) => [d.order.toString(), d]));

    const filtered = orders.map((order) => ({
      deliveryId: deliveryByOrder.get(order._id.toString())?._id,
      deliveryStatus: deliveryByOrder.get(order._id.toString())?.status,
      deliveryIssue: order.deliveryIssue,
      serviceLocationType: order.serviceLocationType,
      paymentMethod: order.paymentMethod,
      amountDue: order.amountDue ?? order.totalAmount,
      pointsValue: order.pointsValue,
      totalAmount: order.totalAmount,
      providerCompletedAt: order.providerCompletedAt,
      clientConfirmedAt: order.clientConfirmedAt,
      finalizedAt: order.finalizedAt,
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
    if (status === 'cancelled') await refundRedemption(order);

    const client = await User.findById(order.client).select('pushToken');
    if (client) {
      sendPushNotifications([client], {
        title: status === 'confirmed' ? 'Order accepted!' : 'Order declined',
        body:
          status === 'confirmed'
            ? 'The seller accepted your order. Open the app to pay and finish checkout.'
            : 'The seller was unable to fulfil your order this time.',
        data: { type: 'order_status_changed', orderId: order._id.toString(), status }
      });
    }

    res.status(200).json({ order });
  } catch (error) {
    next(error);
  }
};

// @route   PATCH /api/orders/:id/complete
// @access  Private (the provider on this order)
// body: { cashReceived?: true }  — required for cash bookings
//
// STEP 1 of 2 for services. The provider says "the job is done" (and, for a
// cash booking, "I have been paid the cash"). Nothing is final yet: the order
// stays 'confirmed' until the CLIENT confirms too (confirmServiceOrder). Only
// then are payouts created and points awarded. Product orders never use this —
// they finish through the delivery code.
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

    if (order.items.some((item) => item.itemType === 'product')) {
      return res.status(400).json({
        message: 'This order includes physical products and completes automatically once delivered, not manually.'
      });
    }
    if (order.status !== 'confirmed') {
      return res.status(400).json({ message: `Can't complete an order from status "${order.status}".` });
    }
    if (order.providerCompletedAt) {
      return res.status(400).json({ message: 'You already marked this as done — waiting for the client to confirm.' });
    }

    if (order.paymentMethod === 'cash') {
      if (req.body.cashReceived !== true) {
        return res.status(400).json({
          message: `Confirm that you received R${(order.amountDue ?? order.totalAmount).toFixed(2)} cash from the client.`
        });
      }
      order.providerCashConfirmed = true;
    } else if (order.paymentStatus !== 'paid') {
      return res.status(400).json({ message: 'This order needs to be paid before it can be marked complete.' });
    }

    order.providerCompletedAt = new Date();
    await order.save();

    const client = await User.findById(order.client).select('pushToken');
    if (client) {
      sendPushNotifications([client], {
        title: 'Please confirm your service',
        body:
          order.paymentMethod === 'cash'
            ? 'Your provider says the job is done and they received your cash. Open the app to confirm.'
            : 'Your provider says the job is done. Open the app to confirm.',
        data: { type: 'confirm_service', orderId: order._id.toString() }
      });
    }
    req.app.get('io')?.to(`client_${order.client}`).emit('service_awaiting_confirmation', { orderId: order._id.toString() });

    res.status(200).json({ order });
  } catch (error) {
    next(error);
  }
};

// @route   POST /api/orders/:id/confirm
// @access  Private (the client who booked)
// body: { cashPaid?: true }  — required for cash bookings
//
// STEP 2 of 2. The client confirms the work was done (and, for cash, that they
// paid). Both sides having confirmed finalizes the sale: payouts, 8%
// commission, rewards points, live earnings update.
const confirmServiceOrder = async (req, res, next) => {
  try {
    const order = await Order.findById(req.params.id);
    if (!order) return res.status(404).json({ message: 'Order not found' });
    if (order.client.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Only the client who booked this can confirm it.' });
    }
    if (order.items.some((item) => item.itemType === 'product')) {
      return res.status(400).json({ message: 'Product orders are confirmed with the delivery code.' });
    }
    if (!order.providerCompletedAt) {
      return res.status(400).json({ message: 'The provider has not marked this job as done yet.' });
    }
    if (order.clientConfirmedAt) {
      return res.status(400).json({ message: 'You have already confirmed this.' });
    }
    if (order.paymentMethod === 'cash') {
      if (req.body.cashPaid !== true) {
        return res.status(400).json({
          message: `Confirm that you paid R${(order.amountDue ?? order.totalAmount).toFixed(2)} cash to the provider.`
        });
      }
      order.clientCashConfirmed = true;
    }
    order.clientConfirmedAt = new Date();
    await order.save();

    await finalizeServiceOrder(order._id, req.app.get('io'));
    const fresh = await Order.findById(order._id);
    res.status(200).json({ order: fresh });
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

    if (!paymentReference && (order.amountDue ?? order.totalAmount) > 0) {
      return res.status(400).json({ message: 'Payment reference is required' });
    }
    if (order.paymentMethod === 'cash') {
      return res.status(400).json({ message: 'This is a cash booking — you pay the provider directly after the work is done.' });
    }
    const expectedAmount = order.amountDue ?? order.totalAmount;

    let verification;
    if (expectedAmount === 0) {
      // Fully covered by rewards points: nothing to charge, nothing to verify.
      verification = { status: 'success', amount: 0, metadata: { orderId: order._id.toString() } };
    } else if (isTestReference(paymentReference)) {
      // Temporary tester-only path — see utils/testPayments.js.
      if (!isTestPaymentAllowedFor(req.user)) {
        return res.status(403).json({ message: 'Test payments are not enabled for this account.' });
      }
      verification = buildTestVerification('orderId', order._id, expectedAmount);
    } else try {
      verification = await verifyPaystackTransaction(paymentReference);
    } catch (verifyError) {
      console.error('Paystack verification request failed:', verifyError?.response?.data || verifyError.message);
      // The user gets a clean "try again" — but if Paystack itself is
      // down or misconfigured, every payment attempt will fail this
      // way and every affected user will just quietly give up rather
      // than file a support ticket. Reported so a spike in these shows
      // up as an alert, not as a slow trickle of unexplained churn.
      reportSilentFailure(verifyError, 'paystack-verification', {
        orderId: order._id.toString(),
        paymentReference
      });
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

    if (!amountMatchesExpected(verification.amount, expectedAmount)) {
      return res.status(402).json({ message: "Payment amount does not match this order's total" });
    }

    order.paymentStatus = 'paid';
    if (expectedAmount > 0) order.paymentReference = paymentReference;
    await order.save();

    const sellerIds = [...new Set(order.items.map((item) => item.sellerSnapshot.toString()))];
    const sellers = await User.find({ _id: { $in: sellerIds } }).select('pushToken');
    sendPushNotifications(sellers, {
      title: 'Payment received',
      body: `The client paid R${order.totalAmount} — you can start preparing this order.`,
      data: { type: 'order_paid', orderId: order._id.toString() }
    });

    // Order is now both accepted and paid — this is the moment a physical
    // delivery job (if the order has any products) gets created and pushed
    // out to all online drivers.
    try {
      const io = req.app.get('io');
      await createDeliveryForOrder(order, io);
    } catch (deliveryError) {
      // A delivery-creation failure should never block a successful payment
      // from being recorded — log it and let the order stand as paid.
      // But this is exactly the kind of failure a client would only ever
      // discover by waiting for a delivery that's never coming — reported
      // with the order id so an admin can manually create the delivery or
      // refund, ideally before the client notices anything is wrong.
      console.error(`Failed to create delivery for order ${order._id}:`, deliveryError);
      reportSilentFailure(deliveryError, 'delivery-creation', {
        orderId: order._id.toString(),
        totalAmount: order.totalAmount
      });
    }

    res.status(200).json({ order });
  } catch (error) {
    next(error);
  }
};

module.exports = { getCheckoutQuote, checkout, getMyOrders, getIncomingOrders, getOrderById, updateOrderStatus, completeServiceOrder, confirmServiceOrder, payOrder };