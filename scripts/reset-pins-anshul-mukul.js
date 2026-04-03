#!/usr/bin/env node
/**
 * Regenerate 6-digit PINs for Mukul and Anshul only (profiles.pin_hash).
 *
 * Usage: node scripts/reset-pins-anshul-mukul.js
 * Requires SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY (or .env.local via scripts/config.js).
 */

const { createClient } = require('@supabase/supabase-js');
const bcrypt = require('bcryptjs');
const config = require('./config');

const TARGETS = [
  { name: 'Mukul', email: 'mukul@superjoin.ai' },
  { name: 'Anshul', email: 'anshul@superjoin.ai' },
];

function generateRandomPin() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

async function main() {
  const supabaseUrl =
    process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || config.supabaseUrl;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || config.serviceRoleKey;
  if (!supabaseUrl || !serviceRoleKey) {
    console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY (set env or use .env.local).');
    process.exit(1);
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: listData, error: listError } = await supabase.auth.admin.listUsers({
    page: 1,
    perPage: 1000,
  });
  if (listError) throw listError;

  const results = [];
  for (const { name, email } of TARGETS) {
    const user = listData.users.find((u) => u.email === email);
    if (!user) {
      console.error(`User not found in auth: ${email}`);
      continue;
    }

    const pin = generateRandomPin();
    const pinHash = await bcrypt.hash(pin, 10);
    const { data: updated, error: updateError } = await supabase
      .from('profiles')
      .update({
        pin_hash: pinHash,
        pin_set_at: new Date().toISOString(),
        must_change_pin: false,
      })
      .eq('id', user.id)
      .select('id')
      .maybeSingle();

    if (updateError) {
      console.error(`Failed to update profile for ${email}:`, updateError);
      continue;
    }
    if (!updated) {
      console.error(`No profile row for ${email} (id ${user.id}); create profile first.`);
      continue;
    }

    results.push({ name, email, pin });
    console.log(`OK: ${name} (${email})`);
  }

  if (results.length === 0) {
    console.error('\nNo PINs were updated.');
    process.exit(1);
  }

  console.log('\n--- New PINs (share securely; not stored in git) ---');
  for (const r of results) {
    console.log(`  ${r.name} (${r.email}): ${r.pin}`);
  }
  console.log('');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
