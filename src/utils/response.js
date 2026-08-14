/* ==========================================================================
   Uniform response envelope
   Every endpoint answers in the same shape, so the client has one code path
   for success and one for failure.
   ========================================================================== */

function ok(res, data, meta) {
  const body = { success: true, data };
  if (meta) body.meta = meta;
  return res.json(body);
}

function created(res, data) {
  return res.status(201).json({ success: true, data });
}

function fail(res, status, message, details) {
  const body = { success: false, error: { message } };
  if (details) body.error.details = details;
  return res.status(status).json(body);
}

module.exports = { ok, created, fail };
