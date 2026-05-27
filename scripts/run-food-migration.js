#!/usr/bin/env node
/**
 * Apply food catalog + meal/water logs migration.
 * Requires pg + HEALTH_LEAGUE_POSTGRES_URL_NON_POOLING in .env.local
 *
 * Usage: NODE_TLS_REJECT_UNAUTHORIZED=0 node scripts/run-food-migration.js
 */

const fs = require('fs');
const path = require('path');
const config = require('./config');

const postgresUrl = config.postgresUrl || process.env.HEALTH_LEAGUE_POSTGRES_URL_NON_POOLING;

if (!postgresUrl) {
  console.error('Missing HEALTH_LEAGUE_POSTGRES_URL_NON_POOLING');
  process.exit(1);
}

async function run() {
  const pg = require('pg');
  const migrationPath = path.join(
    __dirname,
    '..',
    'supabase',
    'migrations',
    '20260527_food_and_water_logging.sql',
  );
  const sql = fs.readFileSync(migrationPath, 'utf8');
  const client = new pg.Client({
    connectionString: postgresUrl,
    ssl: { rejectUnauthorized: false },
  });
  try {
    await client.connect();
    await client.query(sql);
    const { rows } = await client.query(
      'SELECT count(*)::int AS n FROM public.food_catalog',
    );
    console.log(`Food logging migration applied. food_catalog rows: ${rows[0].n}`);
  } catch (err) {
    console.error('Migration error:', err.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

run();
