-- Add meals_log JSONB column to store named meal data
-- (breakfast/brunch/lunch/snack/dinner each as 'home_cooked'|'junk'|'')
-- home_cooked_meals and junk_food counts are still maintained for scoring

ALTER TABLE public.daily_entries
  ADD COLUMN IF NOT EXISTS meals_log JSONB;
