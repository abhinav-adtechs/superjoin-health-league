import { getSupabaseWithUser } from '@/lib/supabase/server';
import { syncDailyEntryAfterFoodOrWater } from '@/lib/food/daily-rollup';
import { MAX_DELETE_DAYS_BACK, isValidDate, normalizeYmd } from '@/lib/entryDateWindow';
import { NextResponse } from 'next/server';

export async function DELETE(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { supabase, user } = await getSupabaseWithUser(request);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id } = await context.params;
    if (!id?.trim()) return NextResponse.json({ error: 'Missing id' }, { status: 400 });

    const { data: row, error: fetchErr } = await supabase
      .from('water_logs')
      .select('id, log_date')
      .eq('id', id)
      .eq('user_id', user.id)
      .maybeSingle();

    if (fetchErr) return NextResponse.json({ error: fetchErr.message }, { status: 500 });
    if (!row) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    const logDate = normalizeYmd(row.log_date as string) ?? String(row.log_date);
    if (!logDate || !isValidDate(logDate)) {
      return NextResponse.json({ error: 'Invalid log date' }, { status: 500 });
    }

    const today = new Date().toISOString().slice(0, 10);
    const minDelete = new Date(today + 'T12:00:00');
    minDelete.setDate(minDelete.getDate() - MAX_DELETE_DAYS_BACK);
    const minStr = minDelete.toISOString().slice(0, 10);
    if (logDate < minStr) {
      return NextResponse.json(
        { error: 'You can only remove entries for today and the past 2 days' },
        { status: 400 },
      );
    }

    const { error: delErr } = await supabase
      .from('water_logs')
      .delete()
      .eq('id', id)
      .eq('user_id', user.id);

    if (delErr) return NextResponse.json({ error: delErr.message }, { status: 500 });

    const rollup = await syncDailyEntryAfterFoodOrWater(supabase, user.id, logDate);
    if ('error' in rollup) {
      return NextResponse.json({ error: rollup.error }, { status: 500 });
    }

    return NextResponse.json({
      deleted: true,
      daily_points: rollup.daily_points,
      points_delta: rollup.points_delta,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Failed to delete water log';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
