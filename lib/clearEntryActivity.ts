/**
 * Clear a single activity slice from a daily entry row (server + client labels).
 * Mirrors visibility rules in LogEntryTab (movement / nutrition / hydration / sleep).
 */

export const CLEAR_ACTIVITY_KEYS = [
  'strength',
  'cardio',
  'steps',
  'water',
  'protein',
  'calories',
  'junk',
  'alcohol',
  'home_cooked',
  'sleep',
  'meals_log',
] as const;

export type ClearActivityKey = (typeof CLEAR_ACTIVITY_KEYS)[number];

/** Short labels for confirm dialogs and aria-labels */
export const CLEAR_ACTIVITY_LABELS: Record<ClearActivityKey, string> = {
  strength: 'Strength',
  cardio: 'Cardio',
  steps: 'Steps',
  water: 'Water',
  protein: 'Protein',
  calories: 'Calories',
  junk: 'Junk food',
  alcohol: 'Alcohol',
  home_cooked: 'Home-cooked meals',
  sleep: 'Sleep',
  meals_log: 'Meals log',
};

export function isClearActivityKey(v: unknown): v is ClearActivityKey {
  return typeof v === 'string' && (CLEAR_ACTIVITY_KEYS as readonly string[]).includes(v);
}

/** Row shape from daily_entries — loose for JSON/Supabase. */
export type DailyEntryRow = Record<string, unknown>;

export function applyClearActivity(existing: DailyEntryRow, activity: ClearActivityKey): DailyEntryRow {
  const entry: DailyEntryRow = { ...existing };

  switch (activity) {
    case 'strength':
      entry.workout_done = false;
      entry.workout_duration = null;
      entry.workout_types = [];
      break;
    case 'cardio':
      entry.cardio_done = false;
      entry.cardio_duration = null;
      entry.cardio_type = null;
      break;
    case 'steps':
      entry.steps = null;
      break;
    case 'water':
      entry.water_liters = null;
      break;
    case 'protein':
      entry.protein_meal = false;
      entry.protein_qty = null;
      break;
    case 'calories':
      entry.calories_kcal = null;
      break;
    case 'junk':
      entry.junk_food = null;
      break;
    case 'alcohol':
      entry.alcohol = null;
      break;
    case 'home_cooked':
      entry.home_cooked_meals = null;
      break;
    case 'sleep':
      entry.sleep_hours = null;
      entry.sleep_quality = null;
      break;
    case 'meals_log':
      entry.meals_log = null;
      break;
  }

  if (entry.workout_done === false) {
    entry.workout_duration = null;
    entry.workout_types = [];
  }
  if (entry.cardio_done === false) {
    entry.cardio_duration = null;
    entry.cardio_type = null;
  }
  if (entry.workout_types != null && !Array.isArray(entry.workout_types)) {
    entry.workout_types = [];
  }
  const pq = entry.protein_qty != null ? Number(entry.protein_qty) : 0;
  if (pq > 0) {
    entry.protein_meal = true;
  }

  return entry;
}

function mealsLogNonEmpty(meals_log: unknown): boolean {
  if (meals_log == null) return false;
  if (Array.isArray(meals_log)) return meals_log.length > 0;
  if (typeof meals_log === 'object') return Object.keys(meals_log as object).length > 0;
  return true;
}

/** Align with LogEntryTab hasMovement / hasNutrition / hasHydration / hasSleepLog + meals_log. */
export function isDailyEntryEmpty(e: DailyEntryRow): boolean {
  if (e.workout_done === true || e.cardio_done === true) return false;
  if (e.steps != null && Number(e.steps) > 0) return false;
  if (e.water_liters != null && Number(e.water_liters) > 0) return false;
  if (e.sleep_hours != null && Number(e.sleep_hours) > 0) return false;

  if (Number(e.protein_qty ?? 0) > 0 || e.protein_meal === true) return false;
  if (Number(e.calories_kcal ?? 0) > 0) return false;
  if (e.junk_food != null) return false;
  if (e.alcohol != null) return false;
  if (Number(e.home_cooked_meals ?? 0) > 0) return false;
  if (mealsLogNonEmpty(e.meals_log)) return false;

  return true;
}
