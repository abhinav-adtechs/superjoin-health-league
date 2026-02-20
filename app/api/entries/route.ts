import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { calculateDailyPoints, getAgeBracket } from '@/lib/points';
import type { AgeBracket } from '@/lib/types';

const ALLOWED_FIELDS = [
  'workout_done', 'workout_duration', 'workout_types', 'cardio_done', 'cardio_duration', 'cardio_type',
  'steps', 'water_liters', 'home_cooked_meals', 'protein_meal', 'protein_qty', 'junk_food', 'alcohol',
  'sleep_hours', 'sleep_quality',
] as const;

function isValidDate(dateStr: string): boolean {
  const d = new Date(dateStr);
  return !isNaN(d.getTime());
}

function isTodayOrYesterday(dateStr: string): boolean {
  const d = new Date(dateStr);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const dDate = d.toDateString();
  return dDate === today.toDateString() || dDate === yesterday.toDateString();
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
  if (!isTodayOrYesterday(date)) {
    return NextResponse.json({ error: 'Only today or yesterday can be logged' }, { status: 400 });
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
    } : {}),
  };
  for (const key of ALLOWED_FIELDS) {
    if (body[key] !== undefined) entry[key] = body[key];
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

  const { data: profile } = await supabase.from('profiles').select('age_bracket').eq('id', user.id).single();
  const ageBracket: AgeBracket = (profile?.age_bracket as AgeBracket) ?? '25_to_35';
  entry.daily_points = calculateDailyPoints(entry as Parameters<typeof calculateDailyPoints>[0], ageBracket);

  const { data, error } = await supabase
    .from('daily_entries')
    .upsert(entry, { onConflict: 'user_id,date', ignoreDuplicates: false })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
