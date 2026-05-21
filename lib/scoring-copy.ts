/**
 * User-facing copy for scoring v3 — keep in sync with lib/points.ts.
 */

import type { FitnessGoal, FoodTrackingMode } from './types';
import { DAILY_CAP_FULL_TRACKING, DAILY_CAP_WATER_ONLY, getNutritionCap } from './points';

export { DAILY_CAP_WATER_ONLY, DAILY_CAP_FULL_TRACKING };

export const FOOD_MODE_SETUP_OPTIONS: {
  value: FoodTrackingMode;
  label: string;
  description: string;
}[] = [
  {
    value: 'protein_only',
    label: 'Track protein + water',
    description: 'Up to 15 pts water + 15 pts protein (gradient tiers). Unlocks 90 pts/day.',
  },
  {
    value: 'calories_only',
    label: 'Track calories + water',
    description: 'Up to 15 pts each. Calorie tiers ±2–15% (ideal for cutting/bulking). 90 pts/day.',
  },
  {
    value: 'both',
    label: 'Track protein, calories & water',
    description: '10 pts per metric (30 nutrition total). Best for detailed logging. 90 pts/day.',
  },
];

export const FOOD_MODE_LABELS_SHORT: Record<FoodTrackingMode, string> = {
  protein_only: 'Protein + water',
  calories_only: 'Calories + water',
  both: 'Protein + calories + water',
};

/** One-line summary of nutrition points for the user's tracking mode. */
export function foodModePointsSummary(mode: FoodTrackingMode | null | undefined): string {
  if (mode == null) {
    return `Water only — up to ${getNutritionCap(null)} nutrition pts. Daily cap ${DAILY_CAP_WATER_ONLY}.`;
  }
  const nutritionMax = getNutritionCap(mode);
  if (mode === 'protein_only') {
    return `Water (15) + protein (15) = ${nutritionMax} nutrition pts. Daily cap ${DAILY_CAP_FULL_TRACKING}.`;
  }
  if (mode === 'calories_only') {
    return `Water (15) + calories (15) = ${nutritionMax} nutrition pts. Daily cap ${DAILY_CAP_FULL_TRACKING}.`;
  }
  return `Water (10) + protein (10) + calories (10) = ${nutritionMax} nutrition pts. Daily cap ${DAILY_CAP_FULL_TRACKING}.`;
}

export const FITNESS_GOAL_POINTS_HINTS: Record<
  FitnessGoal,
  { calorieModeLabel: string; calorieModeHint: string; scoring: string }
> = {
  lose_weight: {
    calorieModeLabel: 'Calorie deficit',
    calorieModeHint:
      'Calories: up to 15 pts when within ±2–15% at or under your budget (calories_only / both).',
    scoring:
      'Effort-based v3: longer workouts earn more (up to 25 pts). Track calories + water for 90 pts/day.',
  },
  gain_muscle: {
    calorieModeLabel: 'Calorie surplus',
    calorieModeHint:
      'Protein tiers up to 15 pts; calories up to 15 (or 10 in “both” mode) at or above target.',
    scoring:
      'Effort-based v3: workout duration + steps/cardio gradients. “Both” tracking = 90 pts/day cap.',
  },
  gain_weight: {
    calorieModeLabel: 'Calorie surplus',
    calorieModeHint:
      'Calories: gradient pts for meeting or exceeding target (±2–15%). Water always scored.',
    scoring:
      'Effort-based v3: partial credit for steps, sleep, and nutrition. Full tracking = 90 pts/day.',
  },
  stay_active: {
    calorieModeLabel: 'Flexible nutrition',
    calorieModeHint:
      'Water + protein and/or calories — partial tiers reward logging, not perfection.',
    scoring:
      'Effort-based v3: 75 pts/day (water only) or 90 with protein/calorie tracking.',
  },
  general_wellness: {
    calorieModeLabel: 'Balanced habits',
    calorieModeHint:
      'Hydration, sleep gradients, and optional macros — points scale with what you log.',
    scoring:
      'Effort-based v3: show up across categories; goal crush = 70% of your cap + 3 categories.',
  },
};

export const V3_CATEGORY_SUMMARY =
  'Workout 25 · Movement 20 · Sleep 15 · Nutrition 15–30 (by tracking mode)';
