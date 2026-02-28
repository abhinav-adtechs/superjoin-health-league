/**
 * Fitbit Web API client.
 * OAuth 2.0 PKCE helpers + data fetching for all relevant health data types.
 * Docs: https://dev.fitbit.com/build/reference/web-api/
 */

import type { IntegrationSyncPayload } from '@/lib/types';
import {
  classifyFitbitActivity,
  fitbitActivityToCardioType,
  fitbitActivityToWorkoutOption,
  fitbitEfficiencyToQuality,
} from './data-mapper';

const FITBIT_AUTH_URL = 'https://www.fitbit.com/oauth2/authorize';
const FITBIT_TOKEN_URL = 'https://api.fitbit.com/oauth2/token';
const FITBIT_API_BASE = 'https://api.fitbit.com';

// Scopes we request from Fitbit
export const FITBIT_SCOPES = [
  'activity',
  'sleep',
  'nutrition',
  'weight',
  'profile',
].join(' ');

// ============================================
// PKCE Helpers
// ============================================

function base64URLEncode(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let str = '';
  for (let i = 0; i < bytes.length; i++) str += String.fromCharCode(bytes[i]);
  return btoa(str).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

/** Generate a cryptographically random code_verifier (43-128 chars) */
export function generateCodeVerifier(): string {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return base64URLEncode(array.buffer);
}

/** Derive code_challenge from verifier using SHA-256 */
export async function generateCodeChallenge(verifier: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(verifier);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return base64URLEncode(digest);
}

/** Build the full Fitbit authorization URL */
export async function buildFitbitAuthUrl(params: {
  clientId: string;
  redirectUri: string;
  state: string;
  codeVerifier: string;
}): Promise<string> {
  const challenge = await generateCodeChallenge(params.codeVerifier);
  const url = new URL(FITBIT_AUTH_URL);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('client_id', params.clientId);
  url.searchParams.set('redirect_uri', params.redirectUri);
  url.searchParams.set('scope', FITBIT_SCOPES);
  url.searchParams.set('code_challenge', challenge);
  url.searchParams.set('code_challenge_method', 'S256');
  url.searchParams.set('state', params.state);
  return url.toString();
}

// ============================================
// Token Exchange
// ============================================

export interface FitbitTokenResponse {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  token_type: string;
  user_id: string;
  scope: string;
}

/** Exchange authorization code for access + refresh tokens */
export async function exchangeCodeForToken(params: {
  code: string;
  codeVerifier: string;
  clientId: string;
  clientSecret: string;
  redirectUri: string;
}): Promise<FitbitTokenResponse> {
  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    code: params.code,
    redirect_uri: params.redirectUri,
    code_verifier: params.codeVerifier,
    client_id: params.clientId,
  });

  const credentials = Buffer.from(`${params.clientId}:${params.clientSecret}`).toString('base64');

  const res = await fetch(FITBIT_TOKEN_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: `Basic ${credentials}`,
    },
    body: body.toString(),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Fitbit token exchange failed: ${res.status} ${text}`);
  }

  return res.json() as Promise<FitbitTokenResponse>;
}

/** Refresh an expired Fitbit access token */
export async function refreshFitbitToken(params: {
  refreshToken: string;
  clientId: string;
  clientSecret: string;
}): Promise<FitbitTokenResponse> {
  const body = new URLSearchParams({
    grant_type: 'refresh_token',
    refresh_token: params.refreshToken,
    client_id: params.clientId,
  });

  const credentials = Buffer.from(`${params.clientId}:${params.clientSecret}`).toString('base64');

  const res = await fetch(FITBIT_TOKEN_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: `Basic ${credentials}`,
    },
    body: body.toString(),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Fitbit token refresh failed: ${res.status} ${text}`);
  }

  return res.json() as Promise<FitbitTokenResponse>;
}

/** Revoke a Fitbit token (disconnect) */
export async function revokeFitbitToken(params: {
  token: string;
  clientId: string;
  clientSecret: string;
}): Promise<void> {
  const body = new URLSearchParams({ token: params.token });
  const credentials = Buffer.from(`${params.clientId}:${params.clientSecret}`).toString('base64');
  await fetch('https://api.fitbit.com/oauth2/revoke', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: `Basic ${credentials}`,
    },
    body: body.toString(),
  });
}

// ============================================
// Data Fetching
// ============================================

