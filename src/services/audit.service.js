/* ==========================================================================
   Audit service
   One entry point for writing the trail, so no controller can forget the
   actor, the target or the request context.
   ========================================================================== */

const auditRepo = require('../repositories/audit.repository');
const present = require('../utils/present');
const logger = require('../config/logger');

async function record(req, action, targetType, targetId, detail) {
  try {
    return await auditRepo.write({
      actorId: req.user ? req.user.id : null,
      actorName: req.user ? `${req.user.rank_title} ${req.user.full_name}` : 'Anonymous',
      action,
      targetType,
      targetId,
      detail,
      ip: req.context ? req.context.ip : null,
      userAgent: req.context ? req.context.userAgent : null
    });
  } catch (err) {
    // An audit failure must be loud but must not silently swallow the action
    // that triggered it — the caller decides whether to abort.
    logger.error(`Audit write failed for ${action}/${targetId}: ${err.message}`);
    throw err;
  }
}

async function list(options) {
  const [rows, integrity] = await Promise.all([
    auditRepo.list(options),
    auditRepo.verify()
  ]);

  return {
    entries: rows.map((r) => present.auditEntry(r, integrity.intact || r.id !== integrity.brokenAt)),
    integrity
  };
}

module.exports = { record, list, verify: auditRepo.verify };
