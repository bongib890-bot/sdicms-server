/* ==========================================================================
   Rate limiting
   A generous global limit, and a strict one on sign-in so credential
   stuffing is expensive.
   ========================================================================== */

const rateLimit = require('express-rate-limit');
const env = require('../config/env');

const globalLimiter = rateLimit({
  windowMs: env.rateLimit.windowMinutes * 60 * 1000,
  max: env.rateLimit.max,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: { message: 'Too many requests. Wait a moment and try again.' } }
});

const loginLimiter = rateLimit({
  windowMs: env.rateLimit.windowMinutes * 60 * 1000,
  max: env.rateLimit.loginMax,
  skipSuccessfulRequests: true,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: { message: 'Too many sign-in attempts from this address. Try again shortly.' } }
});

module.exports = { globalLimiter, loginLimiter };
