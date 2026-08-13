const rateLimit = require('express-rate-limit');

// General baseline across the whole API — generous enough that no
// legitimate user should ever notice it, just a backstop against
// scripted abuse.
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Too many requests. Please try again shortly.' }
});

// Login/register/password-reset specifically — these are the
// endpoints actually worth protecting tightly, since they're what
// credential-stuffing and brute-force attempts target. Much lower
// limit, same window.
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Too many attempts. Please try again in a few minutes.' }
});

module.exports = { apiLimiter, authLimiter };
