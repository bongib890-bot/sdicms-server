/* ==========================================================================
   Environment configuration
   Loaded once and validated. Missing critical values stop the process here
   rather than surfacing as a confusing runtime error later.
   ========================================================================== */

const path = require('path');

function required(name, fallback) {
  const value = process.env[name] || fallback;
  if (!value) {
    console.error(`Missing required environment variable: ${name}`);
    console.error('Copy .env.example to .env and fill it in.');
    process.exit(1);
  }
  return value;
}

const env = {
  nodeEnv: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT || '3000', 10),
  appUrl: process.env.APP_URL || 'http://localhost:3000',

  db: {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '3306', 10),
    database: process.env.DB_NAME || 'sdicms',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    connectionLimit: parseInt(process.env.DB_CONNECTION_LIMIT || '10', 10)
  },

  jwt: {
    accessSecret: required('JWT_ACCESS_SECRET', 'dev_only_access_secret_change_me'),
    refreshSecret: required('JWT_REFRESH_SECRET', 'dev_only_refresh_secret_change_me'),
    accessExpiry: process.env.JWT_ACCESS_EXPIRY || '15m',
    refreshExpiry: process.env.JWT_REFRESH_EXPIRY || '7d'
  },

  bcryptRounds: parseInt(process.env.BCRYPT_ROUNDS || '12', 10),
  maxLoginAttempts: parseInt(process.env.MAX_LOGIN_ATTEMPTS || '5', 10),
  lockoutMinutes: parseInt(process.env.LOCKOUT_MINUTES || '15', 10),
  defaultPassword: process.env.DEFAULT_USER_PASSWORD || 'Sdicms2026Reset',

  storagePath: path.resolve(process.env.STORAGE_PATH || './storage'),
  maxUploadMb: parseInt(process.env.MAX_UPLOAD_MB || '100', 10),

  rateLimit: {
    windowMinutes: parseInt(process.env.RATE_LIMIT_WINDOW_MINUTES || '15', 10),
    max: parseInt(process.env.RATE_LIMIT_MAX || '600', 10),
    loginMax: parseInt(process.env.LOGIN_RATE_LIMIT_MAX || '10', 10)
  },

  logLevel: process.env.LOG_LEVEL || 'debug'
};

module.exports = env;
