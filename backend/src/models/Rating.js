const mongoose = require('mongoose');

const ratingSchema = new mongoose.Schema(
  {
    client: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },
    order: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Order',
      required: true
    },
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
    // Denormalized so a seller's own rating list doesn't need a second
    // lookup through Product/Service just to find out who to credit —
    // same pattern already used elsewhere in this codebase (Order's
    // sellerSnapshot, Ride's driver snapshot).
    seller: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    rating: {
      type: Number,
      required: true,
      min: 1,
      max: 5
    },
    comment: {
      type: String,
      trim: true,
      maxlength: 1000
    }
  },
  { timestamps: true, toJSON: { virtuals: true } }
);

// One rating per client per item per order — not per client per item
// overall, since the same client could legitimately order the same
// product twice and have a different experience each time.
ratingSchema.index(
  { client: 1, order: 1, itemType: 1, product: 1, service: 1 },
  { unique: true }
);

module.exports = mongoose.model('Rating', ratingSchema);
