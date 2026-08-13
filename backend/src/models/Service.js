const mongoose = require('mongoose');

const specSchema = new mongoose.Schema(
  {
    key: { type: String, required: true, trim: true },
    value: { type: String, required: true, trim: true }
  },
  { _id: false }
);

const serviceSchema = new mongoose.Schema(
  {
    provider: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },
    name: {
      type: String,
      required: [true, 'Service name is required'],
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
      // e.g. [{ key: 'Duration', value: '2-3 hours' }, { key: 'Includes', value: 'Parts & labor' }]
      type: [specSchema],
      default: []
    },
    images: {
      type: [String],
      default: [],
      validate: {
        validator: function (arr) {
          return arr.length <= 5;
        },
        message: 'A service can have a maximum of 5 images'
      }
    },
    durationEstimate: {
      // e.g. "2-3 hours", "1 day"
      type: String,
      trim: true,
      required: [true, 'Duration estimate is required']
    },
    availability: {
      type: String,
      enum: ['Available', 'Booked Out', 'By Appointment'],
      default: 'Available'
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

serviceSchema.index({ name: 'text', description: 'text', category: 'text' });

serviceSchema.virtual('thumbnail').get(function () {
  return this.images && this.images.length > 0 ? this.images[0] : null;
});

serviceSchema.set('toJSON', { virtuals: true });
serviceSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('Service', serviceSchema);
