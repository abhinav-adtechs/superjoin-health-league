import { createServiceRoleClient } from '@/lib/supabase/admin';
import { getSupabaseWithUser } from '@/lib/supabase/server';
import {
  calculateDailyPoints,
  getCumulativeGoalCrushStreakBonus,
  getCumulativeLoggingStreakBonus,
  getGoalCrushThreshold,
  isWeeklyGoalHit,
  WEEKLY_PERF_BONUS,
} from '@/lib/points';
import type { AgeBracket, FitnessGoal, FoodTrackingMode } from '@/lib/types';
import { NextResponse } from 'next/server';

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const MONTH_RE = /^\d{4}-\d{2}$/;

const FULL_ENTRY_SELECT =
  'id, user_id, date, created_at, updated_at, daily_points, workout_done, workout_duration, workout_types, cardio_done, cardio_duration, cardio_type, steps, water_liters, home_cooked_meals, protein_meal, protein_qty, junk_food, alcohol, sleep_hours, sleep_quality, calories_kcal, scored_with_goal';

type ProfileRow = {
  id: string;
  display_name: string;
  age_bracket: AgeBracket | string;
  joined_at: string | null;
  fitness_goal: FitnessGoal | null;
  food_tracking_mode: FoodTrackingMode | null;
  goal_workout_days_week: number | null;
  goal_workout_mins_week: number | null;
  goal_home_cooked_per_week: number | null;
  goal_protein_g_day: number | null;
  goal_calories_day: number | null;
  goal_steps_day: number | null;
};

type EntryRow = {
  user_id: string;
  date: string;
  daily_points: number | null;
  is_goal_crush_day?: boolean | null;
  workout_done?: boolean | null;
  workout_duration?: number | null;
  cardio_done?: boolean | null;
  cardio_duration?: number | null;
  steps?: number | null;
  water_liters?: number | null;
  home_cooked_meals?: number | null;
  protein_meal?: boolean | null;
  protein_qty?: number | null;
  junk_food?: boolean | null;
  alcohol?: string | null;
  sleep_hours?: number | null;
  sleep_quality?: number | null;
  calories_kcal?: number | null;
  scored_with_goal?: FitnessGoal | null;
};

function toISODate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function addDays(date: string, delta: number): string {
  const d = new Date(`${date}T12:00:00`);
  d.setDate(d.getDate() + delta);
  return toISODate(d);
}

function addYears(date: string, delta: number): string {
  const d = new Date(`${date}T12:00:00`);
  d.setFullYear(d.getFullYear() + delta);
  return toISODate(d);
}

function monthBounds(month: string): { start: string; end: string } {
  const [year, monthNum] = month.split('-').map(Number);
  const start = `${year}-${String(monthNum).padStart(2, '0')}-01`;
  const end = new Date(year, monthNum, 0, 12, 0, 0);
  return { start, end: toISODate(end) };
}

function dateMin(...dates: string[]): string {
  return dates.reduce((min, d) => (d < min ? d : min));
}

function dateMax(...dates: string[]): string {
  return dates.reduce((max, d) => (d > max ? d : max));
}

function effectivePoints(entry: EntryRow, profile: ProfileRow): number {
  if ((entry.daily_points ?? 0) > 0) return entry.daily_points ?? 0;
  return calculateDailyPoints(entry, profile.age_bracket as AgeBracket, {
    goal_protein_g_day: profile.goal_protein_g_day,
    goal_calories_day: profile.goal_calories_day,
    food_tracking_mode: profile.food_tracking_mode,
    fitness_goal: profile.fitness_goal,
    goal_steps_day: profile.goal_steps_day,
  });
}

function computeStreak(dates: string[], asOfDate: string): number {
  if (!dates.length) return 0;
  const dateSet = new Set(dates);
  let streak = 0;
  const cur = new Date(`${asOfDate}T12:00:00`);
  if (!dateSet.has(toISODate(cur))) cur.setDate(cur.getDate() - 1);
  while (dateSet.has(toISODate(cur))) {
    streak++;
    cur.setDate(cur.getDate() - 1);
  }
  return streak;
}

