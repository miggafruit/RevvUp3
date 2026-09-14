const Inquiry = require('../models/Inquiry');
const User = require('../models/User');
const { sendPushNotifications } = require('../utils/pushNotifications');
const { CANNED_REPLIES } = require('../config/inquiryReplies');

// @route   POST /api/inquiries
// @access  Private (client)
// body: { shop, product?, vehicleMake, vehicleModel, vehicleYear, partName, quantity, additionalDetails? }
// This is what the "Part Inquiry" form on ProductsBrowseScreen actually
// calls now — previously that form only flipped local component state
// and never sent anything anywhere, so the shop never got the message.
const createInquiry = async (req, res, next) => {
  try {
    const {
      shop,
      product,
      vehicleMake,
      vehicleModel,
      vehicleYear,
      partName,
      quantity,
      additionalDetails
    } = req.body;

    if (!shop || !vehicleMake || !vehicleModel || !vehicleYear || !partName || !quantity) {
      return res.status(400).json({
        success: false,
        message: 'shop, vehicleMake, vehicleModel, vehicleYear, partName, and quantity are required.'
      });
    }

    const shopUser = await User.findOne({ _id: shop, role: 'shop' });
    if (!shopUser) {
      return res.status(404).json({ success: false, message: 'Shop not found.' });
    }

    const inquiry = await Inquiry.create({
      client: req.user._id,
      shop,
      product: product || undefined,
      vehicleMake,
      vehicleModel,
      vehicleYear,
      partName,
      quantity,
      additionalDetails
    });

    sendPushNotifications([shopUser], {
      title: 'New part inquiry',
      body: `${req.user.name} is asking about "${partName}" for a ${vehicleYear} ${vehicleMake} ${vehicleModel}.`,
      data: { type: 'new_inquiry', inquiryId: inquiry._id.toString() }
    });

    return res.status(201).json({ success: true, data: inquiry });
  } catch (error) {
    next(error);
  }
};

// @route   GET /api/inquiries/mine
// @access  Private (shop) — inquiries sent to the logged-in shop
const getInquiriesForShop = async (req, res, next) => {
  try {
    const inquiries = await Inquiry.find({ shop: req.user._id })
      .sort({ createdAt: -1 })
      .populate('client', 'name phone')
      .populate('product', 'name');
    return res.json({ success: true, data: inquiries });
  } catch (error) {
    next(error);
  }
};

// @route   GET /api/inquiries/sent
// @access  Private (client) — inquiries the logged-in client has sent
// Lets the client actually confirm an inquiry went somewhere, instead
// of the old fake local "Submitted!" state with nothing behind it.
const getInquiriesForClient = async (req, res, next) => {
  try {
    const inquiries = await Inquiry.find({ client: req.user._id })
      .sort({ createdAt: -1 })
      .populate('shop', 'businessName')
      .populate('product', 'name');
    return res.json({ success: true, data: inquiries });
  } catch (error) {
    next(error);
  }
};

// @route   POST /api/inquiries/:id/respond
// @access  Private (shop, must own the inquiry)
// body: { replyType: 'available' | 'check_back' | 'not_available' | 'custom', message?: string }
//
// This is the piece that was entirely missing before: the old
// "Mark as Responded" action just flipped a status flag with no
// content attached, and the client had no way to see even that much
// (see getInquiriesForClient — nothing in the app ever called it).
// Responding now requires an actual message — either the canned
// default text for the chosen replyType, or the shop's own wording if
// they picked 'custom' — and pushes it straight to the client.
const respondToInquiry = async (req, res, next) => {
  try {
    const { replyType, message } = req.body;
    const validTypes = ['available', 'check_back', 'not_available', 'custom'];
    if (!validTypes.includes(replyType)) {
      return res.status(400).json({ success: false, message: `replyType must be one of: ${validTypes.join(', ')}` });
    }
    if (replyType === 'custom' && !message?.trim()) {
      return res.status(400).json({ success: false, message: 'message is required for a custom reply.' });
    }

    const inquiry = await Inquiry.findById(req.params.id).populate('client', 'name pushToken');
    if (!inquiry) return res.status(404).json({ success: false, message: 'Inquiry not found.' });
    if (inquiry.shop.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, message: 'You do not have permission to respond to this inquiry.' });
    }

    const responseMessage = replyType === 'custom' ? message.trim() : CANNED_REPLIES[replyType];

    inquiry.status = 'responded';
    inquiry.replyType = replyType;
    inquiry.responseMessage = responseMessage;
    inquiry.respondedAt = new Date();
    await inquiry.save();

    if (inquiry.client) {
      sendPushNotifications([inquiry.client], {
        title: `Reply about your "${inquiry.partName}" inquiry`,
        body: responseMessage,
        data: { type: 'inquiry_responded', inquiryId: inquiry._id.toString() }
      });
    }

    return res.json({ success: true, data: inquiry });
  } catch (error) {
    next(error);
  }
};

// @route   PATCH /api/inquiries/:id/close
// @access  Private (shop, must own the inquiry)
// Archives an inquiry without sending the client a reply — for things
// like duplicate/spam inquiries where there's nothing to actually tell
// the client. Kept separate from respondToInquiry since closing
// deliberately doesn't require or send a message.
const closeInquiry = async (req, res, next) => {
  try {
    const inquiry = await Inquiry.findById(req.params.id);
    if (!inquiry) return res.status(404).json({ success: false, message: 'Inquiry not found.' });
    if (inquiry.shop.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, message: 'You do not have permission to update this inquiry.' });
    }

    inquiry.status = 'closed';
    await inquiry.save();
    return res.json({ success: true, data: inquiry });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  createInquiry,
  getInquiriesForShop,
  getInquiriesForClient,
  respondToInquiry,
  closeInquiry
};
