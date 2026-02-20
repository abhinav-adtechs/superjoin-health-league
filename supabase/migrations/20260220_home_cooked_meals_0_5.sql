-- Allow home_cooked_meals 0-5 (was 0-3) for blended meals UI
ALTER TABLE public.daily_entries
  DROP CONSTRAINT IF EXISTS daily_entries_home_cooked_meals_check;

ALTER TABLE public.daily_entries
  ADD CONSTRAINT daily_entries_home_cooked_meals_check
  CHECK (home_cooked_meals IS NULL OR (home_cooked_meals >= 0 AND home_cooked_meals <= 5));
