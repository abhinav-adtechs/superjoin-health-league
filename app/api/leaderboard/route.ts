import { createClient } from '@/lib/supabase/server';
import { createServiceRoleClient } from '@/lib/supabase/admin';
import { NextResponse } from 'next/server';
import type { LeaderboardView, LeaderboardRanking, FitnessGoal, FoodTrackingMode, AgeBracket } from '@/lib/types';
import { calculateDailyPoints, isWeeklyGoalHit, WEEKLY_PERF_BONUS, computeGoalAdherencePct } from '@/lib/points';
import { parseGoalWorkoutTypes } from '@/lib/workout-goals';

type ProfileRow = {
  id: string;
  display_name: string;
  avatar_url: string | null;
  age_bracket: string;
  joined_at: string;
  fitness_goal: FitnessGoal | null;
  goal_workout_types?: unknown;
  food_tracking_mode: FoodTrackingMode | null;
  goal_workout_days_week: number | null;
  goal_workout_mins_week: number | null;
  goal_home_cooked_per_week: number | null;
  goal_water_liters: number | null;
  goal_sleep_hours: number | null;
  goal_sleep_hours_min: number | null;
  goal_sleep_hours_max: number | null;
  goal_protein_g_day: number | null;
  goal_calories_day: number | null;
};

type FullEntry = {
  user_id: string;
  date: string;
  daily_points: number;
  is_goal_crush_day?: boolean | null;
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
  calories_kcal: number | null;
  scored_with_goal: FitnessGoal | null;
};

// ─── Points helper ────────────────────────────────────────────────────────────

/**
 * Returns the effective daily points for an entry.
 * Uses the stored `daily_points` when it is > 0 (fast path).
 * Falls back to a live recompute for old entries that were saved before
 * the scoring engine ran (daily_points = 0 / null).
 */
function effectivePoints(entry: FullEntry, profile: ProfileRow): number {
  if ((entry.daily_points ?? 0) > 0) return entry.daily_points;
  return calculateDailyPoints(entry, profile.age_bracket as AgeBracket, {
    goal_protein_g_day: profile.goal_protein_g_day,
    goal_calories_day: profile.goal_calories_day,
    food_tracking_mode: profile.food_tracking_mode,
    fitness_goal: profile.fitness_goal,
  });
}

// ─── Date helpers ─────────────────────────────────────────────────────────────

