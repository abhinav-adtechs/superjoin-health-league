/**
 * Shared data mapping utilities for health platform integrations.
 * Maps platform-specific workout/activity types to our WorkoutOption and CardioType enums.
 */

import type { WorkoutOption, CardioType, IntegrationSyncPayload } from '@/lib/types';

// ============================================
// Apple HealthKit → Our Types
// ============================================

/**
 * HKWorkoutActivityType numeric values → WorkoutOption
 * Strength/gym types map to workout_types; cardio types map to cardio_type.
 * Reference: https://developer.apple.com/documentation/healthkit/hkworkoutactivitytype
 */
export const HK_WORKOUT_TO_WORKOUT_OPTION: Record<number, WorkoutOption> = {
  50: 'full_body',        // HKWorkoutActivityTypeFunctionalStrengthTraining
  20: 'full_body',        // HKWorkoutActivityTypeGymnastics
  57: 'full_body',        // HKWorkoutActivityTypeMixedCardio
  65: 'full_body',        // HKWorkoutActivityTypeHighIntensityIntervalTraining
  24: 'full_body',        // HKWorkoutActivityTypePaddleSports
  1:  'other',            // HKWorkoutActivityTypeAmericanFootball
  51: 'full_body',        // HKWorkoutActivityTypeHandball
  75: 'core',             // HKWorkoutActivityTypePilates
  77: 'full_body',        // HKWorkoutActivityTypeTaiChi
  47: 'push',             // HKWorkoutActivityTypeSnowSports
  49: 'full_body',        // HKWorkoutActivityTypeTraditionalStrengthTraining
  62: 'full_body',        // HKWorkoutActivityTypeWrestling
  80: 'full_body',        // HKWorkoutActivityTypeMartialArts (used as strength)
  100: 'bodyweight',      // HKWorkoutActivityTypeYoga
  3000: 'other',          // HKWorkoutActivityTypeOther
};

export const HK_CARDIO_ACTIVITY_TYPES: Set<number> = new Set([
  37,   // HKWorkoutActivityTypeRunning
  13,   // HKWorkoutActivityTypeCycling
  46,   // HKWorkoutActivityTypeSwimming
  52,   // HKWorkoutActivityTypeWalking
  24,   // HKWorkoutActivityTypeHiking
  55,   // HKWorkoutActivityTypeRowing
  12,   // HKWorkoutActivityTypeDance
  2,    // HKWorkoutActivityTypeArchery (sports)
  5,    // HKWorkoutActivityTypeBasketball
  7,    // HKWorkoutActivityTypeBadminton
  10,   // HKWorkoutActivityTypeCricket
  41,   // HKWorkoutActivityTypeSoccer (football)
  44,   // HKWorkoutActivityTypeSquash
  45,   // HKWorkoutActivityTypeTennis
  53,   // HKWorkoutActivityTypeVolleyball
  64,   // HKWorkoutActivityTypeHockey
  78,   // HKWorkoutActivityTypeElliptical
  35,   // HKWorkoutActivityTypeJumpRope
  36,   // HKWorkoutActivityTypeKickboxing
  59,   // HKWorkoutActivityTypeSkiing
  60,   // HKWorkoutActivityTypeSnowboarding
  70,   // HKWorkoutActivityTypeStairClimbing
  71,   // HKWorkoutActivityTypeSurfingSports
  73,   // HKWorkoutActivityTypeTrackAndField
]);

export const HK_CARDIO_TYPE_MAP: Record<number, CardioType> = {
  37:  'running',
  13:  'cycling',
  46:  'swimming',
  52:  'walking',
  24:  'hiking',
  55:  'rowing',
  12:  'dance',
  41:  'football',
  10:  'cricket',
  5:   'basketball',
  7:   'badminton',
  44:  'squash',
  45:  'tennis',
  53:  'volleyball',
  64:  'hockey',
  36:  'martial_arts',
  78:  'sports',   // elliptical → sports
  70:  'sports',   // stair climber → sports
  73:  'sports',   // track and field → sports
};

