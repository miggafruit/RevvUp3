const { isConfigured, generateVideoUploadSignature } = require('../config/cloudinary');

// @route   GET /api/uploads/video-signature
// @access  Private (shop, service_provider)
// Returns everything the mobile app needs to upload a video directly
// to Cloudinary — the video file itself never touches this backend.
// Scoped to a per-user folder so one account's videos can't overwrite
// or be confused with another's.
const getVideoUploadSignature = async (req, res, next) => {
  try {
    if (!isConfigured) {
      return res.status(503).json({
        success: false,
        message: 'Video upload is not set up yet. You can still add a video by pasting a link instead.'
      });
    }

    const folder = `revvup/profile-videos/${req.user._id}`;
    const signatureData = generateVideoUploadSignature(folder);

    return res.json({ success: true, data: signatureData });
  } catch (error) {
    next(error);
  }
};

module.exports = { getVideoUploadSignature };
