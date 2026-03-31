import { createClient } from '@/lib/supabase/server';
import { createServiceRoleClient } from '@/lib/supabase/admin';
import { NextResponse } from 'next/server';
import { calculateDailyPoints, getAgeBracket, isGoalCrushDay } from '@/lib/points';
import type { AgeBracket } from '@/lib/types';
import {
  detectEntryCategory,
  buildEntryBlocks,
  postToChannel,
  sendDM,
} from '@/lib/slack';
import { sendPushToUser } from '@/lib/push';

const ALLOWED_FIELDS = [
  'workout_done', 'workout_duration', 'workout_types', 'cardio_done', 'cardio_duration', 'cardio_type',
  'steps', 'water_liters', 'home_cooked_meals', 'protein_meal', 'protein_qty', 'junk_food', 'meals_log', 'alcohol',
  'sleep_hours', 'sleep_quality',
  // New fields
  'calories_kcal',
] as const;

function isValidDate(dateStr: string): boolean {
  const d = new Date(dateStr);
  return !isNaN(d.getTime());
}

const MAX_DAYS_BACK = 7;

function isWithinAllowedPastRange(dateStr: string, maxDaysBack: number = MAX_DAYS_BACK): boolean {
  const d = new Date(dateStr + 'T12:00:00');
  const today = new Date();
  today.setHours(12, 0, 0, 0);
  const dTime = d.getTime();
  const todayTime = today.getTime();
  if (dTime > todayTime) return false;
  const minDate = new Date(today);
  minDate.setDate(minDate.getDate() - maxDaysBack);
  minDate.setHours(12, 0, 0, 0);
  return dTime >= minDate.getTime();
}

function weekStart(d: Date): string {
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  const monday = new Date(d);
  monday.setDate(diff);
  return monday.toISOString().slice(0, 10);
}

