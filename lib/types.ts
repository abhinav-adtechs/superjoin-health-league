// Enums matching Supabase schema
export type Gender = 'male' | 'female' | 'other';
export type FitnessGoal = 'lose_weight' | 'gain_muscle' | 'stay_active' | 'general_wellness';
export type AgeBracket = 'under_25' | '25_to_35' | 'over_35';
/** Multi-select: body parts + clusters */
export type WorkoutOption =
  | 'bicep' | 'tricep' | 'shoulder' | 'chest' | 'back' | 'core' | 'quad' | 'hamstring' | 'glute' | 'calf' | 'forearm'
  | 'push' | 'pull' | 'legs' | 'full_body' | 'bodyweight' | 'other';
/** Cardio / sports: 15+ options (use search in UI) */
export type CardioType =
  | 'running' | 'cycling' | 'swimming' | 'walking' | 'hiking' | 'rowing' | 'dance'
  | 'football' | 'cricket' | 'basketball' | 'badminton' | 'tennis' | 'squash' | 'volleyball' | 'hockey'
  | 'martial_arts' | 'sports' | 'other';
export type Alcohol = 'zero' | 'one_to_two' | 'three_plus';

export interface Profile {
  id: string;
  slack_user_id: string | null;
  display_name: string;
  avatar_url: string | null;
  age: number;
  gender: Gender;
  height_cm: number;
  starting_weight: number;
  current_weight: number | null;
  fitness_goal: FitnessGoal;
  age_bracket: AgeBracket;
  timezone: string;
  reminder_time: string;
  joined_at: string;
  is_active: boolean;
  is_admin?: boolean;
  must_change_pin?: boolean;
  pin_set_at?: string | null;
  created_at: string;
  updated_at: string;
  // Personal goals (optional)
  goal_workout_mins_week?: number | null;
  goal_workout_days_week?: number | null;
  goal_steps_day?: number | null;
  goal_sleep_hours?: number | null;
  goal_sleep_hours_min?: number | null;
  goal_sleep_hours_max?: number | null;
  goal_water_liters?: number | null;
  goal_home_cooked_per_week?: number | null;
}

export interface DailyEntry {
  id: string;
  user_id: string;
  date: string;
  created_at: string;
  updated_at: string;
  workout_done: boolean | null;
  workout_duration: number | null;
  workout_types: WorkoutOption[] | null;
  cardio_done: boolean | null;
  cardio_duration: number | null;
  cardio_type: CardioType | null;
  steps: number | null;
  water_liters: number | null;
  home_cooked_meals: number | null;
  protein_meal: boolean | null;
  protein_qty: number | null;
  junk_food: boolean | null;
  alcohol: Alcohol | null;
  sleep_hours: number | null;
  sleep_quality: number | null;
  daily_points: number;
}

export interface WeeklyWeighIn {
  id: string;
  user_id: string;
  week_start: string;
  weight_kg: number;
  created_at: string;
}

export interface Streak {
  id: string;
  user_id: string;
  start_date: string;
  end_date: string | null;
  bonus_awarded: number;
  created_at: string;
}

export type LeaderboardView = 'weekly' | 'monthly' | 'alltime';

export interface LeaderboardRanking {
  rank: number;
  /** Previous period rank (weekly only) */
  prev_rank?: number | null;
  /** Positive = moved up (rank improved), negative = moved down */
  rank_change?: number | null;
  user: {
    id: string;
    display_name: string;
    avatar_url: string | null;
    streak_days: number;
    days_active: number;
  };
  score: {
    total_points: number;
    normalized_score: number;
    /** % of theoretical max points achieved (weekly: points / days_elapsed / 98 * 100) */
    goals_pct?: number;
    breakdown?: { workout: number; nutrition: number; sleep: number; steps: number };
    breakdown_pct?: { exercise: string; nutrition: string; sleep: string; steps: string };
  };
  insights?: {
    strongest_category: string;
    improvement_vs_last_week?: string;
    improvement_detail?: string;
  };
}

export interface LeaderboardResponse {
  view: LeaderboardView;
  period: string;
  week_start?: string;
  current_user_id?: string | null;
  rankings: LeaderboardRanking[];
  category_leaders?: Record<string, { display_name: string; points?: number; days?: number }>;
  team_stats?: {
    avg_sleep_hours?: number;
    avg_water_liters?: number;
    pct_workout_days?: number;
    avg_steps?: number;
  };
}

// ============================================
// Connected Accounts / Integrations
// ============================================

export type IntegrationPlatform = 'fitbit' | 'apple_health' | 'google_health';

/** fill_nulls: only fills empty daily_entry fields; always_override: connected data wins */
export type SyncPreference = 'fill_nulls' | 'always_override';

export interface ConnectedAccount {
  id: string;
  user_id: string;
  platform: IntegrationPlatform;
  access_token: string | null;
  refresh_token: string | null;
  token_expires_at: string | null;
  scopes: string[] | null;
  platform_user_id: string | null;
  connected_at: string;
  last_synced_at: string | null;
  sync_enabled: boolean;
  sync_preference: SyncPreference;
}

/** Subset of DailyEntry fields that integrations can populate */
export interface IntegrationSyncPayload {
  date: string;
  steps?: number | null;
  workout_done?: boolean | null;
  workout_duration?: number | null;
  workout_types?: WorkoutOption[] | null;
  cardio_done?: boolean | null;
  cardio_duration?: number | null;
  cardio_type?: CardioType | null;
  water_liters?: number | null;
  protein_qty?: number | null;
  protein_meal?: boolean | null;
  sleep_hours?: number | null;
  sleep_quality?: number | null;
  weight_kg?: number | null;
}

/** Status response for a single platform */
export interface IntegrationStatus {
  platform: IntegrationPlatform;
  connected: boolean;
  sync_enabled: boolean;
  sync_preference: SyncPreference;
  connected_at: string | null;
  last_synced_at: string | null;
  platform_user_id: string | null;
  /** Fields that were populated during last sync */
  last_sync_fields?: string[];
}
