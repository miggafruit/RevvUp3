const { isTestPaymentAllowedFor } = require('../utils/testPayments');
const { requiresPoliceClearance, hasValidClearance } = require('../config/clearance');
const Delivery = require('../models/Delivery');
const Order = require('../models/Order');
const User = require('../models/User');
const { findAvailableDeliveryDrivers } = require('../utils/matching');
const { sendPushNotifications } = require('../utils/pushNotifications');
const { createPayoutEntry } = require('../utils/payouts');
const { afterProductDelivered } = require('../services/orderFinalization');

/**
 * Sends a push to a delivery's client. Deliberately does its own
 * separate User lookup rather than ever populating delivery.client —
 * that field is used for socket room-targeting elsewhere
 * (`client_${delivery.client}`), and populating it would reintroduce
 * the exact bug already fixed in ehailingController: a populated
 * Mongoose document doesn't stringify to just its id, so the room name
 * would silently become garbage nobody's actually listening on.
 */
const notifyDeliveryClient = async (delivery, { title, body, data }) => {
  const client = await User.findById(delivery.client).select('pushToken');
  if (client) {
    sendPushNotifications([client], { title, body, data });
  }
};

// Internal helper — called from orderController.payOrder once a confirmed
// order is actually paid for. Not exposed as its own route.
// Only physical products need a driver; service-only orders return null.
const createDeliveryForOrder = async (order, io) => {
  const productItems = order.items.filter((item) => item.itemType === 'product');
  if (productItems.length === 0) return null;

  const existing = await Delivery.findOne({ order: order._id });
  if (existing) return existing;

  // Single-seller cart assumption, same one already documented in orderController.
  const shopId = productItems[0].sellerSnapshot;
  const shop = await User.findById(shopId);
  if (!shop) return null;

  const delivery = await Delivery.create({
    order: order._id,
    client: order.client,
    shop: shop._id,
    pickupAddress: shop.businessAddress || 'Shop address not set',
    pickupPhone: shop.phone,
    dropoffAddress: order.deliveryAddress,
    dropoffPhone: order.contactPhone,
    items: productItems.map((item) => ({
      nameSnapshot: item.nameSnapshot,
      quantity: item.quantity
    })),
    totalAmount: order.totalAmount,
    status: 'pending'
  });

  // Every isDriver delivery driver gets targeted individually — not
  // the generic "drivers" room, which also includes roadside-only
  // responders who have no business seeing a delivery job they can't
  // accept. Not distance-filtered (Delivery.js has no pickup
  // coordinates at all yet), just role-correct. Mirrors exactly how
  // ehailingController.createRequest targets drivers individually.
  const availableDrivers = await findAvailableDeliveryDrivers();
  if (io) {
    availableDrivers.forEach((driver) => {
      io.to(`driver_${driver._id}`).emit('new_delivery', delivery);
    });
  }

  sendPushNotifications(availableDrivers, {
    title: 'New delivery job',
    body: `A delivery from ${shop.businessName || 'a shop'} is available.`,
    data: { type: 'new_delivery', deliveryId: String(delivery._id) }
  });

  return delivery;
};

// @route   GET /api/deliveries/pending
// @access  Private (service_provider, isDriver)
const getPendingDeliveries = async (req, res, next) => {
  try {
    if (!req.user.isDriver) {
      return res.status(403).json({ message: 'Only registered drivers can view delivery jobs' });
    }
    const deliveries = await Delivery.find({ status: 'pending' }).sort({ createdAt: -1 });
    res.status(200).json({ deliveries });
  } catch (error) {
    next(error);
  }
};

// @route   GET /api/deliveries/my-active
// @access  Private (service_provider, isDriver)
// Lets a driver reload whatever delivery they're currently assigned to
// (accepted or picked_up) — without this, closing and reopening the
// app mid-delivery left no way back to it, the same gap already found
// and fixed for roadside assistance.
const getMyActiveDelivery = async (req, res, next) => {
  try {
    if (!req.user.isDriver) {
      return res.status(403).json({ message: 'Only registered drivers can view delivery jobs' });
    }
    const delivery = await Delivery.findOne({
      'driver.driver_id': req.user._id.toString(),
      status: { $in: ['accepted', 'picked_up'] }
    });
    res.status(200).json({ delivery: delivery || null });
  } catch (error) {
    next(error);
  }
};

