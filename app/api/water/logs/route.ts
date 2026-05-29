import { getSupabaseWithUser } from '@/lib/supabase/server';
import { syncDailyEntryAfterFoodOrWater } from '@/lib/food/daily-rollup';
import type { WaterLogSource } from '@/lib/food/types';
import {
  isValidDate,
  isWithinAllowedPastRange,
  normalizeYmd,
} from '@/lib/entryDateWindow';
import { NextResponse } from 'next/server';

const WATER_SOURCES = new Set<WaterLogSource>([
  'quick_glass',
  'quick_bottle',
  'quick_liter',
  'manual',
  'integration',
]);

export async function GET(request: Request) {
  const { supabase, user } = await getSupabaseWithUser(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const rawDate = searchParams.get('date') ?? '';
  const date = normalizeYmd(rawDate) ?? rawDate;
  if (!date || !isValidDate(date)) {
    return NextResponse.json({ error: 'Invalid or missing date' }, { status: 400 });
  }

  const { data: items, error } = await supabase
    .from('water_logs')
    .select('id, log_date, amount_liters, label, source, created_at')
    .eq('user_id', user.id)
    .eq('log_date', date)
    .order('created_at', { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  let total_liters = 0;
  for (const row of items ?? []) {
    total_liters += Number(row.amount_liters ?? 0);
  }

  return NextResponse.json({
    items: items ?? [],
    total_liters: Math.round(total_liters * 100) / 100,
  });
}

export async function POST(request: Request) {
  try {
    const { supabase, user } = await getSupabaseWithUser(request);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
    }
    if (!body || typeof body !== 'object') {
      return NextResponse.json({ error: 'Invalid body' }, { status: 400 });
    }

    const b = body as Record<string, unknown>;
    const rawDate = typeof b.date === 'string' ? b.date : '';
    const date = normalizeYmd(rawDate) ?? rawDate;
    if (!date || !isValidDate(date)) {
      return NextResponse.json({ error: 'Invalid or missing date' }, { status: 400 });
    }
    if (!isWithinAllowedPastRange(date)) {
      return NextResponse.json(
        { error: 'Date must be today or up to 4 days in the past' },
        { status: 400 },
      );
    }

    const amount_liters = Math.round(Number(b.amount_liters) * 100) / 100;
    if (!Number.isFinite(amount_liters) || amount_liters <= 0 || amount_liters > 2) {
      return NextResponse.json({ error: 'Invalid amount_liters' }, { status: 400 });
    }

    const source = typeof b.source === 'string' ? b.source : 'quick_glass';
    if (!WATER_SOURCES.has(source as WaterLogSource)) {
      return NextResponse.json({ error: 'Invalid source' }, { status: 400 });
    }

    const label = typeof b.label === 'string' && b.label.trim() ? b.label.trim() : null;

    const { error: insertErr } = await supabase.from('water_logs').insert({
      user_id: user.id,
      log_date: date,
      amount_liters,
      source,
      label,
    });
    if (insertErr) return NextResponse.json({ error: insertErr.message }, { status: 500 });

    const rollup = await syncDailyEntryAfterFoodOrWater(supabase, user.id, date);
    if ('error' in rollup) {
      return NextResponse.json({ error: rollup.error }, { status: 500 });
    }

    const { data: dayLogs } = await supabase
      .from('water_logs')
      .select('amount_liters')
      .eq('user_id', user.id)
      .eq('log_date', date);

    let total_liters = 0;
    for (const row of dayLogs ?? []) {
      total_liters += Number(row.amount_liters ?? 0);
    }

    return NextResponse.json({
      total_liters: Math.round(total_liters * 100) / 100,
      daily_points: rollup.daily_points,
      points_delta: rollup.points_delta,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Failed to save water log';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
