-- ============================================
-- Run this in Supabase SQL Editor to verify the schema was applied.
-- You should see: 4 tables, 6 enums, 12+ policies, 2 triggers.
-- ============================================

-- 1. Tables (expect 4 rows)
SELECT 'Tables' AS check_type, relname AS name
FROM pg_class
WHERE relnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
  AND relkind = 'r'
  AND relname IN ('profiles', 'daily_entries', 'weekly_weigh_ins', 'streaks')
ORDER BY relname;

-- 2. Enums (expect 6 rows)
SELECT 'Enums' AS check_type, t.typname AS name
FROM pg_type t
JOIN pg_namespace n ON t.typnamespace = n.oid
WHERE n.nspname = 'public' AND t.typtype = 'e'
  AND t.typname IN ('gender_enum', 'fitness_goal_enum', 'age_bracket_enum', 'workout_option_enum', 'cardio_type_enum', 'alcohol_enum')
ORDER BY t.typname;

-- 3. RLS policies (expect 12+ rows)
SELECT 'RLS Policies' AS check_type, schemaname || '.' || tablename || ' → ' || policyname AS name
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, policyname;

-- 4. Triggers (expect 2: profiles_updated_at, daily_entries_updated_at)
SELECT 'Triggers' AS check_type, tgname AS name
FROM pg_trigger t
JOIN pg_class c ON t.tgrelid = c.oid
JOIN pg_namespace n ON c.relnamespace = n.oid
WHERE n.nspname = 'public' AND NOT t.tgisinternal
  AND c.relname IN ('profiles', 'daily_entries')
ORDER BY c.relname;

-- 5. daily_entries should have workout_types column (array)
SELECT 'Columns (daily_entries.workout_types)' AS check_type,
  CASE WHEN EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'daily_entries' AND column_name = 'workout_types'
  ) THEN 'workout_types column exists' ELSE 'MISSING: workout_types' END AS name;
