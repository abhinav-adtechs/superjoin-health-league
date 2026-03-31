import type { WorkoutGoalType } from './types';

/** All valid values for profile workout-type tags (multi-select). */
export const WORKOUT_GOAL_TYPES: readonly WorkoutGoalType[] = [
  'strength',
  'running',
  'walking',
  'martial_arts',
  'cardio_mix',
  'team_sports',
  'racket_sports',
  'cycling',
  'swimming',
  'yoga',
  'crossfit',
] as const;

const VALID = new Set<string>(WORKOUT_GOAL_TYPES as readonly string[]);

/** Parse JSONB array, legacy single string, or JSON string into a deduped list of valid types. */
export function parseGoalWorkoutTypes(input: unknown): WorkoutGoalType[] {
  if (input == null) return [];
  if (Array.isArray(input)) {
    const out = new Set<WorkoutGoalType>();
    for (const x of input) {
      if (typeof x === 'string' && VALID.has(x)) out.add(x as WorkoutGoalType);
    }
    return Array.from(out);
  }
  if (typeof input === 'string' && input.trim()) {
    if (VALID.has(input)) return [input as WorkoutGoalType];
    try {
      const p = JSON.parse(input);
      if (Array.isArray(p)) return parseGoalWorkoutTypes(p);
    } catch {
      /* ignore */
    }
  }
  return [];
}
