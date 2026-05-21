/**
 * POST /api/integrations/fitbit/sync
 * Fetches Fitbit data for the requested date and upserts into daily_entries.
 * Automatically refreshes expired tokens.
 */

import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import {
  fetchFitbitDayData,
  refreshFitbitToken,
} from '@/lib/integrations/fitbit';
import { mergeIntegrationData } from '@/lib/integrations/data-mapper';
import { calculateDailyPoints } from '@/lib/points';
import type { AgeBracket, SyncPreference } from '@/lib/types';

function weekStart(d: Date): string {
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  const monday = new Date(d);
  monday.setDate(diff);
  return monday.toISOString().slice(0, 10);
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const date: string = body.date ?? new Date().toISOString().slice(0, 10);

  // Load connected account
  const { data: account, error: accountError } = await supabase
    .from('connected_accounts')
    .select('*')
    .eq('user_id', user.id)
    .eq('platform', 'fitbit')
    .maybeSingle();

  if (accountError || !account) {
    return NextResponse.json({ error: 'Fitbit not connected' }, { status: 404 });
  }
  if (!account.sync_enabled) {
    return NextResponse.json({ error: 'Fitbit sync is disabled' }, { status: 400 });
  }

  let accessToken: string = account.access_token;

  // Refresh token if expired (with 5-minute buffer)
  const expiresAt = account.token_expires_at ? new Date(account.token_expires_at).getTime() : 0;
  if (Date.now() > expiresAt - 300_000) {
    const clientId = process.env.FITBIT_CLIENT_ID!;
    const clientSecret = process.env.FITBIT_CLIENT_SECRET!;
    try {
      const refreshed = await refreshFitbitToken({
        refreshToken: account.refresh_token,
        clientId,
        clientSecret,
      });
      accessToken = refreshed.access_token;
      const newExpiry = new Date(Date.now() + refreshed.expires_in * 1000).toISOString();
      await supabase
        .from('connected_accounts')
        .update({
          access_token: refreshed.access_token,
          refresh_token: refreshed.refresh_token,
          token_expires_at: newExpiry,
        })
        .eq('user_id', user.id)
        .eq('platform', 'fitbit');
    } catch {
      return NextResponse.json({ error: 'Fitbit token refresh failed' }, { status: 401 });
    }
  }

  // Fetch Fitbit data
  let incoming;
  try {
    incoming = await fetchFitbitDayData(date, accessToken);
  } catch {
    return NextResponse.json({ error: 'Fitbit API fetch failed' }, { status: 502 });
  }

  // Load existing daily entry
  const { data: existing } = await supabase
    .from('daily_entries')
    .select('*')
    .eq('user_id', user.id)
    .eq('date', date)
    .maybeSingle();

  const preference = (account.sync_preference as SyncPreference) ?? 'fill_nulls';

  // Build fields to merge (exclude date and weight_kg which goes to weekly_weigh_ins)
  const { weight_kg, date: _date, ...incomingFields } = incoming;
  const existingFields = existing
    ? {
        steps: existing.steps,
        workout_done: existing.workout_done,
        workout_duration: existing.workout_duration,
        workout_types: existing.workout_types,
        cardio_done: existing.cardio_done,
        cardio_duration: existing.cardio_duration,
        cardio_type: existing.cardio_type,
        water_liters: existing.water_liters,
        protein_qty: existing.protein_qty,
        protein_meal: existing.protein_meal,
        sleep_hours: existing.sleep_hours,
        sleep_quality: existing.sleep_quality,
      }
    : {};

  const { merged, changed } = mergeIntegrationData(existingFields, incomingFields, preference);

  if (changed.length > 0) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('age_bracket, fitness_goal, food_tracking_mode, goal_protein_g_day, goal_calories_day, goal_steps_day')
      .eq('id', user.id)
      .single();
    const ageBracket: AgeBracket = (profile?.age_bracket as AgeBracket) ?? '25_to_35';
    const profileForPoints = profile
      ? {
          goal_protein_g_day: profile.goal_protein_g_day,
          goal_calories_day: profile.goal_calories_day,
          food_tracking_mode: profile.food_tracking_mode,
          fitness_goal: profile.fitness_goal,
          goal_steps_day: profile.goal_steps_day,
        }
      : undefined;

    const entryData: Record<string, unknown> = {
      user_id: user.id,
      date,
      ...existingFields,
      ...merged,
    };
    entryData.daily_points = calculateDailyPoints(
      entryData as Parameters<typeof calculateDailyPoints>[0],
      ageBracket,
      profileForPoints,
    );

    await supabase
      .from('daily_entries')
      .upsert(entryData, { onConflict: 'user_id,date', ignoreDuplicates: false });
  }

  // Handle weight separately (goes into weekly_weigh_ins)
  if (weight_kg != null && weight_kg > 0) {
    const ws = weekStart(new Date(date + 'T12:00:00'));
    await supabase
      .from('weekly_weigh_ins')
      .upsert({ user_id: user.id, week_start: ws, weight_kg }, { onConflict: 'user_id,week_start' });
    await supabase
      .from('profiles')
      .update({ current_weight: weight_kg })
      .eq('id', user.id);
  }

  // Update last_synced_at
  await supabase
    .from('connected_accounts')
    .update({ last_synced_at: new Date().toISOString() })
    .eq('user_id', user.id)
    .eq('platform', 'fitbit');

  return NextResponse.json({
    ok: true,
    date,
    fields_synced: changed,
    weight_synced: weight_kg != null,
  });
}
