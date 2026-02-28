import { createClient } from '@/lib/supabase/server';
import { createServiceRoleClient } from '@/lib/supabase/admin';
import { NextResponse } from 'next/server';
import type { LeaderboardView, LeaderboardRanking } from '@/lib/types';

type ProfileRow = {
  id: string;
  display_name: string;
  avatar_url: string | null;
  age_bracket: string;
  joined_at: string;
};

type FullEntry = {
  user_id: string;
  date: string;
  daily_points: number;
  workout_done: boolean | null;
  workout_duration: number | null;
  cardio_done: boolean | null;
  cardio_duration: number | null;
  steps: number | null;
  water_liters: number | null;
  home_cooked_meals: number | null;
  protein_meal: boolean | null;
  protein_qty: number | null;
  junk_food: boolean | null;
  alcohol: string | null;
  sleep_hours: number | null;
  sleep_quality: number | null;
};

// ─── Date helpers ─────────────────────────────────────────────────────────────

function getMonday(d: Date): Date {
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  const monday = new Date(d);
  monday.setDate(diff);
  monday.setHours(0, 0, 0, 0);
  return monday;
}

function addDays(d: Date, n: number): Date {
  const result = new Date(d);
  result.setDate(result.getDate() + n);
  return result;
}

function toISODate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function formatDateShort(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00');
  const day = d.getDate();
  const month = d.toLocaleString('en-GB', { month: 'short' });
  const year = String(d.getFullYear()).slice(2);
  return `${day} ${month} '${year}`;
}

function monthStart(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
}

// ─── Stats helpers ────────────────────────────────────────────────────────────

function computeBreakdown(
  entries: FullEntry[],
  ageBracket: string,
): { workout: number; nutrition: number; sleep: number; steps: number } {
  let workout = 0, nutrition = 0, sleep = 0, steps = 0;
  const adj = ageBracket === 'over_35' ? 0.85 : 1.0;
  for (const e of entries) {
    if (e.workout_done) {
      workout += 10;
      if (e.workout_duration != null && e.workout_duration >= 45) workout += 5;
      if (e.workout_duration != null && e.workout_duration >= 60) workout += 5;
    }
    if (e.cardio_done) {
      workout += 10;
      if (e.cardio_duration != null && e.cardio_duration >= 30 * adj) workout += 5;
    }
    if (e.sleep_hours != null) {
      if (e.sleep_hours >= 7 && e.sleep_hours <= 9) sleep += 10;
      else if (e.sleep_hours >= 6) sleep += 5;
    }
    if (e.sleep_quality != null && e.sleep_quality >= 4) sleep += 5;
    if (e.water_liters != null) {
      if (e.water_liters >= 3) nutrition += 10;
      else if (e.water_liters >= 2) nutrition += 5;
    }
    if (e.home_cooked_meals != null && e.home_cooked_meals >= 2) nutrition += 5;
    if (e.protein_meal) {
      nutrition += 5;
      if (e.protein_qty != null && e.protein_qty >= 100) nutrition += 3;
    }
    if (e.junk_food === false) nutrition += 5;
    if (e.alcohol === 'zero') nutrition += 5;
    if (e.steps != null) {
      if (e.steps >= 10000 * adj) steps += 15;
      else if (e.steps >= 7500 * adj) steps += 10;
      else if (e.steps >= 5000 * adj) steps += 5;
    }
  }
  return { workout, nutrition, sleep, steps };
}

/** Current streak = consecutive days with entries, counting backwards from asOfDate. */
function computeStreak(allDates: string[], asOfDate: string): number {
  if (!allDates.length) return 0;
  const dateSet = new Set(allDates);
  let streak = 0;
  const cur = new Date(asOfDate + 'T12:00:00');
  // If today has no entry, start counting from yesterday
  if (!dateSet.has(toISODate(cur))) cur.setDate(cur.getDate() - 1);
  while (dateSet.has(toISODate(cur))) {
    streak++;
    cur.setDate(cur.getDate() - 1);
  }
  return streak;
}

// ─── Route handler ────────────────────────────────────────────────────────────

const FULL_ENTRY_SELECT =
  'user_id, date, daily_points, workout_done, workout_duration, cardio_done, cardio_duration, steps, water_liters, home_cooked_meals, protein_meal, protein_qty, junk_food, alcohol, sleep_hours, sleep_quality';

