#!/usr/bin/env node

/**
 * Assign distinct personal goals to every profile, then seed daily_entries for all of March.
 * Points + is_goal_crush_day mirror lib/points.ts (calculateDailyPoints + isGoalCrushDay).
 *
 * Usage:
 *   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... node scripts/seed-march-entries.js
 * Optional:
 *   SEED_YEAR=2026 SEED_MONTH=3
 *   SEED_SKIP_GOAL_UPDATE=1   (only insert/update entries; do not change profile goals)
 */

const { createClient } = require('@supabase/supabase-js');
const config = require('./config');

const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || config.supabaseUrl;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || config.serviceRoleKey;

const SEED_YEAR = parseInt(process.env.SEED_YEAR || '2026', 10);
const SEED_MONTH = parseInt(process.env.SEED_MONTH || '3', 10); // March
const SKIP_GOAL_UPDATE = process.env.SEED_SKIP_GOAL_UPDATE === '1' || process.env.SEED_SKIP_GOAL_UPDATE === 'true';

if (!supabaseUrl || !serviceRoleKey) {
  console.error('Error: Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// ── Points (mirrors lib/points.ts) ───────────────────────────────────────────

function caloriePoints(caloriesKcal, goalCaloriesDay, fitnessGoal) {
  if (!goalCaloriesDay || caloriesKcal == null) return 0;
  const cal = caloriesKcal;
  const target = goalCaloriesDay;
  const goal = fitnessGoal ?? 'stay_active';

  if (goal === 'lose_weight') {
    if (cal <= target) return 8;
    if (cal <= target * 1.1) return 4;
    return 0;
  }
  if (goal === 'gain_weight') {
    if (cal >= target) return 8;
    if (cal >= target * 0.85) return 4;
    return 0;
  }
  if (goal === 'gain_muscle') {
    if (cal >= target * 0.9) return 8;
    return 0;
  }
  return 5;
}

function calculateDailyPoints(entry, ageBracket, profile) {
  let points = 0;
  const adj = ageBracket === 'over_35' ? 0.85 : 1.0;

  if (entry.workout_done) {
    points += 10;
    if (entry.workout_duration != null && entry.workout_duration >= 45) points += 5;
    if (entry.workout_duration != null && entry.workout_duration >= 60) points += 5;
  }
  points = Math.min(points, 20);

  let movementPts = 0;
  if (entry.cardio_done) {
    movementPts += 10;
    const cardioThreshold = 30 * adj;
    if (entry.cardio_duration != null && entry.cardio_duration >= cardioThreshold) movementPts += 5;
  }
  if (entry.steps != null) {
    if (entry.steps >= Math.round(10000 * adj)) movementPts += 10;
    else if (entry.steps >= Math.round(7500 * adj)) movementPts += 7;
    else if (entry.steps >= Math.round(5000 * adj)) movementPts += 5;
  }
  points += Math.min(movementPts, 25);

  if (entry.sleep_hours != null) {
    if (entry.sleep_hours >= 7 && entry.sleep_hours <= 9) points += 10;
    else if (entry.sleep_hours >= 6 && entry.sleep_hours < 7) points += 5;
  }

  let nutritionPts = 0;
  if (entry.water_liters != null) {
    if (entry.water_liters >= 3) nutritionPts += 10;
    else if (entry.water_liters >= 2) nutritionPts += 5;
  }

  const mode = profile?.food_tracking_mode ?? null;
  const fitnessGoal = profile?.fitness_goal ?? null;
  const proteinGoal = profile?.goal_protein_g_day ?? null;
  const calGoal = profile?.goal_calories_day ?? null;

  const trackProtein = !mode || mode === 'protein_only' || mode === 'both';
  const trackCalories = mode === 'calories_only' || mode === 'both';

  if (trackProtein && proteinGoal) {
    if (entry.protein_qty != null && entry.protein_qty >= proteinGoal) nutritionPts += 8;
    else if (entry.protein_qty != null && entry.protein_qty > 0) nutritionPts += 4;
  } else if (!trackCalories) {
    if (entry.protein_meal) {
      nutritionPts += 5;
      if (entry.protein_qty != null && entry.protein_qty >= 100) nutritionPts += 3;
    }
  }

  if (trackCalories && calGoal) {
    nutritionPts += caloriePoints(entry.calories_kcal, calGoal, fitnessGoal);
  }

  points += Math.min(nutritionPts, 26);
  return Math.min(points, 85);
}

function isGoalCrushDay(entry, profile, dailyPoints) {
  const {
    goal_water_liters,
    goal_sleep_hours,
    goal_sleep_hours_min,
    goal_sleep_hours_max,
    goal_protein_g_day,
    goal_calories_day,
    food_tracking_mode,
    fitness_goal,
  } = profile;

  const hasSleepGoal =
    goal_sleep_hours != null || (goal_sleep_hours_min != null && goal_sleep_hours_max != null);
  const mode = food_tracking_mode ?? null;
  const trackProtein = !mode || mode === 'protein_only' || mode === 'both';
  const trackCalories = mode === 'calories_only' || mode === 'both';

  const hasDailyGoals =
    goal_water_liters ||
    hasSleepGoal ||
    (trackProtein && goal_protein_g_day) ||
    (trackCalories && goal_calories_day);

  if (!hasDailyGoals) {
    return dailyPoints >= 60;
  }

  if (goal_water_liters && (!entry.water_liters || entry.water_liters < goal_water_liters)) return false;

  if (goal_sleep_hours != null) {
    if (entry.sleep_hours == null || entry.sleep_hours < goal_sleep_hours) return false;
  } else if (goal_sleep_hours_min != null && goal_sleep_hours_max != null) {
    if (
      entry.sleep_hours == null ||
      entry.sleep_hours < goal_sleep_hours_min ||
      entry.sleep_hours > goal_sleep_hours_max
    ) {
      return false;
    }
  }

  if (trackProtein && goal_protein_g_day) {
    if (!entry.protein_qty || entry.protein_qty < goal_protein_g_day) return false;
  }

  if (trackCalories && goal_calories_day) {
    const goal = fitness_goal ?? 'stay_active';
    const cal = entry.calories_kcal;
    if (cal == null) return false;
    if (goal === 'lose_weight' && cal > goal_calories_day * 1.1) return false;
    if (goal === 'gain_weight' && cal < goal_calories_day * 0.85) return false;
    if (goal === 'gain_muscle' && cal < goal_calories_day * 0.9) return false;
  }

  return true;
}

// ── Goal presets: each user gets one (cycled by index) ───────────────────────

/** @typedef {Object} GoalPreset */
const GOAL_PRESETS = [
  {
    label: 'Endurance + protein',
    patch: {
      fitness_goal: 'general_wellness',
      food_tracking_mode: 'protein_only',
      goal_workout_days_week: 4,
      goal_workout_mins_week: 150,
      goal_workout_types: ['running', 'cardio_mix'],
      goal_steps_day: 10000,
      goal_water_liters: 2.5,
      goal_sleep_hours: null,
      goal_sleep_hours_min: 7,
      goal_sleep_hours_max: 8.5,
      goal_protein_g_day: 110,
      goal_calories_day: null,
      goal_home_cooked_per_week: 10,
    },
  },
  {
    label: 'Hypertrophy bulk',
    patch: {
      fitness_goal: 'gain_muscle',
      food_tracking_mode: 'both',
      goal_workout_days_week: 5,
      goal_workout_mins_week: 200,
      goal_workout_types: ['strength', 'crossfit'],
      goal_steps_day: 8000,
      goal_water_liters: 3,
      goal_sleep_hours: null,
      goal_sleep_hours_min: 7,
      goal_sleep_hours_max: 9,
      goal_protein_g_day: 165,
      goal_calories_day: 2800,
      goal_home_cooked_per_week: 12,
    },
  },
  {
    label: 'Fat loss',
    patch: {
      fitness_goal: 'lose_weight',
      food_tracking_mode: 'both',
      goal_workout_days_week: 4,
      goal_workout_mins_week: 160,
      goal_workout_types: ['strength', 'cycling'],
      goal_steps_day: 11000,
      goal_water_liters: 2.5,
      goal_sleep_hours: null,
      goal_sleep_hours_min: 7,
      goal_sleep_hours_max: 8,
      goal_protein_g_day: 140,
      goal_calories_day: 1850,
      goal_home_cooked_per_week: 14,
    },
  },
  {
    label: 'Active maintenance',
    patch: {
      fitness_goal: 'stay_active',
      food_tracking_mode: 'protein_only',
      goal_workout_days_week: 3,
      goal_workout_mins_week: 90,
      goal_workout_types: ['yoga', 'walking'],
      goal_steps_day: 8500,
      goal_water_liters: 2,
      goal_sleep_hours: 7.5,
      goal_sleep_hours_min: null,
      goal_sleep_hours_max: null,
      goal_protein_g_day: 85,
      goal_calories_day: null,
      goal_home_cooked_per_week: 8,
    },
  },
  {
    label: 'Calorie-aware wellness',
    patch: {
      fitness_goal: 'general_wellness',
      food_tracking_mode: 'calories_only',
      goal_workout_days_week: 3,
      goal_workout_mins_week: 120,
      goal_workout_types: ['walking', 'swimming'],
      goal_steps_day: null,
      goal_water_liters: 2.2,
      goal_sleep_hours: null,
      goal_sleep_hours_min: 6.5,
      goal_sleep_hours_max: 8.5,
      goal_protein_g_day: null,
      goal_calories_day: 2200,
      goal_home_cooked_per_week: 9,
    },
  },
  {
    label: 'Weight gain',
    patch: {
      fitness_goal: 'gain_weight',
      food_tracking_mode: 'both',
      goal_workout_days_week: 4,
      goal_workout_mins_week: 140,
      goal_workout_types: ['strength'],
      goal_steps_day: 7000,
      goal_water_liters: 2.8,
      goal_sleep_hours: null,
      goal_sleep_hours_min: 8,
      goal_sleep_hours_max: 9.5,
      goal_protein_g_day: 130,
      goal_calories_day: 3100,
      goal_home_cooked_per_week: 11,
    },
  },
  {
    label: 'Steps + hydration',
    patch: {
      fitness_goal: 'stay_active',
      food_tracking_mode: 'protein_only',
      goal_workout_days_week: 2,
      goal_workout_mins_week: 75,
      goal_workout_types: ['walking', 'running'],
      goal_steps_day: 12000,
      goal_water_liters: 3,
      goal_sleep_hours: null,
      goal_sleep_hours_min: 7,
      goal_sleep_hours_max: 8,
      goal_protein_g_day: 95,
      goal_calories_day: null,
      goal_home_cooked_per_week: 7,
    },
  },
  {
    label: 'Racket sports focus',
    patch: {
      fitness_goal: 'general_wellness',
      food_tracking_mode: 'both',
      goal_workout_days_week: 4,
      goal_workout_mins_week: 180,
      goal_workout_types: ['racket_sports', 'strength'],
      goal_steps_day: 9500,
      goal_water_liters: 2.6,
      goal_sleep_hours: null,
      goal_sleep_hours_min: 7,
      goal_sleep_hours_max: 9,
      goal_protein_g_day: 120,
      goal_calories_day: 2400,
      goal_home_cooked_per_week: 10,
    },
  },
  {
    label: 'Minimal structure',
    patch: {
      fitness_goal: 'general_wellness',
      food_tracking_mode: 'protein_only',
      goal_workout_days_week: 2,
      goal_workout_mins_week: 60,
      goal_workout_types: ['yoga', 'strength'],
      goal_steps_day: 6000,
      goal_water_liters: 2,
      goal_sleep_hours: 7,
      goal_sleep_hours_min: null,
      goal_sleep_hours_max: null,
      goal_protein_g_day: 75,
      goal_calories_day: null,
      goal_home_cooked_per_week: 6,
    },
  },
  {
    label: 'Team sports + fuel',
    patch: {
      fitness_goal: 'stay_active',
      food_tracking_mode: 'both',
      goal_workout_days_week: 3,
      goal_workout_mins_week: 150,
      goal_workout_types: ['team_sports', 'cardio_mix'],
      goal_steps_day: 9000,
      goal_water_liters: 2.7,
      goal_sleep_hours: null,
      goal_sleep_hours_min: 7.5,
      goal_sleep_hours_max: 9,
      goal_protein_g_day: 100,
      goal_calories_day: 2600,
      goal_home_cooked_per_week: 8,
    },
  },
  {
    label: 'Cutting athlete',
    patch: {
      fitness_goal: 'lose_weight',
      food_tracking_mode: 'both',
      goal_workout_days_week: 5,
      goal_workout_mins_week: 220,
      goal_workout_types: ['crossfit', 'cycling'],
      goal_steps_day: 10500,
      goal_water_liters: 3,
      goal_sleep_hours: null,
      goal_sleep_hours_min: 7,
      goal_sleep_hours_max: 8.5,
      goal_protein_g_day: 155,
      goal_calories_day: 1950,
      goal_home_cooked_per_week: 15,
    },
  },
  {
    label: 'Martial arts mix',
    patch: {
      fitness_goal: 'gain_muscle',
      food_tracking_mode: 'protein_only',
      goal_workout_days_week: 4,
      goal_workout_mins_week: 170,
      goal_workout_types: ['martial_arts', 'strength'],
      goal_steps_day: 8800,
      goal_water_liters: 2.4,
      goal_sleep_hours: null,
      goal_sleep_hours_min: 7,
      goal_sleep_hours_max: 8.5,
      goal_protein_g_day: 145,
      goal_calories_day: null,
      goal_home_cooked_per_week: 10,
    },
  },
];

const WORKOUT_OPTIONS = [
  'push',
  'pull',
  'legs',
  'full_body',
  'chest',
  'back',
  'core',
  'quad',
  'bodyweight',
];
const CARDIO_TYPES = [
  'running',
  'cycling',
  'walking',
  'swimming',
  'hiking',
  'dance',
  'badminton',
  'football',
];

function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}
function randInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}
function randFloat(min, max, decimals = 1) {
  const v = min + Math.random() * (max - min);
  return Math.round(v * Math.pow(10, decimals)) / Math.pow(10, decimals);
}
function maybe(p) {
  return Math.random() < p;
}

