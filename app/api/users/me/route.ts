import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { parseGoalWorkoutTypes } from '@/lib/workout-goals';

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

  const raw = profile as Record<string, unknown> | null;
  const profileOut =
    raw == null
      ? null
      : {
          ...raw,
          goal_workout_types: parseGoalWorkoutTypes(
            raw.goal_workout_types ?? raw.goal_workout_type
          ),
        };
  if (profileOut && 'goal_workout_type' in profileOut) {
    delete (profileOut as Record<string, unknown>).goal_workout_type;
  }

  return NextResponse.json({ user: { id: user.id, email: user.email }, profile: profileOut });
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
    'goal_sleep_hours', 'goal_sleep_hours_min', 'goal_sleep_hours_max', 'goal_water_liters', 'goal_home_cooked_per_week',
    // New goal fields
    'food_tracking_mode', 'goal_protein_g_day', 'goal_calories_day',
  ];
  const updates: Record<string, unknown> = {};

  // Fetch current profile to detect fitness_goal change
  const { data: currentProfile } = await supabase
    .from('profiles')
    .select('fitness_goal')
    .eq('id', user.id)
    .single();

  for (const key of allowed) {
    if (body[key] !== undefined) updates[key] = body[key];
  }
  if (body.goal_workout_types !== undefined) {
    const parsed = parseGoalWorkoutTypes(body.goal_workout_types);
    if (parsed.length === 0) {
      return NextResponse.json({ error: 'Select at least one workout type' }, { status: 400 });
    }
    updates.goal_workout_types = parsed;
  }
  if (body.age != null) {
    const age = Number(body.age);
    if (age < 25) updates.age_bracket = 'under_25';
    else if (age <= 35) updates.age_bracket = '25_to_35';
    else updates.age_bracket = 'over_35';
  }

  // Stamp goal_changed_at when fitness_goal or food_tracking_mode changes
  if (
    (body.fitness_goal !== undefined && body.fitness_goal !== currentProfile?.fitness_goal) ||
    body.food_tracking_mode !== undefined
  ) {
    updates.goal_changed_at = new Date().toISOString();
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
