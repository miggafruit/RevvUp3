const Notification = require('../models/Notification');

// @route   GET /api/notifications?page=&limit=
// @access  Private
const getNotifications = async (req, res, next) => {
  try {
    const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 20, 1), 50);

    const [notifications, total] = await Promise.all([
      Notification.find({ recipient: req.user._id })
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit),
      Notification.countDocuments({ recipient: req.user._id })
    ]);

    res.json({
      success: true,
      data: notifications,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) }
    });
  } catch (error) {
    next(error);
  }
};

// @route   GET /api/notifications/unread-count
// @access  Private
// Its own lightweight endpoint rather than folding into getNotifications
// — this is what a bell badge polls frequently, and doesn't need the
// weight of fetching and paginating full notification documents just
// to show a number.
const getUnreadCount = async (req, res, next) => {
  try {
    const count = await Notification.countDocuments({ recipient: req.user._id, read: false });
    res.json({ success: true, count });
  } catch (error) {
    next(error);
  }
};

// @route   PATCH /api/notifications/:id/read
// @access  Private (must own the notification)
const markAsRead = async (req, res, next) => {
  try {
    const notification = await Notification.findOne({ _id: req.params.id, recipient: req.user._id });
    if (!notification) {
      return res.status(404).json({ success: false, message: 'Notification not found.' });
    }
    if (!notification.read) {
      notification.read = true;
      notification.readAt = new Date();
      await notification.save();
    }
    res.json({ success: true, data: notification });
  } catch (error) {
    next(error);
  }
};

// @route   PATCH /api/notifications/read-all
// @access  Private
const markAllAsRead = async (req, res, next) => {
  try {
    await Notification.updateMany(
      { recipient: req.user._id, read: false },
      { read: true, readAt: new Date() }
    );
    res.json({ success: true });
  } catch (error) {
    next(error);
  }
};

module.exports = { getNotifications, getUnreadCount, markAsRead, markAllAsRead };