function computeGoalCrushStreak(
  entries: EntryRow[],
  asOfDate: string,
  crushThreshold: number,
): number {
  const crushDates = new Set(
    entries
      .filter((e) =>
        e.is_goal_crush_day != null ? e.is_goal_crush_day : (e.daily_points ?? 0) >= crushThreshold,
      )
      .map((e) => e.date),
  );
  let streak = 0;
  const cur = new Date(`${asOfDate}T12:00:00`);
  if (!crushDates.has(toISODate(cur))) cur.setDate(cur.getDate() - 1);
  while (crushDates.has(toISODate(cur))) {
    streak++;
    cur.setDate(cur.getDate() - 1);
  }
  return streak;
}

function entriesByUser(entries: EntryRow[]): Map<string, EntryRow[]> {
  const byUser = new Map<string, EntryRow[]>();
  for (const entry of entries) {
    const rows = byUser.get(entry.user_id) ?? [];
    rows.push(entry);
    byUser.set(entry.user_id, rows);
  }
  return byUser;
}

function getRankSummary({
  profiles,
  entries,
  userId,
  from,
  to,
  recentFrom,
  recentTo,
  today,
  view,
}: {
  profiles: ProfileRow[];
  entries: EntryRow[];
  userId: string;
  from: string;
  to: string;
  recentFrom: string;
  recentTo: string;
  today: string;
  view: 'weekly' | 'monthly';
}): { rank: number | null; points: number } {
  const currentByUser = entriesByUser(entries.filter((e) => e.date >= from && e.date <= to));
  const recentByUser = entriesByUser(entries.filter((e) => e.date >= recentFrom && e.date <= recentTo));

  const rankings = profiles.map((profile) => {
    const userEntries = currentByUser.get(profile.id) ?? [];
    const recentEntries = recentByUser.get(profile.id) ?? [];
    const baseTotal = userEntries.reduce((sum, entry) => sum + effectivePoints(entry, profile), 0);
    const streakDays = computeStreak(recentEntries.map((entry) => entry.date), today);
    const crushThreshold = getGoalCrushThreshold(profile.food_tracking_mode);
    const goalCrushStreak = computeGoalCrushStreak(recentEntries, today, crushThreshold);
    const streakBonus =
      getCumulativeLoggingStreakBonus(streakDays) +
      getCumulativeGoalCrushStreakBonus(goalCrushStreak);
    let weeklyBonus = 0;

    if (view === 'weekly') {
      const weekResult = isWeeklyGoalHit(userEntries, profile);
      if (weekResult === 'full') weeklyBonus = WEEKLY_PERF_BONUS.full;
      else if (weekResult === 'partial') weeklyBonus = WEEKLY_PERF_BONUS.partial;
    }

    return {
      id: profile.id,
      points: baseTotal + weeklyBonus + streakBonus,
    };
  });

  rankings.sort((a, b) => b.points - a.points);
  const idx = rankings.findIndex((row) => row.id === userId);
  if (idx === -1) return { rank: null, points: 0 };
  return { rank: idx + 1, points: rankings[idx]?.points ?? 0 };
}

