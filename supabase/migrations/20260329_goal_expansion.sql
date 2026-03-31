-- ============================================================
-- Goal Expansion Migration
-- 2026-03-29
-- Adds: goal columns, food_tracking_mode, scored_with_goal,
--       calories_kcal, goal_changed_at
-- Purges: home_cooked_meals, junk_food historical data
-- Seeds:  varied dummy goals per user based on fitness_goal
-- Updates: scoring_rules table
-- ============================================================

-- ─── 1. New profile columns ───────────────────────────────────────────────────

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS goal_protein_g_day  INTEGER,
  ADD COLUMN IF NOT EXISTS goal_calories_day   INTEGER,
  ADD COLUMN IF NOT EXISTS goal_workout_type   TEXT,
  ADD COLUMN IF NOT EXISTS food_tracking_mode  TEXT DEFAULT 'protein_only',
  ADD COLUMN IF NOT EXISTS goal_changed_at     TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS goal_sleep_hours    NUMERIC(3,1);

-- ─── 2. New daily_entries columns ────────────────────────────────────────────

ALTER TABLE daily_entries
  ADD COLUMN IF NOT EXISTS calories_kcal    INTEGER,
  ADD COLUMN IF NOT EXISTS scored_with_goal TEXT;

-- ─── 3. Purge removed tracking fields ────────────────────────────────────────

UPDATE daily_entries SET home_cooked_meals = NULL, junk_food = NULL;

-- ─── 4. Back-fill scored_with_goal for existing entries ──────────────────────

UPDATE daily_entries de
SET scored_with_goal = p.fitness_goal::TEXT
FROM profiles p
WHERE de.user_id = p.id
  AND de.scored_with_goal IS NULL;

-- ─── 5. Add gain_weight to fitness_goal_enum ─────────────────────────────────
-- Supabase/Postgres: add enum value if it doesn't exist

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum
    WHERE enumlabel = 'gain_weight'
      AND enumtypid = 'fitness_goal_enum'::regtype
  ) THEN
    ALTER TYPE fitness_goal_enum ADD VALUE 'gain_weight';
  END IF;
END $$;

-- ─── 6. Seed varied dummy goals based on fitness_goal + body weight ──────────

UPDATE profiles SET
  fitness_goal        = COALESCE(fitness_goal, 'stay_active'),
  goal_sleep_hours    = CASE
    WHEN COALESCE(fitness_goal::TEXT, 'stay_active') IN ('gain_muscle','gain_weight','lose_weight') THEN 8
    ELSE 7 END,
  goal_water_liters   = CASE
    WHEN COALESCE(fitness_goal::TEXT, 'stay_active') = 'gain_weight'                              THEN 3.5
    WHEN COALESCE(fitness_goal::TEXT, 'stay_active') IN ('lose_weight','gain_muscle')              THEN 3.0
    ELSE 2.5 END,
  goal_workout_mins_week = CASE
    WHEN COALESCE(fitness_goal::TEXT, 'stay_active') = 'lose_weight'   THEN 200
    WHEN COALESCE(fitness_goal::TEXT, 'stay_active') = 'gain_muscle'   THEN 240
    WHEN COALESCE(fitness_goal::TEXT, 'stay_active') = 'gain_weight'   THEN 180
    WHEN COALESCE(fitness_goal::TEXT, 'stay_active') = 'stay_active'   THEN 150
    ELSE 120 END,
  goal_workout_days_week = CASE
    WHEN COALESCE(fitness_goal::TEXT, 'stay_active') = 'lose_weight'   THEN 5
    WHEN COALESCE(fitness_goal::TEXT, 'stay_active') = 'gain_muscle'   THEN 4
    WHEN COALESCE(fitness_goal::TEXT, 'stay_active') = 'gain_weight'   THEN 3
    WHEN COALESCE(fitness_goal::TEXT, 'stay_active') = 'stay_active'   THEN 4
    ELSE 3 END,
  goal_workout_type   = CASE
    WHEN COALESCE(fitness_goal::TEXT, 'stay_active') IN ('gain_muscle','gain_weight') THEN 'strength'
    ELSE 'cardio_mix' END,
  goal_protein_g_day  = CASE
    WHEN COALESCE(fitness_goal::TEXT, 'stay_active') = 'gain_muscle'
      THEN ROUND(COALESCE(current_weight, starting_weight, 70) * 2.0)::INTEGER
    WHEN COALESCE(fitness_goal::TEXT, 'stay_active') IN ('gain_weight','lose_weight')
      THEN ROUND(COALESCE(current_weight, starting_weight, 70) * 1.8)::INTEGER
    WHEN COALESCE(fitness_goal::TEXT, 'stay_active') = 'stay_active'
      THEN ROUND(COALESCE(current_weight, starting_weight, 70) * 1.4)::INTEGER
    ELSE ROUND(COALESCE(current_weight, starting_weight, 70) * 1.2)::INTEGER END,
  food_tracking_mode  = CASE
    WHEN COALESCE(fitness_goal::TEXT, 'stay_active') = 'gain_weight' THEN 'both'
    ELSE 'protein_only' END
