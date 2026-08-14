/* ==========================================================================
   Refresh token repository
   Tokens are stored hashed. Rotation revokes the presented token and issues
   a new row, so a stolen refresh token is usable at most once before the
   theft becomes visible as a reuse attempt.
   ========================================================================== */

const { query, queryOne } = require('../config/database');

function create({ id, userId, tokenHash, expiresAt, userAgent, ip }) {
  return query(
    `INSERT INTO refresh_tokens (id, user_id, token_hash, expires_at, user_agent, ip)
     VALUES (?,?,?,?,?,?)`,
    [id, userId, tokenHash, expiresAt, userAgent || null, ip || null]
  );
}

function findActive(id) {
  return queryOne(
    'SELECT * FROM refresh_tokens WHERE id = ? AND revoked_at IS NULL AND expires_at > NOW()', [id]
  );
}

function revoke(id) {
  return query('UPDATE refresh_tokens SET revoked_at = NOW() WHERE id = ?', [id]);
}

function revokeAllForUser(userId) {
  return query(
    'UPDATE refresh_tokens SET revoked_at = NOW() WHERE user_id = ? AND revoked_at IS NULL', [userId]
  );
}

function purgeExpired() {
  return query('DELETE FROM refresh_tokens WHERE expires_at < NOW() OR revoked_at IS NOT NULL');
}

module.exports = { create, findActive, revoke, revokeAllForUser, purgeExpired };
