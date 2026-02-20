import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single();

  if (profileError && profileError.code !== 'PGRST116') {
    return NextResponse.json({ error: profileError.message }, { status: 500 });
  }

  return NextResponse.json({ user: { id: user.id, email: user.email }, profile: profile ?? null });
}

export async function PUT(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json();
  const allowed = [
    'display_name', 'age', 'gender', 'height_cm', 'starting_weight', 'current_weight',
    'fitness_goal', 'timezone', 'reminder_time', 'slack_user_id', 'avatar_url',
    'goal_workout_mins_week', 'goal_workout_days_week', 'goal_steps_day',
    'goal_sleep_hours', 'goal_sleep_hours_min', 'goal_sleep_hours_max', 'goal_water_liters', 'goal_home_cooked_per_week'
  ];
  const updates: Record<string, unknown> = {};
  for (const key of allowed) {
    if (body[key] !== undefined) updates[key] = body[key];
  }
  if (body.age != null) {
    const age = Number(body.age);
    if (age < 25) updates.age_bracket = 'under_25';
    else if (age <= 35) updates.age_bracket = '25_to_35';
    else updates.age_bracket = 'over_35';
  }

  const { data, error } = await supabase
    .from('profiles')
    .update(updates)
    .eq('id', user.id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
