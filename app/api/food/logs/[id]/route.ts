import { getSupabaseWithUser } from '@/lib/supabase/server';
import { syncDailyEntryAfterFoodOrWater } from '@/lib/food/daily-rollup';
import { NextResponse } from 'next/server';

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { supabase, user } = await getSupabaseWithUser(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });

  const { data: existing, error: fetchError } = await supabase
    .from('meal_food_logs')
    .select('id, log_date')
    .eq('id', id)
    .eq('user_id', user.id)
    .maybeSingle();

  if (fetchError) return NextResponse.json({ error: fetchError.message }, { status: 500 });
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const { error: deleteError } = await supabase
    .from('meal_food_logs')
    .delete()
    .eq('id', id)
    .eq('user_id', user.id);

  if (deleteError) return NextResponse.json({ error: deleteError.message }, { status: 500 });

  const sync = await syncDailyEntryAfterFoodOrWater(
    supabase,
    user.id,
    existing.log_date as string,
  );
  if ('error' in sync) return NextResponse.json({ error: sync.error }, { status: 500 });

  return NextResponse.json({
    ok: true,
    daily_points: sync.daily_points,
    points_delta: sync.points_delta,
  });
}
