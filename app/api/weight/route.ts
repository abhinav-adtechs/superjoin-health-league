import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

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

  const body = await request.json();
  const weight_kg = Number(body.weight_kg);
  if (!Number.isFinite(weight_kg) || weight_kg <= 0 || weight_kg > 500) {
    return NextResponse.json({ error: 'Invalid weight_kg' }, { status: 400 });
  }

  const week_start = weekStart(new Date());
  const { data, error } = await supabase
    .from('weekly_weigh_ins')
    .upsert({ user_id: user.id, week_start, weight_kg }, { onConflict: 'user_id,week_start' })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await supabase.from('profiles').update({ current_weight: weight_kg }).eq('id', user.id);

  return NextResponse.json(data);
}
