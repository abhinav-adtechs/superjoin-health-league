import { getSupabaseWithUser } from '@/lib/supabase/server';
import { syncDailyEntryAfterFoodOrWater } from '@/lib/food/daily-rollup';
import { MEAL_TYPES, type FoodLogSource, type MealType } from '@/lib/food/types';
import {
  isValidDate,
  isWithinAllowedPastRange,
  normalizeYmd,
} from '@/lib/entryDateWindow';
import { NextResponse } from 'next/server';

const MAX_BATCH_ITEMS = 30;
const FOOD_SOURCES = new Set<FoodLogSource>(['catalog', 'nl_parse', 'manual']);
const MEAL_TYPE_SET = new Set<string>(MEAL_TYPES);

type MealLogInsert = {
  user_id: string;
  log_date: string;
  meal_type: MealType;
  food_catalog_id: string;
  display_name: string;
  quantity: number;
  unit: string;
  portion_key: string | null;
  portion_label: string | null;
  calories_kcal: number;
  protein_g: number;
  source: FoodLogSource;
  nl_raw: string | null;
};

function parsePostItem(raw: unknown): MealLogInsert | { error: string } {
  if (!raw || typeof raw !== 'object') return { error: 'Invalid item' };
  const o = raw as Record<string, unknown>;

  const food_catalog_id =
    typeof o.food_catalog_id === 'string' ? o.food_catalog_id.trim() : '';
  if (!food_catalog_id) return { error: 'food_catalog_id is required' };

  const display_name = typeof o.display_name === 'string' ? o.display_name.trim() : '';
  if (!display_name) return { error: 'display_name is required' };

  const meal_type = typeof o.meal_type === 'string' ? o.meal_type : '';
  if (!MEAL_TYPE_SET.has(meal_type)) return { error: 'Invalid meal_type' };

  const quantity = Number(o.quantity);
  if (!Number.isFinite(quantity) || quantity <= 0) return { error: 'Invalid quantity' };

  const unit = typeof o.unit === 'string' ? o.unit.trim() : '';
  if (!unit) return { error: 'unit is required' };

  const calories_kcal = Math.round(Number(o.calories_kcal));
  if (!Number.isFinite(calories_kcal) || calories_kcal < 0 || calories_kcal > 5000) {
    return { error: 'Invalid calories_kcal' };
  }

  const protein_g = Math.round(Number(o.protein_g) * 100) / 100;
  if (!Number.isFinite(protein_g) || protein_g < 0 || protein_g > 500) {
    return { error: 'Invalid protein_g' };
  }

  const source = typeof o.source === 'string' ? o.source : 'catalog';
  if (!FOOD_SOURCES.has(source as FoodLogSource)) return { error: 'Invalid source' };

  const portion_key =
    typeof o.portion_key === 'string' && o.portion_key.trim() ? o.portion_key.trim() : null;
  const portion_label =
    typeof o.portion_label === 'string' && o.portion_label.trim() ? o.portion_label.trim() : null;
  const nl_raw = typeof o.nl_raw === 'string' && o.nl_raw.trim() ? o.nl_raw.trim() : null;

  return {
    user_id: '',
    log_date: '',
    meal_type: meal_type as MealType,
    food_catalog_id,
    display_name,
    quantity,
    unit,
    portion_key,
    portion_label,
    calories_kcal,
    protein_g,
    source: source as FoodLogSource,
    nl_raw,
  };
}

export async function GET(request: Request) {
  const { supabase, user } = await getSupabaseWithUser(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const rawDate = searchParams.get('date') ?? '';
  const date = normalizeYmd(rawDate) ?? rawDate;
  if (!date || !isValidDate(date)) {
    return NextResponse.json({ error: 'Invalid or missing date' }, { status: 400 });
  }

  const { data: logs, error } = await supabase
    .from('meal_food_logs')
    .select(
      'id, log_date, meal_type, food_catalog_id, display_name, quantity, unit, portion_key, portion_label, calories_kcal, protein_g, source, nl_raw, created_at',
    )
    .eq('user_id', user.id)
    .eq('log_date', date)
    .order('created_at', { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  let calories_kcal = 0;
  let protein_g = 0;
  for (const row of logs ?? []) {
    calories_kcal += Number(row.calories_kcal ?? 0);
    protein_g += Number(row.protein_g ?? 0);
  }

  return NextResponse.json({
    items: logs ?? [],
    totals: {
      calories_kcal: Math.round(calories_kcal),
      protein_g: Math.round(protein_g * 100) / 100,
    },
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

    const rawDate = typeof (body as { date?: unknown }).date === 'string' ? (body as { date: string }).date : '';
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

    const rawItems = (body as { items?: unknown }).items;
    if (!Array.isArray(rawItems) || rawItems.length === 0) {
      return NextResponse.json({ error: 'items array is required' }, { status: 400 });
    }
    if (rawItems.length > MAX_BATCH_ITEMS) {
      return NextResponse.json(
        { error: `At most ${MAX_BATCH_ITEMS} items per batch` },
        { status: 400 },
      );
    }

    const rows: MealLogInsert[] = [];
    for (const raw of rawItems) {
      const parsed = parsePostItem(raw);
      if ('error' in parsed) {
        return NextResponse.json({ error: parsed.error }, { status: 400 });
      }
      rows.push({
        ...parsed,
        user_id: user.id,
        log_date: date,
      });
    }

    const { error: insertErr } = await supabase.from('meal_food_logs').insert(rows);
    if (insertErr) return NextResponse.json({ error: insertErr.message }, { status: 500 });

    const rollup = await syncDailyEntryAfterFoodOrWater(supabase, user.id, date);
    if ('error' in rollup) {
      return NextResponse.json({ error: rollup.error }, { status: 500 });
    }

    return NextResponse.json({
      daily_points: rollup.daily_points,
      points_delta: rollup.points_delta,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Failed to save food log';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
