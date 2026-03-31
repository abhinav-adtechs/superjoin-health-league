-- Run once in Supabase Dashboard → SQL Editor (fixes: PGRST204 / "goal_workout_types column not in schema cache").
-- Safe to re-run: ADD COLUMN IF NOT EXISTS; legacy goal_workout_type migration is conditional.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS goal_workout_types jsonb NOT NULL DEFAULT '[]'::jsonb;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'profiles'
      AND column_name = 'goal_workout_type'
  ) THEN
    UPDATE public.profiles
    SET goal_workout_types = jsonb_build_array(trim(goal_workout_type::text))
    WHERE goal_workout_type IS NOT NULL
      AND trim(goal_workout_type::text) <> '';

    ALTER TABLE public.profiles DROP COLUMN goal_workout_type;
  END IF;
END $$;

COMMENT ON COLUMN public.profiles.goal_workout_types IS 'Multi-select workout focus tags (e.g. strength, team_sports)';

-- Refresh PostgREST so the API sees the new column immediately
NOTIFY pgrst, 'reload schema';
