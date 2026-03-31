-- ============================================
-- Office Health Tracker — Supabase Schema (FINAL)
-- ============================================
-- Run this ENTIRE file ONCE in your Supabase project:
--   Dashboard → SQL Editor → New query → Paste → Run
--
-- Requires: Supabase Auth enabled (Email or other providers).
-- Creates: enums, profiles, daily_entries, weekly_weigh_ins, streaks, RLS, indexes, triggers.
-- ============================================

-- Extensions
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ============================================
-- ENUMS
-- ============================================

CREATE TYPE gender_enum AS ENUM ('male', 'female', 'other');
CREATE TYPE fitness_goal_enum AS ENUM ('lose_weight', 'gain_muscle', 'stay_active', 'general_wellness');
CREATE TYPE age_bracket_enum AS ENUM ('under_25', '25_to_35', 'over_35');
-- Workout: multi-select — body parts + clusters (user can pick any combination)
CREATE TYPE workout_option_enum AS ENUM (
  'bicep', 'tricep', 'shoulder', 'chest', 'back', 'core', 'quad', 'hamstring', 'glute', 'calf', 'forearm',
  'push', 'pull', 'legs', 'full_body', 'bodyweight', 'other'
);
-- Cardio / sports: 15+ options (use search in UI for long list)
CREATE TYPE cardio_type_enum AS ENUM (
  'running', 'cycling', 'swimming', 'walking', 'hiking', 'rowing', 'dance',
  'football', 'cricket', 'basketball', 'badminton', 'tennis', 'squash', 'volleyball', 'hockey',
  'martial_arts', 'sports', 'other'
);
CREATE TYPE alcohol_enum AS ENUM ('zero', 'one_to_two', 'three_plus');

-- ============================================
-- USER PROFILES (extends Supabase auth.users if using Auth)
-- ============================================

CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  slack_user_id TEXT UNIQUE,
  display_name TEXT NOT NULL,
  age INTEGER NOT NULL CHECK (age >= 10 AND age <= 120),
  gender gender_enum NOT NULL,
  height_cm NUMERIC(5,2) NOT NULL CHECK (height_cm > 0 AND height_cm <= 300),
  starting_weight NUMERIC(5,2) NOT NULL CHECK (starting_weight > 0 AND starting_weight <= 500),
  current_weight NUMERIC(5,2) CHECK (current_weight IS NULL OR (current_weight > 0 AND current_weight <= 500)),
  fitness_goal fitness_goal_enum NOT NULL,
  age_bracket age_bracket_enum NOT NULL DEFAULT '25_to_35',
  timezone TEXT NOT NULL DEFAULT 'Asia/Kolkata',
  reminder_time TEXT NOT NULL DEFAULT '20:00' CHECK (reminder_time ~ '^\d{1,2}:\d{2}$'),
  joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Personal goals (optional)
  goal_workout_mins_week INTEGER CHECK (goal_workout_mins_week IS NULL OR (goal_workout_mins_week >= 0 AND goal_workout_mins_week <= 600)),
  goal_workout_days_week INTEGER CHECK (goal_workout_days_week IS NULL OR (goal_workout_days_week >= 0 AND goal_workout_days_week <= 7)),
  goal_workout_types JSONB NOT NULL DEFAULT '[]'::jsonb,
  goal_steps_day INTEGER CHECK (goal_steps_day IS NULL OR (goal_steps_day >= 0 AND goal_steps_day <= 100000)),
  goal_sleep_hours_min NUMERIC(3,1) CHECK (goal_sleep_hours_min IS NULL OR (goal_sleep_hours_min >= 0 AND goal_sleep_hours_min <= 24)),
  goal_sleep_hours_max NUMERIC(3,1) CHECK (goal_sleep_hours_max IS NULL OR (goal_sleep_hours_max >= 0 AND goal_sleep_hours_max <= 24)),
  goal_water_liters NUMERIC(3,1) CHECK (goal_water_liters IS NULL OR (goal_water_liters >= 0 AND goal_water_liters <= 10)),
  goal_home_cooked_per_week INTEGER CHECK (goal_home_cooked_per_week IS NULL OR (goal_home_cooked_per_week >= 0 AND goal_home_cooked_per_week <= 21))
);

-- For non-Slack / email auth: slack_user_id can be null; id comes from auth.users

-- ============================================
-- DAILY ENTRIES
-- ============================================

