import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { getAgeBracket } from '@/lib/points';

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
      fitness_goal: 'general_wellness',
      age_bracket,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
