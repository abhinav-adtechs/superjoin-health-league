import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { getAgeBracket } from '@/lib/points';
import type { FitnessGoal, FoodTrackingMode } from '@/lib/types';
import { clampGoalWorkoutMinsWeek } from '@/lib/goal-defaults';
import { parseGoalWorkoutTypes } from '@/lib/workout-goals';

const FITNESS_GOALS: FitnessGoal[] = [
  'lose_weight',
  'gain_muscle',
  'gain_weight',
  'stay_active',
  'general_wellness',
];

const FOOD_MODES: FoodTrackingMode[] = ['protein_only', 'calories_only', 'both'];

function optNum(body: Record<string, unknown>, key: string): number | null {
  if (!(key in body) || body[key] === null || body[key] === '') return null;
  const n = Number(body[key]);
  return Number.isFinite(n) ? n : null;
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: existing } = await supabase.from('profiles').select('id').eq('id', user.id).maybeSingle();
  if (existing) {
    return NextResponse.json({ error: 'Profile already exists', profile: existing }, { status: 400 });
  }

  const body = await request.json();
  const display_name = body.display_name?.trim();
  const age = Number(body.age);
  const gender = body.gender;
  const height_cm = Number(body.height_cm);
  const current_weight = Number(body.current_weight ?? body.starting_weight);

  if (!display_name || display_name.length < 1) {
    return NextResponse.json({ error: 'display_name required' }, { status: 400 });
  }
  if (!Number.isFinite(age) || age < 10 || age > 120) {
    return NextResponse.json({ error: 'Valid age (10–120) required' }, { status: 400 });
  }
  if (!['male', 'female', 'other'].includes(gender)) {
    return NextResponse.json({ error: 'gender must be male, female, or other' }, { status: 400 });
  }
  if (!Number.isFinite(height_cm) || height_cm <= 0 || height_cm > 300) {
    return NextResponse.json({ error: 'Valid height_cm required' }, { status: 400 });
  }
  if (!Number.isFinite(current_weight) || current_weight <= 0 || current_weight > 500) {
    return NextResponse.json({ error: 'Valid current_weight required' }, { status: 400 });
  }

  const age_bracket = getAgeBracket(age);

  const fitness_goal: FitnessGoal = FITNESS_GOALS.includes(body.fitness_goal)
    ? body.fitness_goal
    : 'general_wellness';

  const food_tracking_mode =
    body.food_tracking_mode != null && FOOD_MODES.includes(body.food_tracking_mode)
      ? body.food_tracking_mode
      : 'protein_only';

  let goal_protein_g_day = optNum(body, 'goal_protein_g_day');
  let goal_calories_day = optNum(body, 'goal_calories_day');
  if (food_tracking_mode === 'calories_only') goal_protein_g_day = null;
  if (food_tracking_mode === 'protein_only') goal_calories_day = null;

  const goal_workout_types = parseGoalWorkoutTypes(body.goal_workout_types ?? body.goal_workout_type);
  if (goal_workout_types.length === 0) {
    return NextResponse.json({ error: 'Select at least one workout type' }, { status: 400 });
  }

  const goal_sleep_hours = optNum(body, 'goal_sleep_hours');
  const goal_water_liters = optNum(body, 'goal_water_liters');
  const goal_workout_mins_week_raw = optNum(body, 'goal_workout_mins_week');
  const goal_workout_mins_week =
    goal_workout_mins_week_raw == null ? null : clampGoalWorkoutMinsWeek(goal_workout_mins_week_raw);
  const goal_workout_days_week = optNum(body, 'goal_workout_days_week');
  const goal_steps_day = optNum(body, 'goal_steps_day');

  const { data, error } = await supabase
    .from('profiles')
    .insert({
      id: user.id,
      display_name,
      age,
      gender,
      height_cm,
      starting_weight: current_weight,
      current_weight,
      fitness_goal,
      age_bracket,
      food_tracking_mode,
      goal_protein_g_day,
      goal_calories_day,
      goal_workout_types,
      goal_sleep_hours,
      goal_water_liters,
      goal_workout_mins_week,
      goal_workout_days_week,
      goal_steps_day,
      goal_changed_at: new Date().toISOString(),
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
