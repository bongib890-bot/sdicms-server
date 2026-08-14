/* ==========================================================================
   Async wrapper
   Express 4 does not catch rejected promises from async handlers. Wrapping
   every controller here means a thrown error always reaches errorHandler
   instead of hanging the request.
   ========================================================================== */

module.exports = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
