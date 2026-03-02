/**
 * Points engine per PRD §3.
 * Points only for healthy actions; null/skip = 0. Age bracket over_35 uses 85% thresholds for steps/cardio.
 */

import type { AgeBracket } from './types';

export interface EntryForPoints {
  workout_done?: boolean | null;
  workout_duration?: number | null;
  cardio_done?: boolean | null;
  cardio_duration?: number | null;
  steps?: number | null;
  water_liters?: number | null;
  home_cooked_meals?: number | null;
  protein_meal?: boolean | null;
  protein_qty?: number | null;
  junk_food?: boolean | null;
  alcohol?: string | null;
  sleep_hours?: number | null;
  sleep_quality?: number | null;
}

export interface ProfileDailyGoals {
  goal_steps_day?: number | null;
  goal_water_liters?: number | null;
  goal_sleep_hours_min?: number | null;
  goal_sleep_hours_max?: number | null;
}

export interface ProfileWeeklyGoals {
  goal_workout_days_week?: number | null;
  goal_workout_mins_week?: number | null;
  goal_home_cooked_per_week?: number | null;
}

export function calculateDailyPoints(entry: EntryForPoints, ageBracket: AgeBracket): number {
  let points = 0;
  const adj = ageBracket === 'over_35' ? 0.85 : 1.0;

  // Workout (max 20)
  if (entry.workout_done) {
    points += 10;
    if (entry.workout_duration != null && entry.workout_duration >= 45) points += 5;
    if (entry.workout_duration != null && entry.workout_duration >= 60) points += 5;
  }

  // Cardio (max 15)
  if (entry.cardio_done) {
    points += 10;
    const threshold = 30 * adj;
    if (entry.cardio_duration != null && entry.cardio_duration >= threshold) points += 5;
  }

  // Sleep (max 15)
  if (entry.sleep_hours != null) {
    if (entry.sleep_hours >= 7 && entry.sleep_hours <= 9) points += 10;
    else if (entry.sleep_hours >= 6 && entry.sleep_hours < 7) points += 5;
  }
  if (entry.sleep_quality != null && entry.sleep_quality >= 4) points += 5;

  // Nutrition (max 33)
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

  // Steps (max 15) — over_35: 10000→8500, 7500→6375, 5000→4250
  if (entry.steps != null) {
    const stepThresholds: [number, number][] = [
      [10000 * adj, 15],
      [7500 * adj, 10],
      [5000 * adj, 5],
    ];
    for (const [threshold, pts] of stepThresholds) {
      if (entry.steps! >= threshold) {
        points += pts;
        break;
      }
    }
  }

  return Math.min(points, 98); // cap ~98 daily
}

export function getAgeBracket(age: number): AgeBracket {
  if (age < 25) return 'under_25';
  if (age <= 35) return '25_to_35';
  return 'over_35';
}

// ── Streak & goal bonus constants ────────────────────────────────────────────

/**
 * Logging Streak — just showing up and logging any entry.
 * Small bonuses; rewards the habit of tracking.
 */
export const LOGGING_STREAK_BONUSES: Record<number, number> = {
  7: 10,
  14: 20,
  30: 40,
  60: 75,
  90: 100,
};
export const LOGGING_STREAK_BONUS_AFTER_90 = 50;

/**
 * Weekly Performance — hitting profile weekly goals (workout days/mins, home-cooked meals).
 * Evaluated once per completed week. Partial credit if only some goals are met.
 * No bonus if user has set no weekly goals.
 */
export const WEEKLY_PERF_BONUS = { partial: 20, full: 50 } as const;

/**
 * Goal Crush Streak — consecutive days hitting all set personal daily goals.
 * Larger bonuses; rewards sustained daily performance.
 */
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
 * Falls back to dailyPoints >= 60 if no daily goals are configured.
 *
 * Daily goals: steps, water, sleep hours range.
 */
export function isGoalCrushDay(
  entry: EntryForPoints,
  profile: ProfileDailyGoals,
  dailyPoints: number,
): boolean {
  const { goal_steps_day, goal_water_liters, goal_sleep_hours_min, goal_sleep_hours_max } = profile;
  const hasDailyGoals = goal_steps_day || goal_water_liters || (goal_sleep_hours_min && goal_sleep_hours_max);

  if (!hasDailyGoals) {
    return dailyPoints >= 60;
  }

  if (goal_steps_day && (!entry.steps || entry.steps < goal_steps_day)) return false;
  if (goal_water_liters && (!entry.water_liters || entry.water_liters < goal_water_liters)) return false;
  if (goal_sleep_hours_min && goal_sleep_hours_max) {
    if (
      entry.sleep_hours == null ||
      entry.sleep_hours < goal_sleep_hours_min ||
      entry.sleep_hours > goal_sleep_hours_max
    ) return false;
  }

  return true;
}

export type WeeklyGoalResult = 'full' | 'partial' | 'none';

/**
 * Evaluates whether the user hit their weekly profile goals across a set of entries.
 * Returns 'full' (all set goals met), 'partial' (some met), or 'none' (no goals set or none met).
 *
 * Weekly goals: workout days, workout minutes, home-cooked meals per week.
 */
export function isWeeklyGoalHit(
  weekEntries: EntryForPoints[],
  profile: ProfileWeeklyGoals,
): WeeklyGoalResult {
  const { goal_workout_days_week, goal_workout_mins_week, goal_home_cooked_per_week } = profile;
  const goals = [goal_workout_days_week, goal_workout_mins_week, goal_home_cooked_per_week].filter(Boolean);

  if (goals.length === 0) return 'none';

  const workoutDays = weekEntries.filter(e => e.workout_done || e.cardio_done).length;
  const workoutMins = weekEntries.reduce((sum, e) => sum + (e.workout_duration ?? 0) + (e.cardio_duration ?? 0), 0);
  const homeCookedDays = weekEntries.filter(e => e.home_cooked_meals != null && e.home_cooked_meals >= 1).length;

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
  if (goal_home_cooked_per_week) {
    total++;
    if (homeCookedDays >= goal_home_cooked_per_week) met++;
  }

  if (met === 0) return 'none';
  if (met === total) return 'full';
  return 'partial';
}
