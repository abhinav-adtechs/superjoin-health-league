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

// v2 scoring rules — mirror lib/points.ts exactly.
const FALLBACK_RULES: ScoringRule[] = [
  // Workout (max 20) — age-adjusted for 35+
  { id: 1,  category: 'workout',        category_max: 20,   sort_order: 10, action_label: 'Complete any workout',                   field_name: 'workout_done',     condition_desc: 'workout_done = true',                                        points: 10,  is_bonus: false, age_adjusted: false, age_note: null },
  { id: 2,  category: 'workout',        category_max: 20,   sort_order: 20, action_label: 'Workout for 45+ minutes',                field_name: 'workout_duration', condition_desc: 'workout_duration >= 45',                                     points: 5,   is_bonus: true,  age_adjusted: true,  age_note: 'Over 35: threshold is 38 min (85%)' },
  { id: 3,  category: 'workout',        category_max: 20,   sort_order: 30, action_label: 'Workout for 60+ minutes',                field_name: 'workout_duration', condition_desc: 'workout_duration >= 60',                                     points: 5,   is_bonus: true,  age_adjusted: true,  age_note: 'Over 35: threshold is 51 min (85%)' },
  // Movement: cardio + steps, highest tier only (max 20)
  { id: 4,  category: 'movement',       category_max: 20,   sort_order: 10, action_label: 'Complete any cardio session',            field_name: 'cardio_done',      condition_desc: 'cardio_done = true',                                         points: 8,   is_bonus: false, age_adjusted: false, age_note: null },
  { id: 5,  category: 'movement',       category_max: 20,   sort_order: 20, action_label: 'Cardio for 30+ minutes',                 field_name: 'cardio_duration',  condition_desc: 'cardio_duration >= 30 min',                                  points: 4,   is_bonus: true,  age_adjusted: true,  age_note: 'Over 35: threshold is 25.5 min (85%)' },
  { id: 6,  category: 'movement',       category_max: 20,   sort_order: 30, action_label: '10,000+ steps',                          field_name: 'steps',            condition_desc: 'steps >= 10,000 (highest tier only — does not stack)',       points: 8,   is_bonus: true,  age_adjusted: true,  age_note: 'Over 35: threshold is 8,500 steps (85%)' },
  { id: 7,  category: 'movement',       category_max: 20,   sort_order: 40, action_label: '7,500+ steps',                           field_name: 'steps',            condition_desc: 'steps >= 7,500 (if under 10,000 threshold)',                 points: 6,   is_bonus: true,  age_adjusted: true,  age_note: 'Over 35: threshold is 6,375 steps (85%)' },
  { id: 8,  category: 'movement',       category_max: 20,   sort_order: 50, action_label: '5,000+ steps',                           field_name: 'steps',            condition_desc: 'steps >= 5,000 (if under 7,500 threshold)',                  points: 4,   is_bonus: true,  age_adjusted: true,  age_note: 'Over 35: threshold is 4,250 steps (85%)' },
  // Sleep (max 16) — 3 tiers
  { id: 9,  category: 'sleep',          category_max: 16,   sort_order: 10, action_label: 'Optimal sleep (7–9 hours)',              field_name: 'sleep_hours',      condition_desc: 'sleep_hours >= 7 AND <= 9',                                  points: 16,  is_bonus: false, age_adjusted: false, age_note: null },
  { id: 10, category: 'sleep',          category_max: 16,   sort_order: 15, action_label: 'Good sleep (6–7 hours)',                 field_name: 'sleep_hours',      condition_desc: 'sleep_hours >= 6 AND < 7',                                   points: 8,   is_bonus: false, age_adjusted: false, age_note: null },
  { id: 30, category: 'sleep',          category_max: 16,   sort_order: 20, action_label: 'Fair sleep (5–6 hours)',                 field_name: 'sleep_hours',      condition_desc: 'sleep_hours >= 5 AND < 6',                                   points: 3,   is_bonus: false, age_adjusted: false, age_note: null },
  // Nutrition (max 24) — water-dominant; food tracking adds 5–10%
  { id: 11, category: 'nutrition',      category_max: 24,   sort_order: 10, action_label: 'Drink 3+ litres of water',               field_name: 'water_liters',     condition_desc: 'water_liters >= 3',                                          points: 16,  is_bonus: false, age_adjusted: false, age_note: null },
  { id: 12, category: 'nutrition',      category_max: 24,   sort_order: 15, action_label: 'Drink 2–3 litres of water',              field_name: 'water_liters',     condition_desc: 'water_liters >= 2 AND < 3',                                  points: 8,   is_bonus: false, age_adjusted: false, age_note: null },
  { id: 13, category: 'nutrition',      category_max: 24,   sort_order: 30, action_label: 'Protein goal hit',                       field_name: 'protein_qty',      condition_desc: 'protein_qty >= goal_protein_g_day (goal must be set)',       points: 4,   is_bonus: false, age_adjusted: false, age_note: null },
  { id: 14, category: 'nutrition',      category_max: 24,   sort_order: 31, action_label: 'Protein goal partial',                   field_name: 'protein_qty',      condition_desc: 'protein_qty > 0 but below target',                          points: 2,   is_bonus: false, age_adjusted: false, age_note: null },
  { id: 15, category: 'nutrition',      category_max: 24,   sort_order: 32, action_label: 'Calorie goal aligned',                   field_name: 'calories_kcal',    condition_desc: 'calories within goal direction per fitness goal',             points: 4,   is_bonus: false, age_adjusted: false, age_note: 'Cutting: ≤budget · Bulking: ≥target · Maintenance: within 5%' },
  { id: 16, category: 'nutrition',      category_max: 24,   sort_order: 33, action_label: 'Calorie goal partial',                   field_name: 'calories_kcal',    condition_desc: 'Partially aligned (within 12.5% margin)',                    points: 2,   is_bonus: false, age_adjusted: false, age_note: null },
  // Logging streak
  { id: 17, category: 'logging_streak', category_max: null, sort_order: 10, action_label: '7-day logging streak',                   field_name: 'daily_entries',    condition_desc: 'consecutive log days = 7',                                   points: 10,  is_bonus: false, age_adjusted: false, age_note: null },
  { id: 18, category: 'logging_streak', category_max: null, sort_order: 20, action_label: '14-day logging streak',                  field_name: 'daily_entries',    condition_desc: 'consecutive log days = 14',                                  points: 20,  is_bonus: false, age_adjusted: false, age_note: null },
  { id: 19, category: 'logging_streak', category_max: null, sort_order: 30, action_label: '30-day logging streak',                  field_name: 'daily_entries',    condition_desc: 'consecutive log days = 30',                                  points: 40,  is_bonus: false, age_adjusted: false, age_note: null },
  { id: 20, category: 'logging_streak', category_max: null, sort_order: 40, action_label: '60-day logging streak',                  field_name: 'daily_entries',    condition_desc: 'consecutive log days = 60',                                  points: 75,  is_bonus: false, age_adjusted: false, age_note: null },
  { id: 21, category: 'logging_streak', category_max: null, sort_order: 50, action_label: '90-day logging streak',                  field_name: 'daily_entries',    condition_desc: 'consecutive log days = 90',                                  points: 100, is_bonus: false, age_adjusted: false, age_note: null },
  { id: 22, category: 'logging_streak', category_max: null, sort_order: 60, action_label: 'Every 30 days beyond 90',                field_name: 'daily_entries',    condition_desc: 'consecutive log days mod 30 = 0 (after 90)',                 points: 50,  is_bonus: false, age_adjusted: false, age_note: null },
  // Weekly performance
  { id: 23, category: 'weekly_perf',    category_max: null, sort_order: 10, action_label: 'Hit some weekly goals (partial)',        field_name: 'profiles',         condition_desc: 'some of: goal_workout_days_week, goal_workout_mins_week met', points: 20,  is_bonus: false, age_adjusted: false, age_note: null },
  { id: 24, category: 'weekly_perf',    category_max: null, sort_order: 20, action_label: 'Hit all weekly goals (full)',             field_name: 'profiles',         condition_desc: 'all set weekly goals met (workout days + minutes)',          points: 50,  is_bonus: false, age_adjusted: false, age_note: null },
  // Goal crush streak — score >= 56 AND 3+ categories
  { id: 25, category: 'goal_crush',     category_max: null, sort_order: 10, action_label: '3-day goal crush streak',                field_name: 'is_goal_crush_day',condition_desc: 'consecutive goal crush days = 3',                            points: 15,  is_bonus: false, age_adjusted: false, age_note: null },
  { id: 26, category: 'goal_crush',     category_max: null, sort_order: 20, action_label: '7-day goal crush streak',                field_name: 'is_goal_crush_day',condition_desc: 'consecutive goal crush days = 7',                            points: 50,  is_bonus: false, age_adjusted: false, age_note: null },
  { id: 27, category: 'goal_crush',     category_max: null, sort_order: 30, action_label: '14-day goal crush streak',               field_name: 'is_goal_crush_day',condition_desc: 'consecutive goal crush days = 14',                           points: 100, is_bonus: false, age_adjusted: false, age_note: null },
  { id: 28, category: 'goal_crush',     category_max: null, sort_order: 40, action_label: '30-day goal crush streak',               field_name: 'is_goal_crush_day',condition_desc: 'consecutive goal crush days = 30',                           points: 150, is_bonus: false, age_adjusted: false, age_note: null },
  { id: 29, category: 'goal_crush',     category_max: null, sort_order: 50, action_label: 'Every 30 days beyond 30',                field_name: 'is_goal_crush_day',condition_desc: 'consecutive goal crush days mod 30 = 0 (after 30)',           points: 100, is_bonus: false, age_adjusted: false, age_note: null },
];

export async function GET() {
  // The hardcoded rules below are the canonical source of truth — they exactly
  // mirror lib/points.ts. The DB scoring_rules table may contain stale rows
  // from older migrations, so we always prefer the hardcoded version.
  // (The DB table is kept for future admin overrides; once migrated it can be
  //  used by flipping the logic below back.)
  const rules: ScoringRule[] = FALLBACK_RULES;
  const categories = Array.from(new Set(rules.map((r) => r.category)));

  return NextResponse.json({ rules, categories } satisfies ScoringRulesResponse);
}
