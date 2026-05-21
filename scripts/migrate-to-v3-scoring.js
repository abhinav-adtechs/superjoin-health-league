#!/usr/bin/env node
/**
 * Backfill daily_entries with v3 scoring.
 *
 * Recalculates daily_points and is_goal_crush_day for every entry using the
 * v3 engine (embedded below — mirrors lib/points.ts).
 *
 * Usage:
 *   node scripts/migrate-to-v3-scoring.js          # dry run
 *   node scripts/migrate-to-v3-scoring.js --apply  # commit to DB
 *
 * Requires SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY (or .env.local via scripts/config.js).
 */

const { createClient } = require('@supabase/supabase-js');
const config = require('./config');

const APPLY = process.argv.includes('--apply');
const BATCH_SIZE = 50;

// ── v3 Scoring Logic (mirrors lib/points.ts) ─────────────────────────────────

function getAgeAdj(ageBracket) {
  return ageBracket === 'over_35' ? 0.85 : 1.0;
}

function getDailyActivityCap(mode) {
  return mode == null ? 75 : 90;
}

function getGoalCrushThreshold(mode) {
  return Math.floor(getDailyActivityCap(mode) * 0.7);
}

function tierPoints(value, tiers) {
  for (const [threshold, pts] of tiers) {
    if (value >= threshold) return pts;
  }
  return 0;
}

function scoreWorkoutPoints(entry, adj) {
  if (!entry.workout_done) return 0;
  const dur = entry.workout_duration || 0;
  const t15 = Math.round(15 * adj);
  const t30 = Math.round(30 * adj);
  const t45 = Math.round(45 * adj);
  const t60 = Math.round(60 * adj);
  if (dur >= t60) return 25;
  if (dur >= t45) return 20;
  if (dur >= t30) return 15;
  if (dur >= t15) return 11;
  return 5;
}

function scoreCardioPoints(entry, adj) {
  if (!entry.cardio_done) return 0;
  const dur = entry.cardio_duration || 0;
  const t15 = Math.round(15 * adj);
  const t30 = Math.round(30 * adj);
  const t45 = Math.round(45 * adj);
  const t60 = Math.round(60 * adj);
  if (dur >= t60) return 20;
  if (dur >= t45) return 16;
  if (dur >= t30) return 12;
  if (dur >= t15) return 8;
  return 4;
}

function scoreStepsPoints(steps, goalStepsDay, adj) {
  if (goalStepsDay && goalStepsDay > 0) {
    const pct = steps / goalStepsDay;
    if (pct >= 1.0) return 20;
    if (pct >= 0.75) return 15;
    if (pct >= 0.5) return 10;
    if (pct >= 0.25) return 5;
    return 0;
  }
  if (steps >= Math.round(10000 * adj)) return 20;
  if (steps >= Math.round(7500 * adj)) return 15;
  if (steps >= Math.round(5000 * adj)) return 10;
  if (steps >= Math.round(2500 * adj)) return 5;
  return 0;
}

function scoreMovementPoints(entry, adj, goalStepsDay) {
  let cardioPts = 0;
  let stepsPts = 0;
  if (entry.cardio_done) cardioPts = scoreCardioPoints(entry, adj);
  if (entry.steps != null && entry.steps > 0) {
    stepsPts = scoreStepsPoints(entry.steps, goalStepsDay, adj);
  }
  return Math.min(cardioPts + stepsPts, 20);
}

function scoreSleepPoints(sleepHours) {
  if (sleepHours == null) return 0;
  if (sleepHours >= 8 && sleepHours < 9) return 15;
  if (sleepHours >= 9) return 13;
  if (sleepHours >= 7) return 12;
  if (sleepHours >= 6) return 7;
  if (sleepHours >= 5) return 3;
  return 0;
}

function scoreWaterPoints(liters, maxPts) {
  if (liters == null) return 0;
  if (maxPts === 15) {
    return tierPoints(liters, [[3.0, 15], [2.5, 12], [2.0, 9], [1.5, 6], [1.0, 3]]);
  }
  return tierPoints(liters, [[3.0, 10], [2.5, 8], [2.0, 6], [1.5, 4], [1.0, 2]]);
}

