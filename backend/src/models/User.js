const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const { VALID_ROADSIDE_SERVICES } = require('../config/roadsideServices');

// 'admin' is deliberately NOT in authController.js's own registration
// role list — that list is what actually blocks public self-registration
// as admin, and stays that way on purpose. Admin accounts are only ever
// created via scripts/seedAdmin.js, directly against the database.
const ROLES = ['client', 'service_provider', 'shop', 'admin'];

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Name is required'],
      trim: true
    },
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      lowercase: true,
      trim: true
    },
    phone: {
      type: String,
      required: [true, 'Phone number is required'],
      trim: true
    },
    password: {
      type: String,
      required: [true, 'Password is required'],
      minlength: 6,
      select: false
    },
    role: {
      type: String,
      enum: ROLES,
      required: [true, 'Role is required']
    },

    // Business fields — required only for service_provider and shop, enforced in pre-validate hook below
    businessName: {
      type: String,
      trim: true
    },
    businessAddress: {
      type: String,
      trim: true
    },
    category: {
      type: String,
      trim: true
    },

    // Drivers are service_provider accounts with isDriver: true — this
    // covers DELIVERY only (shop orders to a client's address, any
    // vehicle). It's intentionally separate from roadsideServices below:
    // a delivery driver has no business being dispatched to tow a
    // stranded vehicle, and vice versa. One person can hold both, but
    // each is checked independently.
    isDriver: {
      type: Boolean,
      default: false
    },
    // Which roadside assistance services this account offers, if any —
    // empty array means "not a roadside responder." Matching (see
    // utils/matching.js) filters by whichever specific service a
    // request needs. tow_sling and tow_rollback are separate (not a
    // generic 'towing') because they're genuinely different equipment:
    // a sling can only tow manual-transmission cars, a rollback can tow
    // either — a driver who only owns a sling truck has no business
    // being dispatched to an automatic car's tow request.
    roadsideServices: {
      type: [String],
      enum: VALID_ROADSIDE_SERVICES,
      default: []
    },
    vehicleDetails: {
      make: { type: String, trim: true },
      model: { type: String, trim: true },
      licensePlate: { type: String, trim: true }
    },

    // Shared by both delivery drivers and roadside responders — location
    // and online status mean the same thing regardless of which job
    // they're eligible for. Unused (and harmless) for clients and shops.
    // GeoJSON Point + 2dsphere index below is what lets matching.js find
    // nearby available drivers/responders with $near.
    isOnline: {
      type: Boolean,
      default: false
    },
    isAvailable: {
      type: Boolean,
      default: false
    },
    currentLocation: {
      type: { type: String, enum: ['Point'], default: 'Point' },
      coordinates: { type: [Number], default: [0, 0] } // [longitude, latitude]
    },
    // Expo push token — set whenever the app registers for notifications
    // on this device. Not role-restricted: clients need push too (ride
    // accepted, driver arrived), not just dispatch-eligible drivers.
    pushToken: {
      type: String
    },

    waiverAccepted: {
      type: Boolean,
      required: true,
      default: false
    },
    waiverAcceptedAt: {
      type: Date
    },

    refreshToken: {
      type: String,
      select: false
    },

    resetPasswordToken: {
      type: String,
      select: false
    },
    resetPasswordExpires: {
      type: Date,
      select: false
    },

    // KYC — entirely optional at registration time. Images stored as base64
    // data URIs, same pattern as product/service images.
    kycDocuments: [
      {
        type: {
          type: String,
          enum: [
            'id_document',
            'proof_of_address',
            'selfie',
            'drivers_license',
            'business_registration',
            'vehicle_registration',
            'other'
          ],
          required: true
        },
        label: { type: String, required: true, trim: true },
        image: { type: String, required: true },
        uploadedAt: { type: Date, default: Date.now }
      }
    ],
    kycStatus: {
      type: String,
      enum: ['not_submitted', 'pending', 'approved', 'rejected'],
      default: 'not_submitted'
    },
    kycReviewNote: { type: String },
    kycReviewedAt: { type: Date },
    kycReviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
  },
  { timestamps: true }
);

// Enables Ride matching's $near query to find nearby available drivers.
userSchema.index({ currentLocation: '2dsphere' });

// Enforce business fields for service_provider and shop roles
userSchema.pre('validate', function (next) {
  if (this.role === 'service_provider' || this.role === 'shop') {
    const err = new mongoose.Error.ValidationError(this);
    let hasError = false;

    if (!this.businessName) {
      err.addError('businessName', new mongoose.Error.ValidatorError({
        message: 'Business name is required for this account type',
        path: 'businessName',
        value: this.businessName
      }));
      hasError = true;
    }
    if (!this.businessAddress) {
      err.addError('businessAddress', new mongoose.Error.ValidatorError({
        message: 'Business address is required for this account type',
        path: 'businessAddress',
        value: this.businessAddress
      }));
      hasError = true;
    }

    if (hasError) return next(err);
  }
  next();
});

// Enforce waiver acceptance before a user document can be created
userSchema.pre('validate', function (next) {
  if (!this.waiverAccepted) {
    const err = new mongoose.Error.ValidationError(this);
    err.addError('waiverAccepted', new mongoose.Error.ValidatorError({
      message: 'You must accept the waiver to register',
      path: 'waiverAccepted',
      value: this.waiverAccepted
    }));
    return next(err);
  }
  next();
});

userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

userSchema.methods.comparePassword = async function (candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

userSchema.methods.toSafeObject = function () {
  return {
    id: this._id,
    name: this.name,
    email: this.email,
    phone: this.phone,
    role: this.role,
    businessName: this.businessName,
    businessAddress: this.businessAddress,
    category: this.category,
    isDriver: this.isDriver,
    roadsideServices: this.roadsideServices,
    vehicleDetails: this.vehicleDetails,
    isOnline: this.isOnline,
    isAvailable: this.isAvailable,
    waiverAccepted: this.waiverAccepted,
    kycStatus: this.kycStatus,
    kycReviewNote: this.kycReviewNote,
    kycDocumentCount: this.kycDocuments?.length || 0,
    createdAt: this.createdAt
  };
};

module.exports = mongoose.model('User', userSchema);
module.exports.ROLES = ROLES;