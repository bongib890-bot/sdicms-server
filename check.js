/* ==========================================================================
   SDICMS — Diagnostic
   Checks each thing that has to be true before sign-in can work, in order,
   and stops at the first one that is not.

   Run with:  node check.js
   ========================================================================== */

require('dotenv').config();

const results = [];
function pass(what, detail) { results.push(['ok', what, detail || '']); }
function fail(what, detail, fix) { results.push(['fail', what, detail, fix]); }

async function run() {
  console.log('\nSDICMS — checking your setup\n');

  /* 1. Node version -------------------------------------------------- */
  const major = parseInt(process.versions.node.split('.')[0], 10);
  if (major >= 18) pass('Node.js', `v${process.versions.node}`);
  else fail('Node.js', `v${process.versions.node} is too old`, 'Install Node 18 or newer from nodejs.org');

  /* 2. Dependencies -------------------------------------------------- */
  const needed = ['express', 'mysql2', 'bcrypt', 'jsonwebtoken', 'multer', 'helmet'];
  const missing = [];
  for (const dep of needed) {
    try { require.resolve(dep); } catch (e) { missing.push(dep); }
  }
  if (!missing.length) pass('Dependencies', `${needed.length} packages present`);
  else {
    fail('Dependencies', `missing: ${missing.join(', ')}`, 'Run: npm install');
    return report();
  }

  /* 3. Environment file ---------------------------------------------- */
  const fs = require('fs');
  if (!fs.existsSync('.env')) {
    fail('.env file', 'not found', 'Run: cp .env.example .env   (Windows: copy .env.example .env)');
    return report();
  }
  pass('.env file', 'found');

  /* 4. Secrets actually set ------------------------------------------ */
  const placeholder = /replace_this|replace_with|change_me/i;
  if (placeholder.test(process.env.JWT_ACCESS_SECRET || '') ||
      placeholder.test(process.env.JWT_REFRESH_SECRET || '')) {
    fail('JWT secrets', 'still set to the placeholder value',
      'Generate two with: node -e "console.log(require(\'crypto\').randomBytes(48).toString(\'hex\'))"');
  } else if (!process.env.JWT_ACCESS_SECRET || process.env.JWT_ACCESS_SECRET.length < 20) {
    fail('JWT secrets', 'missing or too short', 'Set JWT_ACCESS_SECRET and JWT_REFRESH_SECRET in .env');
  } else {
    pass('JWT secrets', 'set');
  }

  /* 5. MySQL reachable ----------------------------------------------- */
  const mysql = require('mysql2/promise');
  const env = require('./src/config/env');
  let conn;
  try {
    conn = await mysql.createConnection({
      host: env.db.host, port: env.db.port,
      user: env.db.user, password: env.db.password
    });
    pass('MySQL connection', `${env.db.user}@${env.db.host}:${env.db.port}`);
  } catch (err) {
    fail('MySQL connection', err.code === 'ECONNREFUSED'
      ? 'nothing is listening on ' + env.db.host + ':' + env.db.port
      : err.message,
      err.code === 'ECONNREFUSED'
        ? 'Start MySQL (XAMPP control panel, or: sudo service mysql start)'
        : 'Check DB_USER and DB_PASSWORD in .env');
    return report();
  }

  /* 6. Database exists ----------------------------------------------- */
  const [dbs] = await conn.query('SHOW DATABASES LIKE ?', [env.db.database]);
  if (!dbs.length) {
    fail('Database', `"${env.db.database}" does not exist`, 'Run: npm run db:setup');
    await conn.end();
    return report();
  }
  pass('Database', env.db.database);

  await conn.changeUser({ database: env.db.database });

  /* 7. Tables -------------------------------------------------------- */
  const [tables] = await conn.query('SHOW TABLES');
  if (tables.length < 10) {
    fail('Tables', `only ${tables.length} found`, 'Run: npm run db:setup');
    await conn.end();
    return report();
  }
  pass('Tables', `${tables.length} present`);

  /* 8. Seed data ----------------------------------------------------- */
  const [[users]] = await conn.query('SELECT COUNT(*) AS n FROM users');
  const [[cases]] = await conn.query('SELECT COUNT(*) AS n FROM cases');
  if (users.n === 0) {
    fail('Accounts', 'the users table is empty', 'Run: npm run db:seed');
    await conn.end();
    return report();
  }
  pass('Accounts', `${users.n} users, ${cases.n} dockets`);

  /* 9. The demo password actually verifies --------------------------- */
  const bcrypt = require('bcrypt');
  const [rows] = await conn.query(
    'SELECT email, password_hash, status, locked_until, failed_attempts FROM users WHERE email = ?',
    ['s.adeyemi@sdicms.gov.za']
  );

  if (!rows.length) {
    fail('Demo account', 's.adeyemi@sdicms.gov.za is not in the database', 'Run: npm run db:seed');
  } else {
    const user = rows[0];
    const matches = await bcrypt.compare('Demo1234!', user.password_hash);

    if (!matches) {
      fail('Demo password', 'the stored hash does not match Demo1234!',
        'Re-run: npm run db:seed  (changing BCRYPT_ROUNDS invalidates existing hashes)');
    } else if (user.status === 'suspended') {
      fail('Demo account', 'the account is suspended', 'Set status to active in the users table');
    } else if (user.locked_until && new Date(user.locked_until) > new Date()) {
      const mins = Math.ceil((new Date(user.locked_until) - Date.now()) / 60000);
      fail('Demo account', `locked for another ${mins} minute(s) after ${user.failed_attempts} failed attempts`,
        'Wait it out, or run: UPDATE users SET locked_until = NULL, failed_attempts = 0;');
    } else {
      pass('Sign-in', 's.adeyemi@sdicms.gov.za / Demo1234! verifies against the stored hash');
    }
  }

  await conn.end();
  report();
}

function report() {
  console.log('');
  results.forEach(([state, what, detail, fix]) => {
    const mark = state === 'ok' ? '\x1b[32m  ✓\x1b[0m' : '\x1b[31m  ✗\x1b[0m';
    console.log(`${mark} ${what}${detail ? ' — ' + detail : ''}`);
    if (fix) console.log(`\x1b[33m      fix: ${fix}\x1b[0m`);
  });

  const broken = results.filter((r) => r[0] === 'fail');
  console.log('');
  if (!broken.length) {
    console.log('\x1b[32mEverything checks out. Start the server with: npm run dev\x1b[0m\n');
  } else {
    console.log(`\x1b[31m${broken.length} problem(s) found. Fix the first one and run this again.\x1b[0m\n`);
  }
}

run().catch((err) => {
  console.error('\nThe check itself failed:', err.message);
  console.error(err.stack);
  process.exit(1);
});
