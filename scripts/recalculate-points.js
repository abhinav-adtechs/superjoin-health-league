#!/usr/bin/env node

/**
 * Recalculate daily_points for all existing daily_entries.
 * This ensures all entries have correct points based on current points logic.
 *
 * Usage:
 *   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... node scripts/recalculate-points.js
 */

const { createClient } = require('@supabase/supabase-js');
const config = require('./config');

const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || config.supabaseUrl;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || config.serviceRoleKey;

if (!supabaseUrl || !serviceRoleKey) {
  console.error('Error: Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// Points calculation (mirrors lib/points.ts — calculateDailyPoints)
function calculateDailyPoints(entry, ageBracket) {
  let points = 0;
  const adj = ageBracket === 'over_35' ? 0.85 : 1.0;

  if (entry.workout_done) {
    points += 10;
    if (entry.workout_duration != null && entry.workout_duration >= 45) points += 5;
    if (entry.workout_duration != null && entry.workout_duration >= 60) points += 5;
  }
  if (entry.cardio_done) {
    points += 10;
    const threshold = 30 * adj;
    if (entry.cardio_duration != null && entry.cardio_duration >= threshold) points += 5;
  }
  if (entry.sleep_hours != null) {
    if (entry.sleep_hours >= 7 && entry.sleep_hours <= 9) points += 10;
    else if (entry.sleep_hours >= 6 && entry.sleep_hours < 7) points += 5;
  }
  if (entry.sleep_quality != null && entry.sleep_quality >= 4) points += 5;
  if (entry.water_liters != null) {
    if (entry.water_liters >= 3) points += 10;
    else if (entry.water_liters >= 2) points += 5;
  }
  if (entry.home_cooked_meals != null && entry.home_cooked_meals >= 2) points += 5;
  if (entry.protein_meal) {
    points += 5;
    if (entry.protein_qty != null && entry.protein_qty >= 100) points += 3;
  }
  if (entry.junk_food === false) points += 5;
  if (entry.alcohol === 'zero') points += 5;
  if (entry.steps != null) {
    const stepThresholds = [
      [10000 * adj, 15],
      [7500 * adj, 10],
      [5000 * adj, 5],
    ];
    for (const [threshold, pts] of stepThresholds) {
      if (entry.steps >= threshold) {
        points += pts;
        break;
      }
    }
  }
  return Math.min(points, 98);
}

// Mirrors isGoalCrushDay() in lib/points.ts.
function calculateIsGoalCrushDay(entry, profile, dailyPoints) {
  const { goal_steps_day, goal_water_liters, goal_sleep_hours_min, goal_sleep_hours_max } = profile || {};
  const hasDailyGoals = goal_steps_day || goal_water_liters || (goal_sleep_hours_min && goal_sleep_hours_max);
  if (!hasDailyGoals) return dailyPoints >= 60;
  if (goal_steps_day && (!entry.steps || entry.steps < goal_steps_day)) return false;
  if (goal_water_liters && (!entry.water_liters || entry.water_liters < goal_water_liters)) return false;
  if (goal_sleep_hours_min && goal_sleep_hours_max) {
    if (entry.sleep_hours == null || entry.sleep_hours < goal_sleep_hours_min || entry.sleep_hours > goal_sleep_hours_max) return false;
  }
  return true;
}

async function main() {
  console.log('Fetching all profiles...');
  const { data: profiles, error: profileError } = await supabase
    .from('profiles')
    .select('id, age_bracket, goal_steps_day, goal_water_liters, goal_sleep_hours_min, goal_sleep_hours_max');
  if (profileError) {
    console.error('Error fetching profiles:', profileError);
    process.exit(1);
  }
  if (!profiles || profiles.length === 0) {
    console.log('No profiles found.');
    process.exit(0);
  }

  const profileMap = new Map();
  for (const p of profiles) {
    profileMap.set(p.id, p);
  }
  console.log(`Found ${profiles.length} profile(s).`);

  console.log('Fetching all daily_entries...');
  const { data: entries, error: entriesError } = await supabase
    .from('daily_entries')
    .select('*');
  if (entriesError) {
    console.error('Error fetching entries:', entriesError);
    process.exit(1);
  }
  if (!entries || entries.length === 0) {
    console.log('No entries found.');
    process.exit(0);
  }
  console.log(`Found ${entries.length} daily entry/entries.`);

  console.log('Recalculating points and is_goal_crush_day...');
  const updates = [];
  for (const entry of entries) {
    const profile = profileMap.get(entry.user_id) || {};
    const ageBracket = profile.age_bracket || '25_to_35';
    const newPoints = calculateDailyPoints(entry, ageBracket);
    const newIsGoalCrushDay = calculateIsGoalCrushDay(entry, profile, newPoints);
    const pointsChanged = entry.daily_points !== newPoints;
    const crushChanged = entry.is_goal_crush_day !== newIsGoalCrushDay;
    if (pointsChanged || crushChanged) {
      updates.push({
        id: entry.id,
        daily_points: newPoints,
        is_goal_crush_day: newIsGoalCrushDay,
      });
    }
  }

  console.log(`Updating ${updates.length} entries with recalculated points and goal crush status...`);
  const BATCH = 100;
  let updated = 0;
  for (let i = 0; i < updates.length; i += BATCH) {
    const batch = updates.slice(i, i + BATCH);
    for (const update of batch) {
      const { error } = await supabase
        .from('daily_entries')
        .update({ daily_points: update.daily_points, is_goal_crush_day: update.is_goal_crush_day })
        .eq('id', update.id);
      if (error) {
        console.error(`Error updating entry ${update.id}:`, error);
      } else {
        updated++;
      }
    }
    console.log(`  Updated ${Math.min(i + BATCH, updates.length)}/${updates.length} entries...`);
  }

  console.log(`\n✅ Successfully recalculated points + goal crush status for ${updated} entries.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
