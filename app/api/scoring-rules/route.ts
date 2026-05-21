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

// v3 scoring rules — mirror lib/points.ts exactly.
const FALLBACK_RULES: ScoringRule[] = [
  // Workout (max 25) — duration gradient, age-adjusted thresholds
  { id: 1,  category: 'workout',        category_max: 25,   sort_order: 10, action_label: 'Log any workout',                        field_name: 'workout_done',     condition_desc: 'workout_done = true',                              points: 5,   is_bonus: false, age_adjusted: false, age_note: null },
  { id: 2,  category: 'workout',        category_max: 25,   sort_order: 20, action_label: 'Workout 15+ minutes',                    field_name: 'workout_duration', condition_desc: 'workout_duration >= 15 min',                       points: 11,  is_bonus: false, age_adjusted: true,  age_note: 'Over 35: threshold is 13 min (85%)' },
  { id: 3,  category: 'workout',        category_max: 25,   sort_order: 30, action_label: 'Workout 30+ minutes',                    field_name: 'workout_duration', condition_desc: 'workout_duration >= 30 min',                       points: 15,  is_bonus: false, age_adjusted: true,  age_note: 'Over 35: threshold is 26 min (85%)' },
  { id: 4,  category: 'workout',        category_max: 25,   sort_order: 40, action_label: 'Workout 45+ minutes',                    field_name: 'workout_duration', condition_desc: 'workout_duration >= 45 min',                       points: 20,  is_bonus: false, age_adjusted: true,  age_note: 'Over 35: threshold is 38 min (85%)' },
  { id: 5,  category: 'workout',        category_max: 25,   sort_order: 50, action_label: 'Workout 60+ minutes',                    field_name: 'workout_duration', condition_desc: 'workout_duration >= 60 min',                       points: 25,  is_bonus: false, age_adjusted: true,  age_note: 'Over 35: threshold is 51 min (85%)' },
  // Movement: cardio gradient (max 20 each sub-metric, combined cap 20)
  { id: 6,  category: 'movement',       category_max: 20,   sort_order: 10, action_label: 'Log any cardio session',                 field_name: 'cardio_done',      condition_desc: 'cardio_done = true',                               points: 4,   is_bonus: false, age_adjusted: false, age_note: null },
  { id: 7,  category: 'movement',       category_max: 20,   sort_order: 20, action_label: 'Cardio 15+ minutes',                     field_name: 'cardio_duration',  condition_desc: 'cardio_duration >= 15 min',                        points: 8,   is_bonus: false, age_adjusted: true,  age_note: 'Over 35: threshold is 13 min (85%)' },
  { id: 8,  category: 'movement',       category_max: 20,   sort_order: 30, action_label: 'Cardio 30+ minutes',                     field_name: 'cardio_duration',  condition_desc: 'cardio_duration >= 30 min',                        points: 12,  is_bonus: false, age_adjusted: true,  age_note: 'Over 35: threshold is 26 min (85%)' },
  { id: 9,  category: 'movement',       category_max: 20,   sort_order: 40, action_label: 'Cardio 45+ minutes',                     field_name: 'cardio_duration',  condition_desc: 'cardio_duration >= 45 min',                        points: 16,  is_bonus: false, age_adjusted: true,  age_note: 'Over 35: threshold is 38 min (85%)' },
  { id: 10, category: 'movement',       category_max: 20,   sort_order: 50, action_label: 'Cardio 60+ minutes',                     field_name: 'cardio_duration',  condition_desc: 'cardio_duration >= 60 min',                        points: 20,  is_bonus: false, age_adjusted: true,  age_note: 'Over 35: threshold is 51 min (85%)' },
  { id: 11, category: 'movement',       category_max: 20,   sort_order: 60, action_label: '100% of step goal (or 10,000+ steps)',   field_name: 'steps',            condition_desc: 'steps >= goal_steps_day OR >= 10,000',             points: 20,  is_bonus: false, age_adjusted: true,  age_note: 'Over 35: fixed fallback 8,500 steps' },
  { id: 12, category: 'movement',       category_max: 20,   sort_order: 70, action_label: '75% of step goal (or 7,500+ steps)',     field_name: 'steps',            condition_desc: 'steps >= 75% of goal OR >= 7,500',                 points: 15,  is_bonus: false, age_adjusted: true,  age_note: 'Over 35: fixed fallback 6,375 steps' },
  { id: 13, category: 'movement',       category_max: 20,   sort_order: 80, action_label: '50% of step goal (or 5,000+ steps)',     field_name: 'steps',            condition_desc: 'steps >= 50% of goal OR >= 5,000',                 points: 10,  is_bonus: false, age_adjusted: true,  age_note: 'Over 35: fixed fallback 4,250 steps' },
  { id: 14, category: 'movement',       category_max: 20,   sort_order: 90, action_label: '25% of step goal (or 2,500+ steps)',     field_name: 'steps',            condition_desc: 'steps >= 25% of goal OR >= 2,500',                 points: 5,   is_bonus: false, age_adjusted: true,  age_note: 'Over 35: fixed fallback 2,125 steps' },
  { id: 15, category: 'movement',       category_max: 20,   sort_order: 95, action_label: 'Cardio + steps combined cap',            field_name: null,               condition_desc: 'min(cardio_pts + steps_pts, 20)',                  points: 20,  is_bonus: false, age_adjusted: false, age_note: 'Both sub-metrics scale to 20; sum capped at 20' },
  // Sleep (max 15) — 5-tier gradient
  { id: 16, category: 'sleep',          category_max: 15,   sort_order: 10, action_label: 'Optimal sleep (8–9 hours)',              field_name: 'sleep_hours',      condition_desc: 'sleep_hours >= 8 AND < 9',                         points: 15,  is_bonus: false, age_adjusted: false, age_note: null },
  { id: 17, category: 'sleep',          category_max: 15,   sort_order: 15, action_label: 'Good sleep (7–8 hours)',                 field_name: 'sleep_hours',      condition_desc: 'sleep_hours >= 7 AND < 8',                         points: 12,  is_bonus: false, age_adjusted: false, age_note: null },
  { id: 18, category: 'sleep',          category_max: 15,   sort_order: 20, action_label: 'Fair sleep (6–7 hours)',                 field_name: 'sleep_hours',      condition_desc: 'sleep_hours >= 6 AND < 7',                         points: 7,   is_bonus: false, age_adjusted: false, age_note: null },
  { id: 19, category: 'sleep',          category_max: 15,   sort_order: 25, action_label: 'Short sleep (5–6 hours)',                field_name: 'sleep_hours',      condition_desc: 'sleep_hours >= 5 AND < 6',                         points: 3,   is_bonus: false, age_adjusted: false, age_note: null },
  { id: 20, category: 'sleep',          category_max: 15,   sort_order: 30, action_label: 'Extended sleep (9+ hours)',              field_name: 'sleep_hours',      condition_desc: 'sleep_hours >= 9',                                 points: 13,  is_bonus: false, age_adjusted: false, age_note: 'Mild over-sleep signal' },
  // Nutrition — water (all modes; max 15 or 10 in both mode)
  { id: 21, category: 'nutrition',      category_max: 30,   sort_order: 10, action_label: 'Drink 3+ litres of water',               field_name: 'water_liters',     condition_desc: 'water_liters >= 3',                                points: 15,  is_bonus: false, age_adjusted: false, age_note: 'Max 15 (water-only) or 10 (both mode)' },
  { id: 22, category: 'nutrition',      category_max: 30,   sort_order: 15, action_label: 'Drink 2.5+ litres of water',             field_name: 'water_liters',     condition_desc: 'water_liters >= 2.5',                              points: 12,  is_bonus: false, age_adjusted: false, age_note: null },
  { id: 23, category: 'nutrition',      category_max: 30,   sort_order: 20, action_label: 'Drink 2+ litres of water',               field_name: 'water_liters',     condition_desc: 'water_liters >= 2',                                points: 9,   is_bonus: false, age_adjusted: false, age_note: null },
  { id: 24, category: 'nutrition',      category_max: 30,   sort_order: 25, action_label: 'Drink 1.5+ litres of water',             field_name: 'water_liters',     condition_desc: 'water_liters >= 1.5',                              points: 6,   is_bonus: false, age_adjusted: false, age_note: null },
  { id: 25, category: 'nutrition',      category_max: 30,   sort_order: 30, action_label: 'Drink 1+ litre of water',                field_name: 'water_liters',     condition_desc: 'water_liters >= 1',                                points: 3,   is_bonus: false, age_adjusted: false, age_note: null },
  // Protein (protein_only / both)
  { id: 26, category: 'nutrition',      category_max: 30,   sort_order: 40, action_label: 'Protein goal hit (100%)',                field_name: 'protein_qty',      condition_desc: 'protein_qty >= goal_protein_g_day',                points: 15,  is_bonus: false, age_adjusted: false, age_note: 'Max 15 (protein_only) or 10 (both mode)' },
  { id: 27, category: 'nutrition',      category_max: 30,   sort_order: 45, action_label: 'Protein 75% of goal',                    field_name: 'protein_qty',      condition_desc: 'protein_qty >= 75% of goal',                       points: 11,  is_bonus: false, age_adjusted: false, age_note: null },
  { id: 28, category: 'nutrition',      category_max: 30,   sort_order: 50, action_label: 'Protein 50% of goal',                    field_name: 'protein_qty',      condition_desc: 'protein_qty >= 50% of goal',                       points: 7,   is_bonus: false, age_adjusted: false, age_note: null },
  { id: 29, category: 'nutrition',      category_max: 30,   sort_order: 55, action_label: 'Protein 25% of goal',                    field_name: 'protein_qty',      condition_desc: 'protein_qty >= 25% of goal',                       points: 4,   is_bonus: false, age_adjusted: false, age_note: null },
  { id: 30, category: 'nutrition',      category_max: 30,   sort_order: 60, action_label: 'Any protein logged',                     field_name: 'protein_qty',      condition_desc: 'protein_qty > 0',                                  points: 2,   is_bonus: false, age_adjusted: false, age_note: null },
  // Calories (calories_only / both) — direction-aware
  { id: 31, category: 'nutrition',      category_max: 30,   sort_order: 70, action_label: 'Calories on target (±2%)',               field_name: 'calories_kcal',    condition_desc: 'Within ±2% per fitness goal direction',            points: 15,  is_bonus: false, age_adjusted: false, age_note: 'Max 15 (calories_only) or 10 (both). Cutting: ≤ budget · Bulking: ≥ target' },
  { id: 32, category: 'nutrition',      category_max: 30,   sort_order: 75, action_label: 'Calories within ±5%',                    field_name: 'calories_kcal',    condition_desc: 'Within ±5% per fitness goal direction',            points: 12,  is_bonus: false, age_adjusted: false, age_note: null },
  { id: 33, category: 'nutrition',      category_max: 30,   sort_order: 80, action_label: 'Calories within ±10%',                   field_name: 'calories_kcal',    condition_desc: 'Within ±10% per fitness goal direction',           points: 8,   is_bonus: false, age_adjusted: false, age_note: null },
  { id: 34, category: 'nutrition',      category_max: 30,   sort_order: 85, action_label: 'Calories within ±15%',                   field_name: 'calories_kcal',    condition_desc: 'Within ±15% per fitness goal direction',           points: 4,   is_bonus: false, age_adjusted: false, age_note: null },
  { id: 35, category: 'nutrition',      category_max: 30,   sort_order: 90, action_label: 'Nutrition cap by tracking mode',         field_name: null,               condition_desc: 'null/water-only: 15 pts · other modes: 30 pts',    points: 30,  is_bonus: false, age_adjusted: false, age_note: 'Daily cap: 75 pts (water only) or 90 pts (full tracking)' },
  // Logging streak
  { id: 36, category: 'logging_streak', category_max: null, sort_order: 10, action_label: '7-day logging streak',                   field_name: 'daily_entries',    condition_desc: 'consecutive log days = 7',                         points: 10,  is_bonus: false, age_adjusted: false, age_note: null },
  { id: 37, category: 'logging_streak', category_max: null, sort_order: 20, action_label: '14-day logging streak',                  field_name: 'daily_entries',    condition_desc: 'consecutive log days = 14',                        points: 20,  is_bonus: false, age_adjusted: false, age_note: null },
  { id: 38, category: 'logging_streak', category_max: null, sort_order: 30, action_label: '30-day logging streak',                  field_name: 'daily_entries',    condition_desc: 'consecutive log days = 30',                        points: 40,  is_bonus: false, age_adjusted: false, age_note: null },
  { id: 39, category: 'logging_streak', category_max: null, sort_order: 40, action_label: '60-day logging streak',                  field_name: 'daily_entries',    condition_desc: 'consecutive log days = 60',                        points: 75,  is_bonus: false, age_adjusted: false, age_note: null },
  { id: 40, category: 'logging_streak', category_max: null, sort_order: 50, action_label: '90-day logging streak',                  field_name: 'daily_entries',    condition_desc: 'consecutive log days = 90',                        points: 100, is_bonus: false, age_adjusted: false, age_note: null },
  { id: 41, category: 'logging_streak', category_max: null, sort_order: 60, action_label: 'Every 30 days beyond 90',                field_name: 'daily_entries',    condition_desc: 'consecutive log days mod 30 = 0 (after 90)',       points: 50,  is_bonus: false, age_adjusted: false, age_note: null },
  // Weekly performance
  { id: 42, category: 'weekly_perf',    category_max: null, sort_order: 10, action_label: 'Hit some weekly goals (partial)',        field_name: 'profiles',         condition_desc: 'some of: goal_workout_days_week, goal_workout_mins_week met', points: 20,  is_bonus: false, age_adjusted: false, age_note: null },
  { id: 43, category: 'weekly_perf',    category_max: null, sort_order: 20, action_label: 'Hit all weekly goals (full)',           field_name: 'profiles',         condition_desc: 'all set weekly goals met (workout days + minutes)', points: 50,  is_bonus: false, age_adjusted: false, age_note: null },
  // Goal crush streak — 70% of daily cap + 3+ categories
  { id: 44, category: 'goal_crush',     category_max: null, sort_order: 10, action_label: '3-day goal crush streak',                field_name: 'is_goal_crush_day',condition_desc: 'consecutive goal crush days = 3',                  points: 15,  is_bonus: false, age_adjusted: false, age_note: null },
  { id: 45, category: 'goal_crush',     category_max: null, sort_order: 20, action_label: '7-day goal crush streak',                field_name: 'is_goal_crush_day',condition_desc: 'consecutive goal crush days = 7',                    points: 50,  is_bonus: false, age_adjusted: false, age_note: null },
  { id: 46, category: 'goal_crush',     category_max: null, sort_order: 30, action_label: '14-day goal crush streak',               field_name: 'is_goal_crush_day',condition_desc: 'consecutive goal crush days = 14',                   points: 100, is_bonus: false, age_adjusted: false, age_note: null },
  { id: 47, category: 'goal_crush',     category_max: null, sort_order: 40, action_label: '30-day goal crush streak',               field_name: 'is_goal_crush_day',condition_desc: 'consecutive goal crush days = 30',                   points: 150, is_bonus: false, age_adjusted: false, age_note: null },
  { id: 48, category: 'goal_crush',     category_max: null, sort_order: 50, action_label: 'Every 30 days beyond 30',                field_name: 'is_goal_crush_day',condition_desc: 'consecutive goal crush days mod 30 = 0 (after 30)',  points: 100, is_bonus: false, age_adjusted: false, age_note: null },
  { id: 49, category: 'goal_crush',     category_max: null, sort_order: 5,  action_label: 'Goal crush day threshold',               field_name: 'daily_points',     condition_desc: '≥ 70% of your daily cap + 3 of 4 categories',      points: 0,   is_bonus: false, age_adjusted: false, age_note: '53 pts (water-only) or 63 pts (full tracking)' },
];

export async function GET() {
  const rules: ScoringRule[] = FALLBACK_RULES;
  const categories = Array.from(new Set(rules.map((r) => r.category)));

  return NextResponse.json({ rules, categories } satisfies ScoringRulesResponse);
}
