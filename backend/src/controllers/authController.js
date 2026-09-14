const crypto = require('crypto');
const User = require('../models/User');
const jwt = require('jsonwebtoken');
const { generateAccessToken, generateRefreshToken } = require('../utils/generateTokens');
const { sendPasswordResetEmail } = require('../utils/sendEmail');
const { sendPushNotifications } = require('../utils/pushNotifications');
const Sentry = require('../config/sentry');
const { VALID_ROADSIDE_SERVICES } = require('../config/roadsideServices');

// @route   POST /api/auth/register
// @access  Public
const register = async (req, res, next) => {
  try {
    const {
      name,
      email,
      phone,
      password,
      role,
      businessName,
      businessAddress,
      category,
      waiverAccepted,
      kycDocuments,
      isDriver,
      roadsideServices,
      vehicleDetails,
      bankingDetails
    } = req.body;

    if (!name || !email || !phone || !password || !role) {
      return res.status(400).json({ message: 'Please provide name, email, phone, password and role' });
    }

    if (!['client', 'service_provider', 'shop'].includes(role)) {
      return res.status(400).json({ message: 'Invalid role specified' });
    }

    if (!waiverAccepted) {
      return res.status(400).json({ message: 'You must accept the waiver to register' });
    }

    const existingUser = await User.findOne({ email: email.toLowerCase() });
    if (existingUser) {
      return res.status(409).json({ message: 'An account with this email already exists' });
    }

    const validKycDocuments = Array.isArray(kycDocuments)
      ? kycDocuments.filter((doc) => doc && doc.type && doc.label && doc.image)
      : [];

    const validRoadsideServices =
      role === 'service_provider' && Array.isArray(roadsideServices)
        ? roadsideServices.filter((s) =>
            VALID_ROADSIDE_SERVICES.includes(s)
          )
        : [];

    // A vehicle matters for either job (delivery or roadside) — not just
    // isDriver, or a roadside-only responder would show up to clients
    // with no vehicle info at all.
    const offersDispatchableWork = role === 'service_provider' && (!!isDriver || validRoadsideServices.length > 0);

    // Only picked up for roles that actually get paid out (see
    // PayoutEntry.js) — optional at registration, same as kycDocuments,
    // but required before reviewKyc can approve the account.
    const validBankingDetails =
      role !== 'client' && bankingDetails && typeof bankingDetails === 'object'
        ? {
            accountHolder: bankingDetails.accountHolder,
            bankName: bankingDetails.bankName,
            accountNumber: bankingDetails.accountNumber,
            branchCode: bankingDetails.branchCode,
            accountType: bankingDetails.accountType
          }
        : undefined;

    const user = await User.create({
      name,
      email,
      phone,
      password,
      role,
      businessName,
      businessAddress,
      category,
      isDriver: role === 'service_provider' ? !!isDriver : false,
      roadsideServices: validRoadsideServices,
      vehicleDetails: offersDispatchableWork ? vehicleDetails : undefined,
      bankingDetails: validBankingDetails,
      waiverAccepted: true,
      waiverAcceptedAt: new Date(),
      kycDocuments: validKycDocuments,
      kycStatus: validKycDocuments.length > 0 ? 'pending' : 'not_submitted'
    });

    const accessToken = generateAccessToken(user);
    const refreshToken = generateRefreshToken(user);

    user.refreshToken = refreshToken;
    await user.save();

    res.status(201).json({
      user: user.toSafeObject(),
      accessToken,
      refreshToken
    });
  } catch (error) {
    next(error);
  }
};

// @route   POST /api/auth/login
// @access  Public
const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: 'Please provide email and password' });
    }

    const user = await User.findOne({ email: email.toLowerCase() }).select('+password');
    if (!user) {
      return res.status(401).json({ message: 'Invalid email or password' });
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({ message: 'Invalid email or password' });
    }

    const accessToken = generateAccessToken(user);
    const refreshToken = generateRefreshToken(user);

    user.refreshToken = refreshToken;
    await user.save();

    res.status(200).json({
      user: user.toSafeObject(),
      accessToken,
      refreshToken
    });
  } catch (error) {
    next(error);
  }
};

// @route   POST /api/auth/refresh
// @access  Public (requires valid refresh token)
const refresh = async (req, res, next) => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return res.status(401).json({ message: 'Refresh token required' });
    }

    let decoded;
    try {
      decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);
    } catch (err) {
      return res.status(401).json({ message: 'Invalid or expired refresh token' });
    }

    const user = await User.findById(decoded.id).select('+refreshToken');
    if (!user || user.refreshToken !== refreshToken) {
      return res.status(401).json({ message: 'Refresh token does not match' });
    }

    const newAccessToken = generateAccessToken(user);
    const newRefreshToken = generateRefreshToken(user);

    user.refreshToken = newRefreshToken;
    await user.save();

    res.status(200).json({
      accessToken: newAccessToken,
      refreshToken: newRefreshToken
    });
  } catch (error) {
    next(error);
  }
};

