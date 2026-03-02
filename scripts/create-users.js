#!/usr/bin/env node

/**
 * Create users for Office Health Tracker with random PINs
 * 
 * This script:
 * 1. Creates auth.users entries via Supabase Admin API
 * 2. Creates profiles entries with random PINs
 * 3. Creates profile_auth entries for PIN login
 * 
 * Usage:
 *   SUPABASE_URL=your-url SUPABASE_SERVICE_ROLE_KEY=your-key node scripts/create-users.js
 */

const { createClient } = require('@supabase/supabase-js');
const bcrypt = require('bcryptjs');
const config = require('./config');

const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || config.supabaseUrl;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || config.serviceRoleKey;

if (!supabaseUrl || !serviceRoleKey) {
  console.error('Error: Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  console.error('Usage: SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... node scripts/create-users.js');
  console.error('Or add them to .env.local file');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

// Users to create
const users = [
  { name: 'Manan Gupta', email: 'manan@superjoin.ai' },
  { name: 'Akshat Gupta', email: 'akshat@superjoin.ai' },
  { name: 'Karan Dua', email: 'karan@superjoin.ai' },
  { name: 'Manomay Kagalkar', email: 'manomay@superjoin.ai' },
  { name: 'Vinayak Jhunjhunwala', email: 'vinayak@superjoin.ai' },
  { name: 'Sagar Kotian', email: 'sagar@superjoin.ai' },
  { name: 'Tushar Anand', email: 'tushar@superjoin.ai' },
  { name: 'Mukul', email: 'mukul@superjoin.ai' },
  { name: 'Anshul', email: 'anshul@superjoin.ai' },
];

// Generate random 6-digit PIN
function generateRandomPin() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

// Get age bracket from age
function getAgeBracket(age) {
  if (age < 25) return 'under_25';
  if (age <= 35) return '25_to_35';
  return 'over_35';
}

async function createUser(userData) {
  const { name, email } = userData;
  const pin = generateRandomPin();
  const pinHash = await bcrypt.hash(pin, 10);
  
  // Generate a random password for auth (users won't use this directly, PIN login uses it)
  const authPassword = Math.random().toString(36).slice(-12) + Math.random().toString(36).slice(-12);
  
  try {
    console.log(`\nCreating user: ${name} (${email})...`);
    
    // Step 1: Check if user already exists
    const { data: existingUsers, error: listError } = await supabase.auth.admin.listUsers();
    if (listError) {
      console.error(`Error listing users:`, listError);
      throw listError;
    }
    
    const existingUser = existingUsers.users.find(u => u.email === email);
    let userId;
    
    if (existingUser) {
      console.log(`  User ${email} already exists with ID: ${existingUser.id}`);
      userId = existingUser.id;
      
      // Update password
      const { error: updateError } = await supabase.auth.admin.updateUserById(
        userId,
        { password: authPassword }
      );
      if (updateError) {
        console.error(`  Error updating password:`, updateError);
        throw updateError;
      }
      console.log(`  Password updated.`);
    } else {
      // Step 2: Create auth user
      const { data: newUser, error: createError } = await supabase.auth.admin.createUser({
        email: email,
        password: authPassword,
        email_confirm: true, // Auto-confirm email
      });
      
      if (createError) {
        console.error(`  Error creating auth user:`, createError);
        throw createError;
      }
      
      userId = newUser.user.id;
      console.log(`  Created auth user with ID: ${userId}`);
    }
    
    // Step 3: Check if profile exists
    const { data: existingProfile, error: profileCheckError } = await supabase
      .from('profiles')
      .select('id')
      .eq('id', userId)
      .maybeSingle();
    
    if (profileCheckError && profileCheckError.code !== 'PGRST116') {
      console.error(`  Error checking profile:`, profileCheckError);
      throw profileCheckError;
    }
    
    // Default profile values (you can customize these)
    const defaultAge = 28;
    const defaultHeight = 175;
    const defaultWeight = 75;
    
    if (existingProfile) {
      // Update existing profile with PIN
      const { error: updateError } = await supabase
        .from('profiles')
        .update({
          pin_hash: pinHash,
          pin_set_at: new Date().toISOString(),
          must_change_pin: false,
          display_name: name.split(' ')[0], // First name
        })
        .eq('id', userId);
      
      if (updateError) {
        console.error(`  Error updating profile:`, updateError);
        throw updateError;
      }
      console.log(`  Updated existing profile with PIN.`);
    } else {
      // Create new profile
      const { error: insertError } = await supabase
        .from('profiles')
        .insert({
          id: userId,
          display_name: name.split(' ')[0], // First name
          age: defaultAge,
          gender: 'male', // Default, can be updated later
          height_cm: defaultHeight,
          starting_weight: defaultWeight,
          current_weight: defaultWeight,
          fitness_goal: 'general_wellness',
          age_bracket: getAgeBracket(defaultAge),
          pin_hash: pinHash,
          pin_set_at: new Date().toISOString(),
          must_change_pin: false,
          is_admin: false,
        });
      
      if (insertError) {
        console.error(`  Error creating profile:`, insertError);
        throw insertError;
      }
      console.log(`  Created profile.`);
    }
    
    // Step 4: Create or update profile_auth entry
    const { data: existingAuth, error: authCheckError } = await supabase
      .from('profile_auth')
      .select('profile_id')
      .eq('profile_id', userId)
      .maybeSingle();
    
    if (authCheckError && authCheckError.code !== 'PGRST116') {
      console.error(`  Error checking profile_auth:`, authCheckError);
      throw authCheckError;
    }
    
    if (existingAuth) {
      // Update existing auth entry
      const { error: updateError } = await supabase
        .from('profile_auth')
        .update({
          auth_email: email,
          auth_password: authPassword,
        })
        .eq('profile_id', userId);
      
      if (updateError) {
        console.error(`  Error updating profile_auth:`, updateError);
        throw updateError;
      }
      console.log(`  Updated profile_auth.`);
    } else {
      // Create new auth entry
      const { error: insertError } = await supabase
        .from('profile_auth')
        .insert({
          profile_id: userId,
          auth_email: email,
          auth_password: authPassword,
        });
      
      if (insertError) {
        console.error(`  Error creating profile_auth:`, insertError);
        throw insertError;
      }
      console.log(`  Created profile_auth.`);
    }
    
    return { name, email, pin, userId };
  } catch (error) {
    console.error(`\n❌ Error creating user ${name}:`, error.message);
    return null;
  }
}

async function createAdminPin() {
  const ADMIN_EMAIL = 'abhinav@superjoin.ai';
  const pin = generateRandomPin();
  const pinHash = await bcrypt.hash(pin, 10);

  // Generate a password specifically for PIN-based login. This does NOT
  // have to match your normal admin password – it is only used by the
  // backend when exchanging a successful PIN check for a Supabase session.
  const authPassword = Math.random().toString(36).slice(-12) + Math.random().toString(36).slice(-12);

  try {
    console.log(`\nCreating PIN for admin: ${ADMIN_EMAIL}...`);

    // Find admin auth user
    const { data: existingUsers, error: listError } = await supabase.auth.admin.listUsers();
    if (listError) {
      console.error(`Error listing users:`, listError);
      return null;
    }

    const adminUser = existingUsers.users.find((u) => u.email === ADMIN_EMAIL);
    if (!adminUser) {
      console.log(`  Admin user ${ADMIN_EMAIL} not found. Skipping PIN creation.`);
      return null;
    }

    // Ensure the auth user has the password we will use for PIN-based login
    const { error: pwdError } = await supabase.auth.admin.updateUserById(adminUser.id, {
      password: authPassword,
    });
    if (pwdError) {
      console.error('  Error updating admin auth password for PIN login:', pwdError);
      return null;
    }

    // Update admin profile with PIN
    const { error: updateError } = await supabase
      .from('profiles')
      .update({
        pin_hash: pinHash,
        pin_set_at: new Date().toISOString(),
        must_change_pin: false,
      })
      .eq('id', adminUser.id);

    if (updateError) {
      console.error('  Error updating admin PIN in profiles:', updateError);
      return null;
    }

    // Upsert profile_auth row so /api/auth/pin-login can exchange the PIN for a session
    const { data: existingAuth, error: authCheckError } = await supabase
      .from('profile_auth')
      .select('profile_id')
      .eq('profile_id', adminUser.id)
      .maybeSingle();

    if (authCheckError && authCheckError.code !== 'PGRST116') {
      console.error('  Error checking admin profile_auth:', authCheckError);
      return null;
    }

    if (existingAuth) {
      const { error: authUpdateError } = await supabase
        .from('profile_auth')
        .update({
          auth_email: ADMIN_EMAIL,
          auth_password: authPassword,
        })
        .eq('profile_id', adminUser.id);
      if (authUpdateError) {
        console.error('  Error updating admin profile_auth:', authUpdateError);
        return null;
      }
    } else {
      const { error: authInsertError } = await supabase.from('profile_auth').insert({
        profile_id: adminUser.id,
        auth_email: ADMIN_EMAIL,
        auth_password: authPassword,
      });
      if (authInsertError) {
        console.error('  Error creating admin profile_auth:', authInsertError);
        return null;
      }
    }

    console.log('  ✅ Admin PIN and auth mapping created successfully.');
    return { name: 'Abhinav (Admin)', email: ADMIN_EMAIL, pin };
  } catch (error) {
    console.error('\n❌ Error creating admin PIN:', error.message || error);
    return null;
  }
}

async function main() {
  console.log('🚀 Creating users with random PINs...\n');
  
  const results = [];
  for (const user of users) {
    const result = await createUser(user);
    if (result) {
      results.push(result);
    }
  }
  
  // Also create PIN for admin
  const adminResult = await createAdminPin();
  if (adminResult) {
    results.push(adminResult);
  }
  
  console.log('\n' + '='.repeat(60));
  console.log('✅ USER CREATION SUMMARY');
  console.log('='.repeat(60));
  
  if (results.length === 0) {
    console.log('\n❌ No users were created successfully.');
    process.exit(1);
  }
  
  console.log('\n📋 Created Users and PINs:\n');
  results.forEach(({ name, email, pin }) => {
    console.log(`  ${name}`);
    console.log(`    Email: ${email}`);
    console.log(`    PIN:   ${pin}`);
    console.log('');
  });
  
  console.log('='.repeat(60));
  console.log(`\n✅ Successfully created ${results.length} user(s) with PINs.`);
  console.log('\n⚠️  IMPORTANT: Save these PINs securely and share them with the users.');
  console.log('   Admin can now use PIN login for fast access!\n');
}

main().catch((error) => {
  console.error('\n❌ Fatal error:', error);
  process.exit(1);
});