/** HKWorkoutActivityType string names (from @perfood/capacitor-healthkit) → CardioType */
export const HK_WORKOUT_NAME_TO_CARDIO: Record<string, CardioType> = {
  HKWorkoutActivityTypeRunning: 'running',
  HKWorkoutActivityTypeCycling: 'cycling',
  HKWorkoutActivityTypeSwimming: 'swimming',
  HKWorkoutActivityTypeWalking: 'walking',
  HKWorkoutActivityTypeHiking: 'hiking',
  HKWorkoutActivityTypeRowing: 'rowing',
  HKWorkoutActivityTypeDance: 'dance',
  HKWorkoutActivityTypeSoccer: 'football',
  HKWorkoutActivityTypeCricket: 'cricket',
  HKWorkoutActivityTypeBasketball: 'basketball',
  HKWorkoutActivityTypeBadminton: 'badminton',
  HKWorkoutActivityTypeSquash: 'squash',
  HKWorkoutActivityTypeTennis: 'tennis',
  HKWorkoutActivityTypeVolleyball: 'volleyball',
  HKWorkoutActivityTypeHockey: 'hockey',
  HKWorkoutActivityTypeKickboxing: 'martial_arts',
  HKWorkoutActivityTypeMartialArts: 'martial_arts',
  HKWorkoutActivityTypeElliptical: 'sports',
  HKWorkoutActivityTypeStairClimbing: 'sports',
  HKWorkoutActivityTypeTrackAndField: 'sports',
};

/** HKWorkoutActivityType string names → WorkoutOption (strength/gym types) */
export const HK_WORKOUT_NAME_TO_STRENGTH: Record<string, WorkoutOption> = {
  HKWorkoutActivityTypeTraditionalStrengthTraining: 'full_body',
  HKWorkoutActivityTypeFunctionalStrengthTraining: 'full_body',
  HKWorkoutActivityTypeHighIntensityIntervalTraining: 'full_body',
  HKWorkoutActivityTypeCoreTraining: 'core',
  HKWorkoutActivityTypePilates: 'core',
  HKWorkoutActivityTypeYoga: 'bodyweight',
  HKWorkoutActivityTypeGymnastics: 'bodyweight',
  HKWorkoutActivityTypeTaiChi: 'bodyweight',
  HKWorkoutActivityTypeMixedCardio: 'full_body',
  HKWorkoutActivityTypeWrestling: 'full_body',
  HKWorkoutActivityTypeOther: 'other',
};

// ============================================
// Fitbit → Our Types
// ============================================

/** Fitbit activity names (lowercase) → CardioType */
export const FITBIT_ACTIVITY_TO_CARDIO: Record<string, CardioType> = {
  run: 'running',
  running: 'running',
  'outdoor run': 'running',
  'treadmill': 'running',
  'treadmill running': 'running',
  cycling: 'cycling',
  'outdoor bike': 'cycling',
  'stationary cycling': 'cycling',
  spinning: 'cycling',
  swimming: 'swimming',
  walk: 'walking',
  walking: 'walking',
  'outdoor walk': 'walking',
  hiking: 'hiking',
  rowing: 'rowing',
  'rowing machine': 'rowing',
  dance: 'dance',
  'aerobics': 'sports',
  football: 'football',
  soccer: 'football',
  cricket: 'cricket',
  basketball: 'basketball',
  badminton: 'badminton',
  squash: 'squash',
  tennis: 'tennis',
  volleyball: 'volleyball',
  hockey: 'hockey',
  'martial arts': 'martial_arts',
  boxing: 'martial_arts',
  kickboxing: 'martial_arts',
  'elliptical': 'sports',
  'stair climbing': 'sports',
  'jump rope': 'sports',
  'sports': 'sports',
};

