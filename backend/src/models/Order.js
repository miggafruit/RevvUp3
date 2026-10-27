const mongoose = require('mongoose');

const orderItemSchema = new mongoose.Schema(
  {
    itemType: {
      type: String,
      enum: ['product', 'service'],
      required: true
    },
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product'
    },
    service: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Service'
    },
    nameSnapshot: { type: String, required: true },
    priceSnapshot: { type: Number, required: true },
    sellerSnapshot: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    quantity: {
      type: Number,
      required: true,
      min: 1
    },
    lineTotal: {
      type: Number,
      required: true
    }
  },
  { _id: false }
);

const orderSchema = new mongoose.Schema(
  {
    client: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },
    items: {
      type: [orderItemSchema],
      validate: {
        validator: (arr) => arr.length > 0,
        message: 'Order must contain at least one item'
      }
    },
    totalAmount: {
      type: Number,
      required: true,
      min: 0
    },
    // Included IN totalAmount, not on top of it — tracked separately
    // so checkout/order-detail screens can show "Subtotal + Delivery =
    // Total" instead of one opaque number. 0 for orders with no
    // product items (services never need physical delivery).
    deliveryFee: {
      type: Number,
      default: 0,
      min: 0
    },
    // How the fee was worked out, kept for support/disputes.
    deliveryDistanceKm: { type: Number, min: 0 },
    deliveryTier: { type: Number, min: 1, max: 3 },
    totalWeightKg: { type: Number, min: 0 },
    // Services only: 'at_client' = provider travels to the vehicle/location in
    // deliveryAddress; 'at_provider' = client brings the vehicle to the
    // provider's workshop (deliveryAddress holds the provider's address).
    serviceLocationType: {
      type: String,
      enum: ['at_client', 'at_provider']
    },
    deliveryAddress: {
      type: String,
      required: [true, 'Delivery address is required'],
      trim: true
    },
    contactPhone: {
      type: String,
      required: [true, 'Contact phone is required'],
      trim: true
    },
    status: {
      type: String,
      enum: ['pending', 'confirmed', 'completed', 'cancelled'],
      default: 'pending'
    },
    // Set when something went wrong after payment that needs a human decision
    // (e.g. delivery code failed 3 times and the order went back to the shop
    // — the client may be owed a refund).
    // How the client pays. 'card' = Paystack in the app, 'cash' = handed to the
    // provider in person (services only), 'points' = fully covered by rewards.
    paymentMethod: { type: String, enum: ['card', 'cash', 'points'], default: 'card' },
    // Rewards points the client spent on this order and their rand value.
    pointsRedeemed: { type: Number, default: 0, min: 0 },
    pointsValue: { type: Number, default: 0, min: 0 },
    // What the client actually pays (card or cash) = totalAmount - pointsValue.
    // Undefined on older orders, which means "the full totalAmount".
    amountDue: { type: Number, min: 0 },
    // Whether the seller was in the rewards programme when this was ordered
    // (snapshotted so a later lapse can't take away points already promised).
    rewardsEligible: { type: Boolean, default: false },
    pointsEarned: { type: Number, default: 0 },
    // Two-sided completion for services: both must be set before the order is
    // final, payouts are created and points are awarded.
    providerCompletedAt: { type: Date },
    providerCashConfirmed: { type: Boolean, default: false },
    clientConfirmedAt: { type: Date },
    clientCashConfirmed: { type: Boolean, default: false },
    finalizedAt: { type: Date },
    deliveryIssue: { type: String, enum: ['failed_code_returned'] },
    notes: {
      type: String,
      trim: true
    },
    paymentReference: {
      type: String,
      // sparse is essential, not optional — without it, unique alone
      // would treat every unpaid order's absent paymentReference as
      // the same value, and the second unpaid order ever created
      // would fail to save. sparse excludes documents where the field
      // is unset from the uniqueness check entirely.
      unique: true,
      sparse: true
    },
    paymentStatus: {
      type: String,
      enum: ['pending', 'paid', 'failed'],
      default: 'pending'
    }
  },
  { timestamps: true }
);

module.exports = mongoose.model('Order', orderSchema);