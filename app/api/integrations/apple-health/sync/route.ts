/**
 * POST /api/integrations/apple-health/sync
 * Receives health data pushed from the iOS Capacitor app (via @perfood/capacitor-healthkit)
 * and upserts it into the user's daily_entries.
 *
 * Also handles:
 * - PATCH /api/integrations/apple-health/sync  → update sync preferences
 * - DELETE /api/integrations/apple-health/sync → disconnect Apple Health
 */

import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { mergeIntegrationData } from '@/lib/integrations/data-mapper';
import { calculateDailyPoints } from '@/lib/points';
import type { AgeBracket, IntegrationSyncPayload, SyncPreference } from '@/lib/types';

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

  const body: IntegrationSyncPayload = await request.json().catch(() => null);
  if (!body?.date) {
    return NextResponse.json({ error: 'Missing date in payload' }, { status: 400 });
  }

  const date = body.date;

  // Upsert connected_accounts row (mark as connected for Apple Health — no OAuth tokens needed)
  await supabase
    .from('connected_accounts')
    .upsert(
      {
        user_id: user.id,
        platform: 'apple_health',
        sync_enabled: true,
        sync_preference: 'fill_nulls',
        connected_at: new Date().toISOString(),
        last_synced_at: new Date().toISOString(),
      },
      { onConflict: 'user_id,platform' },
    );

  // Update last_synced_at separately (upsert only sets connected_at on insert)
  await supabase
    .from('connected_accounts')
    .update({ last_synced_at: new Date().toISOString() })
    .eq('user_id', user.id)
    .eq('platform', 'apple_health');

  // Load sync preference
  const { data: account } = await supabase
    .from('connected_accounts')
    .select('sync_preference')
    .eq('user_id', user.id)
    .eq('platform', 'apple_health')
    .maybeSingle();

  const preference = (account?.sync_preference as SyncPreference) ?? 'fill_nulls';

  // Load existing entry
  const { data: existing } = await supabase
    .from('daily_entries')
    .select('*')
    .eq('user_id', user.id)
    .eq('date', date)
    .maybeSingle();

  const { weight_kg, date: _date, ...incomingFields } = body;

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

  // Handle weight
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

  return NextResponse.json({ ok: true, date, fields_synced: changed, weight_synced: weight_kg != null });
}

export async function PATCH(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const updates: Record<string, unknown> = {};

  if (typeof body.sync_enabled === 'boolean') updates.sync_enabled = body.sync_enabled;
  if (body.sync_preference === 'fill_nulls' || body.sync_preference === 'always_override') {
    updates.sync_preference = body.sync_preference;
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 });
  }

  const { error } = await supabase
    .from('connected_accounts')
    .update(updates)
    .eq('user_id', user.id)
    .eq('platform', 'apple_health');

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

export async function DELETE() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  await supabase
    .from('connected_accounts')
    .delete()
    .eq('user_id', user.id)
    .eq('platform', 'apple_health');

  return NextResponse.json({ ok: true });
}
