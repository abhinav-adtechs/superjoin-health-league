#!/usr/bin/env node

/**
 * Seed dummy health data for testing.
 *
 * Uses existing profiles: generates past daily_entries, weekly_weigh_ins, and streaks
 * for the last N days. Uses the same points logic as the app.
 *
 * Usage:
 *   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... node scripts/seed-dummy-data.js
 *   # Optional: SEED_DAYS=60 (default 90), SEED_ENTRY_PROB=0.75 (default ~70% of days get an entry)
 *
 * Cleanup: Use scripts/cleanup-dummy-data.js or delete entries manually.
 */

const { createClient } = require('@supabase/supabase-js');
const config = require('./config');

const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || config.supabaseUrl;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || config.serviceRoleKey;

const SEED_DAYS = parseInt(process.env.SEED_DAYS || '90', 10);
const SEED_ENTRY_PROB = parseFloat(process.env.SEED_ENTRY_PROB || '0.72', 10);

if (!supabaseUrl || !serviceRoleKey) {
  console.error('Error: Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// --- Points calculation (mirrors lib/points.ts) ---
function getAgeBracket(age) {
  if (age < 25) return 'under_25';
  if (age <= 35) return '25_to_35';
  return 'over_35';
}

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

// --- Random helpers ---
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
function maybe(prob) {
  return Math.random() < prob;
}

const WORKOUT_OPTIONS = [
  'push', 'pull', 'legs', 'full_body', 'bodyweight', 'chest', 'back', 'core', 'quad', 'hamstring', 'glute',
];
const CARDIO_TYPES = [
  'running', 'cycling', 'walking', 'swimming', 'hiking', 'dance', 'football', 'cricket', 'basketball', 'badminton',
];

function buildRandomEntry(userId, date, ageBracket) {
  const entry = {
    user_id: userId,
    date: date,
    workout_done: maybe(0.5),
    workout_duration: null,
    workout_types: [],
    cardio_done: maybe(0.4),
    cardio_duration: null,
    cardio_type: null,
    steps: maybe(0.6) ? randInt(3000, 14000) : null,
    water_liters: maybe(0.85) ? randFloat(1.5, 4, 2) : null,
    home_cooked_meals: maybe(0.7) ? randInt(0, 3) : null,
    protein_meal: maybe(0.6),
    protein_qty: null,
    junk_food: maybe(0.3) ? false : (maybe(0.5) ? true : null),
    alcohol: pick(['zero', 'zero', 'zero', 'one_to_two', 'three_plus']),
    sleep_hours: maybe(0.9) ? randFloat(5.5, 8.5, 1) : null,
    sleep_quality: maybe(0.8) ? randInt(2, 5) : null,
  };
  if (entry.workout_done) {
    entry.workout_duration = pick([30, 35, 40, 45, 50, 55, 60, 60]);
    entry.workout_types = [pick(WORKOUT_OPTIONS), ...(maybe(0.4) ? [pick(WORKOUT_OPTIONS)] : [])].filter((v, i, a) => a.indexOf(v) === i);
  }
  if (entry.cardio_done) {
    entry.cardio_duration = randInt(20, 60);
    entry.cardio_type = pick(CARDIO_TYPES);
  }
  if (entry.protein_meal) {
    entry.protein_qty = randInt(60, 180);
  }
  entry.daily_points = calculateDailyPoints(entry, ageBracket);
  return entry;
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

async function main() {
  console.log('Fetching existing profiles...');
  const { data: profiles, error: profileError } = await supabase
    .from('profiles')
    .select('id, display_name, age, age_bracket, starting_weight, joined_at');
  if (profileError) {
    console.error('Error fetching profiles:', profileError);
    process.exit(1);
  }
  if (!profiles || profiles.length === 0) {
    console.error('No profiles found. Create users first (e.g. node scripts/create-users.js).');
    process.exit(1);
  }
  console.log(`Found ${profiles.length} profile(s).`);

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const startDate = new Date(today);
  startDate.setDate(startDate.getDate() - SEED_DAYS);

  const dailyEntries = [];
  const weekWeights = new Map(); // (userId, week_start) -> weight_kg

  // Calculate current week start (Monday) for ensuring visibility
  const currentWeekStart = getWeekStart(dateToYMD(today));
  
  for (const profile of profiles) {
    // Use age_bracket from DB if available, otherwise compute from age
    const ageBracket = profile.age_bracket || getAgeBracket(profile.age || 28);
    const baseWeight = Number(profile.starting_weight) || 75;
    
    for (let i = 0; i < SEED_DAYS; i++) {
      const d = new Date(startDate);
      d.setDate(d.getDate() + i);
      const dateStr = dateToYMD(d);
      if (dateStr >= dateToYMD(today)) continue;
      
      const weekStart = getWeekStart(dateStr);
      const isCurrentWeek = weekStart === currentWeekStart;
      
      // Higher probability for current week to ensure visibility in leaderboard
      const prob = isCurrentWeek ? Math.max(SEED_ENTRY_PROB, 0.85) : SEED_ENTRY_PROB;
      if (!maybe(prob)) continue;
      
      dailyEntries.push(buildRandomEntry(profile.id, dateStr, ageBracket));
      const key = `${profile.id}:${weekStart}`;
      if (!weekWeights.has(key)) {
        const wiggle = randFloat(-1.5, 1.5, 2);
        weekWeights.set(key, { user_id: profile.id, week_start: weekStart, weight_kg: Math.max(40, Math.min(200, baseWeight + wiggle)) });
      }
    }
    
    // Ensure at least 3 entries in current week for each user
    const currentWeekEntries = dailyEntries.filter(e => 
      e.user_id === profile.id && getWeekStart(e.date) === currentWeekStart
    );
    if (currentWeekEntries.length < 3) {
      for (let dayOffset = 1; dayOffset <= 7 && currentWeekEntries.length < 3; dayOffset++) {
        const d = new Date(today);
        d.setDate(d.getDate() - dayOffset);
        const dateStr = dateToYMD(d);
        if (dateStr < dateToYMD(today) && getWeekStart(dateStr) === currentWeekStart) {
          const existing = dailyEntries.find(e => e.user_id === profile.id && e.date === dateStr);
          if (!existing) {
            dailyEntries.push(buildRandomEntry(profile.id, dateStr, ageBracket));
            const weekStart = getWeekStart(dateStr);
            const key = `${profile.id}:${weekStart}`;
            if (!weekWeights.has(key)) {
              const wiggle = randFloat(-1.5, 1.5, 2);
              weekWeights.set(key, { user_id: profile.id, week_start: weekStart, weight_kg: Math.max(40, Math.min(200, baseWeight + wiggle)) });
            }
          }
        }
      }
    }
  }

  console.log(`Generated ${dailyEntries.length} daily entries and ${weekWeights.size} weekly weigh-ins.`);

  // Insert daily_entries in batches
  const BATCH = 100;
  for (let i = 0; i < dailyEntries.length; i += BATCH) {
    const batch = dailyEntries.slice(i, i + BATCH);
    const { error: eError } = await supabase.from('daily_entries').upsert(batch, {
      onConflict: 'user_id,date',
      ignoreDuplicates: false,
    });
    if (eError) {
      console.error('Error inserting daily_entries batch:', eError);
      process.exit(1);
    }
    console.log(`  Inserted daily_entries ${i + 1}-${Math.min(i + BATCH, dailyEntries.length)}`);
  }

  const weighIns = Array.from(weekWeights.values());
  for (let i = 0; i < weighIns.length; i += BATCH) {
    const batch = weighIns.slice(i, i + BATCH);
    const { error: wError } = await supabase.from('weekly_weigh_ins').upsert(batch, {
      onConflict: 'user_id,week_start',
      ignoreDuplicates: false,
    });
    if (wError) {
      console.error('Error inserting weekly_weigh_ins:', wError);
      process.exit(1);
    }
  }
  console.log(`Inserted ${weighIns.length} weekly weigh-ins.`);

  // Build streaks from consecutive days with entries (per user)
  const streaks = [];
  const byUser = new Map();
  for (const e of dailyEntries) {
    if (!byUser.has(e.user_id)) byUser.set(e.user_id, []);
    byUser.get(e.user_id).push(e.date);
  }
  for (const [userId, dates] of byUser) {
    const sorted = [...new Set(dates)].sort();
    let runStart = sorted[0];
    let runEnd = sorted[0];
    for (let i = 1; i < sorted.length; i++) {
      const prev = new Date(sorted[i - 1]);
      const curr = new Date(sorted[i]);
      prev.setDate(prev.getDate() + 1);
      if (dateToYMD(prev) === sorted[i]) {
        runEnd = sorted[i];
      } else {
        if (runStart !== runEnd || sorted.length > 1) {
          streaks.push({
            user_id: userId,
            start_date: runStart,
            end_date: runEnd,
            bonus_awarded: 0,
          });
        }
        runStart = sorted[i];
        runEnd = sorted[i];
      }
    }
    if (runStart) {
      streaks.push({
        user_id: userId,
        start_date: runStart,
        end_date: runEnd,
        bonus_awarded: 0,
      });
    }
  }

  if (streaks.length > 0) {
    const { error: sError } = await supabase.from('streaks').insert(streaks);
    if (sError) {
      console.warn('Note: Could not insert streaks (may conflict with existing):', sError.message);
    } else {
      console.log(`Inserted ${streaks.length} streak record(s).`);
    }
  }

  // Optionally update profile.current_weight from latest weigh-in
  for (const profile of profiles) {
    const userWeighIns = weighIns.filter((w) => w.user_id === profile.id).sort((a, b) => b.week_start.localeCompare(a.week_start));
    if (userWeighIns.length > 0) {
      await supabase.from('profiles').update({ current_weight: userWeighIns[0].weight_kg }).eq('id', profile.id);
    }
  }
  console.log('Updated profile current_weight from latest weigh-ins.');

  console.log('\nDone. You can clean up later with: node scripts/cleanup-dummy-data.js');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