/** Fitbit activity names (lowercase) → WorkoutOption (strength types) */
export const FITBIT_ACTIVITY_TO_STRENGTH: Record<string, WorkoutOption> = {
  weights: 'full_body',
  'weight training': 'full_body',
  'strength training': 'full_body',
  'resistance training': 'full_body',
  'circuit training': 'full_body',
  hiit: 'full_body',
  'cross training': 'full_body',
  yoga: 'bodyweight',
  pilates: 'core',
  'core training': 'core',
  calisthenics: 'bodyweight',
  bodyweight: 'bodyweight',
  gymnastics: 'bodyweight',
  workout: 'full_body',
  'gym': 'full_body',
  'crossfit': 'full_body',
};

const FITBIT_CARDIO_KEYS = new Set(Object.keys(FITBIT_ACTIVITY_TO_CARDIO));

/** Classify a Fitbit activity name as 'cardio' | 'strength' | 'unknown' */
export function classifyFitbitActivity(name: string): 'cardio' | 'strength' | 'unknown' {
  const lower = name.toLowerCase();
  if (FITBIT_CARDIO_KEYS.has(lower)) return 'cardio';
  const cardioMatch = Array.from(FITBIT_CARDIO_KEYS).some((key) => lower.includes(key));
  if (cardioMatch) return 'cardio';
  for (const key of Object.keys(FITBIT_ACTIVITY_TO_STRENGTH)) {
    if (lower.includes(key)) return 'strength';
  }
  return 'unknown';
}

export function fitbitActivityToCardioType(name: string): CardioType {
  const lower = name.toLowerCase();
  if (FITBIT_ACTIVITY_TO_CARDIO[lower]) return FITBIT_ACTIVITY_TO_CARDIO[lower];
  for (const [key, val] of Object.entries(FITBIT_ACTIVITY_TO_CARDIO)) {
    if (lower.includes(key)) return val;
  }
  return 'other';
}

export function fitbitActivityToWorkoutOption(name: string): WorkoutOption {
  const lower = name.toLowerCase();
  if (FITBIT_ACTIVITY_TO_STRENGTH[lower]) return FITBIT_ACTIVITY_TO_STRENGTH[lower];
  for (const [key, val] of Object.entries(FITBIT_ACTIVITY_TO_STRENGTH)) {
    if (lower.includes(key)) return val;
  }
  return 'other';
}

// ============================================
// Sleep quality mapping
// ============================================

/** Map Fitbit sleep efficiency (0-100) to our sleep_quality (1-5) */
export function fitbitEfficiencyToQuality(efficiency: number): number {
  if (efficiency >= 90) return 5;
  if (efficiency >= 80) return 4;
  if (efficiency >= 70) return 3;
  if (efficiency >= 60) return 2;
  return 1;
}

// ============================================
// Merge: apply integration payload onto existing DailyEntry fields
// ============================================

type EntryFields = Omit<IntegrationSyncPayload, 'date'>;

/**
 * Merges a platform sync payload into an existing entry using the specified preference.
 * - fill_nulls: only sets fields that are currently null/undefined
 * - always_override: platform data wins for every provided field
 */
export function mergeIntegrationData(
  existing: Partial<EntryFields>,
  incoming: Partial<EntryFields>,
  preference: 'fill_nulls' | 'always_override',
): { merged: Partial<EntryFields>; changed: string[] } {
  const merged: Partial<EntryFields> = { ...existing };
  const changed: string[] = [];

  for (const [key, value] of Object.entries(incoming) as [keyof EntryFields, unknown][]) {
    if (value === undefined || value === null) continue;
    const existingVal = existing[key];
    const shouldSet =
      preference === 'always_override' ||
      existingVal === undefined ||
      existingVal === null;

    if (shouldSet) {
      // Special handling for workout_types: union merge
      if (key === 'workout_types' && Array.isArray(value) && Array.isArray(existingVal)) {
        const merged_types = [...existingVal, ...value];
        (merged as Record<string, unknown>)[key] = merged_types.filter((v, i) => merged_types.indexOf(v) === i);
      } else {
        (merged as Record<string, unknown>)[key] = value;
      }
      changed.push(key);
    }
  }

  return { merged, changed };
}