// @route   POST /api/deliveries/:id/accept
// @access  Private (service_provider, isDriver)
const acceptDelivery = async (req, res, next) => {
  try {
    if (!req.user.isDriver) {
      return res.status(403).json({ message: 'Only registered drivers can accept deliveries' });
    }
    // Matching already filters by kycStatus: 'approved' — this is a
    // second check for anyone who reaches this endpoint some other way.
    if (req.user.kycStatus !== 'approved' || (requiresPoliceClearance(req.user) && !hasValidClearance(req.user))) {
      return res.status(403).json({ message: 'Your account needs complete, current verification (including a verified police clearance) before accepting deliveries.' });
    }

    const delivery = await Delivery.findById(req.params.id);
    if (!delivery) return res.status(404).json({ message: 'Delivery not found' });
    if (delivery.status !== 'pending') {
      return res.status(409).json({ message: 'This delivery has already been taken' });
    }

    delivery.status = 'accepted';
    delivery.driver = {
      driver_id: req.user._id.toString(),
      driver_name: req.user.name,
      driver_phone: req.user.phone,
      driver_vehicle:
        req.body.driver_vehicle ||
        [req.user.vehicleDetails?.make, req.user.vehicleDetails?.model].filter(Boolean).join(' '),
      driver_location: req.body.driver_location || undefined
    };
    delivery.acceptedAt = new Date();
    await delivery.save();

    const io = req.app.get('io');
    if (io) {
      io.to(`client_${delivery.client}`).emit('delivery_accepted', delivery);
      io.to('drivers').emit('delivery_taken', { delivery_id: delivery._id.toString() });
    }

    notifyDeliveryClient(delivery, {
      title: 'Driver on the way',
      body: `${req.user.name} accepted your delivery and is heading to pick it up.`,
      data: { type: 'delivery_accepted', deliveryId: delivery._id.toString() }
    });

    res.status(200).json({ delivery });
  } catch (error) {
    next(error);
  }
};

// @route   POST /api/deliveries/:id/location
// @access  Private (assigned driver)
const updateDeliveryLocation = async (req, res, next) => {
  try {
    const { latitude, longitude } = req.body;
    const delivery = await Delivery.findById(req.params.id);
    if (!delivery) return res.status(404).json({ message: 'Delivery not found' });
    if (delivery.driver?.driver_id !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Only the driver assigned to this delivery can do that.' });
    }

    if (delivery.driver) {
      delivery.driver.driver_location = { latitude, longitude };
      await delivery.save();
    }

    const io = req.app.get('io');
    if (io) {
      io.to(`client_${delivery.client}`).emit('delivery_location_update', {
        delivery_id: delivery._id.toString(),
        latitude,
        longitude
      });
    }

    res.status(200).json({ success: true });
  } catch (error) {
    next(error);
  }
};

// @route   POST /api/deliveries/:id/picked-up
// @access  Private (assigned driver)
const markPickedUp = async (req, res, next) => {
  try {
    const delivery = await Delivery.findById(req.params.id);
    if (!delivery) return res.status(404).json({ message: 'Delivery not found' });
    if (delivery.driver?.driver_id !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Only the driver assigned to this delivery can do that.' });
    }
    if (delivery.status !== 'accepted') {
      return res.status(409).json({ message: 'This delivery is not waiting to be picked up.' });
    }

    delivery.status = 'picked_up';
    delivery.pickedUpAt = new Date();
    await delivery.save();

    const io = req.app.get('io');
    if (io) {
      io.to(`client_${delivery.client}`).emit('delivery_picked_up', { delivery_id: delivery._id.toString() });
    }

    notifyDeliveryClient(delivery, {
      title: 'Order picked up',
      body: 'Your driver has collected your order and is on the way to you.',
      data: { type: 'delivery_picked_up', deliveryId: delivery._id.toString() }
    });

    res.status(200).json({ delivery });
  } catch (error) {
    next(error);
  }
};

