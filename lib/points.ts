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

/** Streak bonus points by milestone (awarded on the day milestone is hit) */
export const STREAK_BONUSES: Record<number, number> = {
  7: 25,
  14: 50,
  21: 75,
  30: 150,
};
export const STREAK_BONUS_AFTER_30 = 150;

export function getStreakBonusForLength(days: number): number {
  if (days >= 30) {
    const extra = Math.floor((days - 30) / 30) * STREAK_BONUS_AFTER_30;
    return STREAK_BONUSES[30] + extra;
  }
  return STREAK_BONUSES[days] ?? 0;
}
