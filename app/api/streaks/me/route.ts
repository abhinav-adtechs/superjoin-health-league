import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { isWeeklyGoalHit, type WeeklyGoalResult } from '@/lib/points';

function getWeekBounds(): { weekStart: string; weekEnd: string } {
  const today = new Date();
  const day = today.getDay();
  const diffToMonday = day === 0 ? -6 : 1 - day;
  const monday = new Date(today);
  monday.setDate(today.getDate() + diffToMonday);
  monday.setHours(0, 0, 0, 0);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  return {
    weekStart: monday.toISOString().slice(0, 10),
    weekEnd: sunday.toISOString().slice(0, 10),
  };
}

type EntryRow = {
  date: string;
  daily_points: number | null;
  is_goal_crush_day?: boolean | null;
  workout_done?: boolean | null;
  cardio_done?: boolean | null;
  workout_duration?: number | null;
  cardio_duration?: number | null;
  home_cooked_meals?: number | null;
};

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const today = new Date().toISOString().slice(0, 10);
  const { weekStart, weekEnd } = getWeekBounds();
  const oneYearAgo = (() => {
    const d = new Date();
    d.setFullYear(d.getFullYear() - 1);
    return d.toISOString().slice(0, 10);
  })();

  // Try to fetch with is_goal_crush_day (requires migration 20260302_goal_crush_streak.sql).
  // If that column doesn't exist yet, fall back to fetching without it and use
  // daily_points >= 60 as the goal-crush proxy.
  let allEntries: EntryRow[] = [];
  let hasGoalCrushColumn = false;

  const { data: primaryData, error: primaryError } = await supabase
    .from('daily_entries')
    .select('date, daily_points, is_goal_crush_day, workout_done, cardio_done, workout_duration, cardio_duration, home_cooked_meals')
    .eq('user_id', user.id)
    .gte('date', oneYearAgo)
    .order('date', { ascending: false });

  if (!primaryError && primaryData) {
    allEntries = primaryData as EntryRow[];
    hasGoalCrushColumn = true;
  } else {
    // Column likely doesn't exist yet — retry without it
    const { data: fallbackData, error: fallbackError } = await supabase
      .from('daily_entries')
      .select('date, daily_points, workout_done, cardio_done, workout_duration, cardio_duration, home_cooked_meals')
      .eq('user_id', user.id)
      .gte('date', oneYearAgo)
      .order('date', { ascending: false });

    if (fallbackError) return NextResponse.json({ error: fallbackError.message }, { status: 500 });
    allEntries = (fallbackData ?? []) as EntryRow[];
  }

  // ── Logging Streak ───────────────────────────────────────────────────────────
  const entryDates = new Set(allEntries.map((e) => e.date));
  let loggingStreak = 0;
  const loggingCheck = new Date(today);
  if (!entryDates.has(today)) loggingCheck.setDate(loggingCheck.getDate() - 1);
  for (let i = 0; i < 365; i++) {
    const d = loggingCheck.toISOString().slice(0, 10);
    if (entryDates.has(d)) {
      loggingStreak++;
      loggingCheck.setDate(loggingCheck.getDate() - 1);
    } else {
      break;
    }
  }

  // ── Goal Crush Streak ────────────────────────────────────────────────────────
  // Use stored is_goal_crush_day if the column exists, otherwise fall back to
  // daily_points >= 60 as the proxy.
  const isGoalCrushEntry = (e: EntryRow): boolean => {
    if (hasGoalCrushColumn) return e.is_goal_crush_day === true;
    return (e.daily_points ?? 0) >= 60;
  };

  const crushDates = new Set(allEntries.filter(isGoalCrushEntry).map((e) => e.date));
  let goalCrushStreak = 0;
  const crushCheck = new Date(today);
  if (!crushDates.has(today)) crushCheck.setDate(crushCheck.getDate() - 1);
  for (let i = 0; i < 365; i++) {
    const d = crushCheck.toISOString().slice(0, 10);
    if (crushDates.has(d)) {
      goalCrushStreak++;
      crushCheck.setDate(crushCheck.getDate() - 1);
    } else {
      break;
    }
  }

  // ── Weekly Goals ─────────────────────────────────────────────────────────────
  const weekEntries = allEntries.filter((e) => e.date >= weekStart && e.date <= weekEnd);
  const weekLogDays = weekEntries.length;

  const { data: profile } = await supabase
    .from('profiles')
    .select('goal_workout_days_week, goal_workout_mins_week, goal_home_cooked_per_week')
    .eq('id', user.id)
    .single();

  const weeklyGoalsHit: WeeklyGoalResult = isWeeklyGoalHit(weekEntries, profile ?? {});

  return NextResponse.json({
    logging_streak: loggingStreak,
    goal_crush_streak: goalCrushStreak,
    week_log_days: weekLogDays,
    weekly_goals_hit: weeklyGoalsHit,
    week_start: weekStart,
    week_end: weekEnd,
  });
}
