-- Hot-path indexes for the most-used app surfaces:
-- dashboard summary, leaderboard, log history, profile stats, and integrations.

CREATE INDEX IF NOT EXISTS idx_daily_entries_date_user
  ON public.daily_entries(date, user_id);

CREATE INDEX IF NOT EXISTS idx_daily_entries_user_date_desc
  ON public.daily_entries(user_id, date DESC);

CREATE INDEX IF NOT EXISTS idx_weekly_weigh_ins_user_week_start_desc
  ON public.weekly_weigh_ins(user_id, week_start DESC);

CREATE INDEX IF NOT EXISTS idx_connected_accounts_user_platform
  ON public.connected_accounts(user_id, platform);

CREATE INDEX IF NOT EXISTS idx_profiles_active_display_name
  ON public.profiles(display_name)
  WHERE is_active = true;
