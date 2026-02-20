-- ============================================
-- Migration: workout multi-select + cardio expansion
-- Run this ONLY if you already ran the original schema and have existing data.
-- New installs: use schema.sql only (it already includes these changes).
-- ============================================

-- 1. Create workout_option_enum (skip if you already have it from fresh schema.sql)
DO $$
BEGIN
  CREATE TYPE workout_option_enum AS ENUM (
    'bicep', 'tricep', 'shoulder', 'chest', 'back', 'core', 'quad', 'hamstring', 'glute', 'calf', 'forearm',
    'push', 'pull', 'legs', 'full_body', 'bodyweight', 'other'
  );
EXCEPTION WHEN duplicate_object THEN
  NULL;
END $$;

ALTER TABLE public.daily_entries ADD COLUMN IF NOT EXISTS workout_types workout_option_enum[] DEFAULT '{}';

-- Migrate old workout_type (single) to workout_types (array), then drop old column
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'daily_entries' AND column_name = 'workout_type'
  ) THEN
    UPDATE public.daily_entries
    SET workout_types = ARRAY[(workout_type::text)::workout_option_enum]
    WHERE workout_type IS NOT NULL
      AND workout_type::text IN ('push','pull','legs','full_body','bodyweight','other');
    ALTER TABLE public.daily_entries DROP COLUMN workout_type;
  END IF;
END $$;

-- 2. Add new cardio_type_enum values (run these one at a time in SQL Editor if you get "cannot add enum value inside transaction")
-- ALTER TYPE cardio_type_enum ADD VALUE 'football';
-- ALTER TYPE cardio_type_enum ADD VALUE 'cricket';
-- ALTER TYPE cardio_type_enum ADD VALUE 'basketball';
-- ALTER TYPE cardio_type_enum ADD VALUE 'badminton';
-- ALTER TYPE cardio_type_enum ADD VALUE 'tennis';
-- ALTER TYPE cardio_type_enum ADD VALUE 'squash';
-- ALTER TYPE cardio_type_enum ADD VALUE 'volleyball';
-- ALTER TYPE cardio_type_enum ADD VALUE 'hockey';
-- ALTER TYPE cardio_type_enum ADD VALUE 'martial_arts';
-- ALTER TYPE cardio_type_enum ADD VALUE 'hiking';
-- ALTER TYPE cardio_type_enum ADD VALUE 'rowing';
