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
      enum: ['pending', 'accepted', 'picked_up', 'delivered', 'cancelled'],
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
    acceptedAt: Date,
    pickedUpAt: Date,
    deliveredAt: Date
  },
  { timestamps: true }
);

module.exports = mongoose.model('Delivery', deliverySchema);