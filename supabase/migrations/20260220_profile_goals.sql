-- Add personal goal columns to profiles (nullable; optional per user)
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS goal_workout_mins_week INTEGER CHECK (goal_workout_mins_week IS NULL OR (goal_workout_mins_week >= 0 AND goal_workout_mins_week <= 600)),
  ADD COLUMN IF NOT EXISTS goal_workout_days_week INTEGER CHECK (goal_workout_days_week IS NULL OR (goal_workout_days_week >= 0 AND goal_workout_days_week <= 7)),
  ADD COLUMN IF NOT EXISTS goal_steps_day INTEGER CHECK (goal_steps_day IS NULL OR (goal_steps_day >= 0 AND goal_steps_day <= 100000)),
  ADD COLUMN IF NOT EXISTS goal_sleep_hours_min NUMERIC(3,1) CHECK (goal_sleep_hours_min IS NULL OR (goal_sleep_hours_min >= 0 AND goal_sleep_hours_min <= 24)),
  ADD COLUMN IF NOT EXISTS goal_sleep_hours_max NUMERIC(3,1) CHECK (goal_sleep_hours_max IS NULL OR (goal_sleep_hours_max >= 0 AND goal_sleep_hours_max <= 24)),
  ADD COLUMN IF NOT EXISTS goal_water_liters NUMERIC(3,1) CHECK (goal_water_liters IS NULL OR (goal_water_liters >= 0 AND goal_water_liters <= 10)),
  ADD COLUMN IF NOT EXISTS goal_home_cooked_per_week INTEGER CHECK (goal_home_cooked_per_week IS NULL OR (goal_home_cooked_per_week >= 0 AND goal_home_cooked_per_week <= 21));

COMMENT ON COLUMN public.profiles.goal_workout_mins_week IS 'Weekly target: total workout + cardio minutes';
COMMENT ON COLUMN public.profiles.goal_workout_days_week IS 'Weekly target: number of days with workout or cardio';
COMMENT ON COLUMN public.profiles.goal_steps_day IS 'Daily step goal';
COMMENT ON COLUMN public.profiles.goal_sleep_hours_min IS 'Target sleep range minimum (hours)';
COMMENT ON COLUMN public.profiles.goal_sleep_hours_max IS 'Target sleep range maximum (hours)';
COMMENT ON COLUMN public.profiles.goal_water_liters IS 'Daily water goal (liters)';
COMMENT ON COLUMN public.profiles.goal_home_cooked_per_week IS 'Weekly home-cooked meals target';
