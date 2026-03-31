/**
 * Points engine – Goal-centric scoring.
 * - Workout (max 20): workout duration tiers
 * - Movement (max 25): cardio + steps merged
 * - Sleep (max 10): duration only, quality removed
 * - Nutrition (max 26): water + goal-aware protein/calorie
 * Daily cap: 85 pts (streak bonuses stack on top)
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
  // New fields
  calories_kcal?: number | null;
  scored_with_goal?: FitnessGoal | null;
  // Kept for backward compatibility (no longer scored)
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
  // kept for compat
  goal_steps_day?: number | null;
}

export interface ProfileWeeklyGoals {
  goal_workout_days_week?: number | null;
  goal_workout_mins_week?: number | null;
  // kept for compat but no longer used in scoring
  goal_home_cooked_per_week?: number | null;
}

// ── Calorie direction-aware scoring ──────────────────────────────────────────

function caloriePoints(
  caloriesKcal: number | null | undefined,
  goalCaloriesDay: number | null | undefined,
  fitnessGoal: FitnessGoal | null | undefined,
): number {
  if (!goalCaloriesDay || !caloriesKcal) return 0;
  const cal = caloriesKcal;
  const target = goalCaloriesDay;
  const goal = fitnessGoal ?? 'stay_active';

  if (goal === 'lose_weight') {
    if (cal <= target) return 8;
    if (cal <= target * 1.10) return 4;
    return 0;
  }
  if (goal === 'gain_weight') {
    if (cal >= target) return 8;
    if (cal >= target * 0.85) return 4;
    return 0;
  }
  if (goal === 'gain_muscle') {
    if (cal >= target * 0.90) return 8;
    return 0;
  }
  // stay_active / general_wellness: any log earns points
  return 5;
}

// ── Main scoring function ─────────────────────────────────────────────────────

export function calculateDailyPoints(
  entry: EntryForPoints,
  ageBracket: AgeBracket,
  profile?: Pick<ProfileDailyGoals, 'goal_protein_g_day' | 'goal_calories_day' | 'food_tracking_mode' | 'fitness_goal'>,
): number {
  let points = 0;
  const adj = ageBracket === 'over_35' ? 0.85 : 1.0;

  // ── Workout (max 20) ──
  if (entry.workout_done) {
    points += 10;
    if (entry.workout_duration != null && entry.workout_duration >= 45) points += 5;
    if (entry.workout_duration != null && entry.workout_duration >= 60) points += 5;
  }
  points = Math.min(points, 20);

  // ── Movement: cardio + steps merged (max 25) ──
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

  // ── Sleep (max 10) — quality removed ──
  if (entry.sleep_hours != null) {
    if (entry.sleep_hours >= 7 && entry.sleep_hours <= 9) points += 10;
    else if (entry.sleep_hours >= 6 && entry.sleep_hours < 7) points += 5;
  }

  // ── Nutrition (max 26) ──
  let nutritionPts = 0;
  // Water (universal)
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
    // Goal-based protein scoring
    if (entry.protein_qty != null && entry.protein_qty >= proteinGoal) nutritionPts += 8;
    else if (entry.protein_qty != null && entry.protein_qty > 0) nutritionPts += 4;
  } else if (!trackCalories) {
    // Legacy fallback when no goals set
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
  30: 200,
};
export const GOAL_CRUSH_BONUS_AFTER_30 = 200;

// ── Streak bonus helpers ──────────────────────────────────────────────────────

export function getLoggingStreakBonus(days: number): number {
  if (days >= 90) {
    const extra = Math.floor((days - 90) / 30) * LOGGING_STREAK_BONUS_AFTER_90;
    return (LOGGING_STREAK_BONUSES[90] ?? 0) + extra;
  }
  return LOGGING_STREAK_BONUSES[days] ?? 0;
}

export function getGoalCrushStreakBonus(days: number): number {
  if (days >= 30) {
    const extra = Math.floor((days - 30) / 30) * GOAL_CRUSH_BONUS_AFTER_30;
    return (GOAL_CRUSH_STREAK_BONUSES[30] ?? 0) + extra;
  }
  return GOAL_CRUSH_STREAK_BONUSES[days] ?? 0;
}

// ── Goal evaluation ───────────────────────────────────────────────────────────

/**
 * Returns true if the entry meets all set daily profile goals.
 * Falls back to dailyPoints >= 60 if no daily goals configured.
 */
export function isGoalCrushDay(
  entry: EntryForPoints,
  profile: ProfileDailyGoals,
  dailyPoints: number,
): boolean {
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

  const hasSleepGoal = goal_sleep_hours != null || (goal_sleep_hours_min != null && goal_sleep_hours_max != null);
  const mode = food_tracking_mode ?? null;
  const trackProtein = !mode || mode === 'protein_only' || mode === 'both';
  const trackCalories = mode === 'calories_only' || mode === 'both';

  const hasDailyGoals = goal_water_liters || hasSleepGoal || (trackProtein && goal_protein_g_day) || (trackCalories && goal_calories_day);

  if (!hasDailyGoals) {
    return dailyPoints >= 60;
  }

  // Water
  if (goal_water_liters && (!entry.water_liters || entry.water_liters < goal_water_liters)) return false;

  // Sleep
  if (goal_sleep_hours != null) {
    if (entry.sleep_hours == null || entry.sleep_hours < goal_sleep_hours) return false;
  } else if (goal_sleep_hours_min != null && goal_sleep_hours_max != null) {
    if (
      entry.sleep_hours == null ||
      entry.sleep_hours < goal_sleep_hours_min ||
      entry.sleep_hours > goal_sleep_hours_max
    ) return false;
  }

  // Protein
  if (trackProtein && goal_protein_g_day) {
    if (!entry.protein_qty || entry.protein_qty < goal_protein_g_day) return false;
  }

  // Calories
  if (trackCalories && goal_calories_day) {
    const goal = fitness_goal ?? 'stay_active';
    const cal = entry.calories_kcal;
    if (cal == null) return false;
    if (goal === 'lose_weight' && cal > goal_calories_day * 1.10) return false;
    if (goal === 'gain_weight' && cal < goal_calories_day * 0.85) return false;
    if (goal === 'gain_muscle' && cal < goal_calories_day * 0.90) return false;
    // stay_active / general_wellness: just needs to be logged (checked above)
  }

  return true;
}

// ── Goal adherence percent ────────────────────────────────────────────────────

/**
 * Computes how many of the user's set personal goals were hit for this entry.
 * Returns a 0-100 score. Counts only goals that are configured.
 */
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
  const trackProtein = !mode || mode === 'protein_only' || mode === 'both';
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

/**
 * Evaluates whether the user hit their weekly profile goals.
 * Returns 'full', 'partial', or 'none'.
 */
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
