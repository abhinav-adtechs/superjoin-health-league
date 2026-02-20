#!/usr/bin/env node

/**
 * Run the PIN login migration (profile_auth table + profile columns).
 * Requires: pg package and HEALTH_LEAGUE_POSTGRES_URL_NON_POOLING or same in .env.local
 *
 * Usage: node scripts/run-pin-migration.js
 */

const fs = require('fs');
const path = require('path');
const config = require('./config');

const postgresUrl = config.postgresUrl || process.env.HEALTH_LEAGUE_POSTGRES_URL_NON_POOLING;

if (!postgresUrl) {
  console.error('Missing HEALTH_LEAGUE_POSTGRES_URL_NON_POOLING (or add to scripts/.env.local)');
  process.exit(1);
}

async function run() {
  let pg;
  try {
    pg = require('pg');
  } catch (e) {
    console.error('Install pg first: npm install pg');
    process.exit(1);
  }

  const migrationPath = path.join(__dirname, '..', 'supabase', 'migrations', '20260219_pin_login.sql');
  const sql = fs.readFileSync(migrationPath, 'utf8');

  const client = new pg.Client({
    connectionString: postgresUrl,
    ssl: { rejectUnauthorized: false },
  });
  try {
    await client.connect();
    await client.query(sql);
    console.log('PIN login migration applied successfully (profile_auth table + profile columns).');
  } catch (err) {
    console.error('Migration error:', err.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

run();
