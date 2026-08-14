/* ==========================================================================
   Logger
   Console plus a daily file, with no external dependency so the project
   installs quickly on a lab machine.
   ========================================================================== */

const fs = require('fs');
const path = require('path');
const env = require('./env');

const LEVELS = { error: 0, warn: 1, info: 2, debug: 3 };
const threshold = LEVELS[env.logLevel] === undefined ? 3 : LEVELS[env.logLevel];

const logDir = path.join(env.storagePath, 'logs');
fs.mkdirSync(logDir, { recursive: true });

function write(level, message) {
  if (LEVELS[level] > threshold) return;

  const line = `${new Date().toISOString()} [${level.toUpperCase()}] ${message}`;
  const colour = { error: '\x1b[31m', warn: '\x1b[33m', info: '\x1b[36m', debug: '\x1b[90m' }[level];
  console.log(`${colour}${line}\x1b[0m`);

  const file = path.join(logDir, `${new Date().toISOString().slice(0, 10)}.log`);
  fs.appendFile(file, line + '\n', () => {});
}

module.exports = {
  error: (m) => write('error', m),
  warn: (m) => write('warn', m),
  info: (m) => write('info', m),
  debug: (m) => write('debug', m)
};