// @route   POST /api/auth/logout
// @access  Private
const logout = async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id);
    if (user) {
      user.refreshToken = undefined;
      await user.save();
    }
    res.status(200).json({ message: 'Logged out successfully' });
  } catch (error) {
    next(error);
  }
};

// @route   GET /api/auth/me
// @access  Private
const getMe = async (req, res, next) => {
  try {
    res.status(200).json({ user: req.user.toSafeObject() });
  } catch (error) {
    next(error);
  }
};

// @route   GET /api/auth/banking-details
// @access  Private
// The full banking details (including accountNumber, which is
// select:false and so left out of the ordinary user document/
// toSafeObject()) — only ever the account's own, via an explicit
// select, never anyone else's. Lets a settings screen show what's
// currently on file instead of only ever accepting blind overwrites.
const getMyBankingDetails = async (req, res, next) => {
  try {
    if (req.user.role === 'client') {
      return res.status(400).json({ message: 'Client accounts do not have banking details.' });
    }
    const user = await User.findById(req.user._id).select('+bankingDetails.accountNumber');
    res.status(200).json({ bankingDetails: user?.bankingDetails || null });
  } catch (error) {
    next(error);
  }
};

// @route   PATCH /api/auth/me
// @access  Private
// Lets an existing account update business details and opt into (or
// out of) delivery/roadside dispatch work — previously these were only
// ever settable once, at registration. A mechanic who registered
// without roadside capability had no way to add it later short of
// creating a whole new account.
const updateProfile = async (req, res, next) => {
  try {
    const {
      businessName,
      businessAddress,
      category,
      isDriver,
      roadsideServices,
      vehicleDetails,
      bankingDetails,
      profilePhoto,
      qualifications,
      portfolioImages,
      profileVideoUrl
    } = req.body;

    const user = req.user;

    if (businessName !== undefined) user.businessName = businessName;
    if (businessAddress !== undefined) user.businessAddress = businessAddress;
    if (category !== undefined) user.category = category;

    // Public-facing profile content — a photo, a qualifications/bio
    // write-up, portfolio images, and an optional video link. Testers
    // flagged that there was previously no way to add any of this at
    // all. Restricted to non-client roles, same as bankingDetails —
    // this is "represent your business to clients" content, not
    // something a client account needs.
    if (user.role !== 'client') {
      if (profilePhoto !== undefined) user.profilePhoto = profilePhoto || undefined;
      if (qualifications !== undefined) user.qualifications = qualifications;
      if (profileVideoUrl !== undefined) user.profileVideoUrl = profileVideoUrl || undefined;
      if (portfolioImages !== undefined) {
        user.portfolioImages = Array.isArray(portfolioImages) ? portfolioImages.slice(0, 12) : [];
      }
    }

    // Editable after registration too — not just at signup — so an
    // account can add or correct their payout details later without
    // needing to re-register.
    if (user.role !== 'client' && bankingDetails && typeof bankingDetails === 'object') {
      user.bankingDetails = {
        accountHolder: bankingDetails.accountHolder,
        bankName: bankingDetails.bankName,
        accountNumber: bankingDetails.accountNumber,
        branchCode: bankingDetails.branchCode,
        accountType: bankingDetails.accountType
      };
    }

    if (user.role === 'service_provider') {
      if (isDriver !== undefined) user.isDriver = !!isDriver;

      if (roadsideServices !== undefined) {
        const validRoadsideServices = Array.isArray(roadsideServices)
          ? roadsideServices.filter((s) =>
              VALID_ROADSIDE_SERVICES.includes(s)
            )
          : [];
        user.roadsideServices = validRoadsideServices;
      }

      const offersDispatchableWork = user.isDriver || (user.roadsideServices || []).length > 0;
      if (offersDispatchableWork && vehicleDetails) {
        user.vehicleDetails = vehicleDetails;
      }
      // Deliberately not clearing vehicleDetails if they turn dispatch
      // work back off — no harm in keeping it on file for if they turn
      // it back on later, and it avoids silently discarding something
      // they typed in.
    }

    await user.save();
    res.status(200).json({ user: user.toSafeObject() });
  } catch (error) {
    next(error);
  }
};

