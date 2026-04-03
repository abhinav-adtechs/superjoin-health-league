import { getSupabaseWithUser } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const { supabase, user } = await getSupabaseWithUser(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data, error } = await supabase
    .from('weekly_weigh_ins')
    .select('week_start, weight_kg, created_at')
    .eq('user_id', user.id)
    .order('week_start', { ascending: false })
    .limit(52);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data ?? []);
}
