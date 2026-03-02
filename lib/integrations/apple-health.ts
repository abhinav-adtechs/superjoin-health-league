/**
 * Apple HealthKit integration via @perfood/capacitor-healthkit.
 * This module runs only on the client (iOS Capacitor app).
 *
 * On web/browser, all functions are no-ops that return null.
 */

import { Capacitor } from '@capacitor/core';
import type { IntegrationSyncPayload, WorkoutOption, CardioType } from '@/lib/types';
import { HK_WORKOUT_NAME_TO_CARDIO, HK_WORKOUT_NAME_TO_STRENGTH } from './data-mapper';

// HealthKit sample type identifiers used by @perfood/capacitor-healthkit
export const HK_READ_TYPES = [
  'stepCount',
  'workoutType',
  'sleepAnalysis',
  'dietaryWater',
  'dietaryProtein',
  'bodyMass',
] as const;

export type HKSampleType = (typeof HK_READ_TYPES)[number];

/** Raw workout sample from @perfood/capacitor-healthkit */
interface HKWorkoutSample {
  uuid: string;
  startDate: string;
  endDate: string;
  duration: number; // seconds
  totalEnergyBurned?: number;
  totalDistance?: number;
  workoutActivityType?: string; // e.g. "HKWorkoutActivityTypeRunning"
  sourceName?: string;
}

/** Raw quantity sample from @perfood/capacitor-healthkit */
interface HKQuantitySample {
  uuid: string;
  startDate: string;
  endDate: string;
  value: number;
  unitName?: string;
  sourceName?: string;
}

/** Raw sleep analysis sample */
interface HKSleepSample {
  uuid: string;
  startDate: string;
  endDate: string;
  value: number; // 0=inBed, 1=asleep, 2=awake, 3-5=stages
  sourceName?: string;
}

/** Lazily loads the Capacitor HealthKit plugin (only available in iOS app) */
async function getPlugin() {
  if (typeof window === 'undefined') return null;
  // The web stub for this plugin throws "not implemented on web" for every
  // method (including .then()), so we must bail out before importing it.
  if (!Capacitor.isNativePlatform()) return null;
  try {
    const mod = await import('@perfood/capacitor-healthkit');
    return mod.CapacitorHealthkit ?? null;
  } catch {
    return null;
  }
}

/** Returns true if HealthKit is available (iOS Capacitor only) */
export async function isHealthKitAvailable(): Promise<boolean> {
  const plugin = await getPlugin();
  if (!plugin) return false;
  try {
    await plugin.isAvailable();
    return true;
  } catch {
    return false;
  }
}

/**
 * Request HealthKit read permissions.
 * Shows the native iOS permission sheet.
 * Returns true if granted (or previously granted), false otherwise.
 */
export async function requestHealthKitPermissions(): Promise<boolean> {
  const plugin = await getPlugin();
  if (!plugin) return false;
  try {
    await plugin.requestAuthorization({
      all: [],
      read: HK_READ_TYPES as unknown as string[],
      write: [],
    });
    return true;
  } catch {
    return false;
  }
}

// ============================================
// Data Readers
// ============================================

function isoForDate(date: string, endOfDay = false): string {
  return endOfDay ? `${date}T23:59:59.000Z` : `${date}T00:00:00.000Z`;
}

type HKPlugin = NonNullable<Awaited<ReturnType<typeof getPlugin>>>;

async function queryHKit<T>(plugin: HKPlugin, sampleName: string, date: string, limit: number): Promise<T[]> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await (plugin as any).queryHKitSampleType({
      sampleName,
      startDate: isoForDate(date),
      endDate: isoForDate(date, true),
      limit,
    });
    return (result?.resultData ?? []) as T[];
  } catch {
    return [];
  }
}

async function querySteps(plugin: HKPlugin, date: string): Promise<number | null> {
  const samples = await queryHKit<HKQuantitySample>(plugin, 'stepCount', date, 100);
  if (samples.length === 0) return null;
  const total = samples.reduce((sum, s) => sum + (s.value ?? 0), 0);
  return Math.round(total);
}

async function queryWorkouts(plugin: HKPlugin, date: string): Promise<HKWorkoutSample[]> {
  return queryHKit<HKWorkoutSample>(plugin, 'workoutType', date, 20);
}

async function querySleep(plugin: HKPlugin, date: string): Promise<number | null> {
  const samples = await queryHKit<HKSleepSample>(plugin, 'sleepAnalysis', date, 50);
  // Sum only "asleep" samples (value === 1); ignore inBed (0) and awake (2)
  const asleepSamples = samples.filter(s => s.value === 1 || s.value >= 3);
  if (asleepSamples.length === 0) return null;
  const totalSeconds = asleepSamples.reduce((sum, s) => {
    const start = new Date(s.startDate).getTime();
    const end = new Date(s.endDate).getTime();
    return sum + Math.max(0, (end - start) / 1000);
  }, 0);
  return Math.round((totalSeconds / 3600) * 10) / 10;
}

