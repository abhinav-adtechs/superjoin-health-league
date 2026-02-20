#!/usr/bin/env node

/**
 * Verify admin setup is complete
 */

const { createClient } = require('@supabase/supabase-js');

const ADMIN_EMAIL = 'abhinav@superjoin.ai';
const ADMIN_USER_ID = '8ba2c99b-4f9a-4fd3-a27a-8a26b48d07ba';
const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  console.error('Error: Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function verifyAdmin() {
  try {
    console.log('Verifying admin setup...\n');

    // Check auth user
    const { data: { users }, error: listError } = await supabase.auth.admin.listUsers();
    if (listError) throw listError;
    
    const adminUser = users.find(u => u.email === ADMIN_EMAIL);
    if (!adminUser) {
      console.log('❌ Auth user not found');
      return;
    }
    console.log('✅ Auth user exists:');
    console.log(`   Email: ${adminUser.email}`);
    console.log(`   ID: ${adminUser.id}`);
    console.log(`   Email confirmed: ${adminUser.email_confirmed_at ? 'Yes' : 'No'}\n`);

    // Check profile
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', ADMIN_USER_ID)
      .single();

    if (profileError) {
      console.log('❌ Profile not found:', profileError.message);
      return;
    }

    console.log('✅ Admin profile exists:');
    console.log(`   Display name: ${profile.display_name}`);
    console.log(`   Is admin: ${profile.is_admin}`);
    console.log(`   Must change PIN: ${profile.must_change_pin}\n`);

    // Check columns exist
    const hasColumns = [
      'is_admin',
      'pin_hash',
      'pin_set_at',
      'previous_pin_hash',
      'must_change_pin',
      'avatar_url'
    ].every(col => profile.hasOwnProperty(col));

    if (!hasColumns) {
      console.log('⚠️  Some columns missing - run the migration SQL');
    } else {
      console.log('✅ All required columns exist\n');
    }

    console.log('🎉 Admin setup complete!');
    console.log('\nLogin credentials:');
    console.log(`   Email: ${ADMIN_EMAIL}`);
    console.log(`   Password: Admin@2024Temp`);
    console.log('\nYou can now log in to the app!');

  } catch (error) {
    console.error('\n❌ Error:', error.message);
    process.exit(1);
  }
}

verifyAdmin();
