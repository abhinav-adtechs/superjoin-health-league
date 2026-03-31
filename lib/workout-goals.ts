import type { CardioType, WorkoutGoalType } from './types';

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

/** Goal tags that map to the Training (workout minutes) logger. */
const GOALS_FOR_TRAINING_LOG = new Set<WorkoutGoalType>(['strength', 'yoga', 'martial_arts']);

/** Goal tags that map to the Cardio (type + duration) logger. */
const GOALS_FOR_CARDIO_LOG = new Set<WorkoutGoalType>([
  'running',
  'walking',
  'cycling',
  'swimming',
  'cardio_mix',
  'team_sports',
  'racket_sports',
]);

/**
 * Which subsections to show in Log Movement, aligned with profile goal_workout_types.
 * Empty goal list → show training + cardio pickers (legacy); steps only if `stepsGoalActive`.
 * CrossFit uses both strength-style minutes and cardio-style minutes in scoring.
 */
export function getMovementLogSectionVisibility(
  goalTypes: WorkoutGoalType[],
  stepsGoalActive: boolean,
): {
  showTraining: boolean;
  showCardio: boolean;
  showSteps: boolean;
} {
  if (!goalTypes.length) {
    return { showTraining: true, showCardio: true, showSteps: stepsGoalActive };
  }
  let showTraining = false;
  let showCardio = false;
  for (const g of goalTypes) {
    if (g === 'crossfit') {
      showTraining = true;
      showCardio = true;
      continue;
    }
    if (GOALS_FOR_TRAINING_LOG.has(g)) showTraining = true;
    if (GOALS_FOR_CARDIO_LOG.has(g)) showCardio = true;
  }
  if (!showTraining && !showCardio) {
    return { showTraining: true, showCardio: true, showSteps: stepsGoalActive };
  }
  return { showTraining, showCardio, showSteps: stepsGoalActive };
}

/** Short labels for history / calendar column headers. */
export const WORKOUT_GOAL_SHORT_LABELS: Record<WorkoutGoalType, string> = {
  strength: 'Strength',
  running: 'Run',
  walking: 'Walk',
  martial_arts: 'Martial',
  cardio_mix: 'Cardio',
  team_sports: 'Team',
  racket_sports: 'Racket',
  cycling: 'Bike',
  swimming: 'Swim',
  yoga: 'Yoga',
  crossfit: 'HIIT',
};

type EntryForGoalMatch = {
  workout_done?: boolean | null;
  workout_duration?: number | null;
  workout_types?: string[] | null;
  cardio_done?: boolean | null;
  cardio_duration?: number | null;
  cardio_type?: string | null;
};

const TEAM_CARDIO: CardioType[] = ['football', 'cricket', 'basketball', 'volleyball', 'hockey'];
const RACKET_CARDIO: CardioType[] = ['badminton', 'tennis', 'squash'];

/**
 * Whether a daily entry satisfies a specific profile workout goal tag (for day-level history UI).
 */
export function entryMatchesWorkoutGoalType(e: EntryForGoalMatch, t: WorkoutGoalType): boolean {
  if (t === 'strength') {
    return e.workout_done === true;
  }
  if (t === 'yoga') {
    if (e.workout_done !== true) return false;
    const wt = e.workout_types ?? [];
    return wt.includes('bodyweight') || wt.includes('core');
  }
  if (t === 'crossfit') {
    const mins = (e.workout_duration ?? 0) + (e.cardio_duration ?? 0);
    return (e.workout_done === true || e.cardio_done === true) && mins >= 15;
  }
  if (e.cardio_done !== true) return false;
  const ct = (e.cardio_type ?? 'other') as CardioType;
  switch (t) {
    case 'running':
      return ct === 'running';
    case 'walking':
      return ct === 'walking' || ct === 'hiking';
    case 'cycling':
      return ct === 'cycling';
    case 'swimming':
      return ct === 'swimming';
    case 'martial_arts':
      return ct === 'martial_arts';
    case 'cardio_mix':
      return true;
    case 'team_sports':
      return TEAM_CARDIO.includes(ct) || ct === 'sports';
    case 'racket_sports':
      return RACKET_CARDIO.includes(ct);
    default:
      return false;
  }
}

/** Minutes to show for a goal-type cell when the entry matches that type. */
export function workoutGoalTypeMins(e: EntryForGoalMatch, t: WorkoutGoalType): number {
  if (t === 'strength' || t === 'yoga') {
    return e.workout_done ? (e.workout_duration ?? 0) : 0;
  }
  if (t === 'crossfit') {
    return (e.workout_duration ?? 0) + (e.cardio_duration ?? 0);
  }
  return e.cardio_done ? (e.cardio_duration ?? 0) : 0;
}
