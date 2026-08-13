const mongoose = require('mongoose');

const rideSchema = new mongoose.Schema(
  {
    client: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },
    // Denormalized snapshot, same pattern as Delivery.js's `driver` field —
    // avoids a populate() just to show a name/phone/vehicle on the ride,
    // and driver_id lets us still look up the live User document when needed
    // (e.g. to update driver.currentLocation).
    driver: {
      driver_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
      driver_name: String,
      driver_phone: String,
      driver_vehicle: String,
      driver_location: {
        latitude: Number,
        longitude: Number
      }
    },
    serviceType: {
      type: String,
      required: true,
      trim: true
    },
    location: {
      address: { type: String, required: true, trim: true },
      latitude: { type: Number, required: true },
      longitude: { type: Number, required: true }
    },
    // Only present for tow_sling/tow_rollback requests — a tow is a
    // point-to-point job (pickup → delivery point) like a normal ride,
    // unlike jump-starts/tire changes/etc. which are fixed-in-place
    // "come to me" services with no destination at all.
    destination: {
      address: { type: String, trim: true },
      latitude: Number,
      longitude: Number
    },
    // Required for tow_sling/tow_rollback — determines both pricing
    // (see config/pricing.js) and eligibility (a sling truck physically
    // cannot tow an automatic; enforced in ehailingController.createRequest).
    transmissionType: {
      type: String,
      enum: ['manual', 'automatic']
    },
    isAccidentScene: {
      type: Boolean,
      default: false
    },
    vehicleDetails: {
      make: { type: String, trim: true },
      model: { type: String, trim: true },
      licensePlate: { type: String, trim: true }
    },
    issueDescription: {
      type: String,
      trim: true,
      default: ''
    },
    forSomeoneElse: {
      type: Boolean,
      default: false
    },
    beneficiaryName: { type: String, trim: true },
    beneficiaryPhone: { type: String, trim: true },
    status: {
      type: String,
      enum: ['pending', 'accepted', 'in_progress', 'completed', 'cancelled'],
      default: 'pending',
      index: true
    },
    fare: {
      type: Number
    },
    paymentReference: {
      type: String,
      unique: true,
      sparse: true
    },
    paymentStatus: {
      type: String,
      enum: ['pending', 'paid', 'failed'],
      default: 'pending'
    },
    paymentMethod: {
      type: String,
      enum: ['paystack', 'cash']
    },
    distanceKm: Number,
    cancelledBy: {
      type: String,
      enum: ['client', 'driver', 'admin']
    },
    cancelReason: {
      type: String,
      trim: true
    },
    acceptedAt: Date,
    startedAt: Date,
    completedAt: Date
  },
  { timestamps: true, toJSON: { virtuals: true } }
);

module.exports = mongoose.model('Ride', rideSchema);
