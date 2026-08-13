const mongoose = require('mongoose');

// This is deliberately a ledger, not a payment integration. Every
// payment in this app (ride fares, order totals, promotion fees) goes
// straight into the platform's own Paystack account — there's no
// automated split, no Paystack Transfer API, no recipient/subaccount
// management. Building that is a much bigger undertaking (recipient
// verification, transfer reconciliation, failure handling) and wasn't
// asked for. What WAS missing is simpler and just as real: nothing
// anywhere tracked who the platform actually owes money to. This does.
const payoutEntrySchema = new mongoose.Schema(
  {
    recipient: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },
    amount: {
      type: Number,
      required: true,
      min: 0
    },
    // What generated this entry — lets an admin trace a payout back to
    // the actual ride/order it came from, not just a bare number.
    sourceType: {
      type: String,
      enum: ['ride_fare', 'order_seller_share', 'delivery_fee'],
      required: true
    },
    sourceId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true
    },
    status: {
      type: String,
      enum: ['owed', 'paid'],
      default: 'owed',
      index: true
    },
    paidAt: { type: Date },
    paidBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    note: { type: String, trim: true }
  },
  { timestamps: true }
);

// One entry per source per recipient — a ride/order/delivery should
// only ever generate its payout entry once, even if the code path
// that creates it somehow ran twice (e.g. a retried request).
payoutEntrySchema.index({ sourceType: 1, sourceId: 1, recipient: 1 }, { unique: true });

module.exports = mongoose.model('PayoutEntry', payoutEntrySchema);