function scoreProteinPoints(proteinQty, goalG, maxPts) {
  if (proteinQty == null || proteinQty <= 0) return 0;
  if (goalG && goalG > 0) {
    const pct = proteinQty / goalG;
    if (maxPts === 15) {
      if (pct >= 1.0) return 15;
      if (pct >= 0.75) return 11;
      if (pct >= 0.5) return 7;
      if (pct >= 0.25) return 4;
      return 2;
    }
    if (pct >= 1.0) return 10;
    if (pct >= 0.75) return 7;
    if (pct >= 0.5) return 5;
    if (pct >= 0.25) return 3;
    return 1;
  }
  if (maxPts === 15) {
    return tierPoints(proteinQty, [[120, 15], [90, 11], [60, 7], [30, 4], [1, 2]]);
  }
  return tierPoints(proteinQty, [[120, 10], [90, 7], [60, 5], [30, 3], [1, 1]]);
}

function scoreCaloriePoints(caloriesKcal, goalCaloriesDay, fitnessGoal, maxPts) {
  if (!goalCaloriesDay || !caloriesKcal) return 0;
  const cal = caloriesKcal;
  const target = goalCaloriesDay;
  const goal = fitnessGoal || 'stay_active';
  const tiers15 = [[0.02, 15], [0.05, 12], [0.10, 8], [0.15, 4]];
  const tiers10 = [[0.02, 10], [0.05, 8], [0.10, 5], [0.15, 3]];
  const tiers = maxPts === 15 ? tiers15 : tiers10;

  for (const [margin, pts] of tiers) {
    if (goal === 'lose_weight') {
      if (cal <= target && cal >= target * (1 - margin)) return pts;
    } else if (goal === 'gain_weight' || goal === 'gain_muscle') {
      if (cal >= target && cal <= target * (1 + margin)) return pts;
    } else if (cal >= target * (1 - margin) && cal <= target * (1 + margin)) {
      return pts;
    }
  }
  return 0;
}

function scoreNutritionPoints(entry, profile) {
  const mode = (profile && profile.food_tracking_mode) || null;

  if (mode == null) {
    return Math.min(scoreWaterPoints(entry.water_liters, 15), 15);
  }
  if (mode === 'calories_only') {
    const water = scoreWaterPoints(entry.water_liters, 15);
    const calories = scoreCaloriePoints(
      entry.calories_kcal,
      profile && profile.goal_calories_day,
      profile && profile.fitness_goal,
      15,
    );
    return Math.min(water + calories, 30);
  }
  if (mode === 'protein_only') {
    const water = scoreWaterPoints(entry.water_liters, 15);
    const protein = scoreProteinPoints(
      entry.protein_qty,
      profile && profile.goal_protein_g_day,
      15,
    );
    return Math.min(water + protein, 30);
  }
  if (mode === 'both') {
    const water = scoreWaterPoints(entry.water_liters, 10);
    const protein = scoreProteinPoints(
      entry.protein_qty,
      profile && profile.goal_protein_g_day,
      10,
    );
    const calories = scoreCaloriePoints(
      entry.calories_kcal,
      profile && profile.goal_calories_day,
      profile && profile.fitness_goal,
      10,
    );
    return Math.min(water + protein + calories, 30);
  }
  return Math.min(scoreWaterPoints(entry.water_liters, 15), 15);
}

function calculateDailyPointsV3(entry, ageBracket, profile) {
  const adj = getAgeAdj(ageBracket);
  const workout = scoreWorkoutPoints(entry, adj);
  const movement = scoreMovementPoints(
    entry,
    adj,
    profile && profile.goal_steps_day,
  );
  const sleep = scoreSleepPoints(entry.sleep_hours);
  const nutrition = scoreNutritionPoints(entry, profile);
  const total = workout + movement + sleep + nutrition;
  const cap = getDailyActivityCap(profile && profile.food_tracking_mode);
  return Math.min(total, cap);
}

