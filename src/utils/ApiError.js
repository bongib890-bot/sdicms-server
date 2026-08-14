/* ==========================================================================
   Typed error
   Anything thrown as an ApiError becomes a clean HTTP response. Anything
   else becomes a 500 and is logged with its stack.
   ========================================================================== */

class ApiError extends Error {
  constructor(status, message, details = null) {
    super(message);
    this.status = status;
    this.details = details;
    this.expected = true;
  }

  static badRequest(msg, details)  { return new ApiError(400, msg, details); }
  static unauthorized(msg)         { return new ApiError(401, msg || 'Sign in to continue.'); }
  static forbidden(msg)            { return new ApiError(403, msg || 'Your role does not permit that action.'); }
  static notFound(msg)             { return new ApiError(404, msg || 'That record does not exist.'); }
  static conflict(msg)             { return new ApiError(409, msg); }
  static tooLarge(msg)             { return new ApiError(413, msg); }
}

module.exports = ApiError;
