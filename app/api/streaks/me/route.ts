import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: streaks, error } = await supabase
    .from('streaks')
    .select('*')
    .eq('user_id', user.id)
    .order('start_date', { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const today = new Date().toISOString().slice(0, 10);
  const { data: entries } = await supabase
    .from('daily_entries')
    .select('date')
    .eq('user_id', user.id)
    .order('date', { ascending: false })
    .limit(60);

  const entryDates = new Set((entries ?? []).map((e: { date: string }) => e.date));
  let currentLength = 0;
  const check = new Date(today);
  for (let i = 0; i < 365; i++) {
    const d = check.toISOString().slice(0, 10);
    if (entryDates.has(d)) currentLength++;
    else break;
    check.setDate(check.getDate() - 1);
  }

  const active = streaks?.find((s: { end_date: string | null }) => !s.end_date);

  return NextResponse.json({
    current_streak_days: currentLength,
    active_streak: active ?? null,
    history: streaks ?? [],
  });
}
