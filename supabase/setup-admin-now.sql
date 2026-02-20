-- ============================================
-- Quick Admin Setup - Run this in Supabase SQL Editor
-- ============================================
-- This adds the missing columns and creates the admin profile
-- ============================================

-- Step 1: Add missing columns to profiles table
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS avatar_url TEXT,
  ADD COLUMN IF NOT EXISTS pin_hash TEXT,
  ADD COLUMN IF NOT EXISTS pin_set_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS previous_pin_hash TEXT,
  ADD COLUMN IF NOT EXISTS must_change_pin BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS is_admin BOOLEAN NOT NULL DEFAULT false;

-- Step 2: Create admin profile (user ID from script output: 8ba2c99b-4f9a-4fd3-a27a-8a26b48d07ba)
INSERT INTO public.profiles (
  id,
  display_name,
  age,
  gender,
  height_cm,
  starting_weight,
  current_weight,
  fitness_goal,
  age_bracket,
  is_admin,
  must_change_pin
) VALUES (
  '8ba2c99b-4f9a-4fd3-a27a-8a26b48d07ba'::uuid,
  'Abhinav',
  30,
  'male',
  175,
  75,
  75,
  'general_wellness',
  '25_to_35',
  true,
  false
)
ON CONFLICT (id) DO UPDATE
SET is_admin = true,
    must_change_pin = false;

-- Step 3: Verify admin was created
SELECT 
  p.id,
  p.display_name,
  p.is_admin,
  au.email,
  au.email_confirmed_at IS NOT NULL as email_confirmed
FROM public.profiles p
JOIN auth.users au ON au.id = p.id
WHERE au.email = 'abhinav@superjoin.ai';
