// Canned quick-reply options a shop can send back on a part inquiry,
// so responding is a single tap in the common case instead of typing
// a message every time. A shop can still override with their own
// wording (replyType: 'custom') when the canned text doesn't fit.
const CANNED_REPLIES = {
  available: "Yes, we have this part — come by or place your order!",
  check_back: "We need to check on this — please check back with us shortly.",
  not_available: "Sorry, we don't have this part in stock right now."
};

module.exports = { CANNED_REPLIES };