function dateToYMD(d) {
  return d.toISOString().slice(0, 10);
}

function getWeekStart(dateStr) {
  const d = new Date(dateStr + 'T12:00:00Z');
  const day = d.getUTCDay();
  const monday = new Date(d);
  monday.setUTCDate(d.getUTCDate() - (day === 0 ? 6 : day - 1));
  return dateToYMD(monday);
}

/**
 * Build one day of data; ~78% of days hit personal goals (rest are softer / partial).
 */
function buildDayEntry(userId, dateStr, ageBracket, profile) {
  const mode = profile.food_tracking_mode ?? null;
  const trackProtein = !mode || mode === 'protein_only' || mode === 'both';
  const trackCalories = mode === 'calories_only' || mode === 'both';
  const calGoal = profile.goal_calories_day;
  const proteinGoal = profile.goal_protein_g_day;
  const fg = profile.fitness_goal ?? 'stay_active';

  const hitGoals = maybe(0.78);

  const entry = {
    user_id: userId,
    date: dateStr,
    workout_done: maybe(0.55),
    workout_duration: null,
    workout_types: [],
    cardio_done: maybe(0.42),
    cardio_duration: null,
    cardio_type: null,
    steps: maybe(0.88) ? randInt(4000, 14500) : null,
    water_liters: maybe(0.92) ? randFloat(1.8, 3.6, 2) : null,
    home_cooked_meals: maybe(0.75) ? randInt(0, 3) : null,
    protein_meal: maybe(0.65),
    protein_qty: null,
    junk_food: maybe(0.25) ? true : maybe(0.5) ? false : null,
    alcohol: pick(['zero', 'zero', 'zero', 'one_to_two', 'three_plus']),
    sleep_hours: maybe(0.92) ? randFloat(6.0, 8.8, 1) : null,
    sleep_quality: maybe(0.8) ? randInt(2, 5) : null,
    calories_kcal: null,
    scored_with_goal: fg,
  };

  if (entry.workout_done) {
    entry.workout_duration = pick([35, 40, 45, 50, 55, 60, 65]);
    entry.workout_types = [pick(WORKOUT_OPTIONS), ...(maybe(0.35) ? [pick(WORKOUT_OPTIONS)] : [])].filter(
      (v, i, a) => a.indexOf(v) === i,
    );
  }
  if (entry.cardio_done) {
    entry.cardio_duration = randInt(25, 55);
    entry.cardio_type = pick(CARDIO_TYPES);
  }

  if (trackProtein && proteinGoal) {
    if (hitGoals) entry.protein_qty = randInt(proteinGoal, proteinGoal + 45);
    else {
      const hi = Math.max(0, proteinGoal - 1);
      const lo = Math.max(0, Math.min(hi, proteinGoal - Math.max(15, Math.floor(proteinGoal * 0.25))));
      entry.protein_qty = lo <= hi ? randInt(lo, hi) : 0;
    }
  } else if (entry.protein_meal) {
    entry.protein_qty = randInt(50, 140);
  }

  if (trackCalories && calGoal) {
    if (fg === 'lose_weight') {
      entry.calories_kcal = hitGoals ? randInt(Math.floor(calGoal * 0.85), calGoal) : randInt(calGoal, Math.floor(calGoal * 1.15));
    } else if (fg === 'gain_weight' || fg === 'gain_muscle') {
      entry.calories_kcal = hitGoals
        ? randInt(Math.floor(calGoal * 0.92), Math.floor(calGoal * 1.12))
        : randInt(Math.floor(calGoal * 0.7), Math.floor(calGoal * 0.88));
    } else {
      entry.calories_kcal = hitGoals ? randInt(calGoal - 200, calGoal + 200) : randInt(calGoal - 500, calGoal + 400);
    }
  }

  if (profile.goal_water_liters && hitGoals) {
    entry.water_liters = randFloat(Number(profile.goal_water_liters), 3.8, 2);
  } else if (profile.goal_water_liters) {
    entry.water_liters = randFloat(1.5, Math.max(1.5, Number(profile.goal_water_liters) - 0.3), 2);
  }

  if (profile.goal_sleep_hours_min != null && profile.goal_sleep_hours_max != null && hitGoals) {
    entry.sleep_hours = randFloat(
      Number(profile.goal_sleep_hours_min),
      Number(profile.goal_sleep_hours_max),
      1,
    );
  } else if (profile.goal_sleep_hours != null && hitGoals) {
    entry.sleep_hours = randFloat(Number(profile.goal_sleep_hours), Number(profile.goal_sleep_hours) + 1.2, 1);
  }

  if (profile.goal_steps_day && hitGoals) {
    entry.steps = randInt(profile.goal_steps_day, Math.min(18000, profile.goal_steps_day + 2500));
  }

  entry.daily_points = calculateDailyPoints(entry, ageBracket, profile);
  entry.is_goal_crush_day = isGoalCrushDay(entry, profile, entry.daily_points);
  return entry;
}