export async function GET(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const date = searchParams.get('date');
  if (!date || !isValidDate(date)) {
    return NextResponse.json({ error: 'Invalid or missing date' }, { status: 400 });
  }

  const { data, error } = await supabase
    .from('daily_entries')
    .select('*')
    .eq('user_id', user.id)
    .eq('date', date)
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json();
  const date = body.date ?? new Date().toISOString().slice(0, 10);
  if (!isValidDate(date)) {
    return NextResponse.json({ error: 'Invalid date' }, { status: 400 });
  }
  if (!isWithinAllowedPastRange(date)) {
    return NextResponse.json({ error: 'Date must be today or up to 7 days in the past' }, { status: 400 });
  }

  // Merge with existing entry so multiple logs per day (movement, meal, sleep) combine
  const { data: existing } = await supabase
    .from('daily_entries')
    .select('*')
    .eq('user_id', user.id)
    .eq('date', date)
    .maybeSingle();

  const entry: Record<string, unknown> = {
    user_id: user.id,
    date,
    ...(existing ? {
      workout_done: existing.workout_done,
      workout_duration: existing.workout_duration,
      workout_types: existing.workout_types ?? [],
      cardio_done: existing.cardio_done,
      cardio_duration: existing.cardio_duration,
      cardio_type: existing.cardio_type,
      steps: existing.steps,
      water_liters: existing.water_liters,
      home_cooked_meals: existing.home_cooked_meals,
      protein_meal: existing.protein_meal,
      protein_qty: existing.protein_qty,
      junk_food: existing.junk_food,
      alcohol: existing.alcohol,
      sleep_hours: existing.sleep_hours,
      sleep_quality: existing.sleep_quality,
      calories_kcal: existing.calories_kcal,
    } : {}),
  };
  for (const key of ALLOWED_FIELDS) {
    if (body[key] === undefined) continue;
    if (key === 'workout_types') {
      // Union: merge existing + new without duplicates
      const existingTypes: string[] = Array.isArray(entry.workout_types) ? (entry.workout_types as string[]) : [];
      const newTypes: string[] = Array.isArray(body[key]) ? body[key] : [];
      const merged = [...existingTypes, ...newTypes];
      entry[key] = merged.filter((v, i) => merged.indexOf(v) === i);
    } else if (key === 'workout_duration' && body[key] && existing?.workout_duration) {
      // Sum: add new session on top of existing
      entry[key] = Number(existing.workout_duration) + Number(body[key]);
    } else if (key === 'cardio_duration' && body[key] && existing?.cardio_duration) {
      // Sum: add new cardio on top of existing
      entry[key] = Number(existing.cardio_duration) + Number(body[key]);
    } else {
      // All other fields: new value wins
      entry[key] = body[key];
    }
  }

  // Validation: if workout_done is false, clear duration/types
  if (entry.workout_done === false) {
    entry.workout_duration = null;
    entry.workout_types = [];
  }
  if (entry.cardio_done === false) {
    entry.cardio_duration = null;
    entry.cardio_type = null;
  }
  // Ensure workout_types is array
  if (entry.workout_types != null && !Array.isArray(entry.workout_types)) {
    entry.workout_types = [];
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('age_bracket, goal_steps_day, goal_water_liters, goal_sleep_hours, goal_sleep_hours_min, goal_sleep_hours_max, fitness_goal, food_tracking_mode, goal_protein_g_day, goal_calories_day')
    .eq('id', user.id)
    .single();
  const ageBracket: AgeBracket = (profile?.age_bracket as AgeBracket) ?? '25_to_35';

  // Stamp scored_with_goal at time of entry creation/update
  entry.scored_with_goal = profile?.fitness_goal ?? null;

  entry.daily_points = calculateDailyPoints(
    entry as Parameters<typeof calculateDailyPoints>[0],
    ageBracket,
    profile ? {
      goal_protein_g_day: profile.goal_protein_g_day,
      goal_calories_day: profile.goal_calories_day,
      food_tracking_mode: profile.food_tracking_mode,
      fitness_goal: profile.fitness_goal,
    } : undefined,
  );
  entry.is_goal_crush_day = isGoalCrushDay(
    entry as Parameters<typeof isGoalCrushDay>[0],
    profile ?? {},
    entry.daily_points as number,
  );

  let { data, error } = await supabase
    .from('daily_entries')
    .upsert(entry, { onConflict: 'user_id,date', ignoreDuplicates: false })
    .select()
    .single();

  // If the upsert failed because is_goal_crush_day column doesn't exist yet
  // (migration 20260302_goal_crush_streak.sql not applied), retry without it.
  if (error && 'is_goal_crush_day' in entry) {
    const { is_goal_crush_day: _dropped, ...entryWithoutCrush } = entry as Record<string, unknown> & { is_goal_crush_day: unknown };
    void _dropped;
    const retry = await supabase
      .from('daily_entries')
      .upsert(entryWithoutCrush, { onConflict: 'user_id,date', ignoreDuplicates: false })
      .select()
      .single();
    data = retry.data;
    error = retry.error;
  }

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Fire-and-forget: send Slack + push notifications
  fireEntryNotifications(user.id, body, data.daily_points).catch(() => {});

  // Optional weight: upsert weekly_weigh_ins for entry date's week and update profile
  const weight_kg = body.weight_kg != null ? Number(body.weight_kg) : undefined;
  if (weight_kg != null && Number.isFinite(weight_kg) && weight_kg > 0 && weight_kg <= 500) {
    const week_start = weekStart(new Date(date + 'T12:00:00'));
    await supabase
      .from('weekly_weigh_ins')
      .upsert({ user_id: user.id, week_start, weight_kg }, { onConflict: 'user_id,week_start' });
    await supabase.from('profiles').update({ current_weight: weight_kg }).eq('id', user.id);
  }

  return NextResponse.json(data);
}

// ── Notification dispatcher (fire-and-forget) ────────────────────────────────

async function fireEntryNotifications(
  userId: string,
  body: Record<string, unknown>,
  pointsToday: number,
): Promise<void> {
  try {
    const admin = createServiceRoleClient();

    const [prefRes, profileRes] = await Promise.all([
      admin
        .from('notification_preferences')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle(),
      admin
        .from('profiles')
        .select('display_name, slack_user_id')
        .eq('id', userId)
        .single(),
    ]);

    if (prefRes.error || !prefRes.data) return;
    if (profileRes.error || !profileRes.data) return;

    const prefs = prefRes.data;
    const { display_name: displayName, slack_user_id: slackUserId } = profileRes.data;

    const category = detectEntryCategory(body);
    const blocks = buildEntryBlocks({ displayName, category, body, pointsToday });

    // Slack channel post
    if (prefs.slack_enabled && prefs.slack_channel_post_enabled) {
      await postToChannel(blocks);
    }

    // Slack DM
    if (prefs.slack_enabled && prefs.slack_dm_enabled && slackUserId) {
      await sendDM(
        slackUserId,
        `${displayName} just logged an activity — ${pointsToday} pts today!`,
        blocks,
      );
    }

    // Push notification
    if (prefs.push_enabled && prefs.push_on_entry_enabled) {
      const { data: tokens } = await admin
        .from('device_tokens')
        .select('token')
        .eq('user_id', userId);

      if (tokens && tokens.length > 0) {
        await sendPushToUser(
          tokens.map((t: { token: string }) => t.token),
          {
            title: '✅ Activity Logged!',
            body: `${displayName} logged ${category} — ${pointsToday} pts today`,
            data: { type: 'entry_logged', category },
          },
        );
      }
    }
  } catch (e) {
    console.error('[Notifications] fireEntryNotifications error:', e);
  }
}
