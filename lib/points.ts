/**
 * Points engine v3 – Effort-rewarding scoring.
 * - Workout (max 25): duration gradient, age-adjusted for 35+
 * - Movement (max 20): cardio + steps (each scales to 20, sum capped at 20)
 * - Sleep (max 15): 5-tier gradient
 * - Nutrition (max 15–30): scales with food_tracking_mode; daily cap 75–90
 * Streak bonuses stack on top of the daily cap.
 */

import type { AgeBracket, FitnessGoal, FoodTrackingMode } from './types';

export interface EntryForPoints {
  workout_done?: boolean | null;
  workout_duration?: number | null;
  cardio_done?: boolean | null;
  cardio_duration?: number | null;
  steps?: number | null;
  water_liters?: number | null;
  protein_meal?: boolean | null;
  protein_qty?: number | null;
  sleep_hours?: number | null;
  calories_kcal?: number | null;
  scored_with_goal?: FitnessGoal | null;
  home_cooked_meals?: number | null;
  junk_food?: boolean | null;
  alcohol?: string | null;
  sleep_quality?: number | null;
}

export interface ProfileDailyGoals {
  goal_water_liters?: number | null;
  goal_sleep_hours?: number | null;
  goal_sleep_hours_min?: number | null;
  goal_sleep_hours_max?: number | null;
  goal_protein_g_day?: number | null;
  goal_calories_day?: number | null;
  food_tracking_mode?: FoodTrackingMode | null;
  fitness_goal?: FitnessGoal | null;
  goal_steps_day?: number | null;
}

export interface ProfileWeeklyGoals {
  goal_workout_days_week?: number | null;
  goal_workout_mins_week?: number | null;
  goal_home_cooked_per_week?: number | null;
}

export const DAILY_CAP_WATER_ONLY = 75;
export const DAILY_CAP_FULL_TRACKING = 90;

/** Daily activity cap from nutrition tracking depth. */
export function getDailyActivityCap(mode?: FoodTrackingMode | null): number {
  return mode == null ? DAILY_CAP_WATER_ONLY : DAILY_CAP_FULL_TRACKING;
}

export function getNutritionCap(mode?: FoodTrackingMode | null): number {
  return mode == null ? 15 : 30;
}

export function getGoalCrushThreshold(mode?: FoodTrackingMode | null): number {
  return Math.floor(getDailyActivityCap(mode) * 0.7);
}

// ── Tier helpers ─────────────────────────────────────────────────────────────

function tierPoints(value: number, tiers: [number, number][]): number {
  for (const [threshold, pts] of tiers) {
    if (value >= threshold) return pts;
  }
  return 0;
}

function getAgeAdj(ageBracket: AgeBracket): number {
  return ageBracket === 'over_35' ? 0.85 : 1.0;
}

// ── Workout (max 25) ─────────────────────────────────────────────────────────