function getMonday(d: Date): Date {
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  const monday = new Date(d);
  monday.setDate(diff);
  monday.setHours(12, 0, 0, 0);
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
  const d = new Date(dateStr + 'T12:00:00');
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
): { workout: number; nutrition: number; sleep: number; movement: number } {
  let workout = 0, nutrition = 0, sleep = 0, movement = 0;
  const adj = ageBracket === 'over_35' ? 0.85 : 1.0;
  for (const e of entries) {
    // Workout (max 20/day)
    let wpts = 0;
    if (e.workout_done) {
      wpts += 10;
      if (e.workout_duration != null && e.workout_duration >= 45) wpts += 5;
      if (e.workout_duration != null && e.workout_duration >= 60) wpts += 5;
    }
    workout += Math.min(wpts, 20);

    // Movement: cardio + steps, highest tier only (max 20/day)
    let mpts = 0;
    if (e.cardio_done) {
      mpts += 8;
      if (e.cardio_duration != null && e.cardio_duration >= 30 * adj) mpts += 4;
    }
    if (e.steps != null) {
      if (e.steps >= Math.round(10000 * adj)) mpts += 8;
      else if (e.steps >= Math.round(7500 * adj)) mpts += 6;
      else if (e.steps >= Math.round(5000 * adj)) mpts += 4;
    }
    movement += Math.min(mpts, 20);

    // Sleep (max 16/day)
    if (e.sleep_hours != null) {
      if (e.sleep_hours >= 7 && e.sleep_hours <= 9) sleep += 16;
      else if (e.sleep_hours >= 6) sleep += 8;
      else if (e.sleep_hours >= 5) sleep += 3;
    }

    // Nutrition (max 24/day) — water-dominant
    let npts = 0;
    if (e.water_liters != null) {
      if (e.water_liters >= 3) npts += 16;
      else if (e.water_liters >= 2) npts += 8;
    }
    if (e.protein_meal) {
      npts += 4;
    }
    nutrition += Math.min(npts, 24);
  }
  return { workout, nutrition, sleep, movement };
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

/**
 * Goal crush streak = consecutive days where the entry qualifies as a goal-crush day,
 * counting backwards from asOfDate.
 *
 * Uses stored is_goal_crush_day when available (post-migration). Falls back to
 * daily_points >= 60 for entries that pre-date the migration or haven't been backfilled.
 */
function computeGoalCrushStreak(entries: FullEntry[], asOfDate: string): number {
  const crushDates = new Set(
    entries
      .filter((e) => e.is_goal_crush_day != null ? e.is_goal_crush_day : (e.daily_points ?? 0) >= 56)
      .map((e) => e.date),
  );
  let streak = 0;
  const cur = new Date(asOfDate + 'T12:00:00');
  if (!crushDates.has(toISODate(cur))) cur.setDate(cur.getDate() - 1);
  while (crushDates.has(toISODate(cur))) {
    streak++;
    cur.setDate(cur.getDate() - 1);
  }
  return streak;
}

// ─── Route handler ────────────────────────────────────────────────────────────

// is_goal_crush_day omitted — column not yet in live DB; computeGoalCrushStreak
// falls back to daily_points >= 56. Add it back once the DB migration is applied.
const FULL_ENTRY_SELECT =
  'user_id, date, daily_points, workout_done, workout_duration, cardio_done, cardio_duration, steps, water_liters, home_cooked_meals, protein_meal, protein_qty, junk_food, alcohol, sleep_hours, sleep_quality, calories_kcal, scored_with_goal';

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

  // Use admin client for profiles and entries so leaderboard works for guests (unauthenticated)
  let adminSupabase;
  try {
    adminSupabase = createServiceRoleClient();
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Service role not configured';
    return NextResponse.json({ error: msg, view, period: '', rankings: [], category_leaders: {}, team_stats: {} }, { status: 503 });
  }

  const now = new Date();
  let period = '';
  let dateFilter: { gte: string; lte: string } | null = null;
  let weekStartStr: string | undefined;

  if (view === 'weekly') {
    const weekStartParam = searchParams.get('week_start');
    let weekStart: Date;
    if (weekStartParam && /^\d{4}-\d{2}-\d{2}$/.test(weekStartParam)) {
      weekStart = new Date(weekStartParam + 'T12:00:00');
    } else {
      weekStart = getMonday(now);
    }
    const weekEnd = addDays(weekStart, 6);
    weekStartStr = toISODate(weekStart);
    period = `${formatDateShort(toISODate(weekStart))} – ${formatDateShort(toISODate(weekEnd))}`;
    dateFilter = { gte: toISODate(weekStart), lte: toISODate(weekEnd) };
  } else if (view === 'monthly') {
    const monthParam = searchParams.get('month');
    let targetYear: number;
    let targetMonth: number;
    if (monthParam && /^\d{4}-\d{2}$/.test(monthParam)) {
      const parts = monthParam.split('-').map(Number);
      targetYear = parts[0];
      targetMonth = parts[1] - 1;
    } else {
      targetYear = now.getFullYear();
      targetMonth = now.getMonth();
    }
    const start = `${targetYear}-${String(targetMonth + 1).padStart(2, '0')}-01`;
    const end = new Date(targetYear, targetMonth + 1, 0, 12, 0, 0);
    period = `${formatDateShort(start)} – ${formatDateShort(toISODate(end))}`;
    dateFilter = { gte: start, lte: toISODate(end) };
  } else {
    period = 'All time';
  }

  const { data: profiles, error: profilesError } = await adminSupabase
    .from('profiles')
    .select('id, display_name, avatar_url, age_bracket, joined_at, fitness_goal, goal_workout_types, food_tracking_mode, goal_workout_days_week, goal_workout_mins_week, goal_home_cooked_per_week, goal_water_liters, goal_sleep_hours, goal_sleep_hours_min, goal_sleep_hours_max, goal_protein_g_day, goal_calories_day')
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
    if (view === 'weekly' && dateFilter) {
      const lookbackStart = toISODate(addDays(new Date(dateFilter.gte + 'T00:00:00'), -53));
      const { data: recentData, error: recentErr } = await adminSupabase
        .from('daily_entries')
        .select(FULL_ENTRY_SELECT)
        .gte('date', lookbackStart)
        .lte('date', dateFilter.lte);
      if (recentErr) {
        return NextResponse.json(
          { error: recentErr.message, view, period, rankings: [], category_leaders: {}, team_stats: {} },
          { status: 503 },
        );
      }
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
      const { data, error: entriesErr } = await adminSupabase
        .from('daily_entries')
        .select(FULL_ENTRY_SELECT)
        .gte('date', dateFilter.gte)
        .lte('date', dateFilter.lte);
      if (entriesErr) {
        return NextResponse.json(
          { error: entriesErr.message, view, period, rankings: [], category_leaders: {}, team_stats: {} },
          { status: 503 },
        );
      }
      currentEntries = (data ?? []) as FullEntry[];
      recentAllEntries = currentEntries;
    } else {
      // alltime: fetch all entries with an explicit high limit to avoid PostgREST default cap
      const { data, error: entriesErr } = await adminSupabase
        .from('daily_entries')
        .select(FULL_ENTRY_SELECT)
        .limit(50000);
      if (entriesErr) {
        return NextResponse.json(
          { error: entriesErr.message, view, period, rankings: [], category_leaders: {}, team_stats: {} },
          { status: 503 },
        );
      }
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

  // Profile lookup map (used for on-the-fly point recomputation)
  const profileById = new Map<string, ProfileRow>(
    (profiles as ProfileRow[]).map((p) => [p.id, p]),
  );

  // Compute previous-week rank map for rank_change
  const prevPointsByUser = new Map<string, number>();
  for (const e of prevWeekEntries) {
    const prof = profileById.get(e.user_id);
    const pts = prof ? effectivePoints(e, prof) : (e.daily_points ?? 0);
    prevPointsByUser.set(e.user_id, (prevPointsByUser.get(e.user_id) ?? 0) + pts);
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
      const total = userEntries.reduce((sum, e) => sum + effectivePoints(e, p), 0);
      const daysSinceJoin = Math.max(
        1,
        Math.floor((Date.now() - new Date(p.joined_at).getTime()) / (24 * 60 * 60 * 1000)),
      );
      const normalized = total / daysSinceJoin;
      const daysActive = new Set(userEntries.map((e) => e.date)).size;
      const streakDays = computeStreak(recentEntries.map((e) => e.date), todayStr);
      const goalCrushStreak = computeGoalCrushStreak(recentEntries, todayStr);
      const breakdown = computeBreakdown(userEntries, p.age_bracket);

      // Goal adherence: avg across entries that have profile goals set
      const adherenceScores = userEntries.map((e) => computeGoalAdherencePct(e, p));
      const goal_adherence_pct = adherenceScores.length > 0
        ? Math.round(adherenceScores.reduce((a, b) => a + b, 0) / adherenceScores.length)
        : undefined;

      return {
        rank: 0,
        user: {
          id: p.id,
          display_name: p.display_name,
          avatar_url: p.avatar_url,
          streak_days: streakDays,
          goal_crush_streak: goalCrushStreak,
          days_active: daysActive,
          fitness_goal: p.fitness_goal ?? null,
          goal_workout_types: parseGoalWorkoutTypes(p.goal_workout_types),
          food_tracking_mode: p.food_tracking_mode ?? null,
        },
        score: {
          total_points: total,
          normalized_score: Math.round(normalized * 10) / 10,
          goal_adherence_pct,
          breakdown,
        },
      };
    });
    rankings.sort((a, b) => b.score.normalized_score - a.score.normalized_score);
  } else {
    rankings = (profiles as ProfileRow[]).map((p) => {
      const userEntries = currentByUser.get(p.id) ?? [];
      const recentEntries = recentByUser.get(p.id) ?? [];
      const baseTotal = userEntries.reduce((sum, e) => sum + effectivePoints(e, p), 0);
      const daysActive = new Set(userEntries.map((e) => e.date)).size;
      const streakDays = computeStreak(recentEntries.map((e) => e.date), todayStr);
      const goalCrushStreak = computeGoalCrushStreak(recentEntries, todayStr);
      const breakdown = computeBreakdown(userEntries, p.age_bracket);

      // Weekly performance bonus
      let weeklyBonus = 0;
      if (view === 'weekly') {
        const weekResult = isWeeklyGoalHit(userEntries, p);
        if (weekResult === 'full') weeklyBonus = WEEKLY_PERF_BONUS.full;
        else if (weekResult === 'partial') weeklyBonus = WEEKLY_PERF_BONUS.partial;
      }

      const total = baseTotal + weeklyBonus;

      // goals_pct: daily avg vs 85 pt cap
      const goalsPct =
        view === 'weekly'
          ? Math.min(100, Math.round((baseTotal / (daysElapsed * 80)) * 100))
          : undefined;

      // Goal adherence
      const adherenceScores = userEntries.map((e) => computeGoalAdherencePct(e, p));
      const goal_adherence_pct = adherenceScores.length > 0
        ? Math.round(adherenceScores.reduce((a, b) => a + b, 0) / adherenceScores.length)
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
          goal_crush_streak: goalCrushStreak,
          days_active: daysActive,
          fitness_goal: p.fitness_goal ?? null,
          goal_workout_types: parseGoalWorkoutTypes(p.goal_workout_types),
          food_tracking_mode: p.food_tracking_mode ?? null,
        },
        score: {
          total_points: total,
          normalized_score: total,
          goals_pct: goalsPct,
          goal_adherence_pct,
          breakdown,
        },
      };
    });
    rankings.sort((a, b) => b.score.total_points - a.score.total_points);
  }

  rankings.forEach((r, i) => {
    r.rank = i + 1;
    if (r.prev_rank != null) {
      r.rank_change = r.prev_rank - r.rank;
    }
  });

  // Add pts_to_next_rank for current user
  if (currentUserId) {
    const currentUserRankIdx = rankings.findIndex((r) => r.user.id === currentUserId);
    if (currentUserRankIdx > 0) {
      const nextRankEntry = rankings[currentUserRankIdx - 1];
      const currentEntry = rankings[currentUserRankIdx];
      const ptsToNext = nextRankEntry.score.total_points - currentEntry.score.total_points + 1;
      if (!currentEntry.insights) currentEntry.insights = { strongest_category: '' };
      currentEntry.insights.pts_to_next_rank = Math.max(0, ptsToNext);
    } else if (currentUserRankIdx === 0 && rankings.length > 1) {
      const currentEntry = rankings[0];
      if (!currentEntry.insights) currentEntry.insights = { strongest_category: '' };
      currentEntry.insights.pts_to_next_rank = null; // already top
    }
  }

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
