const mongoose = require('mongoose');

const specSchema = new mongoose.Schema(
  {
    key: { type: String, required: true, trim: true },
    value: { type: String, required: true, trim: true }
  },
  { _id: false }
);

const productSchema = new mongoose.Schema(
  {
    shop: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },
    name: {
      type: String,
      required: [true, 'Product name is required'],
      trim: true
    },
    price: {
      type: Number,
      required: [true, 'Price is required'],
      min: [0, 'Price cannot be negative']
    },
    category: {
      type: String,
      required: [true, 'Category is required'],
      trim: true
    },
    description: {
      type: String,
      required: [true, 'Description is required'],
      trim: true
    },
    specs: {
      // e.g. [{ key: 'Material', value: 'Cast Iron / Aluminum Alloy' }, ...]
      type: [specSchema],
      default: []
    },
    images: {
      // base64 data URIs, e.g. "data:image/jpeg;base64,...."
      type: [String],
      default: [],
      validate: {
        validator: function (arr) {
          return arr.length <= 5;
        },
        message: 'A product can have a maximum of 5 images'
      }
    },
    stock: {
      type: Number,
      required: [true, 'Stock count is required'],
      min: [0, 'Stock cannot be negative'],
      default: 0
    },
    condition: {
      type: String,
      enum: ['Brand New', 'Used', 'Refurbished'],
      default: 'Brand New'
    },
    deliveryEstimate: {
      type: String,
      trim: true,
      default: '3-5 business days'
    },
    isActive: {
      type: Boolean,
      default: true
    },
    ratingAverage: {
      type: Number,
      default: 0,
      min: 0,
      max: 5
    },
    ratingCount: {
      type: Number,
      default: 0
    }
  },
  { timestamps: true }
);

productSchema.index({ name: 'text', description: 'text', category: 'text' });

// Lightweight projection for list views — excludes heavy fields like images/specs/description
productSchema.statics.listProjection = function () {
  return 'name price category condition ratingAverage ratingCount stock shop createdAt thumbnail';
};

// Virtual: first image only, used for list/card views so we don't ship all images in list queries
productSchema.virtual('thumbnail').get(function () {
  return this.images && this.images.length > 0 ? this.images[0] : null;
});

productSchema.set('toJSON', { virtuals: true });
productSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('Product', productSchema);
