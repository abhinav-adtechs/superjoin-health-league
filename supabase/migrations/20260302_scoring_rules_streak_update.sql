-- Update scoring_rules streak section to reflect the new three-type streak system.
--
-- Old system: one "streak" type (consecutive logging days, 7d=25, 14d=50, 21d=75, 30d=150).
-- New system:
--   logging_streak  — just showing up and logging (small habit bonuses)
--   weekly_perf     — hitting weekly profile goals this week (single per-week award)
--   goal_crush      — consecutive days hitting personal daily goals (larger bonuses)

-- Remove old streak rows
delete from scoring_rules where category = 'streak';

-- Logging streak milestones (just showing up)
insert into scoring_rules (category, category_max, sort_order, action_label, field_name, condition_desc, points, is_bonus, age_adjusted, age_note) values
('logging_streak', null, 10, '7-day logging streak',                   'daily_entries', 'consecutive log days = 7',    10,  false, false, null),
('logging_streak', null, 20, '14-day logging streak',                  'daily_entries', 'consecutive log days = 14',   20,  false, false, null),
('logging_streak', null, 30, '30-day logging streak',                  'daily_entries', 'consecutive log days = 30',   40,  false, false, null),
('logging_streak', null, 40, '60-day logging streak',                  'daily_entries', 'consecutive log days = 60',   75,  false, false, null),
('logging_streak', null, 50, '90-day logging streak',                  'daily_entries', 'consecutive log days = 90',   100, false, false, null),
('logging_streak', null, 60, 'Every 30 days beyond 90 (repeating)',    'daily_entries', 'consecutive log days mod 30 = 0 (after 90)', 50, false, false, null);

-- Weekly performance bonus (hit profile weekly goals)
insert into scoring_rules (category, category_max, sort_order, action_label, field_name, condition_desc, points, is_bonus, age_adjusted, age_note) values
('weekly_perf', null, 10, 'Hit some weekly goals (partial)',           'profiles', 'some of: goal_workout_days_week, goal_workout_mins_week, goal_home_cooked_per_week met', 20, false, false, null),
('weekly_perf', null, 20, 'Hit all weekly goals (full)',               'profiles', 'all set weekly goals met',  50,  false, false, null);

-- Goal crush streak milestones (consecutive days hitting personal daily goals)
insert into scoring_rules (category, category_max, sort_order, action_label, field_name, condition_desc, points, is_bonus, age_adjusted, age_note) values
('goal_crush', null, 10, '3-day goal crush streak',                    'is_goal_crush_day', 'consecutive goal crush days = 3',    15,  false, false, null),
('goal_crush', null, 20, '7-day goal crush streak',                    'is_goal_crush_day', 'consecutive goal crush days = 7',    50,  false, false, null),
('goal_crush', null, 30, '14-day goal crush streak',                   'is_goal_crush_day', 'consecutive goal crush days = 14',   100, false, false, null),
('goal_crush', null, 40, '30-day goal crush streak',                   'is_goal_crush_day', 'consecutive goal crush days = 30',   200, false, false, null),
('goal_crush', null, 50, 'Every 30 days beyond 30 (repeating)',        'is_goal_crush_day', 'consecutive goal crush days mod 30 = 0 (after 30)', 200, false, false, null);
