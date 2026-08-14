/* ==========================================================================
   Request context
   Captures the details every audit entry needs, so services do not have to
   reach back into the request object.
   ========================================================================== */

const crypto = require('crypto');

module.exports = function requestContext(req, res, next) {
  req.context = {
    requestId: crypto.randomUUID(),
    ip: (req.headers['x-forwarded-for'] || req.socket.remoteAddress || '').split(',')[0].trim(),
    userAgent: (req.headers['user-agent'] || '').slice(0, 255),
    at: new Date()
  };
  res.setHeader('X-Request-Id', req.context.requestId);
  next();
};