// @route   POST /api/deliveries/:id/delivered
// @access  Private (assigned driver)
const markDelivered = async (req, res, next) => {
  try {
    const delivery = await Delivery.findById(req.params.id);
    if (!delivery) return res.status(404).json({ message: 'Delivery not found' });
    if (delivery.driver?.driver_id !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Only the driver assigned to this delivery can do that.' });
    }
    // Prevents a second tap / replayed request from creating duplicate payouts.
    if (delivery.status !== 'picked_up') {
      return res.status(409).json({ message: 'This delivery has not been picked up, or is already delivered.' });
    }

    // Proof of delivery: the client's code. Attempts are counted atomically in
    // the database (before comparing) so parallel guesses can't squeeze past
    // the limit, and the count survives app restarts.
    const submitted = String(req.body.code ?? '').trim();
    if (!/^\d{4}$/.test(submitted)) {
      return res.status(400).json({ message: 'Enter the 4-digit code from the client.' });
    }
    const attemptDoc = await Delivery.findOneAndUpdate(
      { _id: delivery._id, status: 'picked_up', codeAttempts: { $lt: MAX_CODE_ATTEMPTS } },
      { $inc: { codeAttempts: 1 } },
      { new: true }
    ).select('+deliveryCode');
    if (!attemptDoc) {
      return res.status(409).json({ message: 'No attempts left. Return the order to the shop.', returnToShop: true });
    }
    if (!attemptDoc.deliveryCode) {
      return res.status(409).json({ message: 'This delivery has no code yet — ask the client to open their tracking screen.' });
    }
    const a = Buffer.from(attemptDoc.deliveryCode);
    const b = Buffer.from(submitted);
    const matches = a.length === b.length && crypto.timingSafeEqual(a, b);
    if (!matches) {
      const remaining = MAX_CODE_ATTEMPTS - attemptDoc.codeAttempts;
      if (remaining > 0) {
        return res.status(400).json({
          message: `Wrong code. ${remaining} attempt${remaining === 1 ? '' : 's'} left.`,
          attemptsRemaining: remaining
        });
      }
      // Third wrong try: the delivery cannot be completed. Driver takes the
      // product back to the shop.
      attemptDoc.status = 'return_to_shop';
      attemptDoc.returnRequestedAt = new Date();
      await attemptDoc.save();
      const ioReturn = req.app.get('io');
      ioReturn?.to(`client_${attemptDoc.client}`).emit('delivery_return_to_shop', { delivery_id: attemptDoc._id.toString() });
      notifyDeliveryClient(attemptDoc, {
        title: 'Delivery not completed',
        body: 'The delivery code was entered incorrectly 3 times, so the driver is taking your order back to the shop. Contact support if you believe this is a mistake.',
        data: { type: 'delivery_return_to_shop', deliveryId: attemptDoc._id.toString() }
      });
      const shopUser = await User.findById(attemptDoc.shop).select('pushToken');
      if (shopUser) {
        sendPushNotifications([shopUser], {
          title: 'Order coming back',
          body: 'A delivery could not be completed (wrong code 3 times). The driver is returning the order to you — confirm when you receive it.',
          data: { type: 'delivery_return_to_shop', deliveryId: attemptDoc._id.toString() }
        });
      }
      return res.status(423).json({
        message: 'Wrong code 3 times. Do NOT hand over the order — take it back to the shop.',
        attemptsRemaining: 0,
        returnToShop: true,
        delivery: attemptDoc
      });
    }

    delivery.status = 'delivered';
    delivery.deliveredAt = new Date();
    await delivery.save();

    // Once physically delivered, the underlying order is fully complete.
    const order = await Order.findByIdAndUpdate(delivery.order, { status: 'completed' }, { new: true });

    if (order) {
      // Delivery fee goes to whoever actually did the delivery — not
      // the seller, who never touches the courier side of this at all.
      if (delivery.driver?.driver_id && order.deliveryFee > 0) {
        await createPayoutEntry({
          recipient: delivery.driver.driver_id,
          amount: order.deliveryFee,
          sourceType: 'delivery_fee',
          sourceId: delivery._id
        });
      }
      // Seller's share is the order total minus the delivery fee —
      // their actual product/service revenue, not the courier's cut.
      // Single-seller-cart is enforced elsewhere in this codebase, so
      // every item here shares the same seller.
      const sellerId = order.items[0]?.sellerSnapshot;
      const sellerShare = order.totalAmount - (order.deliveryFee || 0);
      if (sellerId && sellerShare > 0) {
        await createPayoutEntry({
          recipient: sellerId,
          amount: sellerShare,
          sourceType: 'order_seller_share',
          sourceId: order._id
        });
      }
    }

    const io = req.app.get('io');
    if (io) {
      io.to(`client_${delivery.client}`).emit('delivery_completed', { delivery_id: delivery._id.toString() });
    }

    // Points for the client + live earnings updates for seller and driver.
    afterProductDelivered(order, io, { driverId: delivery.driver?.driver_id }).catch((err) =>
      console.warn('[delivery] post-delivery follow-ups failed:', err.message)
    );

    notifyDeliveryClient(delivery, {
      title: 'Delivered',
      body: 'Your order has been delivered.',
      data: { type: 'delivery_completed', deliveryId: delivery._id.toString() }
    });

    res.status(200).json({ delivery });
  } catch (error) {
    next(error);
  }
};

