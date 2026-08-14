/* ==========================================================================
   Error handling
   Last in the middleware chain. Expected errors return their own status and
   message; anything unexpected is logged in full and returns a generic 500,
   so internals never leak to the client.
   ========================================================================== */

const multer = require('multer');
const logger = require('../config/logger');
const env = require('../config/env');
const { fail } = require('../utils/response');
const ApiError = require('../utils/ApiError');

function notFound(req, res) {
  return fail(res, 404, `No route matches ${req.method} ${req.originalUrl}`);
}

function errorHandler(err, req, res, next) { // eslint-disable-line no-unused-vars
  // Multer reports upload problems with its own error codes.
  if (err instanceof multer.MulterError) {
    const message = err.code === 'LIMIT_FILE_SIZE'
      ? `That file is larger than the ${env.maxUploadMb} MB limit.`
      : `Upload failed: ${err.message}`;
    return fail(res, 400, message);
  }

  if (err instanceof ApiError || err.expected) {
    if (err.status >= 500) logger.error(err.message);
    return fail(res, err.status || 400, err.message, err.details);
  }

  // Database constraint violations translated into something a user can act on.
  if (err.code === 'ER_DUP_ENTRY') {
    return fail(res, 409, 'That record already exists. Check the email, badge number or reference.');
  }
  if (err.code === 'ER_NO_REFERENCED_ROW_2') {
    return fail(res, 400, 'A referenced record does not exist. Check the station or docket you selected.');
  }

  logger.error(`Unhandled: ${err.message}\n${err.stack}`);

  // In development, show the real reason — a beginner debugging this on
  // their own laptop needs the actual SQL error, not a reassurance. This
  // never happens in production because NODE_ENV switches it off.
  const message = env.nodeEnv === 'production'
    ? 'Something went wrong on our side. The incident has been logged.'
    : `Server error: ${err.message}`;

  return fail(res, 500, message, env.nodeEnv === 'production' ? undefined : { stack: err.stack });
}

module.exports = { notFound, errorHandler };
