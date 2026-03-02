-- Scoring rules table — single source of truth for points display and documentation.
-- Values mirror the logic in lib/points.ts exactly.

create table if not exists scoring_rules (
  id             serial primary key,
  category       text    not null, -- workout | cardio | sleep | nutrition | steps | streak
  category_max   integer,          -- max pts possible in this category (null for streak)
  sort_order     integer not null default 0,
  action_label   text    not null, -- human-readable action
  field_name     text,             -- database column(s) that drives this rule
  condition_desc text    not null, -- readable condition
  points         integer not null,
  is_bonus       boolean not null default false, -- true = stacks on top (not base)
  age_adjusted   boolean not null default false, -- true = threshold changes for over_35
  age_note       text,             -- explanation of the age adjustment
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

comment on table scoring_rules is
  'Point rules that match the calculateDailyPoints() engine in lib/points.ts. '
  'Update both here AND in lib/points.ts when changing scoring.';

-- ── Workout (max 20 pts) ────────────────────────────────────────────────────

insert into scoring_rules (category, category_max, sort_order, action_label, field_name, condition_desc, points, is_bonus, age_adjusted, age_note) values
('workout', 20, 10, 'Complete any workout',        'workout_done',     'workout_done = true',           10, false, false, null),
('workout', 20, 20, 'Workout for 45+ minutes',     'workout_duration', 'workout_duration >= 45',        5,  true,  false, null),
('workout', 20, 30, 'Workout for 60+ minutes',     'workout_duration', 'workout_duration >= 60',        5,  true,  false, null);

-- ── Cardio (max 15 pts) ─────────────────────────────────────────────────────

insert into scoring_rules (category, category_max, sort_order, action_label, field_name, condition_desc, points, is_bonus, age_adjusted, age_note) values
('cardio',  15, 10, 'Complete any cardio session',  'cardio_done',     'cardio_done = true',            10, false, false, null),
('cardio',  15, 20, 'Cardio for 30+ minutes',       'cardio_duration', 'cardio_duration >= 30 min',      5, true,  true,  'Over 35: threshold is 25.5 min (85%)');

-- ── Sleep (max 15 pts) ──────────────────────────────────────────────────────

insert into scoring_rules (category, category_max, sort_order, action_label, field_name, condition_desc, points, is_bonus, age_adjusted, age_note) values
('sleep',   15, 10, 'Optimal sleep (7–9 hours)',    'sleep_hours',    'sleep_hours >= 7 AND <= 9',      10, false, false, null),
('sleep',   15, 15, 'Good sleep (6–7 hours)',        'sleep_hours',    'sleep_hours >= 6 AND < 7',        5, false, false, null),
('sleep',   15, 20, 'High sleep quality (4+ / 5)',   'sleep_quality',  'sleep_quality >= 4',              5, true,  false, null);

-- ── Nutrition (max 33 pts) ──────────────────────────────────────────────────

insert into scoring_rules (category, category_max, sort_order, action_label, field_name, condition_desc, points, is_bonus, age_adjusted, age_note) values
('nutrition', 33, 10, 'Drink 3+ litres of water',         'water_liters',       'water_liters >= 3',              10, false, false, null),
('nutrition', 33, 15, 'Drink 2–3 litres of water',        'water_liters',       'water_liters >= 2 AND < 3',       5, false, false, null),
('nutrition', 33, 20, 'Eat 2+ home-cooked meals',         'home_cooked_meals',  'home_cooked_meals >= 2',          5, false, false, null),
('nutrition', 33, 30, 'Include a protein meal',           'protein_meal',       'protein_meal = true',             5, false, false, null),
('nutrition', 33, 35, 'Protein meal with 100g+ protein',  'protein_qty',        'protein_meal = true AND protein_qty >= 100', 3, true, false, null),
('nutrition', 33, 40, 'Avoid junk food',                  'junk_food',          'junk_food = false',               5, false, false, null),
('nutrition', 33, 50, 'No alcohol',                       'alcohol',            'alcohol = ''zero''',              5, false, false, null);

-- ── Steps (max 15 pts) ──────────────────────────────────────────────────────

insert into scoring_rules (category, category_max, sort_order, action_label, field_name, condition_desc, points, is_bonus, age_adjusted, age_note) values
('steps', 15, 10, '10,000+ steps',  'steps', 'steps >= 10,000', 15, false, true, 'Over 35: threshold is 8,500 steps (85%)'),
('steps', 15, 20, '7,500+ steps',   'steps', 'steps >= 7,500',  10, false, true, 'Over 35: threshold is 6,375 steps (85%)'),
('steps', 15, 30, '5,000+ steps',   'steps', 'steps >= 5,000',   5, false, true, 'Over 35: threshold is 4,250 steps (85%)');

-- ── Streak bonuses (not capped per day) ─────────────────────────────────────

insert into scoring_rules (category, category_max, sort_order, action_label, field_name, condition_desc, points, is_bonus, age_adjusted, age_note) values
('streak', null, 10, '7-day streak milestone',                'streaks', 'consecutive_days = 7',    25,  false, false, null),
('streak', null, 20, '14-day streak milestone',               'streaks', 'consecutive_days = 14',   50,  false, false, null),
('streak', null, 30, '21-day streak milestone',               'streaks', 'consecutive_days = 21',   75,  false, false, null),
('streak', null, 40, '30-day streak milestone',               'streaks', 'consecutive_days = 30',   150, false, false, null),
('streak', null, 50, 'Every 30 days beyond 30 (repeating)',   'streaks', 'consecutive_days mod 30 = 0 (after 30)', 150, false, false, null);

-- Auto-update updated_at
create or replace function scoring_rules_set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger scoring_rules_updated_at
  before update on scoring_rules
  for each row execute procedure scoring_rules_set_updated_at();

-- RLS: anyone authenticated can read; only service role can write
alter table scoring_rules enable row level security;

create policy "scoring_rules_select" on scoring_rules
  for select using (true);
