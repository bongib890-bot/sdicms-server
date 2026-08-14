/* ==========================================================================
   Notification repository
   ========================================================================== */

const { query } = require('../config/database');

function listForUser(userId, limit = 20) {
  // LIMIT is inlined as a validated integer: it cannot be a bound parameter.
  const safe = Math.min(Math.max(parseInt(limit, 10) || 20, 1), 200);
  return query(
    `SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT ${safe}`,
    [userId]
  );
}

function create({ userId, kind, icon, message, link }) {
  return query(
    'INSERT INTO notifications (user_id, kind, icon, message, link) VALUES (?,?,?,?,?)',
    [userId, kind || 'info', icon || 'bell', message, link || null]
  );
}

function markAllRead(userId) {
  return query('UPDATE notifications SET is_read = 1 WHERE user_id = ?', [userId]);
}

module.exports = { listForUser, create, markAllRead };
