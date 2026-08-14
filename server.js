/* ==========================================================================
   SDICMS — Entry point
   Binds the HTTP listener. The Express instance itself lives in src/app.js
   so it can be imported by tests without opening a socket.
   ========================================================================== */

require('dotenv').config();

const app = require('./src/app');
const env = require('./src/config/env');
const logger = require('./src/config/logger');
const { pool } = require('./src/config/database');

async function start() {
  // Fail fast if the database is unreachable — better than a server that
  // accepts requests and then 500s on every one of them.
  try {
    const conn = await pool.getConnection();
    await conn.ping();
    conn.release();
    logger.info(`Database connected — ${env.db.database}@${env.db.host}`);
  } catch (err) {
    logger.error('Database connection failed: ' + err.message);
    logger.error('Check your .env settings, then run: npm run db:reset');
    process.exit(1);
  }

  const server = app.listen(env.port, () => {
    logger.info(`SDICMS API listening on http://localhost:${env.port}`);
    logger.info(`Frontend served from  http://localhost:${env.port}`);
  });

  // Close connections cleanly so in-flight requests are not cut off.
  const shutdown = (signal) => {
    logger.info(`${signal} received — shutting down`);
    server.close(async () => {
      await pool.end();
      process.exit(0);
    });
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

start();