export async function GET(request: Request) {
  let supabase;
  try {
    supabase = await createClient();
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Supabase not configured';
    return NextResponse.json({ error: msg, rankings: [] }, { status: 503 });
  }

  const { searchParams } = new URL(request.url);
  const view = (searchParams.get('view') ?? 'weekly') as LeaderboardView;
  if (!['weekly', 'monthly', 'alltime'].includes(view)) {
    return NextResponse.json({ error: 'Invalid view' }, { status: 400 });
  }

  // Identify the currently logged-in user
  const { data: { user: currentUser } } = await supabase.auth.getUser();
  const currentUserId = currentUser?.id ?? null;

  const now = new Date();
  let period = '';
  let dateFilter: { gte: string; lte: string } | null = null;
  let weekStartStr: string | undefined;

  if (view === 'weekly') {
    const weekStartParam = searchParams.get('week_start');
    let weekStart: Date;
    if (weekStartParam && /^\d{4}-\d{2}-\d{2}$/.test(weekStartParam)) {
      weekStart = new Date(weekStartParam + 'T00:00:00');
    } else {
      weekStart = getMonday(now);
    }
    const weekEnd = addDays(weekStart, 6);
    weekStartStr = toISODate(weekStart);
    period = `${formatDateShort(toISODate(weekStart))} – ${formatDateShort(toISODate(weekEnd))}`;
    dateFilter = { gte: toISODate(weekStart), lte: toISODate(weekEnd) };
  } else if (view === 'monthly') {
    const start = monthStart(now);
    const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    period = `${formatDateShort(start)} – ${formatDateShort(toISODate(end))}`;
    dateFilter = { gte: start, lte: toISODate(end) };
  } else {
    period = 'All time';
  }

  const { data: profiles, error: profilesError } = await supabase
    .from('profiles')
    .select('id, display_name, avatar_url, age_bracket, joined_at')
    .eq('is_active', true);

  if (profilesError) {
    return NextResponse.json(
      { error: profilesError.message, view, period, rankings: [], category_leaders: {}, team_stats: {} },
      { status: 503 },
    );
  }
  if (!profiles?.length) {
    return NextResponse.json({
      view,
      period,
      week_start: weekStartStr,
      current_user_id: currentUserId,
      rankings: [],
      category_leaders: {},
      team_stats: {},
    });
  }

  // Fetch entries. For weekly, pull 60 days back so we can compute streaks & prev-week rank.
  let currentEntries: FullEntry[] = [];
  let prevWeekEntries: FullEntry[] = [];
  let recentAllEntries: FullEntry[] = [];

  try {
    const adminSupabase = createServiceRoleClient();

    if (view === 'weekly' && dateFilter) {
      const lookbackStart = toISODate(addDays(new Date(dateFilter.gte + 'T00:00:00'), -53));
      const { data: recentData } = await adminSupabase
        .from('daily_entries')
        .select(FULL_ENTRY_SELECT)
        .gte('date', lookbackStart)
        .lte('date', dateFilter.lte);
      recentAllEntries = (recentData ?? []) as FullEntry[];
      currentEntries = recentAllEntries.filter(
        (e) => e.date >= dateFilter!.gte && e.date <= dateFilter!.lte,
      );
      const prevWeekStart = toISODate(addDays(new Date(dateFilter.gte + 'T00:00:00'), -7));
      const prevWeekEnd = toISODate(addDays(new Date(dateFilter.gte + 'T00:00:00'), -1));
      prevWeekEntries = recentAllEntries.filter(
        (e) => e.date >= prevWeekStart && e.date <= prevWeekEnd,
      );
    } else if (dateFilter) {
      const { data } = await adminSupabase
        .from('daily_entries')
        .select(FULL_ENTRY_SELECT)
        .gte('date', dateFilter.gte)
        .lte('date', dateFilter.lte);
      currentEntries = (data ?? []) as FullEntry[];
      recentAllEntries = currentEntries;
    } else {
      const { data } = await adminSupabase
        .from('daily_entries')
        .select(FULL_ENTRY_SELECT);
      currentEntries = (data ?? []) as FullEntry[];
      recentAllEntries = currentEntries;
    }
  } catch {
    return NextResponse.json(
      { error: 'Cannot load leaderboard entries', view, period, rankings: [], category_leaders: {}, team_stats: {} },
      { status: 503 },
    );
  }

  // Group entries by user
  const currentByUser = new Map<string, FullEntry[]>();
  for (const e of currentEntries) {
    if (!currentByUser.has(e.user_id)) currentByUser.set(e.user_id, []);
    currentByUser.get(e.user_id)!.push(e);
  }
  const recentByUser = new Map<string, FullEntry[]>();
  for (const e of recentAllEntries) {
    if (!recentByUser.has(e.user_id)) recentByUser.set(e.user_id, []);
    recentByUser.get(e.user_id)!.push(e);
  }

  // Compute previous-week rank map for rank_change
  const prevPointsByUser = new Map<string, number>();
  for (const e of prevWeekEntries) {
    prevPointsByUser.set(e.user_id, (prevPointsByUser.get(e.user_id) ?? 0) + (e.daily_points ?? 0));
  }
  const prevSorted = [...(profiles as ProfileRow[])].sort(
    (a, b) => (prevPointsByUser.get(b.id) ?? 0) - (prevPointsByUser.get(a.id) ?? 0),
  );
  const prevRankMap = new Map<string, number>();
  prevSorted.forEach((p, i) => prevRankMap.set(p.id, i + 1));

  // Days elapsed in the current week (for goals_pct on ongoing weeks)
  let daysElapsed = 7;
  if (view === 'weekly' && dateFilter) {
    const weekStartDate = new Date(dateFilter.gte + 'T00:00:00');
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const weekEndDate = new Date(dateFilter.lte + 'T00:00:00');
    if (today <= weekEndDate) {
      daysElapsed = Math.max(
        1,
        Math.floor((today.getTime() - weekStartDate.getTime()) / (24 * 60 * 60 * 1000)) + 1,
      );
    }
  }

  const todayStr = toISODate(now);

  let rankings: LeaderboardRanking[];

  if (view === 'alltime') {
    rankings = (profiles as ProfileRow[]).map((p) => {
      const userEntries = currentByUser.get(p.id) ?? [];
      const recentEntries = recentByUser.get(p.id) ?? [];
      const total = userEntries.reduce((sum, e) => sum + (e.daily_points ?? 0), 0);
      const daysSinceJoin = Math.max(
        1,
        Math.floor((Date.now() - new Date(p.joined_at).getTime()) / (24 * 60 * 60 * 1000)),
      );
      const normalized = total / daysSinceJoin;
      const daysActive = new Set(userEntries.map((e) => e.date)).size;
      const streakDays = computeStreak(recentEntries.map((e) => e.date), todayStr);
      const breakdown = computeBreakdown(userEntries, p.age_bracket);
      return {
        rank: 0,
        user: {
          id: p.id,
          display_name: p.display_name,
          avatar_url: p.avatar_url,
          streak_days: streakDays,
          days_active: daysActive,
        },
        score: {
          total_points: total,
          normalized_score: Math.round(normalized * 10) / 10,
          breakdown,
        },
      };
    });
    rankings.sort((a, b) => b.score.normalized_score - a.score.normalized_score);
  } else {
    rankings = (profiles as ProfileRow[]).map((p) => {
      const userEntries = currentByUser.get(p.id) ?? [];
      const recentEntries = recentByUser.get(p.id) ?? [];
      const total = userEntries.reduce((sum, e) => sum + (e.daily_points ?? 0), 0);
      const daysActive = new Set(userEntries.map((e) => e.date)).size;
      const streakDays = computeStreak(recentEntries.map((e) => e.date), todayStr);
      const breakdown = computeBreakdown(userEntries, p.age_bracket);
      const goalsPct =
        view === 'weekly'
          ? Math.min(100, Math.round((total / (daysElapsed * 98)) * 100))
          : undefined;
      const prevRank = view === 'weekly' ? (prevRankMap.get(p.id) ?? null) : undefined;
      return {
        rank: 0,
        prev_rank: prevRank,
        user: {
          id: p.id,
          display_name: p.display_name,
          avatar_url: p.avatar_url,
          streak_days: streakDays,
          days_active: daysActive,
        },
        score: {
          total_points: total,
          normalized_score: total,
          goals_pct: goalsPct,
          breakdown,
        },
      };
    });
    rankings.sort((a, b) => b.score.total_points - a.score.total_points);
  }

  rankings.forEach((r, i) => {
    r.rank = i + 1;
    if (r.prev_rank != null) {
      // Positive = moved up (previous rank number was higher = lower position)
      r.rank_change = r.prev_rank - r.rank;
    }
  });

  return NextResponse.json({
    view,
    period,
    week_start: weekStartStr,
    current_user_id: currentUserId,
    rankings,
    category_leaders: {},
    team_stats: {},
  });
}
