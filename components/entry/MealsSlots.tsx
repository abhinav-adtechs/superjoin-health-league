'use client';

import { UtensilsCrossed, Pizza } from 'lucide-react';

export type MealName = 'breakfast' | 'brunch' | 'lunch' | 'snack' | 'dinner';
export type MealSlotType = '' | 'home_cooked' | 'junk';
export type MealsLog = Record<MealName, MealSlotType>;

export const MEAL_NAMES: MealName[] = ['breakfast', 'brunch', 'lunch', 'snack', 'dinner'];

const MEAL_META: Record<MealName, { emoji: string; label: string; short: string }> = {
  breakfast: { emoji: '🌅', label: 'Breakfast', short: 'Bkfst' },
  brunch:    { emoji: '☕', label: 'Brunch',    short: 'Brunch' },
  lunch:     { emoji: '🌤️', label: 'Lunch',     short: 'Lunch' },
  snack:     { emoji: '🍎', label: 'Snack',     short: 'Snack' },
  dinner:    { emoji: '🌙', label: 'Dinner',    short: 'Dinner' },
};

export const EMPTY_MEALS_LOG: MealsLog = {
  breakfast: '',
  brunch: '',
  lunch: '',
  snack: '',
  dinner: '',
};

function cycleSlot(current: MealSlotType): MealSlotType {
  if (current === '') return 'home_cooked';
  if (current === 'home_cooked') return 'junk';
  return '';
}

interface MealsSlotsProps {
  meals: MealsLog;
  onChange: (meals: MealsLog) => void;
  className?: string;
}

export function MealsSlots({ meals, onChange, className = '' }: MealsSlotsProps) {
  const handleTap = (name: MealName) => {
    onChange({ ...meals, [name]: cycleSlot(meals[name]) });
  };

  return (
    <div className={className}>
      <div className="flex items-center justify-between mb-2">
        <p className="text-sm font-medium text-text-secondary">Meals</p>
        <p className="text-[10px] text-text-muted">Tap: skip → 🏠 home → 🍕 junk</p>
      </div>
      <div className="grid grid-cols-5 gap-1.5">
        {MEAL_NAMES.map((name) => {
          const type = meals[name];
          const { emoji, short } = MEAL_META[name];
          return (
            <button
              key={name}
              type="button"
              onClick={() => handleTap(name)}
              className={`min-h-[62px] rounded-xl border-2 flex flex-col items-center justify-center gap-0.5 p-1.5 transition-all touch-manipulation ${
                type === 'home_cooked'
                  ? 'border-accent-green bg-accent-green/10 text-accent-green'
                  : type === 'junk'
                    ? 'border-accent-gold bg-accent-gold/10 text-accent-gold'
                    : 'border-black/10 bg-surface-0/50 text-text-muted hover:border-black/20'
              }`}
              aria-label={`${MEAL_META[name].label}: ${type || 'not logged'}`}
            >
              <span className="text-base leading-none">{emoji}</span>
              <span className="text-[9px] font-semibold uppercase leading-tight text-center">{short}</span>
              {type === 'home_cooked' && <UtensilsCrossed className="w-3 h-3" />}
              {type === 'junk' && <Pizza className="w-3 h-3" />}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function mealsToCounts(meals: MealsLog): {
  home_cooked_meals: number;
  junk_food: boolean;
  meals_log: MealsLog;
} {
  let home_cooked_meals = 0;
  let junk_food = false;
  for (const v of Object.values(meals)) {
    if (v === 'home_cooked') home_cooked_meals++;
    if (v === 'junk') junk_food = true;
  }
  return { home_cooked_meals, junk_food, meals_log: meals };
}

export function mealsFromExisting(
  mealsLogJson: unknown,
  home_cooked_meals: number,
  junk_food: boolean,
): MealsLog {
  // Prefer stored meals_log (named data)
  if (mealsLogJson && typeof mealsLogJson === 'object' && !Array.isArray(mealsLogJson)) {
    const log = mealsLogJson as Record<string, string>;
    const result = { ...EMPTY_MEALS_LOG };
    for (const name of MEAL_NAMES) {
      const v = log[name];
      if (v === 'home_cooked' || v === 'junk') result[name] = v;
    }
    return result;
  }
  // Fall back: reconstruct order from counts
  const result = { ...EMPTY_MEALS_LOG };
  let h = home_cooked_meals;
  for (const name of MEAL_NAMES) {
    if (h > 0) { result[name] = 'home_cooked'; h--; }
  }
  if (junk_food) {
    const firstEmpty = MEAL_NAMES.find((n) => result[n] === '');
    if (firstEmpty) result[firstEmpty] = 'junk';
  }
  return result;
}
