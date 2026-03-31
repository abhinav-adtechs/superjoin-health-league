import type { FitnessGoal } from './types';

/**
 * Daily protein recommendation as grams per kg body weight, by primary fitness goal.
 * Same basis as goal UI suggestions and scoring targets.
 */
export const PROTEIN_G_PER_KG_BY_GOAL: Record<FitnessGoal, number> = {
  gain_muscle: 2.0,
  gain_weight: 1.8,
  lose_weight: 1.8,
  stay_active: 1.4,
  general_wellness: 1.2,
};

const GOAL_SHORT: Record<FitnessGoal, string> = {
  lose_weight: 'cutting',
  gain_muscle: 'muscle gain',
  gain_weight: 'weight gain',
  stay_active: 'maintenance / active',
  general_wellness: 'wellness',
};

export function recommendedProteinGDay(weightKg: number, fitnessGoal: FitnessGoal): number {
  const w = Number.isFinite(weightKg) && weightKg > 0 ? weightKg : 70;
  return Math.round(w * PROTEIN_G_PER_KG_BY_GOAL[fitnessGoal]);
}

/** One-line helper for forms: shows g/kg × kg → g/day. */
export function formatProteinRecommendationLine(
  weightKg: number,
  fitnessGoal: FitnessGoal,
): string {
  const w = Number.isFinite(weightKg) && weightKg > 0 ? weightKg : 70;
  const gPerKg = PROTEIN_G_PER_KG_BY_GOAL[fitnessGoal];
  const grams = Math.round(w * gPerKg);
  return `Recommended: ~${grams} g/day (${gPerKg} g/kg × ${w} kg body weight — typical for ${GOAL_SHORT[fitnessGoal]}).`;
}