CREATE TABLE IF NOT EXISTS public.daily_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Exercise
  workout_done BOOLEAN,
  workout_duration INTEGER CHECK (workout_duration IS NULL OR workout_duration > 0),
  workout_types workout_option_enum[] DEFAULT '{}',
  cardio_done BOOLEAN,
  cardio_duration INTEGER CHECK (cardio_duration IS NULL OR cardio_duration > 0),
  cardio_type cardio_type_enum,
  steps INTEGER CHECK (steps IS NULL OR steps >= 0),

  -- Nutrition
  water_liters NUMERIC(4,2) CHECK (water_liters IS NULL OR (water_liters >= 0 AND water_liters <= 10)),
  home_cooked_meals INTEGER CHECK (home_cooked_meals IS NULL OR (home_cooked_meals >= 0 AND home_cooked_meals <= 5)),
  protein_meal BOOLEAN,
  protein_qty INTEGER CHECK (protein_qty IS NULL OR (protein_qty >= 0 AND protein_qty <= 500)),
  junk_food BOOLEAN,
  meals_log JSONB,
  alcohol alcohol_enum,

  -- Sleep
  sleep_hours NUMERIC(3,1) CHECK (sleep_hours IS NULL OR (sleep_hours >= 0 AND sleep_hours <= 24)),
  sleep_quality INTEGER CHECK (sleep_quality IS NULL OR (sleep_quality >= 1 AND sleep_quality <= 5)),

  -- Computed (set by app or trigger)
  daily_points INTEGER DEFAULT 0,

  UNIQUE (user_id, date)
);

-- If workout_done is false, duration/types should be empty (enforced in app)
-- If cardio_done is false, duration/type should be null (enforced in app)

-- ============================================
-- WEEKLY WEIGH-INS
-- ============================================

CREATE TABLE IF NOT EXISTS public.weekly_weigh_ins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  week_start DATE NOT NULL,
  weight_kg NUMERIC(5,2) NOT NULL CHECK (weight_kg > 0 AND weight_kg <= 500),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, week_start)
);

-- week_start = Monday of that week (ISO week)

-- ============================================
-- STREAKS
-- ============================================

CREATE TABLE IF NOT EXISTS public.streaks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  start_date DATE NOT NULL,
  end_date DATE,
  bonus_awarded INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_streaks_user_active ON public.streaks(user_id, end_date) WHERE end_date IS NULL;
CREATE INDEX IF NOT EXISTS idx_daily_entries_user_date ON public.daily_entries(user_id, date);
CREATE INDEX IF NOT EXISTS idx_weekly_weigh_ins_user ON public.weekly_weigh_ins(user_id, week_start);

-- ============================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.daily_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.weekly_weigh_ins ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.streaks ENABLE ROW LEVEL SECURITY;

-- Profiles: users can read/update own; service role can do all
CREATE POLICY "Users can read own profile"
  ON public.profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile"
  ON public.profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

-- Leaderboard: authenticated users can read all profiles (display names only used in leaderboard)
CREATE POLICY "Authenticated can read all profiles"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (true);

-- Daily entries: own only
CREATE POLICY "Users can read own entries"
  ON public.daily_entries FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own entries"
  ON public.daily_entries FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own entries"
  ON public.daily_entries FOR UPDATE
  USING (auth.uid() = user_id);

-- Weekly weigh-ins: own only
CREATE POLICY "Users can read own weigh ins"
  ON public.weekly_weigh_ins FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own weigh ins"
  ON public.weekly_weigh_ins FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own weigh ins"
  ON public.weekly_weigh_ins FOR UPDATE
  USING (auth.uid() = user_id);

-- Streaks: own only
CREATE POLICY "Users can read own streaks"
  ON public.streaks FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own streaks"
  ON public.streaks FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own streaks"
  ON public.streaks FOR UPDATE
  USING (auth.uid() = user_id);

-- ============================================
-- HELPER: get Monday of week for a date
-- ============================================

CREATE OR REPLACE FUNCTION public.week_start(d DATE)
RETURNS DATE
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT date_trunc('week', d)::date;
$$;

-- ============================================
-- UPDATED_AT TRIGGER
-- ============================================

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS profiles_updated_at ON public.profiles;
CREATE TRIGGER profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS daily_entries_updated_at ON public.daily_entries;
CREATE TRIGGER daily_entries_updated_at
  BEFORE UPDATE ON public.daily_entries
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============================================
-- OPTIONAL: Create profile on signup (Supabase Auth hook)
-- ============================================
-- If you use Supabase Auth, you can create a profile in a trigger or in your app
-- when the user signs up. This example assumes you create profile via API after signup.
-- ============================================

COMMENT ON TABLE public.profiles IS 'Office Health Tracker user profiles';
COMMENT ON COLUMN public.profiles.age IS 'Single integer (e.g. 28). Used for age_bracket only. BMI = weight/height² (age not used in BMI).';
COMMENT ON TABLE public.daily_entries IS 'One row per user per day; all health fields optional';
COMMENT ON COLUMN public.daily_entries.workout_types IS 'Multi-select: body parts (bicep, tricep, …) and/or clusters (push, pull, legs, …)';
COMMENT ON TABLE public.weekly_weigh_ins IS 'One row per user per week for weight';
COMMENT ON TABLE public.streaks IS 'Consecutive days with at least one log; end_date null = active';
