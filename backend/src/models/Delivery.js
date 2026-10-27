const mongoose = require('mongoose');

const deliverySchema = new mongoose.Schema(
  {
    order: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Order',
      required: true,
      unique: true,
      index: true
    },
    client: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    shop: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    pickupAddress: { type: String, required: true, trim: true },
    pickupPhone: { type: String, trim: true },
    dropoffAddress: { type: String, required: true, trim: true },
    dropoffPhone: { type: String, required: true, trim: true },
    items: [
      {
        nameSnapshot: { type: String, required: true },
        quantity: { type: Number, required: true }
      }
    ],
    totalAmount: { type: Number, required: true },
    status: {
      type: String,
      enum: ['pending', 'accepted', 'picked_up', 'delivered', 'return_to_shop', 'returned', 'cancelled'],
      default: 'pending'
    },
    driver: {
      driver_id: String,
      driver_name: String,
      driver_phone: String,
      driver_vehicle: String,
      driver_location: {
        latitude: Number,
        longitude: Number
      }
    },
    // Proof-of-delivery code. The CLIENT sees it; the driver never does and
    // must ask the client for it. select:false + the toJSON transform below
    // mean it can never leak through a normal query or a socket payload.
    deliveryCode: { type: String, select: false },
    codeAttempts: { type: Number, default: 0 },
    returnRequestedAt: Date,
    returnedAt: Date,
    acceptedAt: Date,
    pickedUpAt: Date,
    deliveredAt: Date
  },
  { timestamps: true }
);

deliverySchema.set('toJSON', {
  transform: (doc, ret) => {
    delete ret.deliveryCode;
    return ret;
  }
});

module.exports = mongoose.model('Delivery', deliverySchema);