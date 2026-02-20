-- Single sleep goal (replaces min/max range)
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS goal_sleep_hours NUMERIC(3,1) CHECK (goal_sleep_hours IS NULL OR (goal_sleep_hours >= 0 AND goal_sleep_hours <= 24));

-- Migrate existing: use min as single value if both set
UPDATE public.profiles
SET goal_sleep_hours = goal_sleep_hours_min
WHERE goal_sleep_hours IS NULL AND goal_sleep_hours_min IS NOT NULL;

COMMENT ON COLUMN public.profiles.goal_sleep_hours IS 'Target sleep hours per night (single value)';
