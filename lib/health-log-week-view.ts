import type { WorkoutGoalType } from '@/lib/types';
import { parseGoalWorkoutTypes } from '@/lib/workout-goals';

export type EntryRow = {
  date: string;
  workout_done?: boolean | null;
  workout_duration?: number | null;
  workout_types?: string[] | null;
  cardio_done?: boolean | null;
  cardio_duration?: number | null;
  cardio_type?: string | null;
  steps?: number | null;
  water_liters?: number | null;
  home_cooked_meals?: number | null;
  sleep_hours?: number | null;
  sleep_quality?: number | null;
  protein_meal?: boolean | null;
  protein_qty?: number | null;
  calories_kcal?: number | null;
  daily_points?: number | null;
  is_goal_crush_day?: boolean | null;
};

export type ProfileGoals = {
  goal_workout_mins_week?: number | null;
  goal_workout_days_week?: number | null;
  goal_workout_types?: WorkoutGoalType[] | null;
  goal_steps_day?: number | null;
  goal_sleep_hours?: number | null;
  goal_sleep_hours_min?: number | null;
  goal_sleep_hours_max?: number | null;
  goal_water_liters?: number | null;
  goal_home_cooked_per_week?: number | null;
  goal_protein_g_day?: number | null;
  goal_calories_day?: number | null;
  fitness_goal?: string | null;
};

export const COLOR_WORKOUT = '#FF6B35';
export const COLOR_STEPS = '#059669';
export const COLOR_SLEEP = '#2563eb';
export const COLOR_PROTEIN = '#6366f1';
export const COLOR_CALORIES = '#f43f5e';

