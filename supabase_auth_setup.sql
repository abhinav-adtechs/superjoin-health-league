-- ============================================
-- FIFA League Tracker - Admin Authentication Setup
-- ============================================
-- Run this entire script in your Supabase SQL Editor
-- ============================================

-- Step 1: Enable pgcrypto extension for password hashing
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Step 2: Create admin_passwords table
CREATE TABLE IF NOT EXISTS admin_passwords (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_used_at TIMESTAMPTZ
);

-- Step 3: Create admin_login_audit table
CREATE TABLE IF NOT EXISTS admin_login_audit (
  id BIGSERIAL PRIMARY KEY,
  admin_id UUID REFERENCES admin_passwords(id),
  admin_name_snapshot TEXT NOT NULL,
  login_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  success BOOLEAN NOT NULL,
  ip_address INET,
  user_agent TEXT
);

-- Step 4: Insert admin passwords (REPLACE placeholders with secure passwords before running!)
-- Each admin must have a unique password. Use crypt('your_secure_password', gen_salt('bf'))
INSERT INTO admin_passwords (name, password_hash) VALUES
  ('admin1', crypt('CHANGE_ME_PASSWORD_1', gen_salt('bf'))),
  ('admin2', crypt('CHANGE_ME_PASSWORD_2', gen_salt('bf'))),
  ('admin3', crypt('CHANGE_ME_PASSWORD_3', gen_salt('bf'))),
  ('admin4', crypt('CHANGE_ME_PASSWORD_4', gen_salt('bf')));

-- Step 5: Create RPC function to verify password
-- Drop function if it exists first
DROP FUNCTION IF EXISTS public.verify_admin_password(TEXT);

-- Create the function with proper extension access
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

-- Ensure the API roles can call this function
GRANT EXECUTE ON FUNCTION public.verify_admin_password(TEXT) TO anon, authenticated;

-- Step 6: Create an optional view for login summary
CREATE OR REPLACE VIEW admin_login_summary AS
SELECT
  admin_name_snapshot AS admin_name,
  COUNT(*) FILTER (WHERE success) AS successful_logins,
  COUNT(*) FILTER (WHERE NOT success) AS failed_logins,
  MAX(login_at) AS last_login_at
FROM admin_login_audit
GROUP BY admin_name_snapshot;

-- ============================================
-- IMPORTANT: Replace CHANGE_ME_PASSWORD_* above with secure passwords
-- before running. Do NOT commit real passwords to version control.
-- ============================================
