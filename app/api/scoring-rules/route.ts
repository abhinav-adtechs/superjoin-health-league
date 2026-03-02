import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

export interface ScoringRule {
  id: number;
  category: string;
  category_max: number | null;
  sort_order: number;
  action_label: string;
  field_name: string | null;
  condition_desc: string;
  points: number;
  is_bonus: boolean;
  age_adjusted: boolean;
  age_note: string | null;
}

export interface ScoringRulesResponse {
  rules: ScoringRule[];
  categories: string[];
}

// Fallback used when the scoring_rules table hasn't been migrated yet.
// Mirrors lib/points.ts and the two scoring_rules migrations exactly.
const FALLBACK_RULES: ScoringRule[] = [
  // Workout (max 20)
  { id: 1,  category: 'workout',        category_max: 20,   sort_order: 10, action_label: 'Complete any workout',                   field_name: 'workout_done',     condition_desc: 'workout_done = true',                                    points: 10,  is_bonus: false, age_adjusted: false, age_note: null },
  { id: 2,  category: 'workout',        category_max: 20,   sort_order: 20, action_label: 'Workout for 45+ minutes',                field_name: 'workout_duration', condition_desc: 'workout_duration >= 45',                                 points: 5,   is_bonus: true,  age_adjusted: false, age_note: null },
  { id: 3,  category: 'workout',        category_max: 20,   sort_order: 30, action_label: 'Workout for 60+ minutes',                field_name: 'workout_duration', condition_desc: 'workout_duration >= 60',                                 points: 5,   is_bonus: true,  age_adjusted: false, age_note: null },
  // Cardio (max 15)
  { id: 4,  category: 'cardio',         category_max: 15,   sort_order: 10, action_label: 'Complete any cardio session',            field_name: 'cardio_done',      condition_desc: 'cardio_done = true',                                     points: 10,  is_bonus: false, age_adjusted: false, age_note: null },
  { id: 5,  category: 'cardio',         category_max: 15,   sort_order: 20, action_label: 'Cardio for 30+ minutes',                 field_name: 'cardio_duration',  condition_desc: 'cardio_duration >= 30 min',                              points: 5,   is_bonus: true,  age_adjusted: true,  age_note: 'Over 35: threshold is 25.5 min (85%)' },
  // Sleep (max 15)
  { id: 6,  category: 'sleep',          category_max: 15,   sort_order: 10, action_label: 'Optimal sleep (7–9 hours)',              field_name: 'sleep_hours',      condition_desc: 'sleep_hours >= 7 AND <= 9',                              points: 10,  is_bonus: false, age_adjusted: false, age_note: null },
  { id: 7,  category: 'sleep',          category_max: 15,   sort_order: 15, action_label: 'Good sleep (6–7 hours)',                 field_name: 'sleep_hours',      condition_desc: 'sleep_hours >= 6 AND < 7',                               points: 5,   is_bonus: false, age_adjusted: false, age_note: null },
  { id: 8,  category: 'sleep',          category_max: 15,   sort_order: 20, action_label: 'High sleep quality (4+ / 5)',            field_name: 'sleep_quality',    condition_desc: 'sleep_quality >= 4',                                     points: 5,   is_bonus: true,  age_adjusted: false, age_note: null },
  // Nutrition (max 33)
  { id: 9,  category: 'nutrition',      category_max: 33,   sort_order: 10, action_label: 'Drink 3+ litres of water',               field_name: 'water_liters',     condition_desc: 'water_liters >= 3',                                      points: 10,  is_bonus: false, age_adjusted: false, age_note: null },
  { id: 10, category: 'nutrition',      category_max: 33,   sort_order: 15, action_label: 'Drink 2–3 litres of water',              field_name: 'water_liters',     condition_desc: 'water_liters >= 2 AND < 3',                              points: 5,   is_bonus: false, age_adjusted: false, age_note: null },
  { id: 11, category: 'nutrition',      category_max: 33,   sort_order: 20, action_label: 'Eat 2+ home-cooked meals',               field_name: 'home_cooked_meals',condition_desc: 'home_cooked_meals >= 2',                                 points: 5,   is_bonus: false, age_adjusted: false, age_note: null },
  { id: 12, category: 'nutrition',      category_max: 33,   sort_order: 30, action_label: 'Include a protein meal',                 field_name: 'protein_meal',     condition_desc: 'protein_meal = true',                                    points: 5,   is_bonus: false, age_adjusted: false, age_note: null },
  { id: 13, category: 'nutrition',      category_max: 33,   sort_order: 35, action_label: 'Protein meal with 100g+ protein',        field_name: 'protein_qty',      condition_desc: 'protein_meal = true AND protein_qty >= 100',             points: 3,   is_bonus: true,  age_adjusted: false, age_note: null },
  { id: 14, category: 'nutrition',      category_max: 33,   sort_order: 40, action_label: 'Avoid junk food',                        field_name: 'junk_food',        condition_desc: 'junk_food = false',                                      points: 5,   is_bonus: false, age_adjusted: false, age_note: null },
  { id: 15, category: 'nutrition',      category_max: 33,   sort_order: 50, action_label: 'No alcohol',                             field_name: 'alcohol',          condition_desc: "alcohol = 'zero'",                                       points: 5,   is_bonus: false, age_adjusted: false, age_note: null },
  // Steps (max 15)
  { id: 16, category: 'steps',          category_max: 15,   sort_order: 10, action_label: '10,000+ steps',                          field_name: 'steps',            condition_desc: 'steps >= 10,000',                                        points: 15,  is_bonus: false, age_adjusted: true,  age_note: 'Over 35: threshold is 8,500 steps (85%)' },
  { id: 17, category: 'steps',          category_max: 15,   sort_order: 20, action_label: '7,500+ steps',                           field_name: 'steps',            condition_desc: 'steps >= 7,500',                                         points: 10,  is_bonus: false, age_adjusted: true,  age_note: 'Over 35: threshold is 6,375 steps (85%)' },
  { id: 18, category: 'steps',          category_max: 15,   sort_order: 30, action_label: '5,000+ steps',                           field_name: 'steps',            condition_desc: 'steps >= 5,000',                                         points: 5,   is_bonus: false, age_adjusted: true,  age_note: 'Over 35: threshold is 4,250 steps (85%)' },
  // Logging streak
  { id: 19, category: 'logging_streak', category_max: null, sort_order: 10, action_label: '7-day logging streak',                   field_name: 'daily_entries',    condition_desc: 'consecutive log days = 7',                               points: 10,  is_bonus: false, age_adjusted: false, age_note: null },
  { id: 20, category: 'logging_streak', category_max: null, sort_order: 20, action_label: '14-day logging streak',                  field_name: 'daily_entries',    condition_desc: 'consecutive log days = 14',                              points: 20,  is_bonus: false, age_adjusted: false, age_note: null },
  { id: 21, category: 'logging_streak', category_max: null, sort_order: 30, action_label: '30-day logging streak',                  field_name: 'daily_entries',    condition_desc: 'consecutive log days = 30',                              points: 40,  is_bonus: false, age_adjusted: false, age_note: null },
  { id: 22, category: 'logging_streak', category_max: null, sort_order: 40, action_label: '60-day logging streak',                  field_name: 'daily_entries',    condition_desc: 'consecutive log days = 60',                              points: 75,  is_bonus: false, age_adjusted: false, age_note: null },
  { id: 23, category: 'logging_streak', category_max: null, sort_order: 50, action_label: '90-day logging streak',                  field_name: 'daily_entries',    condition_desc: 'consecutive log days = 90',                              points: 100, is_bonus: false, age_adjusted: false, age_note: null },
  { id: 24, category: 'logging_streak', category_max: null, sort_order: 60, action_label: 'Every 30 days beyond 90',                field_name: 'daily_entries',    condition_desc: 'consecutive log days mod 30 = 0 (after 90)',             points: 50,  is_bonus: false, age_adjusted: false, age_note: null },
  // Weekly performance
  { id: 25, category: 'weekly_perf',    category_max: null, sort_order: 10, action_label: 'Hit some weekly goals (partial)',        field_name: 'profiles',         condition_desc: 'some of: goal_workout_days_week, goal_workout_mins_week, goal_home_cooked_per_week met', points: 20, is_bonus: false, age_adjusted: false, age_note: null },
  { id: 26, category: 'weekly_perf',    category_max: null, sort_order: 20, action_label: 'Hit all weekly goals (full)',             field_name: 'profiles',         condition_desc: 'all set weekly goals met',                               points: 50,  is_bonus: false, age_adjusted: false, age_note: null },
  // Goal crush streak
  { id: 27, category: 'goal_crush',     category_max: null, sort_order: 10, action_label: '3-day goal crush streak',                field_name: 'is_goal_crush_day',condition_desc: 'consecutive goal crush days = 3',                        points: 15,  is_bonus: false, age_adjusted: false, age_note: null },
  { id: 28, category: 'goal_crush',     category_max: null, sort_order: 20, action_label: '7-day goal crush streak',                field_name: 'is_goal_crush_day',condition_desc: 'consecutive goal crush days = 7',                        points: 50,  is_bonus: false, age_adjusted: false, age_note: null },
  { id: 29, category: 'goal_crush',     category_max: null, sort_order: 30, action_label: '14-day goal crush streak',               field_name: 'is_goal_crush_day',condition_desc: 'consecutive goal crush days = 14',                       points: 100, is_bonus: false, age_adjusted: false, age_note: null },
  { id: 30, category: 'goal_crush',     category_max: null, sort_order: 40, action_label: '30-day goal crush streak',               field_name: 'is_goal_crush_day',condition_desc: 'consecutive goal crush days = 30',                       points: 200, is_bonus: false, age_adjusted: false, age_note: null },
  { id: 31, category: 'goal_crush',     category_max: null, sort_order: 50, action_label: 'Every 30 days beyond 30',                field_name: 'is_goal_crush_day',condition_desc: 'consecutive goal crush days mod 30 = 0 (after 30)',       points: 200, is_bonus: false, age_adjusted: false, age_note: null },
];

export async function GET() {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { data, error } = await supabase
    .from('scoring_rules')
    .select('*')
    .order('category')
    .order('sort_order');

  // If the table doesn't exist yet (migration not applied), serve the
  // hardcoded fallback so the UI always works.
  const rules: ScoringRule[] = (!error && data && data.length > 0) ? data : FALLBACK_RULES;
  const categories = [...new Set(rules.map((r) => r.category))];

  if (error) {
    console.warn('scoring_rules table not found, using fallback data:', error.code);
  }

  return NextResponse.json({ rules, categories } satisfies ScoringRulesResponse);
}