async function queryDietaryWater(plugin: HKPlugin, date: string): Promise<number | null> {
  const samples = await queryHKit<HKQuantitySample>(plugin, 'dietaryWater', date, 50);
  if (samples.length === 0) return null;
  // Values are in mL; convert to liters
  const totalMl = samples.reduce((sum, s) => sum + (s.value ?? 0), 0);
  return Math.round((totalMl / 1000) * 100) / 100;
}

async function queryProtein(plugin: HKPlugin, date: string): Promise<number | null> {
  const samples = await queryHKit<HKQuantitySample>(plugin, 'dietaryProtein', date, 50);
  if (samples.length === 0) return null;
  return Math.round(samples.reduce((sum, s) => sum + (s.value ?? 0), 0));
}

async function queryWeight(plugin: HKPlugin, date: string): Promise<number | null> {
  const samples = await queryHKit<HKQuantitySample>(plugin, 'bodyMass', date, 5);
  if (samples.length === 0) return null;
  const latest = samples[samples.length - 1];
  return Math.round(latest.value * 10) / 10;
}

// ============================================
// Workout Classification
// ============================================

const CARDIO_NAMES = new Set(Object.keys(HK_WORKOUT_NAME_TO_CARDIO));
const STRENGTH_NAMES = new Set(Object.keys(HK_WORKOUT_NAME_TO_STRENGTH));

function classifyWorkout(activityType: string): 'cardio' | 'strength' | 'unknown' {
  if (CARDIO_NAMES.has(activityType)) return 'cardio';
  if (STRENGTH_NAMES.has(activityType)) return 'strength';
  // Partial match for variants
  const lower = activityType.toLowerCase();
  const found = Array.from(CARDIO_NAMES).some((name) => lower.includes(name.toLowerCase()));
  if (found) return 'cardio';
  return 'unknown';
}

// ============================================
// Full Day Query
// ============================================

/**
 * Reads all relevant HealthKit data for a given date from the iOS device.
 * Must be called from the Capacitor iOS app (not web).
 */
export async function readHealthKitDay(date: string): Promise<IntegrationSyncPayload | null> {
  const plugin = await getPlugin();
  if (!plugin) return null;

  const [steps, workouts, sleepHours, water, protein, weight] = await Promise.all([
    querySteps(plugin, date),
    queryWorkouts(plugin, date),
    querySleep(plugin, date),
    queryDietaryWater(plugin, date),
    queryProtein(plugin, date),
    queryWeight(plugin, date),
  ]);

  let workout_done: boolean | null = null;
  let workout_duration: number | null = null;
  const workout_types: WorkoutOption[] = [];
  let cardio_done: boolean | null = null;
  let cardio_duration: number | null = null;
  let cardio_type: CardioType | null = null;

  for (const w of workouts) {
    const actType = w.workoutActivityType ?? 'HKWorkoutActivityTypeOther';
    const durationMins = Math.round((w.duration ?? 0) / 60);
    const classification = classifyWorkout(actType);

    if (classification === 'cardio') {
      cardio_done = true;
      cardio_duration = (cardio_duration ?? 0) + durationMins;
      if (!cardio_type) {
        cardio_type = HK_WORKOUT_NAME_TO_CARDIO[actType] ?? 'other';
      }
    } else {
      workout_done = true;
      workout_duration = (workout_duration ?? 0) + durationMins;
      const option: WorkoutOption = HK_WORKOUT_NAME_TO_STRENGTH[actType] ?? 'other';
      if (!workout_types.includes(option)) workout_types.push(option);
    }
  }

  const protein_qty = protein;
  const protein_meal = protein_qty != null && protein_qty >= 30 ? true : null;

  return {
    date,
    steps,
    workout_done,
    workout_duration,
    workout_types: workout_types.length > 0 ? workout_types : null,
    cardio_done,
    cardio_duration,
    cardio_type,
    water_liters: water,
    protein_qty,
    protein_meal,
    sleep_hours: sleepHours,
    sleep_quality: null, // HealthKit has no quality score
    weight_kg: weight,
  };
}

/**
 * Read today and yesterday's HealthKit data and POST to the API.
 * Called on every iOS app launch after permissions are granted.
 */
export async function syncHealthKitToApi(apiBaseUrl: string, authToken: string): Promise<void> {
  const plugin = await getPlugin();
  if (!plugin) return;

  const today = new Date().toISOString().slice(0, 10);
  const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);

  for (const date of [yesterday, today]) {
    const payload = await readHealthKitDay(date);
    if (!payload) continue;
    try {
      await fetch(`${apiBaseUrl}/api/integrations/apple-health/sync`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`,
        },
        credentials: 'include',
        body: JSON.stringify(payload),
      });
    } catch {
      // Silent fail — will retry on next launch
    }
  }
}
