-- ============================================
-- Connected Accounts — OAuth tokens + sync state
-- ============================================
-- Stores OAuth credentials for Fitbit and future platforms.
-- Apple Health connections use platform_user_id as a device token (no OAuth).
-- ============================================

CREATE TABLE IF NOT EXISTS public.connected_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  platform TEXT NOT NULL CHECK (platform IN ('fitbit', 'apple_health', 'google_health')),

  -- OAuth tokens (null for Apple Health which uses native Capacitor bridge)
  access_token TEXT,
  refresh_token TEXT,
  token_expires_at TIMESTAMPTZ,
  scopes TEXT[],

  -- Identifies the user on the connected platform (Fitbit user ID, device UUID, etc.)
  platform_user_id TEXT,

  connected_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_synced_at TIMESTAMPTZ,

  -- When false the platform is shown as connected but syncing is paused
  sync_enabled BOOLEAN NOT NULL DEFAULT true,

  -- fill_nulls: only populate empty daily_entry fields
  -- always_override: connected data always wins over manual entry
  sync_preference TEXT NOT NULL DEFAULT 'fill_nulls'
    CHECK (sync_preference IN ('fill_nulls', 'always_override')),

  UNIQUE (user_id, platform)
);

COMMENT ON TABLE public.connected_accounts IS 'OAuth + device connections to external health platforms';
COMMENT ON COLUMN public.connected_accounts.sync_preference IS 'fill_nulls: fill empty fields only; always_override: connected data wins';

CREATE INDEX IF NOT EXISTS idx_connected_accounts_user ON public.connected_accounts(user_id);

-- ============================================
-- ROW LEVEL SECURITY
-- ============================================

ALTER TABLE public.connected_accounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own connected accounts"
  ON public.connected_accounts FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own connected accounts"
  ON public.connected_accounts FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own connected accounts"
  ON public.connected_accounts FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own connected accounts"
  ON public.connected_accounts FOR DELETE
  USING (auth.uid() = user_id);
