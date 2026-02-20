#!/usr/bin/env node

/**
 * Verify users in Supabase: list all profiles and auth users count.
 * Uses same config as create-users.js (.env.local or env vars).
 */

const { createClient } = require('@supabase/supabase-js');
const config = require('./config');

const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || config.supabaseUrl;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || config.serviceRoleKey;

if (!supabaseUrl || !serviceRoleKey) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY (set in .env.local or env)');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function main() {
  console.log('Connecting to Supabase...\n');

  const { data: profiles, error: profilesError } = await supabase
    .from('profiles')
    .select('id, display_name, is_active, created_at')
    .order('display_name');

  if (profilesError) {
    console.error('Profiles query failed:', profilesError.message);
    process.exit(1);
  }

  const { data: authList, error: authError } = await supabase.auth.admin.listUsers({ perPage: 1000 });
  const authCount = authError ? 0 : (authList?.users?.length ?? 0);

  console.log('--- Profiles (public.profiles) ---');
  console.log('Total:', profiles?.length ?? 0);
  console.log('Active (is_active=true):', profiles?.filter((p) => p.is_active).length ?? 0);
  if (profiles?.length) {
    profiles.forEach((p, i) => {
      console.log(`  ${i + 1}. ${p.display_name} ${p.is_active ? '' : '[inactive]'}`);
    });
  }
  console.log('\n--- Auth (auth.users) ---');
  console.log('Total users:', authCount);
  if (authError) console.log('(list error:', authError.message + ')');
  console.log('\nDone.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
