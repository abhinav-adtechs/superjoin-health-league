#!/usr/bin/env node

/**
 * Ensure all profiles are marked as active so they appear in leaderboard.
 *
 * Usage:
 *   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... node scripts/ensure-profiles-active.js
 */

const { createClient } = require('@supabase/supabase-js');
const config = require('./config');

const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || config.supabaseUrl;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || config.serviceRoleKey;

if (!supabaseUrl || !serviceRoleKey) {
  console.error('Error: Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function main() {
  console.log('Fetching all profiles...');
  const { data: profiles, error: profileError } = await supabase
    .from('profiles')
    .select('id, display_name, is_active');
  if (profileError) {
    console.error('Error fetching profiles:', profileError);
    process.exit(1);
  }
  if (!profiles || profiles.length === 0) {
    console.log('No profiles found.');
    process.exit(0);
  }

  console.log(`Found ${profiles.length} profile(s):\n`);
  for (const p of profiles) {
    console.log(`  ${p.display_name}: is_active = ${p.is_active}`);
  }

  const inactive = profiles.filter(p => !p.is_active);
  if (inactive.length === 0) {
    console.log('\n✅ All profiles are already active.');
    return;
  }

  console.log(`\nFound ${inactive.length} inactive profile(s). Activating...`);
  for (const p of inactive) {
    const { error } = await supabase
      .from('profiles')
      .update({ is_active: true })
      .eq('id', p.id);
    if (error) {
      console.error(`  Error activating ${p.display_name}:`, error);
    } else {
      console.log(`  ✅ Activated ${p.display_name}`);
    }
  }

  console.log('\n✅ Done.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