export async function GET(request: Request) {
  const { supabase, user } = await getSupabaseWithUser(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const today = searchParams.get('today');
  const yesterday = searchParams.get('yesterday');
  const weekStart = searchParams.get('week_start');
  const month = searchParams.get('month');

  if (
    !today ||
    !yesterday ||
    !weekStart ||
    !month ||
    !DATE_RE.test(today) ||
    !DATE_RE.test(yesterday) ||
    !DATE_RE.test(weekStart) ||
    !MONTH_RE.test(month)
  ) {
    return NextResponse.json({ error: 'Invalid dashboard summary window' }, { status: 400 });
  }

  const weekEnd = addDays(weekStart, 6);
  const weeklyRecentStart = addDays(weekStart, -53);
  const oneYearAgo = addYears(today, -1);
  const { start: monthStart, end: monthEnd } = monthBounds(month);
  const rangeStart = dateMin(oneYearAgo, weeklyRecentStart, monthStart);
  const rangeEnd = dateMax(today, weekEnd, monthEnd);

  let profiles: ProfileRow[] = [];
  let entries: EntryRow[] = [];
  let rankError: string | null = null;

  try {
    const admin = createServiceRoleClient();
    const [profilesRes, entriesRes] = await Promise.all([
      admin
        .from('profiles')
        .select('id, display_name, age_bracket, joined_at, fitness_goal, food_tracking_mode, goal_workout_days_week, goal_workout_mins_week, goal_home_cooked_per_week, goal_protein_g_day, goal_calories_day, goal_steps_day')
        .eq('is_active', true),
      admin
        .from('daily_entries')
        .select(FULL_ENTRY_SELECT)
        .gte('date', rangeStart)
        .lte('date', rangeEnd),
    ]);

    if (profilesRes.error) throw profilesRes.error;
    if (entriesRes.error) throw entriesRes.error;
    profiles = (profilesRes.data ?? []) as ProfileRow[];
    entries = (entriesRes.data ?? []) as EntryRow[];
  } catch (error) {
    rankError = error instanceof Error ? error.message : 'Could not load rank summary';
    const { data, error: ownEntriesError } = await supabase
      .from('daily_entries')
      .select('*')
      .eq('user_id', user.id)
      .gte('date', oneYearAgo)
      .lte('date', today)
      .order('date', { ascending: false });

    if (ownEntriesError) {
      return NextResponse.json({ error: ownEntriesError.message }, { status: 500 });
    }
    entries = (data ?? []) as EntryRow[];
  }

  const personalEntries = entries
    .filter((entry) => entry.user_id === user.id && entry.date >= oneYearAgo && entry.date <= today)
    .sort((a, b) => b.date.localeCompare(a.date));
  const weeklyEntries = personalEntries.filter((entry) => entry.date >= weekStart && entry.date <= today);
  const todayEntry = personalEntries.find((entry) => entry.date === today) ?? null;
  const yesterdayEntry = personalEntries.find((entry) => entry.date === yesterday) ?? null;
  const currentProfile = profiles.find((profile) => profile.id === user.id) ?? null;
  const loggingStreak = computeStreak(personalEntries.map((entry) => entry.date), today);
  const goalCrushStreak = computeGoalCrushStreak(
    personalEntries,
    today,
    getGoalCrushThreshold(currentProfile?.food_tracking_mode),
  );
  const weeklyGoalsHit = currentProfile ? isWeeklyGoalHit(weeklyEntries, currentProfile) : 'none';

  const weeklyRank =
    profiles.length > 0
      ? getRankSummary({
          profiles,
          entries,
          userId: user.id,
          from: weekStart,
          to: weekEnd,
          recentFrom: weeklyRecentStart,
          recentTo: weekEnd,
          today,
          view: 'weekly',
        })
      : { rank: null, points: 0 };
  const monthlyRank =
    profiles.length > 0
      ? getRankSummary({
          profiles,
          entries,
          userId: user.id,
          from: monthStart,
          to: monthEnd,
          recentFrom: monthStart,
          recentTo: monthEnd,
          today,
          view: 'monthly',
        })
      : { rank: null, points: 0 };

  return NextResponse.json({
    today_entry: todayEntry,
    yesterday_entry: yesterdayEntry,
    weekly_entries: weeklyEntries,
    logging_streak: loggingStreak,
    goal_crush_streak: goalCrushStreak,
    week_log_days: weeklyEntries.length,
    weekly_goals_hit: weeklyGoalsHit,
    weekly_rank: weeklyRank.rank,
    weekly_points: weeklyRank.points,
    monthly_rank: monthlyRank.rank,
    monthly_points: monthlyRank.points,
    rank_error: rankError,
  });
}
