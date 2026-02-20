#!/usr/bin/env node

/**
 * Remove seeded dummy data (daily_entries, weekly_weigh_ins in the past N days).
 * Only run this if you previously ran seed-dummy-data.js and want to clear that data.
 *
 * Usage:
 *   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... node scripts/cleanup-dummy-data.js
 *   # Optional: SEED_DAYS=90 (must match what you used for seed)
 */

const { createClient } = require('@supabase/supabase-js');
const config = require('./config');

const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || config.supabaseUrl;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || config.serviceRoleKey;
const SEED_DAYS = parseInt(process.env.SEED_DAYS || '90', 10);

if (!supabaseUrl || !serviceRoleKey) {
  console.error('Error: Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

function dateToYMD(d) {
  return d.toISOString().slice(0, 10);
}

async function main() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const startDate = new Date(today);
  startDate.setDate(startDate.getDate() - SEED_DAYS);
  const fromDate = dateToYMD(startDate);
  const toDate = dateToYMD(new Date(today.getTime() - 86400000)); // yesterday

  console.log(`Cleaning dummy data from ${fromDate} to ${toDate} (past ${SEED_DAYS} days)...`);

  const { error: eErr } = await supabase
    .from('daily_entries')
    .delete()
    .gte('date', fromDate)
    .lte('date', toDate);
  if (eErr) {
    console.error('Error deleting daily_entries:', eErr);
    process.exit(1);
  }
  console.log('Deleted daily_entries in date range.');

  // Weekly weigh-ins: delete those with week_start in range
  const weekStart = new Date(startDate);
  const weekEnd = new Date(today);
  const wsFrom = dateToYMD(weekStart);
  const wsTo = dateToYMD(weekEnd);
  const { error: wErr } = await supabase
    .from('weekly_weigh_ins')
    .delete()
    .gte('week_start', wsFrom)
    .lte('week_start', wsTo);
  if (wErr) {
    console.error('Error deleting weekly_weigh_ins:', wErr);
    process.exit(1);
  }
  console.log('Deleted weekly_weigh_ins in date range.');

  // Streaks: optional - uncomment to also remove streaks created in seed
  // const { error: sErr } = await supabase.from('streaks').delete().gte('start_date', fromDate);
  // if (sErr) console.error('Error deleting streaks:', sErr);

  console.log('Cleanup done.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
