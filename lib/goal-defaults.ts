import type { FitnessGoal } from './types';

/** Litres per day — higher for training / surplus goals, moderate for maintenance & wellness */
export const RECOMMENDED_WATER_LITERS_BY_GOAL: Record<FitnessGoal, number> = {
  lose_weight: 3.0,
  gain_muscle: 3.0,
  gain_weight: 3.5,
  stay_active: 2.5,
  general_wellness: 2.5,
};

/** Hours per night — recovery-focused goals bias slightly higher */
export const RECOMMENDED_SLEEP_HOURS_BY_GOAL: Record<FitnessGoal, number> = {
  lose_weight: 8,
  gain_muscle: 8,
  gain_weight: 8,
  stay_active: 7,
  general_wellness: 7,
};

/** Matches `profiles.goal_workout_mins_week` CHECK in the database */
export const GOAL_WORKOUT_MINS_WEEK_MAX = 600;

/** Clamp weekly workout minutes to DB-allowed range (0–600) or null */
export function clampGoalWorkoutMinsWeek(value: number): number {
  const rounded = Math.round(value);
  return Math.min(GOAL_WORKOUT_MINS_WEEK_MAX, Math.max(0, rounded));
}

/** Total training minutes per week */
export const RECOMMENDED_WORKOUT_MINS_WEEK_BY_GOAL: Record<FitnessGoal, number> = {
  lose_weight: 200,
  gain_muscle: 240,
  gain_weight: 180,
  stay_active: 150,
  general_wellness: 120,
};

/** Training days per week */
export const RECOMMENDED_WORKOUT_DAYS_WEEK_BY_GOAL: Record<FitnessGoal, number> = {
  lose_weight: 5,
  gain_muscle: 4,
  gain_weight: 3,
  stay_active: 4,
  general_wellness: 3,
};

/** Calorie suggestion in kcal/kg body weight (used with weight for daily calorie target) */
export const CALORIE_MULTIPLIERS_PER_KG: Record<FitnessGoal, number> = {
  lose_weight: 27,
  gain_muscle: 33,
  gain_weight: 35,
  stay_active: 31,
  general_wellness: 31,
};

export function formatMinsAsHoursMinutes(total: number): string {
  const h = Math.floor(total / 60);
  const m = total % 60;
  if (h === 0) return `${m} min`;
  if (m === 0) return `${h} h`;
  return `${h} h ${m} min`;
}

function waterLitersDisplay(L: number): string {
  return Number.isInteger(L) ? String(L) : L.toFixed(1);
}

/** UI line under water field */
export function formatRecommendedWaterLine(goal: FitnessGoal, goalLabel: string): string {
  const L = RECOMMENDED_WATER_LITERS_BY_GOAL[goal];
  return `Recommended for ${goalLabel}: ~${waterLitersDisplay(L)} L/day`;
}

/** UI line under sleep field */
export function formatRecommendedSleepLine(goal: FitnessGoal, goalLabel: string): string {
  const h = RECOMMENDED_SLEEP_HOURS_BY_GOAL[goal];
  const suffix = h % 1 === 0 ? `${h}` : h.toFixed(1);
  return `Recommended for ${goalLabel}: ~${suffix} h/night`;
}

/** UI line under workout duration + days (single summary) */
export function formatRecommendedWorkoutSummaryLine(goal: FitnessGoal, goalLabel: string): string {
  const mins = RECOMMENDED_WORKOUT_MINS_WEEK_BY_GOAL[goal];
  const days = RECOMMENDED_WORKOUT_DAYS_WEEK_BY_GOAL[goal];
  const vol = formatMinsAsHoursMinutes(mins);
  return `Recommended for ${goalLabel}: ~${vol}/week total · ~${days} days/week`;
}

/** Weekly volume only (for separate duration field) */
export function formatRecommendedWorkoutWeeklyVolumeLine(goal: FitnessGoal, goalLabel: string): string {
  const mins = RECOMMENDED_WORKOUT_MINS_WEEK_BY_GOAL[goal];
  return `Recommended for ${goalLabel}: ~${formatMinsAsHoursMinutes(mins)}/week total`;
}

/** Days/week only (for separate days field) */
export function formatRecommendedWorkoutDaysLine(goal: FitnessGoal, goalLabel: string): string {
  const days = RECOMMENDED_WORKOUT_DAYS_WEEK_BY_GOAL[goal];
  return `Recommended for ${goalLabel}: ~${days} days/week`;
}

/** Split recommended weekly minutes into hour + minute fields */
export function recommendedWorkoutHoursMinsParts(goal: FitnessGoal): { hours: number; mins: number } {
  const total = RECOMMENDED_WORKOUT_MINS_WEEK_BY_GOAL[goal];
  return { hours: Math.floor(total / 60), mins: total % 60 };
}
