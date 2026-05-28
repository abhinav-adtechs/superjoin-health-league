import type { SupabaseClient } from '@supabase/supabase-js';
import { normalizeYmd } from '@/lib/entryDateWindow';
import { calculateDailyPoints, isGoalCrushDay } from '@/lib/points';
import type { AgeBracket } from '@/lib/types';

export async function rollupMealNutritionToDailyEntry(
  supabase: SupabaseClient,
  userId: string,
  date: string,
): Promise<{ protein_qty: number; calories_kcal: number; protein_meal: boolean }> {
  const { data: logs } = await supabase
    .from('meal_food_logs')
    .select('calories_kcal, protein_g')
    .eq('user_id', userId)
    .eq('log_date', date);

  let calories_kcal = 0;
  let protein_g = 0;
  for (const row of logs ?? []) {
    calories_kcal += Number(row.calories_kcal ?? 0);
    protein_g += Number(row.protein_g ?? 0);
  }
  const protein_qty = Math.round(protein_g);
  return {
    protein_qty,
    calories_kcal: Math.round(calories_kcal),
    protein_meal: protein_qty > 0,
  };
}

export async function rollupWaterToDailyEntry(
  supabase: SupabaseClient,
  userId: string,
  date: string,
): Promise<number> {
  const { data: logs } = await supabase
    .from('water_logs')
    .select('amount_liters')
    .eq('user_id', userId)
    .eq('log_date', date);

  let total = 0;
  for (const row of logs ?? []) {
    total += Number(row.amount_liters ?? 0);
  }
  return Math.round(total * 100) / 100;
}

function mergeExistingDailyFields(existing: Record<string, unknown> | null): Record<string, unknown> {
  if (!existing) return {};
  return {
    workout_done: existing.workout_done,
    workout_duration: existing.workout_duration,
    workout_types: existing.workout_types ?? [],
    cardio_done: existing.cardio_done,
    cardio_duration: existing.cardio_duration,
    cardio_type: existing.cardio_type,
    steps: existing.steps,
    water_liters: existing.water_liters,
    home_cooked_meals: existing.home_cooked_meals,
    protein_meal: existing.protein_meal,
    protein_qty: existing.protein_qty,
    junk_food: existing.junk_food,
    alcohol: existing.alcohol,
    sleep_hours: existing.sleep_hours,
    sleep_quality: existing.sleep_quality,
    calories_kcal: existing.calories_kcal,
  };
}

/** Recompute daily_entries nutrition from meal_food_logs + water_logs; preserve other fields. */
export async function syncDailyEntryAfterFoodOrWater(
  supabase: SupabaseClient,
  userId: string,
  date: string,
): Promise<{ daily_points: number; points_delta?: number } | { error: string }> {
  const dateNorm = normalizeYmd(date) ?? date;

  const { data: existing } = await supabase
    .from('daily_entries')
    .select('*')
    .eq('user_id', userId)
    .eq('date', dateNorm)
    .maybeSingle();

  const { data: mealLogs } = await supabase
    .from('meal_food_logs')
    .select('id')
    .eq('user_id', userId)
    .eq('log_date', dateNorm)
    .limit(1);

  const { data: waterLogs } = await supabase
    .from('water_logs')
    .select('id')
    .eq('user_id', userId)
    .eq('log_date', dateNorm)
    .limit(1);

  const hasMealLogs = (mealLogs?.length ?? 0) > 0;
  const hasWaterLogs = (waterLogs?.length ?? 0) > 0;

  const nutrition = hasMealLogs
    ? await rollupMealNutritionToDailyEntry(supabase, userId, dateNorm)
    : null;

  const water_liters = hasWaterLogs
    ? await rollupWaterToDailyEntry(supabase, userId, dateNorm)
    : existing?.water_liters ?? null;

  const { data: profile } = await supabase
    .from('profiles')
    .select(
      'age_bracket, fitness_goal, food_tracking_mode, goal_protein_g_day, goal_calories_day, goal_steps_day',
    )
    .eq('id', userId)
    .single();

  const ageBracket: AgeBracket = (profile?.age_bracket as AgeBracket) ?? '25_to_35';
  const profileForPoints = profile
    ? {
        goal_protein_g_day: profile.goal_protein_g_day,
        goal_calories_day: profile.goal_calories_day,
        food_tracking_mode: profile.food_tracking_mode,
        fitness_goal: profile.fitness_goal,
        goal_steps_day: profile.goal_steps_day,
      }
    : undefined;

  const entry: Record<string, unknown> = {
    user_id: userId,
    date: dateNorm,
    ...mergeExistingDailyFields(existing as Record<string, unknown> | null),
  };

  if (hasMealLogs && nutrition) {
    entry.protein_qty = nutrition.protein_qty;
    entry.calories_kcal = nutrition.calories_kcal;
    entry.protein_meal = nutrition.protein_meal;
  } else {
    entry.protein_qty = null;
    entry.calories_kcal = null;
    entry.protein_meal = false;
  }

  if (hasWaterLogs) {
    entry.water_liters = water_liters;
  } else if (!hasWaterLogs && existing) {
    entry.water_liters = existing.water_liters;
  }

  const prevPoints = existing
    ? calculateDailyPoints(
        existing as Parameters<typeof calculateDailyPoints>[0],
        ageBracket,
        profileForPoints,
      )
    : 0;

  entry.scored_with_goal = profile?.fitness_goal ?? null;
  entry.daily_points = calculateDailyPoints(
    entry as Parameters<typeof calculateDailyPoints>[0],
    ageBracket,
    profileForPoints,
  );
  entry.is_goal_crush_day = isGoalCrushDay(
    entry as Parameters<typeof isGoalCrushDay>[0],
    profile ?? {},
    entry.daily_points as number,
  );

  let { data, error } = await supabase
    .from('daily_entries')
    .upsert(entry, { onConflict: 'user_id,date', ignoreDuplicates: false })
    .select('daily_points')
    .single();

  if (error && 'is_goal_crush_day' in entry) {
    const { is_goal_crush_day: _dropped, ...withoutCrush } = entry as Record<string, unknown> & {
      is_goal_crush_day: unknown;
    };
    void _dropped;
    const retry = await supabase
      .from('daily_entries')
      .upsert(withoutCrush, { onConflict: 'user_id,date', ignoreDuplicates: false })
      .select('daily_points')
      .single();
    data = retry.data;
    error = retry.error;
  }

  if (error) return { error: error.message };

  return {
    daily_points: data?.daily_points ?? 0,
    points_delta: (data?.daily_points ?? 0) - prevPoints,
  };
}
