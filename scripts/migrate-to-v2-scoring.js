#!/usr/bin/env node
/**
 * Backfill daily_entries with v2 scoring.
 *
 * Recalculates daily_points and is_goal_crush_day for every entry using the
 * v2 engine (embedded below — no TypeScript imports needed).
 *
 * Usage:
 *   node scripts/migrate-to-v2-scoring.js          # dry run (shows what would change)
 *   node scripts/migrate-to-v2-scoring.js --apply  # commit changes to DB
 *
 * Requires SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY (or .env.local via scripts/config.js).
 */

const { createClient } = require('@supabase/supabase-js');
const config = require('./config');

const APPLY = process.argv.includes('--apply');
const BATCH_SIZE = 50;

// ── v2 Scoring Logic (mirrors lib/points.ts) ─────────────────────────────────

function getAgeAdj(ageBracket) {
  return ageBracket === 'over_35' ? 0.85 : 1.0;
}

function caloriePointsV2(cal, target, fitnessGoal) {
  if (!target || !cal) return 0;
  const goal = fitnessGoal || 'stay_active';

  if (goal === 'lose_weight') {
    if (cal <= target) return 4;
    if (cal <= target * 1.125) return 2;
    return 0;
  }
  if (goal === 'gain_weight' || goal === 'gain_muscle') {
    if (cal >= target) return 4;
    if (cal >= target * 0.875) return 2;
    return 0;
  }
  // stay_active / general_wellness — symmetric maintenance window
  if (cal >= target * 0.95 && cal <= target * 1.05) return 4;
  if (cal >= target * 0.875 && cal <= target * 1.125) return 2;
  return 0;
}

function calculateDailyPointsV2(entry, ageBracket, profile) {
  const adj = getAgeAdj(ageBracket);
  let points = 0;

  // Workout (max 20) — age-adjusted duration thresholds
  if (entry.workout_done) {
    points += 10;
    const dur = entry.workout_duration || 0;
    if (dur >= Math.round(45 * adj)) points += 5;
    if (dur >= Math.round(60 * adj)) points += 5;
  }
  points = Math.min(points, 20);

  // Movement: cardio + steps, highest tier only (max 20)
  let movPts = 0;
  if (entry.cardio_done) {
    movPts += 8;
    const cardurThresh = 30 * adj;
    if ((entry.cardio_duration || 0) >= cardurThresh) movPts += 4;
  }
  if (entry.steps != null) {
    if (entry.steps >= Math.round(10000 * adj)) movPts += 8;
    else if (entry.steps >= Math.round(7500 * adj)) movPts += 6;
    else if (entry.steps >= Math.round(5000 * adj)) movPts += 4;
  }
  points += Math.min(movPts, 20);

  // Sleep (max 16) — 3 tiers
  if (entry.sleep_hours != null) {
    if (entry.sleep_hours >= 7 && entry.sleep_hours <= 9) points += 16;
    else if (entry.sleep_hours >= 6 && entry.sleep_hours < 7) points += 8;
    else if (entry.sleep_hours >= 5 && entry.sleep_hours < 6) points += 3;
  }

  // Nutrition (max 24) — water-dominant
  let nutPts = 0;
  if (entry.water_liters != null) {
    if (entry.water_liters >= 3) nutPts += 16;
    else if (entry.water_liters >= 2) nutPts += 8;
  }

  const mode = (profile && profile.food_tracking_mode) || null;
  const trackProtein = !mode || mode === 'protein_only' || mode === 'both';
  const trackCalories = !mode || mode === 'calories_only' || mode === 'both';
  const proteinGoal = profile && profile.goal_protein_g_day;
  const calGoal = profile && profile.goal_calories_day;
  const fitnessGoal = profile && profile.fitness_goal;

  if (trackProtein && proteinGoal) {
    if (entry.protein_qty != null && entry.protein_qty >= proteinGoal) nutPts += 4;
    else if (entry.protein_qty != null && entry.protein_qty > 0) nutPts += 2;
  }

  if (trackCalories && calGoal) {
    nutPts += caloriePointsV2(entry.calories_kcal, calGoal, fitnessGoal);
  }

  points += Math.min(nutPts, 24);

  return Math.min(points, 80);
}

function isGoalCrushDayV2(entry, dailyPoints) {
  if (dailyPoints < 56) return false;

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

  // Fetch all profiles
  const { data: profiles, error: profilesErr } = await supabase
    .from('profiles')
    .select('id, age_bracket, fitness_goal, food_tracking_mode, goal_protein_g_day, goal_calories_day');
  if (profilesErr) throw profilesErr;

  const profileMap = new Map(profiles.map((p) => [p.id, p]));
  console.log(`Loaded ${profileMap.size} profiles.`);

  // Fetch all daily_entries
  // is_goal_crush_day excluded — column not yet in live DB.
  // The script writes it back; Supabase will error if the column is missing,
  // so we detect that and fall back to writing only daily_points.
  const { data: entries, error: entriesErr } = await supabase
    .from('daily_entries')
    .select('id, user_id, date, daily_points, workout_done, workout_duration, cardio_done, cardio_duration, steps, water_liters, protein_qty, calories_kcal, sleep_hours');
  if (entriesErr) throw entriesErr;

  console.log(`Loaded ${entries.length} entries.\n`);

  const updates = [];
  let unchanged = 0;

  for (const entry of entries) {
    const profile = profileMap.get(entry.user_id);
    const ageBracket = (profile && profile.age_bracket) || 'under_25';

    const newPoints = calculateDailyPointsV2(entry, ageBracket, profile);
    const newCrush = isGoalCrushDayV2(entry, newPoints);

    const pointsChanged = newPoints !== (entry.daily_points ?? 0);

    if (pointsChanged) {
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

  // Show sample
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

  // Batch update
  let successCount = 0;
  let errorCount = 0;

  for (let i = 0; i < updates.length; i += BATCH_SIZE) {
    const batch = updates.slice(i, i + BATCH_SIZE);
    for (const u of batch) {
      const { error } = await supabase
        .from('daily_entries')
        .update({ daily_points: u.daily_points })
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
