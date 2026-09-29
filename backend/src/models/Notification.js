const mongoose = require('mongoose');

// Previously push notifications were entirely fire-and-forget — once
// dismissed, or if the recipient's phone was off/the app wasn't open
// to see it arrive, there was no record of it anywhere. This is what
// actually gives every user a real in-app notification history: a
// bell icon they can open at any time to see everything they've
// missed, not just whatever happened to be on screen the moment it
// fired.
const notificationSchema = new mongoose.Schema(
  {
    recipient: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },
    title: { type: String, required: true },
    body: { type: String, required: true },
    // Matches the `type` already used in every sendPushNotifications
    // call's `data.type` field throughout the codebase (new_order,
    // kyc_reviewed, new_inquiry, etc.) — reused as-is rather than
    // introducing a second, parallel type vocabulary. Mobile's
    // existing handleNotificationTap navigation switch (built for push
    // taps) works unchanged for in-app notification taps too, since
    // it's driven by this same type value.
    type: { type: String, required: true },
    // Whatever extra ids the navigation switch needs (rideId, orderId,
    // inquiryId, etc.) — kept as a free-form object rather than a
    // dozen optional typed fields, since which ids matter varies
    // entirely by type.
    data: { type: mongoose.Schema.Types.Mixed, default: {} },
    read: { type: Boolean, default: false, index: true },
    readAt: Date
  },
  { timestamps: true }
);

// Every list/count query filters by recipient and often by read status
// together — this composite index is what keeps both fast as the
// collection grows, rather than relying on the single-field index on
// recipient alone.
notificationSchema.index({ recipient: 1, read: 1, createdAt: -1 });

module.exports = mongoose.model('Notification', notificationSchema);