function scoreWorkoutPoints(
  entry: EntryForPoints,
  adj: number,
): number {
  if (!entry.workout_done) return 0;
  const dur = entry.workout_duration ?? 0;
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

// ── Movement (max 20) ────────────────────────────────────────────────────────

function scoreCardioPoints(entry: EntryForPoints, adj: number): number {
  if (!entry.cardio_done) return 0;
  const dur = entry.cardio_duration ?? 0;
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

function scoreStepsPoints(
  steps: number,
  goalStepsDay: number | null | undefined,
  adj: number,
): number {
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

function scoreMovementPoints(
  entry: EntryForPoints,
  adj: number,
  goalStepsDay?: number | null,
): number {
  let cardioPts = 0;
  let stepsPts = 0;
  if (entry.cardio_done) cardioPts = scoreCardioPoints(entry, adj);
  if (entry.steps != null && entry.steps > 0) {
    stepsPts = scoreStepsPoints(entry.steps, goalStepsDay, adj);
  }
  return Math.min(cardioPts + stepsPts, 20);
}

// ── Sleep (max 15) ───────────────────────────────────────────────────────────

function scoreSleepPoints(sleepHours: number | null | undefined): number {
  if (sleepHours == null) return 0;
  if (sleepHours >= 8 && sleepHours < 9) return 15;
  if (sleepHours >= 9) return 13;
  if (sleepHours >= 7) return 12;
  if (sleepHours >= 6) return 7;
  if (sleepHours >= 5) return 3;
  return 0;
}

// ── Nutrition ─────────────────────────────────────────────────────────────────

function scoreWaterPoints(liters: number | null | undefined, maxPts: number): number {
  if (liters == null) return 0;
  if (maxPts === 15) {
    return tierPoints(liters, [
      [3.0, 15],
      [2.5, 12],
      [2.0, 9],
      [1.5, 6],
      [1.0, 3],
    ]);
  }
  // max 10 (both mode)
  return tierPoints(liters, [
    [3.0, 10],
    [2.5, 8],
    [2.0, 6],
    [1.5, 4],
    [1.0, 2],
  ]);
}

function scoreProteinPoints(
  proteinQty: number | null | undefined,
  goalG: number | null | undefined,
  maxPts: number,
): number {
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
    // max 10 (both mode)
    if (pct >= 1.0) return 10;
    if (pct >= 0.75) return 7;
    if (pct >= 0.5) return 5;
    if (pct >= 0.25) return 3;
    return 1;
  }

  // Fixed fallback when no goal set
  if (maxPts === 15) {
    return tierPoints(proteinQty, [
      [120, 15],
      [90, 11],
      [60, 7],
      [30, 4],
      [1, 2],
    ]);
  }
  return tierPoints(proteinQty, [
    [120, 10],
    [90, 7],
    [60, 5],
    [30, 3],
    [1, 1],
  ]);
}

/**
 * Calorie adherence scoring (v3 gradient).
 * Direction-aware per fitness_goal; maxPts is 15 (calories_only) or 10 (both).
 */
function scoreCaloriePoints(
  caloriesKcal: number | null | undefined,
  goalCaloriesDay: number | null | undefined,
  fitnessGoal: FitnessGoal | null | undefined,
  maxPts: number,
): number {
  if (!goalCaloriesDay || !caloriesKcal) return 0;

  const cal = caloriesKcal;
  const target = goalCaloriesDay;
  const goal = fitnessGoal ?? 'stay_active';

  const tiers15: [number, number][] = [
    [0.02, 15],
    [0.05, 12],
    [0.10, 8],
    [0.15, 4],
  ];
  const tiers10: [number, number][] = [
    [0.02, 10],
    [0.05, 8],
    [0.10, 5],
    [0.15, 3],
  ];
  const tiers = maxPts === 15 ? tiers15 : tiers10;

  function bestTier(check: (margin: number) => boolean): number {
    for (const [margin, pts] of tiers) {
      if (check(margin)) return pts;
    }
    return 0;
  }

  if (goal === 'lose_weight') {
    // On target: at or under budget, within margin of target from below
    return bestTier((m) => cal <= target && cal >= target * (1 - m));
  }
  if (goal === 'gain_weight' || goal === 'gain_muscle') {
    return bestTier((m) => cal >= target && cal <= target * (1 + m));
  }
  // stay_active / general_wellness — symmetric
  return bestTier((m) => cal >= target * (1 - m) && cal <= target * (1 + m));
}

function scoreNutritionPoints(
  entry: EntryForPoints,
  profile?: Pick<
    ProfileDailyGoals,
    'goal_protein_g_day' | 'goal_calories_day' | 'food_tracking_mode' | 'fitness_goal'
  >,
): number {
  const mode = profile?.food_tracking_mode ?? null;

  if (mode == null) {
    return Math.min(scoreWaterPoints(entry.water_liters, 15), 15);
  }

  if (mode === 'calories_only') {
    const water = scoreWaterPoints(entry.water_liters, 15);
    const calories = scoreCaloriePoints(
      entry.calories_kcal,
      profile?.goal_calories_day,
      profile?.fitness_goal,
      15,
    );
    return Math.min(water + calories, 30);
  }

  if (mode === 'protein_only') {
    const water = scoreWaterPoints(entry.water_liters, 15);
    const protein = scoreProteinPoints(
      entry.protein_qty,
      profile?.goal_protein_g_day,
      15,
    );
    return Math.min(water + protein, 30);
  }

  if (mode === 'both') {
    const water = scoreWaterPoints(entry.water_liters, 10);
    const protein = scoreProteinPoints(
      entry.protein_qty,
      profile?.goal_protein_g_day,
      10,
    );
    const calories = scoreCaloriePoints(
      entry.calories_kcal,
      profile?.goal_calories_day,
      profile?.fitness_goal,
      10,
    );
    return Math.min(water + protein + calories, 30);
  }

  return Math.min(scoreWaterPoints(entry.water_liters, 15), 15);
}

// ── Category breakdown (for leaderboard display) ─────────────────────────────

export function calculateCategoryBreakdown(
  entry: EntryForPoints,
  ageBracket: AgeBracket,
  profile?: Pick<
    ProfileDailyGoals,
    'goal_protein_g_day' | 'goal_calories_day' | 'food_tracking_mode' | 'fitness_goal' | 'goal_steps_day'
  >,
): { workout: number; movement: number; sleep: number; nutrition: number } {
  const adj = getAgeAdj(ageBracket);
  return {
    workout: scoreWorkoutPoints(entry, adj),
    movement: scoreMovementPoints(entry, adj, profile?.goal_steps_day),
    sleep: scoreSleepPoints(entry.sleep_hours),
    nutrition: scoreNutritionPoints(entry, profile),
  };
}

// ── Main scoring function ─────────────────────────────────────────────────────

export function calculateDailyPoints(
  entry: EntryForPoints,
  ageBracket: AgeBracket,
  profile?: Pick<
    ProfileDailyGoals,
    'goal_protein_g_day' | 'goal_calories_day' | 'food_tracking_mode' | 'fitness_goal' | 'goal_steps_day'
  >,
): number {
  const adj = getAgeAdj(ageBracket);
  const breakdown = calculateCategoryBreakdown(entry, ageBracket, profile);
  const total =
    breakdown.workout + breakdown.movement + breakdown.sleep + breakdown.nutrition;
  const cap = getDailyActivityCap(profile?.food_tracking_mode);
  return Math.min(total, cap);
}

export function getAgeBracket(age: number): AgeBracket {
  if (age < 25) return 'under_25';
  if (age <= 35) return '25_to_35';
  return 'over_35';
}

// ── Streak & goal bonus constants ────────────────────────────────────────────

export const LOGGING_STREAK_BONUSES: Record<number, number> = {
  7: 10,
  14: 20,
  30: 40,
  60: 75,
  90: 100,
};
export const LOGGING_STREAK_BONUS_AFTER_90 = 50;

export const WEEKLY_PERF_BONUS = { partial: 20, full: 50 } as const;

export const GOAL_CRUSH_STREAK_BONUSES: Record<number, number> = {
  3: 15,
  7: 50,
  14: 100,
  30: 150,
};
export const GOAL_CRUSH_BONUS_AFTER_30 = 100;

// ── Streak bonus helpers ──────────────────────────────────────────────────────

/** Bonus awarded on exactly this milestone day (for UI delta messaging). */
export function getLoggingStreakBonus(days: number): number {
  if (days >= 90) {
    const extra = Math.floor((days - 90) / 30) * LOGGING_STREAK_BONUS_AFTER_90;
    return (LOGGING_STREAK_BONUSES[90] ?? 0) + extra;
  }
  return LOGGING_STREAK_BONUSES[days] ?? 0;
}

/** Cumulative logging streak bonus earned at the user's current streak length. */
export function getCumulativeLoggingStreakBonus(days: number): number {
  if (days >= 90) {
    const extra = Math.floor((days - 90) / 30) * LOGGING_STREAK_BONUS_AFTER_90;
    return (LOGGING_STREAK_BONUSES[90] ?? 0) + extra;
  }
  const milestones = Object.keys(LOGGING_STREAK_BONUSES)
    .map(Number)
    .sort((a, b) => b - a);
  for (const m of milestones) {
    if (days >= m) return LOGGING_STREAK_BONUSES[m] ?? 0;
  }
  return 0;
}

export function getGoalCrushStreakBonus(days: number): number {
  if (days >= 30) {
    const extra = Math.floor((days - 30) / 30) * GOAL_CRUSH_BONUS_AFTER_30;
    return (GOAL_CRUSH_STREAK_BONUSES[30] ?? 0) + extra;
  }
  return GOAL_CRUSH_STREAK_BONUSES[days] ?? 0;
}

/** Cumulative goal crush streak bonus at current streak length. */
export function getCumulativeGoalCrushStreakBonus(days: number): number {
  if (days >= 30) {
    const extra = Math.floor((days - 30) / 30) * GOAL_CRUSH_BONUS_AFTER_30;
    return (GOAL_CRUSH_STREAK_BONUSES[30] ?? 0) + extra;
  }
  const milestones = Object.keys(GOAL_CRUSH_STREAK_BONUSES)
    .map(Number)
    .sort((a, b) => b - a);
  for (const m of milestones) {
    if (days >= m) return GOAL_CRUSH_STREAK_BONUSES[m] ?? 0;
  }
  return 0;
}

// ── Goal evaluation ───────────────────────────────────────────────────────────

/**
 * Goal crush day: score >= 70% of user's daily cap + 3 of 4 categories contributed.
 */
export function isGoalCrushDay(
  entry: EntryForPoints,
  profile: ProfileDailyGoals,
  dailyPoints: number,
): boolean {
  const threshold = getGoalCrushThreshold(profile.food_tracking_mode);
  if (dailyPoints < threshold) return false;

  let categoriesWithPoints = 0;
  if (entry.workout_done) categoriesWithPoints++;
  if (entry.cardio_done || (entry.steps != null && entry.steps > 0)) categoriesWithPoints++;
  if (entry.sleep_hours != null && entry.sleep_hours >= 5) categoriesWithPoints++;
  const hasNutrition =
    (entry.water_liters != null && entry.water_liters > 0) ||
    (entry.protein_qty != null && entry.protein_qty > 0) ||
    (entry.calories_kcal != null && entry.calories_kcal > 0);
  if (hasNutrition) categoriesWithPoints++;

  return categoriesWithPoints >= 3;
}

// ── Goal adherence percent ────────────────────────────────────────────────────

export function computeGoalAdherencePct(
  entry: EntryForPoints,
  profile: ProfileDailyGoals,
): number {
  const checks: boolean[] = [];
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

  const mode = food_tracking_mode ?? null;
  const trackProtein = mode === 'protein_only' || mode === 'both';
  const trackCalories = mode === 'calories_only' || mode === 'both';

  if (goal_water_liters) {
    checks.push(!!(entry.water_liters && entry.water_liters >= goal_water_liters));
  }

  if (goal_sleep_hours != null) {
    checks.push(!!(entry.sleep_hours != null && entry.sleep_hours >= goal_sleep_hours));
  } else if (goal_sleep_hours_min != null && goal_sleep_hours_max != null) {
    checks.push(!!(
      entry.sleep_hours != null &&
      entry.sleep_hours >= goal_sleep_hours_min &&
      entry.sleep_hours <= goal_sleep_hours_max
    ));
  }

  if (trackProtein && goal_protein_g_day) {
    checks.push(!!(entry.protein_qty != null && entry.protein_qty >= goal_protein_g_day));
  }

  if (trackCalories && goal_calories_day) {
    const goal = fitness_goal ?? 'stay_active';
    const cal = entry.calories_kcal;
    if (cal == null) {
      checks.push(false);
    } else if (goal === 'lose_weight') {
      checks.push(cal <= goal_calories_day * 1.10);
    } else if (goal === 'gain_weight') {
      checks.push(cal >= goal_calories_day * 0.85);
    } else if (goal === 'gain_muscle') {
      checks.push(cal >= goal_calories_day * 0.90);
    } else {
      checks.push(true);
    }
  }

  if (checks.length === 0) return 0;
  const hit = checks.filter(Boolean).length;
  return Math.round((hit / checks.length) * 100);
}

export type WeeklyGoalResult = 'full' | 'partial' | 'none';

export function isWeeklyGoalHit(
  weekEntries: EntryForPoints[],
  profile: ProfileWeeklyGoals,
): WeeklyGoalResult {
  const { goal_workout_days_week, goal_workout_mins_week } = profile;
  const goals = [goal_workout_days_week, goal_workout_mins_week].filter(Boolean);

  if (goals.length === 0) return 'none';

  const workoutDays = weekEntries.filter(e => e.workout_done || e.cardio_done).length;
  const workoutMins = weekEntries.reduce(
    (sum, e) => sum + (e.workout_duration ?? 0) + (e.cardio_duration ?? 0),
    0,
  );

  let met = 0;
  let total = 0;

  if (goal_workout_days_week) {
    total++;
    if (workoutDays >= goal_workout_days_week) met++;
  }
  if (goal_workout_mins_week) {
    total++;
    if (workoutMins >= goal_workout_mins_week) met++;
  }

  if (met === 0) return 'none';
  if (met === total) return 'full';
  return 'partial';
}
