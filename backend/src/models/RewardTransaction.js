const mongoose = require('mongoose');

// Ledger of a client's points. User.rewardPoints is the live balance; this is
// the audit trail behind it. (type, order) is unique so a retried request can
// never earn, redeem or refund the same order twice.
const rewardTransactionSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    type: { type: String, enum: ['earn', 'redeem', 'redeem_refund'], required: true },
    points: { type: Number, required: true, min: 1 },
    valueRand: { type: Number, required: true, min: 0 },
    order: { type: mongoose.Schema.Types.ObjectId, ref: 'Order', required: true },
    seller: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    sellerName: { type: String },
    balanceAfter: { type: Number },
    // Set once the client's app has shown the celebration for an 'earn'.
    seenAt: { type: Date }
  },
  { timestamps: true }
);

rewardTransactionSchema.index({ type: 1, order: 1 }, { unique: true });

module.exports = mongoose.model('RewardTransaction', rewardTransactionSchema);
