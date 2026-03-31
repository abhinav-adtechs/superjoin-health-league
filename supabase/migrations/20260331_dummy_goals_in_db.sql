-- Demo / dev: fill NULL goal columns with deterministic per-user dummy values (hashtext on id).
-- Safe with COALESCE — does not overwrite existing non-null goals.
-- Remove or adjust when you replace with real data.

UPDATE public.profiles p
SET
  food_tracking_mode = COALESCE(
    p.food_tracking_mode::text,
    (ARRAY['protein_only', 'calories_only', 'both'])[1 + abs(hashtext(p.id::text || 'fm')) % 3]
  ),
  goal_workout_mins_week = COALESCE(
    p.goal_workout_mins_week,
    120 + abs(hashtext(p.id::text || 'wm')) % 140
  ),
  goal_workout_days_week = COALESCE(
    p.goal_workout_days_week,
    3 + abs(hashtext(p.id::text || 'dw')) % 4
  ),
  goal_sleep_hours = COALESCE(
    p.goal_sleep_hours,
    ROUND((6.5::numeric + (abs(hashtext(p.id::text || 'sh')) % 24) / 10.0), 1)
  ),
  goal_water_liters = COALESCE(
    p.goal_water_liters,
    ROUND((2.2::numeric + (abs(hashtext(p.id::text || 'wl')) % 14) / 10.0), 1)
  ),
  goal_steps_day = COALESCE(
    p.goal_steps_day,
    5000 + (abs(hashtext(p.id::text || 'st')) % 13) * 500
  ),
  goal_workout_type = COALESCE(
    p.goal_workout_type,
    (ARRAY['strength', 'running', 'walking', 'martial_arts', 'cardio_mix'])[1 + abs(hashtext(p.id::text || 'wt')) % 5]
  ),
  goal_protein_g_day = COALESCE(
    p.goal_protein_g_day,
    LEAST(
      260,
      GREATEST(
        80,
        (ROUND(COALESCE(p.current_weight, p.starting_weight, 70) * 1.6)::integer
         + (abs(hashtext(p.id::text || 'pr')) % 25)
         - 12)
      )
    )
  ),
  goal_calories_day = COALESCE(
    p.goal_calories_day,
    LEAST(
      4500,
      GREATEST(
        1200,
        (ROUND(COALESCE(p.current_weight, p.starting_weight, 70) * 31)::integer
         + (abs(hashtext(p.id::text || 'cal')) % 360)
         - 180)
      )
    )
  ),
  updated_at = now();

-- Align protein/calorie columns with food_tracking_mode
UPDATE public.profiles
SET
  goal_protein_g_day = CASE
    WHEN food_tracking_mode::text = 'calories_only' THEN NULL
    ELSE goal_protein_g_day
  END,
  goal_calories_day = CASE
    WHEN food_tracking_mode::text = 'protein_only' THEN NULL
    ELSE goal_calories_day
  END,
  updated_at = now();
