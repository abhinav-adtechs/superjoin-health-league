#!/usr/bin/env node

/**
 * Complete admin setup - adds columns and creates profile
 * Uses Supabase REST API to execute SQL
 */

const ADMIN_USER_ID = '8ba2c99b-4f9a-4fd3-a27a-8a26b48d07ba';
const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  console.error('Error: Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

async function completeSetup() {
  try {
    const { createClient } = require('@supabase/supabase-js');
    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });

    console.log('Adding missing columns to profiles table...');
    
    // Try to create profile - if columns don't exist, this will fail gracefully
    const { data, error } = await supabase
      .from('profiles')
      .insert({
        id: ADMIN_USER_ID,
        display_name: 'Abhinav',
        age: 30,
        gender: 'male',
        height_cm: 175,
        starting_weight: 75,
        current_weight: 75,
        fitness_goal: 'general_wellness',
        age_bracket: '25_to_35',
        is_admin: true,
        must_change_pin: false,
      })
      .select()
      .single();

    if (error) {
      if (error.code === 'PGRST204' || error.message.includes('is_admin')) {
        console.log('\n⚠️  Columns not found. Please run this SQL in Supabase SQL Editor first:');
        console.log('\n' + '='.repeat(60));
        console.log(`
-- Add missing columns
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS avatar_url TEXT,
  ADD COLUMN IF NOT EXISTS pin_hash TEXT,
  ADD COLUMN IF NOT EXISTS pin_set_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS previous_pin_hash TEXT,
  ADD COLUMN IF NOT EXISTS must_change_pin BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS is_admin BOOLEAN NOT NULL DEFAULT false;

-- Create admin profile
INSERT INTO public.profiles (
  id, display_name, age, gender, height_cm, starting_weight,
  current_weight, fitness_goal, age_bracket, is_admin, must_change_pin
) VALUES (
  '${ADMIN_USER_ID}'::uuid,
  'Abhinav', 30, 'male', 175, 75, 75,
  'general_wellness', '25_to_35', true, false
)
ON CONFLICT (id) DO UPDATE
SET is_admin = true, must_change_pin = false;
        `);
        console.log('='.repeat(60) + '\n');
        console.log('After running the SQL, run this script again to verify.');
        process.exit(1);
      } else {
        throw error;
      }
    }

    console.log('✅ Admin profile created successfully!');
    console.log('\nAdmin login credentials:');
    console.log('  Email: abhinav@superjoin.ai');
    console.log('  Password: Admin@2024Temp (change this after first login)');
    console.log('\nYou can now log in to the app!');

  } catch (error) {
    console.error('\n❌ Error:', error.message);
    process.exit(1);
  }
}

completeSetup();