// @route   POST /api/deliveries/:id/test-advance
// @access  Private (client, tester allowlist only — see utils/testPayments.js)
// TEMPORARY testing aid: lets ONE tester walk their own delivery through
// accepted -> picked up -> delivered without needing a second phone/driver
// account. Uses a clearly-named fake driver, creates NO payouts, and is
// rejected for everyone not on TEST_PAYMENT_EMAILS.
const testAdvanceDelivery = async (req, res, next) => {
  try {
    if (!isTestPaymentAllowedFor(req.user)) {
      return res.status(403).json({ message: 'Test tools are not enabled for this account.' });
    }
    const delivery = await Delivery.findById(req.params.id);
    if (!delivery) return res.status(404).json({ message: 'Delivery not found' });
    if (delivery.client.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Not your delivery.' });
    }

    const io = req.app.get('io');
    const id = delivery._id.toString();

    if (delivery.status === 'pending') {
      delivery.status = 'accepted';
      delivery.driver = {
        driver_id: 'TEST_DRIVER',
        driver_name: 'Test Driver (simulated)',
        driver_phone: '0000000000',
        driver_vehicle: 'Test Vehicle'
      };
      delivery.acceptedAt = new Date();
      await delivery.save();
      io?.to(`client_${delivery.client}`).emit('delivery_accepted', delivery);
    } else if (delivery.status === 'accepted') {
      delivery.status = 'picked_up';
      delivery.pickedUpAt = new Date();
      await delivery.save();
      io?.to(`client_${delivery.client}`).emit('delivery_picked_up', { delivery_id: id });
    } else if (delivery.status === 'picked_up') {
      delivery.status = 'delivered';
      delivery.deliveredAt = new Date();
      await delivery.save();
      await Order.findByIdAndUpdate(delivery.order, { status: 'completed' });
      io?.to(`client_${delivery.client}`).emit('delivery_completed', { delivery_id: id });
    } else {
      return res.status(409).json({ message: 'This delivery is already finished.' });
    }

    res.status(200).json({ delivery });
  } catch (error) {
    next(error);
  }
};

// @route   GET /api/deliveries/order/:orderId
// @access  Private (owner client, assigned driver, or the shop)
const getDeliveryByOrder = async (req, res, next) => {
  try {
    const delivery = await Delivery.findOne({ order: req.params.orderId });
    if (!delivery) return res.status(404).json({ message: 'No delivery found for this order' });

    const isOwner = delivery.client.toString() === req.user._id.toString();
    const isAssignedDriver = delivery.driver?.driver_id === req.user._id.toString();
    const isShop = delivery.shop.toString() === req.user._id.toString();

    if (!isOwner && !isAssignedDriver && !isShop) {
      return res.status(403).json({ message: 'You do not have permission to view this delivery' });
    }

    // Only the client ever receives the code (created lazily for deliveries
    // made before this feature existed).
    const out = delivery.toJSON();
    if (isOwner && ['accepted', 'picked_up'].includes(delivery.status)) {
      const withCode = await Delivery.findById(delivery._id).select('+deliveryCode');
      if (!withCode.deliveryCode) {
        withCode.deliveryCode = generateCode();
        await withCode.save();
      }
      out.deliveryCode = withCode.deliveryCode;
    }
    res.status(200).json({ delivery: out });
  } catch (error) {
    next(error);
  }
};

// @route   POST /api/deliveries/:id/confirm-returned
// @access  Private (the shop that sent the order)
// The shop confirms the driver brought the order back. Stock is restored and
// the order is flagged so an admin can decide on a refund — money is never
// moved automatically.
const confirmReturned = async (req, res, next) => {
  try {
    const delivery = await Delivery.findById(req.params.id);
    if (!delivery) return res.status(404).json({ message: 'Delivery not found' });
    if (delivery.shop.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Only the shop that sent this order can confirm its return.' });
    }
    if (delivery.status !== 'return_to_shop') {
      return res.status(409).json({ message: 'This delivery is not waiting to be returned.' });
    }

    delivery.status = 'returned';
    delivery.returnedAt = new Date();
    await delivery.save();

    const Product = require('../models/Product');
    const order = await Order.findById(delivery.order);
    if (order) {
      await Promise.all(
        order.items
          .filter((i) => i.itemType === 'product')
          .map((i) => Product.findByIdAndUpdate(i.product, { $inc: { stock: i.quantity } }))
      );
      order.deliveryIssue = 'failed_code_returned';
      await order.save();
    }

    notifyDeliveryClient(delivery, {
      title: 'Order returned to the shop',
      body: 'Your order is back with the shop. Our team will contact you about next steps.',
      data: { type: 'delivery_returned', deliveryId: delivery._id.toString() }
    });
    req.app.get('io')?.to(`client_${delivery.client}`).emit('delivery_returned', { delivery_id: delivery._id.toString() });

    res.status(200).json({ delivery });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  createDeliveryForOrder,
  getPendingDeliveries,
  getMyActiveDelivery,
  acceptDelivery,
  updateDeliveryLocation,
  markPickedUp,
  markDelivered,
  getDeliveryByOrder,
  confirmReturned,
  testAdvanceDelivery
};