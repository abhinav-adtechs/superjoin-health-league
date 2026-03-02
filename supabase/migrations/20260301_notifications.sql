-- ============================================
-- Notifications — preferences and device tokens
-- ============================================

-- Add slack_user_id to profiles if not already present (linked Slack member ID)
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS slack_user_id TEXT;

COMMENT ON COLUMN public.profiles.slack_user_id IS 'Slack member ID (e.g. U0123ABCDEF) resolved from Slack email via bot';

-- ============================================
-- Notification Preferences (per user)
-- ============================================

CREATE TABLE IF NOT EXISTS public.notification_preferences (
  user_id UUID PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,

  -- Slack
  slack_enabled          BOOLEAN NOT NULL DEFAULT false,
  slack_email            TEXT,
  slack_channel_post_enabled BOOLEAN NOT NULL DEFAULT true,
  slack_dm_enabled       BOOLEAN NOT NULL DEFAULT false,
  slack_reminder_enabled BOOLEAN NOT NULL DEFAULT false,
  slack_reminder_time    TEXT DEFAULT '09:00',   -- HH:MM in user's local timezone

  -- Email (coming soon)
  email_enabled BOOLEAN NOT NULL DEFAULT false,

  -- WhatsApp (coming soon)
  whatsapp_enabled BOOLEAN NOT NULL DEFAULT false,

  -- Push (iOS / Android via Firebase)
  push_enabled           BOOLEAN NOT NULL DEFAULT false,
  push_on_entry_enabled  BOOLEAN NOT NULL DEFAULT true,
  push_reminder_enabled  BOOLEAN NOT NULL DEFAULT false,
  push_reminder_time     TEXT DEFAULT '09:00',   -- HH:MM in user's local timezone

  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.notification_preferences IS 'Per-user notification channel preferences';
COMMENT ON COLUMN public.notification_preferences.slack_reminder_time IS 'HH:MM format in user profile timezone';
COMMENT ON COLUMN public.notification_preferences.push_reminder_time IS 'HH:MM format in user profile timezone';

-- ============================================
-- Device Tokens (for push notifications)
-- ============================================

CREATE TABLE IF NOT EXISTS public.device_tokens (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  token      TEXT NOT NULL UNIQUE,
  platform   TEXT NOT NULL CHECK (platform IN ('ios', 'android')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.device_tokens IS 'FCM/APNs device tokens for push notifications';

CREATE INDEX IF NOT EXISTS idx_device_tokens_user ON public.device_tokens(user_id);

-- ============================================
-- ROW LEVEL SECURITY — notification_preferences
-- ============================================

ALTER TABLE public.notification_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own notification preferences"
  ON public.notification_preferences FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own notification preferences"
  ON public.notification_preferences FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own notification preferences"
  ON public.notification_preferences FOR UPDATE
  USING (auth.uid() = user_id);

-- ============================================
-- ROW LEVEL SECURITY — device_tokens
-- ============================================

ALTER TABLE public.device_tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own device tokens"
  ON public.device_tokens FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own device tokens"
  ON public.device_tokens FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own device tokens"
  ON public.device_tokens FOR DELETE
  USING (auth.uid() = user_id);