function monthDateRange(year, monthIndex1Based) {
  const start = new Date(Date.UTC(year, monthIndex1Based - 1, 1));
  const end = new Date(Date.UTC(year, monthIndex1Based, 0));
  const dates = [];
  for (let d = new Date(start); d <= end; d.setUTCDate(d.getUTCDate() + 1)) {
    dates.push(dateToYMD(new Date(d)));
  }
  return dates;
}

async function main() {
  const monthDates = monthDateRange(SEED_YEAR, SEED_MONTH);
  const monthLabel = `${SEED_YEAR}-${String(SEED_MONTH).padStart(2, '0')}`;
  console.log(`Seeding daily entries for ${monthLabel} (${monthDates.length} days)…`);

  const { data: profiles, error: profileError } = await supabase
    .from('profiles')
    .select(
      'id, display_name, age, age_bracket, is_active, starting_weight, fitness_goal, food_tracking_mode, goal_protein_g_day, goal_calories_day',
    )
    .order('display_name', { ascending: true });

  if (profileError) {
    console.error('Error fetching profiles:', profileError);
    process.exit(1);
  }
  const active = (profiles || []).filter((p) => p.is_active !== false);
  if (active.length === 0) {
    console.error('No active profiles found.');
    process.exit(1);
  }
  console.log(`Found ${active.length} profile(s).`);

  const nowIso = new Date().toISOString();
  const updatedProfiles = [];

  for (let i = 0; i < active.length; i++) {
    const profile = active[i];
    const preset = GOAL_PRESETS[i % GOAL_PRESETS.length];
    const { patch } = preset;
    const row = {
      ...patch,
      goal_changed_at: nowIso,
      updated_at: nowIso,
    };

    if (!SKIP_GOAL_UPDATE) {
      const { error: upErr } = await supabase.from('profiles').update(row).eq('id', profile.id);
      if (upErr) {
        console.error(`Failed to update goals for ${profile.display_name}:`, upErr);
        process.exit(1);
      }
    }

    updatedProfiles.push({
      ...profile,
      ...patch,
      label: preset.label,
    });
    console.log(`  ${profile.display_name}: ${preset.label}${SKIP_GOAL_UPDATE ? ' (goals skipped)' : ''}`);
  }

  const dailyEntries = [];

  for (const p of updatedProfiles) {
    const ageBracket = p.age_bracket || (p.age < 25 ? 'under_25' : p.age <= 35 ? '25_to_35' : 'over_35');

    for (const dateStr of monthDates) {
      dailyEntries.push(buildDayEntry(p.id, dateStr, ageBracket, p));
    }
  }

  // Weigh-ins: one per ISO week touched by the month, per user
  const weighInsFixed = [];
  for (const p of updatedProfiles) {
    const seen = new Set();
    for (const dateStr of monthDates) {
      const ws = getWeekStart(dateStr);
      if (seen.has(ws)) continue;
      seen.add(ws);
      const wiggle = randFloat(-1.2, 1.2, 2);
      const bw = Number(p.starting_weight) || 75;
      weighInsFixed.push({
        user_id: p.id,
        week_start: ws,
        weight_kg: Math.max(45, Math.min(130, bw + wiggle)),
      });
    }
  }

  console.log(`Generated ${dailyEntries.length} daily rows, ${weighInsFixed.length} weekly weigh-ins.`);

  const BATCH = 100;
  let stripGoalCrush = false;
  let stripScoredGoal = false;

  async function upsertDailyBatch(batch) {
    let rows = batch;
    if (stripGoalCrush) {
      rows = rows.map(({ is_goal_crush_day: _c, ...rest }) => rest);
    }
    if (stripScoredGoal) {
      rows = rows.map(({ scored_with_goal: _s, ...rest }) => rest);
    }
    return supabase.from('daily_entries').upsert(rows, {
      onConflict: 'user_id,date',
      ignoreDuplicates: false,
    });
  }

  for (let i = 0; i < dailyEntries.length; i += BATCH) {
    const batch = dailyEntries.slice(i, i + BATCH);
    let { error: eError } = await upsertDailyBatch(batch);
    if (eError && String(eError.message || '').includes('is_goal_crush_day')) {
      stripGoalCrush = true;
      ({ error: eError } = await upsertDailyBatch(batch));
    }
    if (eError && String(eError.message || '').includes('scored_with_goal')) {
      stripScoredGoal = true;
      ({ error: eError } = await upsertDailyBatch(batch));
    }
    if (eError) {
      console.error('Error upserting daily_entries:', eError);
      process.exit(1);
    }
    console.log(`  daily_entries ${i + 1}–${Math.min(i + BATCH, dailyEntries.length)}`);
  }
  if (stripGoalCrush) console.log('  (note: omitted is_goal_crush_day — column not in DB)');
  if (stripScoredGoal) console.log('  (note: omitted scored_with_goal — column not in DB)');

  for (let i = 0; i < weighInsFixed.length; i += BATCH) {
    const batch = weighInsFixed.slice(i, i + BATCH);
    const { error: wError } = await supabase.from('weekly_weigh_ins').upsert(batch, {
      onConflict: 'user_id,week_start',
      ignoreDuplicates: false,
    });
    if (wError) {
      console.error('Error upserting weekly_weigh_ins:', wError);
      process.exit(1);
    }
  }
  console.log('Done. Leaderboards and stats should reflect March data after refresh.');

  // Optional: sync latest weight on profile
  for (const p of updatedProfiles) {
    const last = weighInsFixed.filter((w) => w.user_id === p.id).sort((a, b) => b.week_start.localeCompare(a.week_start));
    if (last[0]) {
      await supabase.from('profiles').update({ current_weight: last[0].weight_kg }).eq('id', p.id);
    }
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
