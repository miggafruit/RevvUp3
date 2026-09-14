const mongoose = require('mongoose');

// Previously the "Part Inquiry" form on ProductsBrowseScreen only ever
// set local component state (`setSubmitted(true)`) — nothing was ever
// sent to the server, so the shop never received it and there was
// nothing to notify the client about either. This model is what
// actually persists an inquiry so it can be delivered and looked up.
const inquirySchema = new mongoose.Schema(
  {
    client: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },
    shop: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product'
    },
    vehicleMake: { type: String, required: true, trim: true },
    vehicleModel: { type: String, required: true, trim: true },
    vehicleYear: { type: String, required: true, trim: true },
    partName: { type: String, required: true, trim: true },
    quantity: { type: String, required: true, trim: true },
    additionalDetails: { type: String, trim: true },
    status: {
      type: String,
      enum: ['new', 'responded', 'closed'],
      default: 'new'
    },
    // The actual reply content — previously "responded" was just a
    // status flag with no message attached at all, so there was
    // nothing for the client to actually read even if they'd had a
    // way to see it (which they didn't either — see
    // getInquiriesForClient). replyType records which canned option
    // was used (or 'custom'), message is what's actually shown to the
    // client — either the canned default text or the shop's own
    // wording if they typed something.
    replyType: {
      type: String,
      enum: ['available', 'check_back', 'not_available', 'custom']
    },
    responseMessage: { type: String, trim: true },
    respondedAt: Date
  },
  { timestamps: true }
);

module.exports = mongoose.model('Inquiry', inquirySchema);
