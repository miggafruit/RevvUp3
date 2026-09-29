const { v2: cloudinary } = require('cloudinary');

// Video upload for profile videos. Previously "video" only ever meant
// pasting an external link (YouTube, etc.) — that was a deliberate
// choice, not an oversight, because this app's other uploads (KYC
// docs, selfies, portfolio images) all store files as base64 text
// directly in MongoDB, and that approach genuinely doesn't work for
// video: MongoDB caps a document at 16MB, a real video is easily
// bigger than that even before base64 inflates it further, and
// uploading megabytes of base64 text over mobile data is slow and
// unreliable. Real video needs storage built for it — Cloudinary here.
//
// The mobile app never sees the API secret. It asks this backend for a
// short-lived signed signature, then uploads the actual video file
// directly to Cloudinary using that signature — the file itself never
// passes through this server at all, which is what keeps a large
// video upload from tying up backend resources or hitting Express's
// own request size limits.
const isConfigured = !!(
  process.env.CLOUDINARY_CLOUD_NAME &&
  process.env.CLOUDINARY_API_KEY &&
  process.env.CLOUDINARY_API_SECRET
);

if (isConfigured) {
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
  });
}

/**
 * Generates the signed parameters a client needs to upload a video
 * directly to Cloudinary. The signature is computed here (server-side,
 * with the secret) over exactly the parameters the client will send —
 * Cloudinary recomputes the same signature on its end and rejects the
 * upload if anything doesn't match, so a client can't forge a
 * signature for parameters we didn't actually authorize.
 */
function generateVideoUploadSignature(folder) {
  if (!isConfigured) {
    throw new Error('Video upload is not configured (CLOUDINARY_* env vars missing).');
  }

  const timestamp = Math.round(Date.now() / 1000);
  const paramsToSign = { timestamp, folder, resource_type: 'video' };
  const signature = cloudinary.utils.api_sign_request(paramsToSign, process.env.CLOUDINARY_API_SECRET);

  return {
    timestamp,
    signature,
    apiKey: process.env.CLOUDINARY_API_KEY,
    cloudName: process.env.CLOUDINARY_CLOUD_NAME,
    folder
  };
}

module.exports = { isConfigured, generateVideoUploadSignature };
