-- Store workout focus as a JSONB array (multi-select). Migrates legacy TEXT goal_workout_type.

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

-- PostgREST picks up new columns without a project restart (avoids stale schema cache / PGRST204)
NOTIFY pgrst, 'reload schema';
