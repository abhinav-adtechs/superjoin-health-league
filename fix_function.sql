-- ============================================
-- Fix: Recreate verify_admin_password function
-- Run this in Supabase SQL Editor if you get "function does not exist" error
-- ============================================

-- Step 1: Ensure pgcrypto extension is enabled
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Step 2: Drop function if it exists (with different signatures)
DROP FUNCTION IF EXISTS public.verify_admin_password(TEXT);
DROP FUNCTION IF EXISTS verify_admin_password(TEXT);

-- Step 3: Recreate the function with proper extension access
CREATE OR REPLACE FUNCTION public.verify_admin_password(plain_password TEXT)
RETURNS TABLE(id UUID, name TEXT) 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  matched_admin RECORD;
BEGIN
  -- Loop through all active admins and check password
  FOR matched_admin IN 
    SELECT ap.id, ap.name, ap.password_hash
    FROM public.admin_passwords ap
    WHERE ap.is_active = true
  LOOP
    -- Use crypt function from pgcrypto extension
    IF matched_admin.password_hash = crypt(plain_password, matched_admin.password_hash) THEN
      id := matched_admin.id;
      name := matched_admin.name;
      RETURN NEXT;
      EXIT;
    END IF;
  END LOOP;
  
  RETURN;
END;
$$;

-- Step 4: Grant permissions
GRANT EXECUTE ON FUNCTION public.verify_admin_password(TEXT) TO anon, authenticated;

-- Step 5: Test the function (optional - run with your test password)
-- SELECT * FROM public.verify_admin_password('your_test_password');
