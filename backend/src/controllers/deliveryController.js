const Delivery = require('../models/Delivery');
const Order = require('../models/Order');
const User = require('../models/User');
const { findAvailableDeliveryDrivers } = require('../utils/matching');
const { sendPushNotifications } = require('../utils/pushNotifications');
const { createPayoutEntry } = require('../utils/payouts');

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
    if (req.user.kycStatus !== 'approved') {
      return res.status(403).json({ message: 'Your account needs to complete verification before accepting deliveries.' });
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
  getDeliveryByOrder
};