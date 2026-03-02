-- Add is_goal_crush_day to daily_entries.
--
-- Stores whether the user hit all their personal daily goals on that entry date.
-- Evaluated at logging time against the profile goals active then, so future goal
-- changes do not retroactively alter past streak counts.
--
-- Daily goals evaluated: goal_steps_day, goal_water_liters, goal_sleep_hours_min/max.
-- If no daily goals are set, falls back to daily_points >= 60.

ALTER TABLE daily_entries
  ADD COLUMN IF NOT EXISTS is_goal_crush_day boolean NOT NULL DEFAULT false;
