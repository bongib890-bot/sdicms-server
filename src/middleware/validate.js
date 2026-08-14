/* ==========================================================================
   Request validation
   Runs an express-validator chain and turns failures into one 400 with a
   field-keyed detail object the form can render directly.
   ========================================================================== */

const { validationResult } = require('express-validator');
const ApiError = require('../utils/ApiError');

module.exports = function validate(req, res, next) {
  const result = validationResult(req);
  if (result.isEmpty()) return next();

  const details = {};
  result.array().forEach((e) => {
    const key = e.path || e.param;
    if (!details[key]) details[key] = e.msg;
  });

  next(ApiError.badRequest('Some fields need attention.', details));
};
