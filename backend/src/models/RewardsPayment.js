const mongoose = require('mongoose');

// One row per R150 membership payment by a shop/provider.
const rewardsPaymentSchema = new mongoose.Schema(
  {
    seller: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    amount: { type: Number, required: true, min: 0 },
    paymentReference: { type: String, required: true, unique: true },
    periodStart: { type: Date, required: true },
    periodEnd: { type: Date, required: true }
  },
  { timestamps: true }
);

module.exports = mongoose.model('RewardsPayment', rewardsPaymentSchema);