export function fmtMins(mins: number): string {
  if (mins === 0) return '—';
  if (mins < 60) return `${mins}m`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

export function entryWorkoutMins(e: EntryRow): number {
  const w = e.workout_done && e.workout_duration ? e.workout_duration : 0;
  const c = e.cardio_done && e.cardio_duration ? e.cardio_duration : 0;
  return w + c;
}

export function dayGoalStatus(e: EntryRow, goals: ProfileGoals | null): boolean | null {
  if (e.is_goal_crush_day != null) return e.is_goal_crush_day;
  if (e.daily_points != null && e.daily_points >= 60) return true;
  if (e.daily_points != null && e.daily_points > 0) return false;

  const workoutGoal = (goals?.goal_workout_days_week ?? 0) > 0 || (goals?.goal_workout_mins_week ?? 0) > 0;
  const stepsGoal = (goals?.goal_steps_day ?? 0) > 0;
  const sleepGoal = (goals?.goal_sleep_hours ?? goals?.goal_sleep_hours_min ?? 0) > 0;
  const waterGoal = (goals?.goal_water_liters ?? 0) > 0;

  if (!workoutGoal && !stepsGoal && !sleepGoal && !waterGoal) return null;

  const workoutMet = !workoutGoal || e.workout_done === true || e.cardio_done === true;
  const stepsMet = !stepsGoal || (e.steps ?? 0) >= (goals?.goal_steps_day ?? 0);
  const sleepMet =
    !sleepGoal ||
    (e.sleep_hours != null &&
      (goals?.goal_sleep_hours != null
        ? e.sleep_hours >= goals.goal_sleep_hours
        : e.sleep_hours >= (goals?.goal_sleep_hours_min ?? 0) &&
          (goals?.goal_sleep_hours_max == null || e.sleep_hours <= goals.goal_sleep_hours_max)));
  const waterMet = !waterGoal || (e.water_liters ?? 0) >= (goals?.goal_water_liters ?? 0);

  return workoutMet && stepsMet && sleepMet && waterMet;
}

type CategoryKey = 'workout' | 'steps' | 'sleep' | 'water' | 'protein' | 'calories';

export type WeekViewColumn =
  | { kind: 'workout_agg' }
  | { kind: 'steps' }
  | { kind: 'sleep' }
  | { kind: 'water' }
  | { kind: 'protein' }
  | { kind: 'calories' };

export function buildWeekViewColumns(goals: ProfileGoals | null): WeekViewColumn[] {
  const g = goals ?? {};
  const hasWorkoutGoal = (g.goal_workout_days_week ?? 0) > 0 || (g.goal_workout_mins_week ?? 0) > 0;
  const types = parseGoalWorkoutTypes(g.goal_workout_types);
  const cols: WeekViewColumn[] = [];
  if (hasWorkoutGoal || types.length > 0) cols.push({ kind: 'workout_agg' });
  if ((g.goal_steps_day ?? 0) > 0) cols.push({ kind: 'steps' });
  if ((g.goal_sleep_hours ?? g.goal_sleep_hours_min ?? 0) > 0) cols.push({ kind: 'sleep' });
  if ((g.goal_water_liters ?? 0) > 0) cols.push({ kind: 'water' });
  if ((g.goal_protein_g_day ?? 0) > 0) cols.push({ kind: 'protein' });
  if ((g.goal_calories_day ?? 0) > 0) cols.push({ kind: 'calories' });
  return cols;
}

function categoryStatus(
  e: EntryRow | undefined,
  category: CategoryKey,
  goals: ProfileGoals | null,
  isPastNoEntry = false,
  isPast = false
): { met: boolean | null; value: string } {
  if (!e) return { met: isPastNoEntry ? false : null, value: '—' };

  const notLoggedAsMissed = isPastNoEntry || isPast;

  switch (category) {
    case 'workout': {
      const mins = entryWorkoutMins(e);
      const done = e.workout_done === true || e.cardio_done === true;
      if (!done) return { met: notLoggedAsMissed ? false : null, value: '—' };
      return { met: true, value: mins > 0 ? fmtMins(mins) : '✓' };
    }
    case 'steps': {
      const steps = e.steps ?? 0;
      if (steps === 0) return { met: notLoggedAsMissed ? false : null, value: '—' };
      const goal = goals?.goal_steps_day ?? 0;
      const met = goal > 0 ? steps >= goal : true;
      return { met, value: `${(steps / 1000).toFixed(1)}k` };
    }
    case 'sleep': {
      const sleep = e.sleep_hours ?? 0;
      if (sleep === 0) return { met: notLoggedAsMissed ? false : null, value: '—' };
      const single = goals?.goal_sleep_hours;
      const min = goals?.goal_sleep_hours_min;
      const max = goals?.goal_sleep_hours_max;
      let met: boolean | null = null;
      if (single != null) met = sleep >= single;
      else if (min != null && max != null) met = sleep >= min && sleep <= max;
      else if (min != null) met = sleep >= min;
      else met = true;
      return { met, value: `${sleep}h` };
    }
    case 'water': {
      const water = e.water_liters ?? 0;
      if (water === 0) return { met: notLoggedAsMissed ? false : null, value: '—' };
      const goal = goals?.goal_water_liters ?? 0;
      const met = goal > 0 ? water >= goal : true;
      return { met, value: `${water}L` };
    }
    case 'protein': {
      const qty = e.protein_qty ?? 0;
      const hasMeal = e.protein_meal === true;
      if (qty === 0 && !hasMeal) return { met: notLoggedAsMissed ? false : null, value: '—' };
      const goal = goals?.goal_protein_g_day ?? 0;
      const met = goal > 0 ? qty >= goal : true;
      return { met, value: qty > 0 ? `${qty}g` : '✓' };
    }
    case 'calories': {
      const cal = e.calories_kcal ?? 0;
      if (cal === 0) return { met: notLoggedAsMissed ? false : null, value: '—' };
      const goal = goals?.goal_calories_day ?? 0;
      let met: boolean | null = null;
      if (goal > 0) {
        const isLoseWeight = goals?.fitness_goal === 'lose_weight';
        met = isLoseWeight ? cal <= goal : cal >= goal;
      } else met = true;
      return { met, value: cal >= 1000 ? `${(cal / 1000).toFixed(1)}k` : `${cal}` };
    }
  }
}

export function weekColumnStatus(
  e: EntryRow | undefined,
  col: WeekViewColumn,
  goals: ProfileGoals | null,
  isPastNoEntry: boolean,
  isPast: boolean
): { met: boolean | null; value: string } {
  if (col.kind === 'workout_agg') return categoryStatus(e, 'workout', goals, isPastNoEntry, isPast);
  if (col.kind === 'steps') return categoryStatus(e, 'steps', goals, isPastNoEntry, isPast);
  if (col.kind === 'sleep') return categoryStatus(e, 'sleep', goals, isPastNoEntry, isPast);
  if (col.kind === 'protein') return categoryStatus(e, 'protein', goals, isPastNoEntry, isPast);
  if (col.kind === 'calories') return categoryStatus(e, 'calories', goals, isPastNoEntry, isPast);
  return categoryStatus(e, 'water', goals, isPastNoEntry, isPast);
}

export function weekColumnColor(col: WeekViewColumn): string {
  if (col.kind === 'workout_agg') return COLOR_WORKOUT;
  if (col.kind === 'steps') return COLOR_STEPS;
  if (col.kind === 'sleep') return COLOR_SLEEP;
  if (col.kind === 'protein') return COLOR_PROTEIN;
  if (col.kind === 'calories') return COLOR_CALORIES;
  return '#f59e0b';
}

export function weekColumnLabel(col: WeekViewColumn): string {
  if (col.kind === 'workout_agg') return 'Workout';
  if (col.kind === 'steps') return 'Steps';
  if (col.kind === 'sleep') return 'Sleep';
  if (col.kind === 'protein') return 'Protein';
  if (col.kind === 'calories') return 'Calories';
  return 'Water';
}

export function weekColKey(col: WeekViewColumn): string {
  return col.kind;
}
