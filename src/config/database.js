/* ==========================================================================
   MySQL connection pool
   A pool, not a single connection: concurrent requests would otherwise
   queue behind one another.
   ========================================================================== */

const mysql = require('mysql2/promise');
const env = require('./env');

const pool = mysql.createPool({
  host: env.db.host,
  port: env.db.port,
  user: env.db.user,
  password: env.db.password,
  database: env.db.database,
  waitForConnections: true,
  connectionLimit: env.db.connectionLimit,
  queueLimit: 0,
  timezone: 'Z',
  charset: 'utf8mb4_unicode_ci'
});

/**
 * Run a parameterised query. SQL is never built by string concatenation.
 *
 * Uses mysql2's query() (text protocol) rather than execute() (prepared
 * statements/binary protocol). This was changed while chasing a MariaDB
 * syntax error that turned out to have a different cause — a CASE WHEN
 * condition split across a line break in the source, which some MariaDB
 * builds parse incorrectly regardless of protocol. That query has since
 * been rewritten onto a single line and works correctly either way. The
 * switch to query() is kept regardless: it also avoids a separate, confirmed
 * restriction where MariaDB rejects a bound parameter inside LIMIT/OFFSET
 * under the binary protocol specifically.
 */
async function query(sql, params = []) {
  const [rows] = await pool.query(sql, params);
  return rows;
}

/** Run a query expected to return at most one row. */
async function queryOne(sql, params = []) {
  const rows = await query(sql, params);
  return rows.length ? rows[0] : null;
}

/**
 * Run several statements as one unit. Used wherever a write must be
 * all-or-nothing — an exhibit and its first custody entry, for instance.
 */
async function transaction(work) {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const result = await work(conn);
    await conn.commit();
    return result;
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

module.exports = { pool, query, queryOne, transaction };
