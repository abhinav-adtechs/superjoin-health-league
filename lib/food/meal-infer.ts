import { MEAL_TYPES, type MealType } from './types';

export function normalizeMealType(raw: unknown): MealType | undefined {
  if (typeof raw !== 'string') return undefined;
  const m = raw.trim().toLowerCase();
  return MEAL_TYPES.includes(m as MealType) ? (m as MealType) : undefined;
}

/** Scan full user text for meal cues (breakfast, lunch, etc.). */
export function inferMealTypeFromText(text: string): MealType | undefined {
  const t = text.toLowerCase();
  if (/\b(breakfast|morning)\b/.test(t)) return 'breakfast';
  if (/\b(brunch)\b/.test(t)) return 'brunch';
  if (/\b(lunch|noon|afternoon)\b/.test(t)) return 'lunch';
  if (/\b(snack|tea time|chai time)\b/.test(t)) return 'snack';
  if (/\b(dinner|supper|night)\b/.test(t)) return 'dinner';
  return undefined;
}

function inferMealTypeFromClock(): MealType {
  const h = new Date().getHours();
  if (h >= 5 && h < 11) return 'breakfast';
  if (h >= 11 && h < 15) return 'lunch';
  if (h >= 15 && h < 17) return 'snack';
  if (h >= 17 && h < 23) return 'dinner';
  return 'snack';
}

/** Resolve meal_type for a parsed line (model output → text cues → time of day). */
export function resolveMealTypeForParsedItem(
  itemMeal: unknown,
  fullUserText: string,
): MealType {
  return (
    normalizeMealType(itemMeal) ??
    inferMealTypeFromText(fullUserText) ??
    inferMealTypeFromClock()
  );
}
