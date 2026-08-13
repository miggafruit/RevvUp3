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