import type { SupabaseClient } from '@supabase/supabase-js';
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

/** Recompute daily_entries nutrition from meal_food_logs + water_logs; preserve other fields. */
export async function syncDailyEntryAfterFoodOrWater(
  supabase: SupabaseClient,
  userId: string,
  date: string,
): Promise<{ daily_points: number; points_delta?: number } | { error: string }> {
  const { data: existing } = await supabase
    .from('daily_entries')
    .select('*')
    .eq('user_id', userId)
    .eq('date', date)
    .maybeSingle();

  const { data: mealLogs } = await supabase
    .from('meal_food_logs')
    .select('id')
    .eq('user_id', userId)
    .eq('log_date', date)
    .limit(1);

  const { data: waterLogs } = await supabase
    .from('water_logs')
    .select('id')
    .eq('user_id', userId)
    .eq('log_date', date)
    .limit(1);

  const hasMealLogs = (mealLogs?.length ?? 0) > 0;
  const hasWaterLogs = (waterLogs?.length ?? 0) > 0;

  const nutrition = hasMealLogs
    ? await rollupMealNutritionToDailyEntry(supabase, userId, date)
    : null;

  const water_liters = hasWaterLogs
    ? await rollupWaterToDailyEntry(supabase, userId, date)
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
    date,
    ...(existing ?? {}),
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

  const { data, error } = await supabase
    .from('daily_entries')
    .upsert(entry, { onConflict: 'user_id,date' })
    .select('daily_points')
    .single();

  if (error) return { error: error.message };

  return {
    daily_points: data?.daily_points ?? 0,
    points_delta: (data?.daily_points ?? 0) - prevPoints,
  };
}
