#!/usr/bin/env node

/**
 * Create admin user for Office Health Tracker
 * 
 * This script:
 * 1. Creates auth.users entry via Supabase Admin API
 * 2. Creates profiles entry with is_admin = true
 * 
 * Usage:
 *   SUPABASE_URL=your-url SUPABASE_SERVICE_ROLE_KEY=your-key ADMIN_PASSWORD=your-password node scripts/create-admin.js
 */

const { createClient } = require('@supabase/supabase-js');

const ADMIN_EMAIL = 'abhinav@superjoin.ai';
const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const adminPassword = process.env.ADMIN_PASSWORD;

if (!supabaseUrl || !serviceRoleKey) {
  console.error('Error: Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  console.error('Usage: SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... ADMIN_PASSWORD=... node scripts/create-admin.js');
  process.exit(1);
}

if (!adminPassword) {
  console.error('Error: Missing ADMIN_PASSWORD');
  console.error('Usage: SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... ADMIN_PASSWORD=... node scripts/create-admin.js');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function createAdmin() {
  try {
    console.log('Creating admin user...');
    
    // Step 1: Check if user already exists
    const { data: existingUsers, error: listError } = await supabase.auth.admin.listUsers();
    if (listError) {
      console.error('Error listing users:', listError);
      throw listError;
    }
    
    const existingUser = existingUsers.users.find(u => u.email === ADMIN_EMAIL);
    let userId;
    
    if (existingUser) {
      console.log(`User ${ADMIN_EMAIL} already exists with ID: ${existingUser.id}`);
      userId = existingUser.id;
      
      // Update password if needed
      const { error: updateError } = await supabase.auth.admin.updateUserById(
        userId,
        { password: adminPassword }
      );
      if (updateError) {
        console.error('Error updating password:', updateError);
        throw updateError;
      }
      console.log('Password updated.');
    } else {
      // Step 2: Create auth user
      const { data: newUser, error: createError } = await supabase.auth.admin.createUser({
        email: ADMIN_EMAIL,
        password: adminPassword,
        email_confirm: true, // Auto-confirm email
      });
      
      if (createError) {
        console.error('Error creating user:', createError);
        throw createError;
      }
      
      userId = newUser.user.id;
      console.log(`Created auth user with ID: ${userId}`);
    }
    
    // Step 3: Check if profile exists
    const { data: existingProfile, error: profileCheckError } = await supabase
      .from('profiles')
      .select('id')
      .eq('id', userId)
      .maybeSingle();
    
    if (profileCheckError && profileCheckError.code !== 'PGRST116') {
      console.error('Error checking profile:', profileCheckError);
      throw profileCheckError;
    }
    
    if (existingProfile) {
      // Update existing profile to be admin
      const { error: updateError } = await supabase
        .from('profiles')
        .update({ is_admin: true })
        .eq('id', userId);
      
      if (updateError) {
        console.error('Error updating profile:', updateError);
        throw updateError;
      }
      console.log('Updated existing profile to admin.');
    } else {
      // Create new profile
      const { error: insertError } = await supabase
        .from('profiles')
        .insert({
          id: userId,
          display_name: 'Abhinav',
          age: 30,
          gender: 'male',
          height_cm: 175,
          starting_weight: 75,
          current_weight: 75,
          fitness_goal: 'general_wellness',
          age_bracket: '25_to_35',
          is_admin: true,
          must_change_pin: false, // Admin doesn't use PIN
        });
      
      if (insertError) {
        console.error('Error creating profile:', insertError);
        throw insertError;
      }
      console.log('Created admin profile.');
    }
    
    console.log('\n✅ Admin user created successfully!');
    console.log(`   Email: ${ADMIN_EMAIL}`);
    console.log(`   User ID: ${userId}`);
    console.log('\nYou can now log in with:');
    console.log(`   Email: ${ADMIN_EMAIL}`);
    console.log(`   Password: [the password you provided]`);
    
  } catch (error) {
    console.error('\n❌ Error:', error.message);
    process.exit(1);
  }
}

createAdmin();
