/* ==========================================================================
   Database setup
   Creates the database if it does not exist, then applies schema.sql and
   triggers.sql. Safe to re-run: the schema drops and recreates its tables.

   Run with:  npm run db:setup
   ========================================================================== */

require('dotenv').config();

const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');

const env = require('../src/config/env');

async function run() {
  console.log(`\nSDICMS — database setup`);
  console.log(`Target: ${env.db.user}@${env.db.host}:${env.db.port}/${env.db.database}\n`);

  // Connect without selecting a database so it can be created.
  let root;
  try {
    root = await mysql.createConnection({
      host: env.db.host,
      port: env.db.port,
      user: env.db.user,
      password: env.db.password,
      multipleStatements: true
    });
  } catch (err) {
    console.error('Could not connect to MySQL.');
    console.error(err.message);
    console.error('\nCheck that MySQL is running and that DB_USER / DB_PASSWORD in .env are correct.');
    process.exit(1);
  }

  await root.query(
    `CREATE DATABASE IF NOT EXISTS \`${env.db.database}\`
     CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`
  );
  console.log(`  database ready`);

  await root.changeUser({ database: env.db.database });

  const schema = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
  await root.query(schema);
  console.log('  tables created');

  // Triggers use DELIMITER, which is a client instruction rather than SQL.
  // Split on the // marker and issue each body separately.
  const triggerFile = fs.readFileSync(path.join(__dirname, 'triggers.sql'), 'utf8');
  const statements = triggerFile
    .replace(/DELIMITER\s+\/\/|DELIMITER\s+;/g, '')
    .split('//')
    .map((s) => s.trim())
    .filter((s) => s.length && !s.startsWith('--'));

  for (const statement of statements) {
    // Strip comment-only lines so an empty statement is never sent.
    const cleaned = statement.split('\n').filter((l) => !l.trim().startsWith('--')).join('\n').trim();
    if (!cleaned) continue;
    try {
      await root.query(cleaned);
    } catch (err) {
      console.warn(`  trigger skipped: ${err.message}`);
    }
  }
  console.log('  append-only triggers applied');

  await root.end();

  console.log('\nSchema is in place. Load the sample data with:\n');
  console.log('  npm run db:seed\n');
}

run().catch((err) => {
  console.error('\nSetup failed:', err.message);
  process.exit(1);
});