async function fitbitGet(path: string, accessToken: string) {
  const res = await fetch(`${FITBIT_API_BASE}${path}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) {
    throw new Error(`Fitbit API error ${res.status} for ${path}`);
  }
  return res.json();
}

/** Fetch Fitbit steps for a single date (YYYY-MM-DD) */
async function fetchSteps(date: string, token: string): Promise<number | null> {
  try {
    const data = await fitbitGet(`/1/user/-/activities/steps/date/${date}/1d.json`, token);
    const val = data?.['activities-steps']?.[0]?.value;
    const steps = parseInt(val, 10);
    return isNaN(steps) ? null : steps;
  } catch {
    return null;
  }
}

/** Fetch Fitbit sleep data for a single date */
async function fetchSleep(date: string, token: string): Promise<{ hours: number | null; quality: number | null }> {
  try {
    const data = await fitbitGet(`/1/user/-/sleep/date/${date}.json`, token);
    const summary = data?.summary;
    const totalMins = summary?.totalMinutesAsleep;
    const hours = totalMins != null ? Math.round((totalMins / 60) * 10) / 10 : null;
    const mainSleep = data?.sleep?.find((s: { isMainSleep: boolean }) => s.isMainSleep);
    const quality = mainSleep?.efficiency != null
      ? fitbitEfficiencyToQuality(mainSleep.efficiency)
      : null;
    return { hours, quality };
  } catch {
    return { hours: null, quality: null };
  }
}

interface FitbitActivity {
  activityName: string;
  duration: number; // milliseconds
  startTime: string;
}

/** Fetch Fitbit activity log for a date */
async function fetchActivities(date: string, token: string): Promise<FitbitActivity[]> {
  try {
    const data = await fitbitGet(
      `/1/user/-/activities/list.json?afterDate=${date}&sort=asc&offset=0&limit=20`,
      token,
    );
    // Filter to activities that started on the requested date
    const activities: FitbitActivity[] = (data?.activities ?? []).filter((a: FitbitActivity) =>
      a.startTime?.startsWith(date),
    );
    return activities;
  } catch {
    return [];
  }
}

/** Fetch water intake for a date (returns liters) */
async function fetchWater(date: string, token: string): Promise<number | null> {
  try {
    const data = await fitbitGet(`/1/user/-/foods/log/water/date/${date}.json`, token);
    const ml = data?.summary?.water;
    return ml != null ? Math.round((ml / 1000) * 100) / 100 : null;
  } catch {
    return null;
  }
}

/** Fetch nutrition (protein) for a date */
async function fetchProtein(date: string, token: string): Promise<number | null> {
  try {
    const data = await fitbitGet(`/1/user/-/foods/log/date/${date}.json`, token);
    const protein = data?.summary?.protein;
    return protein != null ? Math.round(protein) : null;
  } catch {
    return null;
  }
}

/** Fetch body weight for a date */
async function fetchWeight(date: string, token: string): Promise<number | null> {
  try {
    const data = await fitbitGet(`/1/user/-/body/weight/date/${date}/1d.json`, token);
    const entry = data?.['body-weight']?.[0]?.value;
    return entry != null ? parseFloat(entry) : null;
  } catch {
    return null;
  }
}

// ============================================
// Full Daily Sync
// ============================================

/**
 * Fetches all available health data from Fitbit for the given date
 * and returns it as an IntegrationSyncPayload.
 */
export async function fetchFitbitDayData(
  date: string,
  accessToken: string,
): Promise<IntegrationSyncPayload> {
  const [steps, sleep, activities, water, protein, weight] = await Promise.all([
    fetchSteps(date, accessToken),
    fetchSleep(date, accessToken),
    fetchActivities(date, accessToken),
    fetchWater(date, accessToken),
    fetchProtein(date, accessToken),
    fetchWeight(date, accessToken),
  ]);

  // Classify activities into strength vs cardio
  let workout_done: boolean | null = null;
  let workout_duration: number | null = null;
  const workout_types: import('@/lib/types').WorkoutOption[] = [];
  let cardio_done: boolean | null = null;
  let cardio_duration: number | null = null;
  let cardio_type: import('@/lib/types').CardioType | null = null;

  for (const activity of activities) {
    const classification = classifyFitbitActivity(activity.activityName);
    const durationMins = Math.round(activity.duration / 60000);

    if (classification === 'cardio') {
      cardio_done = true;
      cardio_duration = (cardio_duration ?? 0) + durationMins;
      if (!cardio_type) {
        cardio_type = fitbitActivityToCardioType(activity.activityName);
      }
    } else if (classification === 'strength') {
      workout_done = true;
      workout_duration = (workout_duration ?? 0) + durationMins;
      const option = fitbitActivityToWorkoutOption(activity.activityName);
      if (!workout_types.includes(option)) workout_types.push(option);
    } else {
      // Unknown: treat as general workout
      workout_done = true;
      workout_duration = (workout_duration ?? 0) + durationMins;
      if (!workout_types.includes('other')) workout_types.push('other');
    }
  }

  const protein_qty = protein ?? null;
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
    sleep_hours: sleep.hours,
    sleep_quality: sleep.quality,
    weight_kg: weight,
  };
}