// @route   POST /api/auth/kyc/resubmit
// @access  Private
// Lets an account whose KYC was rejected (or who never submitted)
// upload new documents. Sets kycStatus back to 'pending' and clears
// the old review note/timestamp/reviewer — those describe the
// PREVIOUS submission, and leaving them in place would make it look
// like the new submission was already reviewed when it hasn't been.
const resubmitKyc = async (req, res, next) => {
  try {
    const { kycDocuments } = req.body;

    const validKycDocuments = Array.isArray(kycDocuments)
      ? kycDocuments.filter((doc) => doc && doc.type && doc.label && doc.image)
      : [];

    if (validKycDocuments.length === 0) {
      return res.status(400).json({ message: 'At least one valid document is required.' });
    }

    const user = req.user;
    if (user.kycStatus === 'pending') {
      return res.status(400).json({ message: 'Your verification is already under review.' });
    }
    if (user.kycStatus === 'approved') {
      return res.status(400).json({ message: "You're already verified — no need to resubmit." });
    }

    user.kycDocuments = validKycDocuments;
    user.kycStatus = 'pending';
    user.kycReviewNote = undefined;
    user.kycReviewedAt = undefined;
    user.kycReviewedBy = undefined;
    await user.save();

    res.status(200).json({ user: user.toSafeObject() });
  } catch (error) {
    next(error);
  }
};

// @route   POST /api/auth/push-token
// @access  Private
// Called whenever the app registers for push notifications on a
// device — separate from updateProfile since this happens
// automatically on login/app-start, not as a deliberate profile edit.
const registerPushToken = async (req, res, next) => {
  try {
    const { pushToken } = req.body;
    if (!pushToken) {
      return res.status(400).json({ success: false, message: 'pushToken is required.' });
    }
    req.user.pushToken = pushToken;
    await req.user.save();
    return res.status(200).json({ success: true });
  } catch (error) {
    next(error);
  }
};

// @route   POST /api/auth/forgot-password
// @access  Public
const forgotPassword = async (req, res, next) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ message: 'Please provide your email address' });
    }

    const genericResponse = {
      message: 'If an account exists for that email, a reset code has been sent.'
    };

    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) {
      return res.status(200).json(genericResponse);
    }

    // 6-digit numeric code — much easier to actually type than the
    // previous 64-character hex token, and still secure: crypto.randomInt
    // is cryptographically secure (unlike Math.random), and 1 million
    // possibilities combined with the 15-minute expiry and the existing
    // rate limit on this endpoint (20 attempts/15min) makes brute-forcing
    // impractical within the code's lifetime.
    const rawToken = crypto.randomInt(100000, 1000000).toString();
    const hashedToken = crypto.createHash('sha256').update(rawToken).digest('hex');

    user.resetPasswordToken = hashedToken;
    user.resetPasswordExpires = Date.now() + 15 * 60 * 1000; // 15 minutes
    await user.save({ validateBeforeSave: false });

    const resetUrl = process.env.APP_RESET_URL
      ? `${process.env.APP_RESET_URL}?token=${rawToken}&email=${encodeURIComponent(user.email)}`
      : undefined;

    try {
      await sendPasswordResetEmail({ to: user.email, resetToken: rawToken, resetUrl });
    } catch (emailError) {
      user.resetPasswordToken = undefined;
      user.resetPasswordExpires = undefined;
      await user.save({ validateBeforeSave: false });
      console.error('Failed to send password reset email:', emailError);
      // Caught here (not passed to next()), so Sentry's Express error
      // handler never sees this on its own — capture it explicitly so
      // "password reset emails are broken" doesn't go unnoticed just
      // because it's handled gracefully instead of crashing.
      Sentry.captureException(emailError);
      return res.status(500).json({ message: 'Could not send reset email. Please try again shortly.' });
    }

    res.status(200).json(genericResponse);
  } catch (error) {
    next(error);
  }
};

// @route   POST /api/auth/reset-password
// @access  Public
const resetPassword = async (req, res, next) => {
  try {
    const { email, token, password } = req.body;

    if (!email || !token || !password) {
      return res.status(400).json({ message: 'Please provide your email, reset code and a new password' });
    }
    if (password.length < 6) {
      return res.status(400).json({ message: 'Password must be at least 6 characters' });
    }

    const hashedToken = crypto.createHash('sha256').update(token).digest('hex');

    const user = await User.findOne({
      email: email.toLowerCase(),
      resetPasswordToken: hashedToken,
      resetPasswordExpires: { $gt: Date.now() }
    }).select('+resetPasswordToken +resetPasswordExpires');

    if (!user) {
      return res.status(400).json({ message: 'This reset code is invalid or has expired' });
    }

    user.password = password;
    user.resetPasswordToken = undefined;
    user.resetPasswordExpires = undefined;
    user.refreshToken = undefined;
    await user.save();

    // Confirms the change went through and gives the account owner a
    // signal to act on if this wasn't actually them — previously this
    // was completely silent, so there was no notification of any kind
    // when a password was changed.
    sendPushNotifications([user], {
      title: 'Password changed',
      body: "Your RevvUp password was just reset. If this wasn't you, contact support right away.",
      data: { type: 'password_reset' }
    });

    res.status(200).json({ message: 'Your password has been reset. Please log in.' });
  } catch (error) {
    next(error);
  }
};

module.exports = { register, login, refresh, logout, getMe, getMyBankingDetails, updateProfile, resubmitKyc, registerPushToken, forgotPassword, resetPassword };