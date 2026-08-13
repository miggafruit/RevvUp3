const mongoose = require('mongoose');

const promotionSchema = new mongoose.Schema(
  {
    seller: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },
    // Denormalized so the client can navigate to the right detail screen
    // (ShopDetail vs ProviderDetail) without an extra lookup.
    sellerRole: {
      type: String,
      enum: ['shop', 'service_provider'],
      required: true
    },
    title: {
      type: String,
      required: [true, 'Title is required'],
      trim: true,
      maxlength: 80
    },
    description: {
      type: String,
      required: [true, 'Description is required'],
      trim: true,
      maxlength: 500
    },
    image: {
      type: String // base64 data URI, optional
    },
    tier: {
      type: String,
      enum: ['7_days', '14_days', '30_days'],
      required: true
    },
    price: {
      type: Number,
      required: true
    },
    paymentReference: {
      type: String,
      unique: true,
      sparse: true
    },
    paymentStatus: {
      type: String,
      enum: ['pending', 'paid'],
      default: 'pending'
    },
    // Set only once payment succeeds — a promotion "starts" when it's paid for,
    // not when the draft was created.
    startDate: {
      type: Date
    },
    endDate: {
      type: Date,
      index: true
    }
  },
  { timestamps: true }
);

module.exports = mongoose.model('Promotion', promotionSchema);