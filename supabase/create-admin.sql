-- ============================================
-- Create Admin User Profile (SQL only)
-- ============================================
-- NOTE: This SQL assumes you've already created the auth.users entry
-- via Supabase Dashboard or the create-admin.js script.
--
-- To use this SQL:
-- 1. First create the auth user via Supabase Dashboard:
--    - Go to Authentication > Users > Add User
--    - Email: abhinav@superjoin.ai
--    - Password: [your password]
--    - Auto-confirm: Yes
-- 2. Get the user ID from the created user
-- 3. Replace USER_ID_HERE below with that UUID
-- 4. Run this SQL
-- ============================================

-- Option 1: If admin profile doesn't exist, create it
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
)
SELECT 
  au.id,
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
FROM auth.users au
WHERE au.email = 'abhinav@superjoin.ai'
  AND NOT EXISTS (
    SELECT 1 FROM public.profiles p WHERE p.id = au.id
  )
ON CONFLICT (id) DO UPDATE
SET is_admin = true,
    must_change_pin = false;

-- Option 2: If you know the user ID, use this instead:
-- Replace USER_ID_HERE with the actual UUID from auth.users
/*
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
  'USER_ID_HERE'::uuid,
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
*/

-- Verify the admin was created
SELECT 
  p.id,
  p.display_name,
  p.is_admin,
  au.email
FROM public.profiles p
JOIN auth.users au ON au.id = p.id
WHERE au.email = 'abhinav@superjoin.ai';
