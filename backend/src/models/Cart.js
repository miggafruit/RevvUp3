const mongoose = require('mongoose');

const cartItemSchema = new mongoose.Schema(
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
    quantity: {
      type: Number,
      required: true,
      min: [1, 'Quantity must be at least 1'],
      default: 1
    }
  },
  { _id: true, timestamps: true }
);

// Ensure exactly one of product/service is set, matching itemType
cartItemSchema.pre('validate', function (next) {
  if (this.itemType === 'product' && !this.product) {
    return next(new Error('product reference is required when itemType is "product"'));
  }
  if (this.itemType === 'service' && !this.service) {
    return next(new Error('service reference is required when itemType is "service"'));
  }
  next();
});

const cartSchema = new mongoose.Schema(
  {
    client: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true,
      index: true
    },
    items: {
      type: [cartItemSchema],
      default: []
    }
  },
  { timestamps: true }
);

module.exports = mongoose.model('Cart', cartSchema);