function isGoalCrushDayV3(entry, profile, dailyPoints) {
  const threshold = getGoalCrushThreshold(profile && profile.food_tracking_mode);
  if (dailyPoints < threshold) return false;

  let categories = 0;
  if (entry.workout_done) categories++;
  if (entry.cardio_done || (entry.steps != null && entry.steps > 0)) categories++;
  if (entry.sleep_hours != null && entry.sleep_hours >= 5) categories++;
  const hasNutrition =
    (entry.water_liters != null && entry.water_liters > 0) ||
    (entry.protein_qty != null && entry.protein_qty > 0) ||
    (entry.calories_kcal != null && entry.calories_kcal > 0);
  if (hasNutrition) categories++;

  return categories >= 3;
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  const supabaseUrl =
    process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || config.supabaseUrl;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || config.serviceRoleKey;

  if (!supabaseUrl || !serviceRoleKey) {
    console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY (set env or use .env.local).');
    process.exit(1);
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  console.log(`Mode: ${APPLY ? 'APPLY (writing to DB)' : 'DRY RUN (no writes)'}\n`);

  const { data: profiles, error: profilesErr } = await supabase
    .from('profiles')
    .select(
      'id, age_bracket, fitness_goal, food_tracking_mode, goal_protein_g_day, goal_calories_day, goal_steps_day',
    );
  if (profilesErr) throw profilesErr;

  const profileMap = new Map(profiles.map((p) => [p.id, p]));
  console.log(`Loaded ${profileMap.size} profiles.`);

  const { data: entries, error: entriesErr } = await supabase
    .from('daily_entries')
    .select(
      'id, user_id, date, daily_points, is_goal_crush_day, workout_done, workout_duration, cardio_done, cardio_duration, steps, water_liters, protein_qty, calories_kcal, sleep_hours',
    );
  if (entriesErr) throw entriesErr;

  console.log(`Loaded ${entries.length} entries.\n`);

  const updates = [];
  let unchanged = 0;

  for (const entry of entries) {
    const profile = profileMap.get(entry.user_id);
    const ageBracket = (profile && profile.age_bracket) || 'under_25';

    const newPoints = calculateDailyPointsV3(entry, ageBracket, profile);
    const newCrush = isGoalCrushDayV3(entry, profile, newPoints);

    const pointsChanged = newPoints !== (entry.daily_points ?? 0);
    const crushChanged = newCrush !== (entry.is_goal_crush_day ?? false);

    if (pointsChanged || crushChanged) {
      updates.push({ id: entry.id, daily_points: newPoints, is_goal_crush_day: newCrush });
    } else {
      unchanged++;
    }
  }

  console.log(`Entries to update: ${updates.length}`);
  console.log(`Entries unchanged: ${unchanged}`);

  if (updates.length === 0) {
    console.log('\nNothing to update.');
    return;
  }

  console.log('\nSample changes (first 5):');
  for (const u of updates.slice(0, 5)) {
    const orig = entries.find((e) => e.id === u.id);
    console.log(
      `  entry ${u.id} (${orig.date}): pts ${orig.daily_points ?? 0} → ${u.daily_points}, crush ${orig.is_goal_crush_day ?? false} → ${u.is_goal_crush_day}`,
    );
  }

  if (!APPLY) {
    console.log('\nDry run — no changes written. Re-run with --apply to commit.');
    return;
  }

  let successCount = 0;
  let errorCount = 0;

  for (let i = 0; i < updates.length; i += BATCH_SIZE) {
    const batch = updates.slice(i, i + BATCH_SIZE);
    for (const u of batch) {
      const { error } = await supabase
        .from('daily_entries')
        .update({ daily_points: u.daily_points, is_goal_crush_day: u.is_goal_crush_day })
        .eq('id', u.id);
      if (error) {
        console.error(`  Failed entry ${u.id}:`, error.message);
        errorCount++;
      } else {
        successCount++;
      }
    }
    process.stdout.write(`\r  Updated ${successCount}/${updates.length}...`);
  }

  console.log(`\n\nDone. ${successCount} updated, ${errorCount} failed.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