WHERE (goal_sleep_hours IS NULL OR goal_sleep_hours_min IS NULL)
  AND goal_water_liters IS NULL
  AND goal_workout_mins_week IS NULL;

-- ─── 7. Update scoring_rules table ───────────────────────────────────────────

-- Remove obsolete rows (only if scoring_rules table exists)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'scoring_rules') THEN
    -- Remove removed fields
    DELETE FROM scoring_rules WHERE category = 'nutrition'
      AND (action_label ILIKE '%home-cooked%'
        OR action_label ILIKE '%junk%'
        OR action_label ILIKE '%alcohol%');
    DELETE FROM scoring_rules WHERE category = 'sleep'
      AND action_label ILIKE '%quality%';
    -- Remove old steps category (now part of movement)
    DELETE FROM scoring_rules WHERE category = 'steps';
    -- Remove old cardio category (now part of movement)
    DELETE FROM scoring_rules WHERE category = 'cardio';

    -- Update nutrition category_max from 33 to 26
    UPDATE scoring_rules SET category_max = 26 WHERE category = 'nutrition';
    -- Update sleep category_max from 15 to 10
    UPDATE scoring_rules SET category_max = 10 WHERE category = 'sleep';

    -- Insert new Movement category
    INSERT INTO scoring_rules
      (category, action_label, condition_desc, points, is_bonus, category_max, sort_order, field_name, age_adjusted, age_note)
    VALUES
      ('movement', 'Complete any cardio session',  'cardio_done = true',                               10, false, 25, 10, 'cardio_done',     false, null),
      ('movement', 'Cardio for 30+ minutes',        'cardio_duration >= 30 min',                         5, true,  25, 20, 'cardio_duration',  true,  'Over 35: threshold is 25.5 min (85%)'),
      ('movement', '10,000+ steps',                 'steps >= 10,000 (stacks with cardio, cap 25)',     10, true,  25, 30, 'steps',            true,  'Over 35: threshold is 8,500 steps (85%)'),
      ('movement', '7,500+ steps',                  'steps >= 7,500',                                    7, true,  25, 40, 'steps',            true,  'Over 35: threshold is 6,375 steps (85%)'),
      ('movement', '5,000+ steps',                  'steps >= 5,000',                                    5, true,  25, 50, 'steps',            true,  'Over 35: threshold is 4,250 steps (85%)')
    ON CONFLICT DO NOTHING;

    -- Insert new nutrition rows for goal-aware protein and calorie scoring
    INSERT INTO scoring_rules
      (category, action_label, condition_desc, points, is_bonus, category_max, sort_order, field_name, age_adjusted, age_note)
    VALUES
      ('nutrition', 'Protein goal hit',     'protein_qty >= goal_protein_g_day (goal must be set)',   8, false, 26, 30, 'protein_qty',   false, null),
      ('nutrition', 'Protein goal partial', 'protein_qty > 0 but below target',                       4, false, 26, 31, 'protein_qty',   false, null),
      ('nutrition', 'Calorie goal aligned', 'calories within goal direction per fitness goal',         8, false, 26, 32, 'calories_kcal', false, null),
      ('nutrition', 'Calorie goal partial', 'Partially aligned (within 10-15% margin)',                4, false, 26, 33, 'calories_kcal', false, null)
    ON CONFLICT DO NOTHING;

    -- Update weekly_perf description to remove home-cooked reference
    UPDATE scoring_rules
    SET condition_desc = 'some of: goal_workout_days_week, goal_workout_mins_week met'
    WHERE category = 'weekly_perf' AND action_label ILIKE '%partial%';

    UPDATE scoring_rules
    SET condition_desc = 'all set weekly goals met (workout days + workout minutes)'
    WHERE category = 'weekly_perf' AND action_label ILIKE '%full%';
  END IF;
END $$;
