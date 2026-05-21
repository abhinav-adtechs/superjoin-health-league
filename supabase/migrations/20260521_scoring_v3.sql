-- Scoring v3: effort-rewarding recalibration (documentation table sync).
-- Canonical logic lives in lib/points.ts; API uses hardcoded FALLBACK_RULES.

DELETE FROM scoring_rules;

INSERT INTO scoring_rules (category, category_max, sort_order, action_label, field_name, condition_desc, points, is_bonus, age_adjusted, age_note) VALUES
('workout', 25, 10, 'Log any workout', 'workout_done', 'workout_done = true', 5, false, false, null),
('workout', 25, 20, 'Workout 15+ minutes', 'workout_duration', 'workout_duration >= 15 min', 11, false, true, 'Over 35: threshold is 13 min (85%)'),
('workout', 25, 30, 'Workout 30+ minutes', 'workout_duration', 'workout_duration >= 30 min', 15, false, true, 'Over 35: threshold is 26 min (85%)'),
('workout', 25, 40, 'Workout 45+ minutes', 'workout_duration', 'workout_duration >= 45 min', 20, false, true, 'Over 35: threshold is 38 min (85%)'),
('workout', 25, 50, 'Workout 60+ minutes', 'workout_duration', 'workout_duration >= 60 min', 25, false, true, 'Over 35: threshold is 51 min (85%)'),

('movement', 20, 10, 'Log any cardio session', 'cardio_done', 'cardio_done = true', 4, false, false, null),
('movement', 20, 20, 'Cardio 15+ minutes', 'cardio_duration', 'cardio_duration >= 15 min', 8, false, true, 'Over 35: 13 min threshold'),
('movement', 20, 30, 'Cardio 30+ minutes', 'cardio_duration', 'cardio_duration >= 30 min', 12, false, true, 'Over 35: 26 min threshold'),
('movement', 20, 40, 'Cardio 45+ minutes', 'cardio_duration', 'cardio_duration >= 45 min', 16, false, true, 'Over 35: 38 min threshold'),
('movement', 20, 50, 'Cardio 60+ minutes', 'cardio_duration', 'cardio_duration >= 60 min', 20, false, true, 'Over 35: 51 min threshold'),
('movement', 20, 60, '100% of step goal', 'steps', 'steps >= goal_steps_day OR >= 10,000', 20, false, true, 'Over 35: 8,500 step fallback'),
('movement', 20, 70, '75% of step goal', 'steps', 'steps >= 75% of goal', 15, false, true, null),
('movement', 20, 80, '50% of step goal', 'steps', 'steps >= 50% of goal', 10, false, true, null),
('movement', 20, 90, '25% of step goal', 'steps', 'steps >= 25% of goal', 5, false, true, null),

('sleep', 15, 10, 'Optimal sleep (8–9 hours)', 'sleep_hours', 'sleep_hours >= 8 AND < 9', 15, false, false, null),
('sleep', 15, 15, 'Good sleep (7–8 hours)', 'sleep_hours', 'sleep_hours >= 7 AND < 8', 12, false, false, null),
('sleep', 15, 20, 'Fair sleep (6–7 hours)', 'sleep_hours', 'sleep_hours >= 6 AND < 7', 7, false, false, null),
('sleep', 15, 25, 'Short sleep (5–6 hours)', 'sleep_hours', 'sleep_hours >= 5 AND < 6', 3, false, false, null),
('sleep', 15, 30, 'Extended sleep (9+ hours)', 'sleep_hours', 'sleep_hours >= 9', 13, false, false, null),

('nutrition', 30, 10, 'Drink 3+ litres of water', 'water_liters', 'water_liters >= 3', 15, false, false, 'Max 15 water-only; 10 in both mode'),
('nutrition', 30, 15, 'Protein goal hit (100%)', 'protein_qty', 'protein_qty >= goal', 15, false, false, null),
('nutrition', 30, 20, 'Calories on target (±2%)', 'calories_kcal', 'Within ±2% per fitness goal', 15, false, false, null),

('logging_streak', null, 10, '7-day logging streak', 'daily_entries', 'consecutive_days = 7', 10, false, false, null),
('logging_streak', null, 20, '14-day logging streak', 'daily_entries', 'consecutive_days = 14', 20, false, false, null),
('logging_streak', null, 30, '30-day logging streak', 'daily_entries', 'consecutive_days = 30', 40, false, false, null),
('logging_streak', null, 40, '60-day logging streak', 'daily_entries', 'consecutive_days = 60', 75, false, false, null),
('logging_streak', null, 50, '90-day logging streak', 'daily_entries', 'consecutive_days = 90', 100, false, false, null),

('weekly_perf', null, 10, 'Hit some weekly goals (partial)', 'profiles', 'partial weekly goals', 20, false, false, null),
('weekly_perf', null, 20, 'Hit all weekly goals (full)', 'profiles', 'all weekly goals', 50, false, false, null),

('goal_crush', null, 10, '3-day goal crush streak', 'is_goal_crush_day', 'consecutive_days = 3', 15, false, false, null),
('goal_crush', null, 20, '7-day goal crush streak', 'is_goal_crush_day', 'consecutive_days = 7', 50, false, false, null),
('goal_crush', null, 30, '14-day goal crush streak', 'is_goal_crush_day', 'consecutive_days = 14', 100, false, false, null),
('goal_crush', null, 40, '30-day goal crush streak', 'is_goal_crush_day', 'consecutive_days = 30', 150, false, false, null);
