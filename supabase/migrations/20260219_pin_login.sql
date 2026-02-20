-- ============================================
-- PIN-based login + admin + avatar
-- ============================================
-- Run in Supabase SQL Editor after main schema.
-- Adds: profiles pin/avatar/admin columns, profile_auth table, RLS.
-- ============================================

-- Profiles: PIN and avatar and admin
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS avatar_url TEXT,
  ADD COLUMN IF NOT EXISTS pin_hash TEXT,
  ADD COLUMN IF NOT EXISTS pin_set_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS previous_pin_hash TEXT,
  ADD COLUMN IF NOT EXISTS must_change_pin BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS is_admin BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN public.profiles.pin_hash IS 'Bcrypt hash of 6-digit PIN';
COMMENT ON COLUMN public.profiles.pin_set_at IS 'When current PIN was set; used for 60-day expiry';
COMMENT ON COLUMN public.profiles.previous_pin_hash IS 'Previous PIN hash; new PIN cannot equal this';
COMMENT ON COLUMN public.profiles.must_change_pin IS 'True on first login or after 60-day expiry';
COMMENT ON COLUMN public.profiles.is_admin IS 'Admin uses email/password (abhinav@superjoin.ai); not shown in PIN user list';

-- Backend-only: credentials to sign in after PIN verify (service role only in app)
CREATE TABLE IF NOT EXISTS public.profile_auth (
  profile_id UUID PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  auth_email TEXT UNIQUE NOT NULL,
  auth_password TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- RLS: no direct access for anon/authenticated; only backend with service role uses this
ALTER TABLE public.profile_auth ENABLE ROW LEVEL SECURITY;

-- No policies: no one can read/write via anon or authenticated; service role bypasses RLS
CREATE POLICY "No anon access to profile_auth"
  ON public.profile_auth FOR ALL
  TO anon
  USING (false)
  WITH CHECK (false);

CREATE POLICY "No authenticated access to profile_auth"
  ON public.profile_auth FOR ALL
  TO authenticated
  USING (false)
  WITH CHECK (false);

-- Login dropdown is served by API route with service role; no anon profile list.
-- (Authenticated can read all profiles for leaderboard — existing policy.)
