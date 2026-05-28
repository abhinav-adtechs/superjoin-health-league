'use client';

import { useState, useEffect, useMemo } from 'react';
import {
  Activity,
  Target,
  Trophy,
  Dumbbell,
  Flame,
  Frown,
  TrendingUp,
  Droplets,
  Moon,
  Scale,
  UtensilsCrossed,
  Gauge,
  Trash2,
} from 'lucide-react';
import type { ReactNode } from 'react';
import { apiUrl, getApiFetchOptions, getAuthHeaders } from '@/lib/api';
import { CalendarHistogram } from './CalendarHistogram';
import { LogHistorySkeleton } from '@/components/LoadingScreen';
import { getLoggingStreakBonus } from '@/lib/points';
import type { Profile } from '@/lib/types';
import {
  CLEAR_ACTIVITY_LABELS,
  type ClearActivityKey,
} from '@/lib/clearEntryActivity';
import {
  MAX_DELETE_DAYS_BACK,
  getLocalDateString,
  isDateWithinAnchorRange,
  normalizeYmd,
} from '@/lib/entryDateWindow';

/** Canonical YYYY-MM-DD for API rows (ISO timestamps from Supabase break string compares and delete keys). */
function normalizeEntryRow<T extends { date: string }>(row: T): T {
  const y = normalizeYmd(row.date) ?? row.date;
  return { ...row, date: y };
}

type ProjectionResponse = {
  rank: number;
  is_first: boolean;
  days_to_first: number | null;
  expected_daily_points: number;
  message?: string;
};

type LeaderboardRankingEntry = {
  rank: number;
  user: { id: string; display_name: string };
  score: { total_points: number };
};

type LeaderboardSnapshot = {
  current_user_id: string | null;
  rankings: LeaderboardRankingEntry[];
};

type EntryRow = {
  date: string;
  workout_done?: boolean | null;
  workout_duration?: number | null;
  workout_types?: string[] | null;
  cardio_done?: boolean | null;
  cardio_duration?: number | null;
  cardio_type?: string | null;
  steps?: number | null;
  water_liters?: number | null;
  home_cooked_meals?: number | null;
  protein_meal?: boolean | null;
  protein_qty?: number | null;
  junk_food?: boolean | null;
  alcohol?: string | null;
  sleep_hours?: number | null;
  calories_kcal?: number | null;
  daily_points?: number | null;
  is_goal_crush_day?: boolean | null;
};

type HistoryRange = 'week' | 'month' | 'all';
/** What to show in the daily log list (replaces strength / cardio / steps). */
type LogCategoryFilter = 'all' | 'movement' | 'nutrition' | 'hydration' | 'sleep' | 'weight';
type WeekStatus = 'green' | 'yellow' | 'red';

function hasMovement(e: EntryRow): boolean {
  return e.workout_done === true || e.cardio_done === true || (e.steps != null && Number(e.steps) > 0);
}

function hasHydration(e: EntryRow): boolean {
  return e.water_liters != null && e.water_liters > 0;
}

function hasSleepLog(e: EntryRow): boolean {
  return e.sleep_hours != null && e.sleep_hours > 0;
}

function hasNutrition(e: EntryRow): boolean {
  if ((e.protein_qty ?? 0) > 0 || e.protein_meal === true) return true;
  if ((e.calories_kcal ?? 0) > 0) return true;
  if (e.junk_food != null) return true;
  if (e.alcohol != null) return true;
  if ((e.home_cooked_meals ?? 0) > 0) return true;
  return false;
}

function hasAnyLog(e: EntryRow): boolean {
  return hasMovement(e) || hasNutrition(e) || hasHydration(e) || hasSleepLog(e);
}

function workoutMins(e: EntryRow): number {
  const w = (e.workout_done && e.workout_duration) ? e.workout_duration : 0;
  const c = (e.cardio_done && e.cardio_duration) ? e.cardio_duration : 0;
  return w + c;
}

function label(s: string): string {
  return s.replace(/_/g, ' ');
}

const COLOR_WORKOUT = '#FF6B35';
const COLOR_CARDIO = '#0d9488';
const COLOR_STEPS = '#2563eb';
const COLOR_WATER = '#f59e0b';
const COLOR_SLEEP = '#0ea5e9';
const COLOR_NUTRITION = '#6366f1';
const COLOR_WEIGHT = '#94a3b8';

const LOG_FILTER_META: { id: LogCategoryFilter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'movement', label: 'Movement' },
  { id: 'nutrition', label: 'Nutrition' },
  { id: 'hydration', label: 'Water' },
  { id: 'sleep', label: 'Sleep' },
  { id: 'weight', label: 'Weight' },
];

function isGoalCrushEntry(e: EntryRow): boolean {
  if (e.is_goal_crush_day != null) return e.is_goal_crush_day === true;
  return (e.daily_points ?? 0) >= 60;
}

function addDays(dateStr: string, delta: number): string {
  const d = new Date(dateStr + 'T12:00:00');
  d.setDate(d.getDate() + delta);
  return d.toISOString().slice(0, 10);
}

function getMondayOfWeek(date: Date): Date {
  const d = new Date(date);
  const dow = d.getDay();
  d.setDate(d.getDate() - (dow === 0 ? 6 : dow - 1));
  return d;
}

function getWeekBounds(offset: number): { from: string; to: string } {
  const monday = getMondayOfWeek(new Date());
  monday.setDate(monday.getDate() + offset * 7);
  const sunday = new Date(monday);
  sunday.setDate(sunday.getDate() + 6);
  return { from: monday.toISOString().slice(0, 10), to: sunday.toISOString().slice(0, 10) };
}

function getMonthBounds(offset: number): { from: string; to: string } {
  const today = new Date();
  const first = new Date(today.getFullYear(), today.getMonth() + offset, 1);
  const last = new Date(today.getFullYear(), today.getMonth() + offset + 1, 0);
  return { from: first.toISOString().slice(0, 10), to: last.toISOString().slice(0, 10) };
}

function formatWeekNav(offset: number): string {
  const { from, to } = getWeekBounds(offset);
  const f = new Date(from + 'T12:00:00');
  const t = new Date(to + 'T12:00:00');
  const opts: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' };
  return `${f.toLocaleDateString(undefined, opts)} – ${t.toLocaleDateString(undefined, opts)}`;
}

function formatMonthNav(offset: number): string {
  const today = new Date();
  const d = new Date(today.getFullYear(), today.getMonth() + offset, 1);
  return d.toLocaleString('default', { month: 'long', year: 'numeric' });
}

// Returns the Monday of the ISO week for a given date string
function getWeekStart(dateStr: string): string {
  const d = getMondayOfWeek(new Date(dateStr + 'T12:00:00'));
  return d.toISOString().slice(0, 10);
}

function formatWeekRange(weekStartStr: string): string {
  const start = new Date(weekStartStr + 'T12:00:00');
  const end = new Date(weekStartStr + 'T12:00:00');
  end.setDate(end.getDate() + 6);
  const opts: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' };
  return `${start.toLocaleDateString(undefined, opts)} – ${end.toLocaleDateString(undefined, opts)}`;
}

function getWorkoutPoints(e: EntryRow, ageBracket: Profile['age_bracket']): number {
  if (!e.workout_done) return 0;
  let pts = 10;
  if (e.workout_duration != null && e.workout_duration >= 45) pts += 5;
  if (e.workout_duration != null && e.workout_duration >= 60) pts += 5;
  return pts;
}

function getCardioPoints(e: EntryRow, ageBracket: Profile['age_bracket']): number {
  if (!e.cardio_done) return 0;
  let pts = 10;
  const adj = ageBracket === 'over_35' ? 0.85 : 1.0;
  const threshold = 30 * adj;
  if (e.cardio_duration != null && e.cardio_duration >= threshold) pts += 5;
  return pts;
}

function getStepsPoints(e: EntryRow, ageBracket: Profile['age_bracket']): number {
  if (e.steps == null) return 0;
  const adj = ageBracket === 'over_35' ? 0.85 : 1.0;
  const thresholds: [number, number][] = [
    [10000 * adj, 15],
    [7500 * adj, 10],
    [5000 * adj, 5],
  ];
  for (const [th, pts] of thresholds) {
    if (e.steps >= th) return pts;
  }
  return 0;
}

export function LogEntryTab({ profile, onSuccess, refreshTrigger = 0 }: { profile: Profile; onSuccess: () => void; refreshTrigger?: number }) {
  const [entries, setEntries] = useState<EntryRow[]>([]);
  const [weightHistory, setWeightHistory] = useState<{ week_start: string; weight_kg: number }[]>([]);
  const [loading, setLoading] = useState(true);
  const [projection, setProjection] = useState<ProjectionResponse | null>(null);
  const [monthlyBoard, setMonthlyBoard] = useState<LeaderboardSnapshot | null>(null);
  const [historyRange, setHistoryRange] = useState<HistoryRange>('all');
  const [historyWeekOffset, setHistoryWeekOffset] = useState(0);
  const [historyMonthOffset, setHistoryMonthOffset] = useState(0);
  const [categoryFilter, setCategoryFilter] = useState<LogCategoryFilter>('all');
  const [visibleWeeks, setVisibleWeeks] = useState(8);
  const [busyClearKey, setBusyClearKey] = useState<string | null>(null);
  /** Anchor for delete UI: today + previous 2 days only. */
  const todayLocalForDelete = getLocalDateString();

  async function clearActivityForDate(date: string, activity: ClearActivityKey) {
    const label = CLEAR_ACTIVITY_LABELS[activity];
    if (!confirm(`Remove ${label} log for this day?`)) return;
    const dateKey = normalizeYmd(date) ?? date;
    const k = `${dateKey}:${activity}`;
    setBusyClearKey(k);
    try {
      const authHeaders = await getAuthHeaders();
      const res = await fetch(apiUrl('/api/entries'), getApiFetchOptions({
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', ...authHeaders },
        body: JSON.stringify({ date: dateKey, activity, client_today: getLocalDateString() }),
      }));
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const msg = (data as { error?: string }).error || `Could not remove (${res.status})`;
        alert(msg);
        return;
      }
      onSuccess();
    } finally {
      setBusyClearKey(null);
    }
  }

  const logEntries = useMemo(
    () => [...entries].filter(hasAnyLog).sort((a, b) => b.date.localeCompare(a.date)),
    [entries]
  );

  const movementEntries = useMemo(
    () => [...entries].filter(hasMovement).sort((a, b) => b.date.localeCompare(a.date)),
    [entries]
  );

  const weightByWeek = useMemo(() => {
    const m = new Map<string, number>();
    for (const w of weightHistory) {
      m.set(w.week_start, w.weight_kg);
    }
    return m;
  }, [weightHistory]);

  useEffect(() => {
    let cancelled = false;
    const end = new Date();
    const start = new Date();
    start.setDate(start.getDate() - 365);
    // Use local-date strings (not UTC) so entries logged after midnight in UTC+
    // timezones are included — entries are stored with the local date on the client.
    const localDate = (d: Date) =>
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    const from = localDate(start);
    const to = localDate(end);

    void (async () => {
      const authHeaders = await getAuthHeaders();
      const baseHeaders = { ...authHeaders };
      try {
        const [entriesRes, weightRes] = await Promise.all([
          fetch(
            apiUrl(`/api/entries/history?from=${from}&to=${to}`),
            getApiFetchOptions({ cache: 'no-store', headers: baseHeaders }),
          ),
          fetch(apiUrl('/api/weight/history'), getApiFetchOptions({ cache: 'no-store', headers: baseHeaders })),
        ]);
        const data = await entriesRes.json().catch(() => []);
        const wh = await weightRes.json().catch(() => []);
        if (cancelled) return;
        const list = Array.isArray(data) ? data : [];
        setEntries(list.map((row: EntryRow) => normalizeEntryRow(row)));
        const weights = Array.isArray(wh) ? wh : [];
        setWeightHistory(
          weights
            .filter((x: { week_start?: string; weight_kg?: number }) => x.week_start && typeof x.weight_kg === 'number')
            .map((x: { week_start: string; weight_kg: number }) => ({ week_start: x.week_start, weight_kg: x.weight_kg }))
        );
      } catch {
        if (!cancelled) {
          setEntries([]);
          setWeightHistory([]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [refreshTrigger]);

  useEffect(() => {
    let cancelled = false;
    fetch(apiUrl('/api/leaderboard/projection'), getApiFetchOptions())
      .then((r) => r.json())
      .then((data) => { if (!cancelled) setProjection(data); })
      .catch(() => { if (!cancelled) setProjection(null); });
    return () => { cancelled = true; };
  }, [refreshTrigger]);

  useEffect(() => {
    let cancelled = false;
    const d = new Date();
    const monthStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    fetch(apiUrl(`/api/leaderboard?view=monthly&month=${monthStr}`), getApiFetchOptions())
      .then((r) => r.json())
      .then((data) => { if (!cancelled) setMonthlyBoard(data); })
      .catch(() => { if (!cancelled) setMonthlyBoard(null); });
    return () => { cancelled = true; };
  }, [refreshTrigger]);

  const { streakBonusByDate, streakHighlightDates, streakLengthByDate } = useMemo(() => {
    const bonuses = new Map<string, number>();
    const highlight = new Set<string>();
    const lengths = new Map<string, number>();
    if (!logEntries.length) return { streakBonusByDate: bonuses, streakHighlightDates: highlight, streakLengthByDate: lengths };

    const uniqueDates = Array.from(new Set(logEntries.map((e) => e.date))).sort();
    let currentStreak = 0;
    let prevDate: string | null = null;
    let run: string[] = [];

    const flushRun = () => {
      if (run.length >= 7) {
        for (const d of run) highlight.add(d);
      }
      run = [];
    };

    for (const date of uniqueDates) {
      if (prevDate && addDays(prevDate, 1) === date) {
        currentStreak += 1;
      } else {
        flushRun();
        currentStreak = 1;
      }
      run.push(date);
      const totalBefore = getLoggingStreakBonus(currentStreak - 1);
      const totalNow = getLoggingStreakBonus(currentStreak);
      const delta = totalNow - totalBefore;
      if (delta > 0) bonuses.set(date, delta);
      lengths.set(date, currentStreak);
      prevDate = date;
    }
    flushRun();

    return { streakBonusByDate: bonuses, streakHighlightDates: highlight, streakLengthByDate: lengths };
  }, [logEntries]);

  // Reset pagination when filters change
  useEffect(() => {
    setVisibleWeeks(8);
    setHistoryWeekOffset(0);
    setHistoryMonthOffset(0);
  }, [historyRange]);

  useEffect(() => {
    setVisibleWeeks(8);
  }, [categoryFilter]);

  // Compute filter bounds from offset-based navigation
  const filterBounds = useMemo(() => {
    if (historyRange === 'all') return null;
    if (historyRange === 'week') return getWeekBounds(historyWeekOffset);
    return getMonthBounds(historyMonthOffset);
  }, [historyRange, historyWeekOffset, historyMonthOffset]);

  const filteredLogEntries = useMemo(() => {
    return logEntries.filter((e) => {
      if (filterBounds && (e.date < filterBounds.from || e.date > filterBounds.to)) return false;
      switch (categoryFilter) {
        case 'all':
          return true;
        case 'movement':
          return hasMovement(e);
        case 'nutrition':
          return hasNutrition(e);
        case 'hydration':
          return hasHydration(e);
        case 'sleep':
          return hasSleepLog(e);
        case 'weight':
          return false;
        default:
          return true;
      }
    });
  }, [logEntries, filterBounds, categoryFilter]);

  // 3-tier week goal map (keyed by week-start date)
  const weekGoalMap = useMemo(() => {
    const map = new Map<string, { status: WeekStatus; metric: string | null }>();
    const goalDays = profile.goal_workout_days_week ?? 0;
    const goalMins = profile.goal_workout_mins_week ?? 0;

    const byWeek = new Map<string, EntryRow[]>();
    movementEntries.forEach((e) => {
      const ws = getWeekStart(e.date);
      if (!byWeek.has(ws)) byWeek.set(ws, []);
      byWeek.get(ws)!.push(e);
    });

    byWeek.forEach((wEntries, weekStart) => {
      // Weekly workout goal: count days with an actual workout or cardio session logged.
      // workout goal is inherently weekly (not daily), so is_goal_crush_day is irrelevant here.
      const workoutCount = wEntries.filter((e) => e.workout_done === true || e.cardio_done === true).length;

      if (goalDays > 0) {
        const metric = `${workoutCount}/${goalDays} workout days`;
        if (workoutCount >= goalDays) map.set(weekStart, { status: 'green', metric });
        else if (workoutCount > 0) map.set(weekStart, { status: 'yellow', metric });
        else map.set(weekStart, { status: 'red', metric });
      } else if (goalMins > 0) {
        const total = wEntries.reduce((s, e) => s + workoutMins(e), 0);
        const metric = `${total}/${goalMins} min`;
        if (total >= goalMins) map.set(weekStart, { status: 'green', metric });
        else if (total > 0) map.set(weekStart, { status: 'yellow', metric });
        else map.set(weekStart, { status: 'red', metric });
      } else {
        // No weekly workout goal set — fall back to whether any goal-crush days occurred
        const goalHitCount = wEntries.filter((e) => isGoalCrushEntry(e)).length;
        const status: WeekStatus = goalHitCount > 0 ? 'green' : workoutCount > 0 ? 'yellow' : 'red';
        map.set(weekStart, { status, metric: null });
      }
    });

    return map;
  }, [movementEntries, profile]);

  // Group filtered entries by week, merge weekly weigh-ins; respecting visibleWeeks
  const { weekGroups, totalWeekCount } = useMemo(() => {
    const byWeek = new Map<string, EntryRow[]>();
    filteredLogEntries.forEach((e) => {
      const ws = getWeekStart(e.date);
      if (!byWeek.has(ws)) byWeek.set(ws, []);
      byWeek.get(ws)!.push(e);
    });

    const includeWeightOnlyWeeks = categoryFilter === 'all' || categoryFilter === 'weight';
    if (includeWeightOnlyWeeks) {
      for (const w of weightHistory) {
        if (filterBounds && (w.week_start < filterBounds.from || w.week_start > filterBounds.to)) continue;
        if (!byWeek.has(w.week_start)) byWeek.set(w.week_start, []);
      }
    }

    let pairs = Array.from(byWeek.entries());
    pairs = pairs.filter(([ws, ent]) => {
      const wkg = weightByWeek.get(ws);
      if (categoryFilter === 'weight') return wkg != null;
      if (categoryFilter === 'all') return ent.length > 0 || wkg != null;
      return ent.length > 0;
    });

    pairs.forEach(([, ent]) => {
      ent.sort((a, b) => b.date.localeCompare(a.date));
    });

    const sorted = pairs.sort((a, b) => b[0].localeCompare(a[0]));
    const totalWeekCount = sorted.length;
    const weekGroups = sorted.slice(0, visibleWeeks).map(([weekStart, entries]) => ({
      weekStart,
      entries,
      weightKg: weightByWeek.get(weekStart) ?? null,
    }));

    return { weekGroups, totalWeekCount };
  }, [filteredLogEntries, weightHistory, weightByWeek, filterBounds, categoryFilter, visibleWeeks]);

  // Estimate daily points when hitting goals, based on past goal-crush day entries
  const goalDailyPts = useMemo(() => {
    const goalDays = logEntries.filter((e) => e.is_goal_crush_day === true && (e.daily_points ?? 0) > 0);
    if (goalDays.length === 0) {
      // Fall back: rough estimate based on which goals are set (new 85pt system)
      let est = 0;
      if ((profile.goal_workout_days_week ?? 0) > 0 || (profile.goal_workout_mins_week ?? 0) > 0) est += 20;
      if ((profile.goal_sleep_hours ?? profile.goal_sleep_hours_min ?? 0) > 0) est += 10;
      if ((profile.goal_water_liters ?? 0) > 0) est += 10;
      if ((profile.goal_protein_g_day ?? 0) > 0) est += 8;
      if ((profile.goal_calories_day ?? 0) > 0) est += 8;
      return est > 0 ? est : 55;
    }
    const avg = goalDays.reduce((s, e) => s + (e.daily_points ?? 0), 0) / goalDays.length;
    return Math.round(avg);
  }, [logEntries, profile]);

  // Monthly rank insights from live leaderboard
  const rankInsights = useMemo(() => {
    const dailyPts = projection?.expected_daily_points ?? 0;
    const today = new Date();
    const dayOfMonth = today.getDate();
    const daysInMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
    const remainingMonthDays = Math.max(0, daysInMonth - dayOfMonth);

    if (!monthlyBoard?.current_user_id || !monthlyBoard.rankings.length) {
      return { dailyPts, remainingMonthDays, myRank: null, myPts: null, total: 0, above: null, ptsNeeded: null, projectedRank: null, goalProjectedTotal: null, goalProjectedRank: null };
    }

    const userId = monthlyBoard.current_user_id;
    const myEntry = monthlyBoard.rankings.find((r) => r.user.id === userId);
    if (!myEntry) {
      return { dailyPts, remainingMonthDays, myRank: null, myPts: null, total: monthlyBoard.rankings.length, above: null, ptsNeeded: null, projectedRank: null, goalProjectedTotal: null, goalProjectedRank: null };
    }

    const myRank = myEntry.rank;
    const myPts = myEntry.score.total_points;
    const total = monthlyBoard.rankings.length;

    const above = myRank > 1 ? monthlyBoard.rankings.find((r) => r.rank === myRank - 1) : null;
    const ptsNeeded = above ? Math.max(1, above.score.total_points - myPts + 1) : null;

    const projectedTotal = myPts + Math.round(dailyPts * remainingMonthDays);
    const projectedRank =
      monthlyBoard.rankings.filter((r) => r.user.id !== userId && r.score.total_points > projectedTotal)
        .length + 1;

    const goalProjectedTotal = myPts + Math.round(goalDailyPts * remainingMonthDays);
    const goalProjectedRank =
      monthlyBoard.rankings.filter((r) => r.user.id !== userId && r.score.total_points > goalProjectedTotal)
        .length + 1;

    return { dailyPts, remainingMonthDays, myRank, myPts, total, above, ptsNeeded, projectedTotal, projectedRank, goalProjectedTotal, goalProjectedRank };
  }, [monthlyBoard, projection, goalDailyPts]);

  const hasWeeklyGoal = (profile.goal_workout_days_week ?? 0) > 0 || (profile.goal_workout_mins_week ?? 0) > 0;

  const weekStatusMeta: Record<WeekStatus, { label: string; cls: string; icon: ReactNode }> = {
    green: {
      label: hasWeeklyGoal ? 'Workout goal met' : 'Perfect week',
      cls: 'bg-emerald-500/10 text-emerald-500',
      icon: <Trophy className="w-3 h-3 text-accent-gold" />,
    },
    yellow: {
      label: hasWeeklyGoal ? 'Workout goal partial' : 'Partial week',
      cls: 'bg-amber-400/10 text-amber-400',
      icon: <Activity className="w-3 h-3" />,
    },
    red: {
      label: hasWeeklyGoal ? 'Workout goal missed' : 'Week missed',
      cls: 'bg-rose-500/10 text-rose-500',
      icon: <Frown className="w-3 h-3" />,
    },
  };

  return (
    <div className="space-y-8 animate-fade-up">
      <div>
        <h2 className="text-lg font-semibold text-text-primary mb-1">Health &amp; Activity Log</h2>
        <p className="text-sm text-text-secondary">
          Calendar tracks <strong>Workout</strong>, <strong>Nutrition</strong>, <strong>Sleep</strong>, <strong>Hydration</strong> and more — all your daily goals in one view. Use <strong>New Entry</strong> in the header to log.
        </p>
      </div>

      {/* Goal pills */}
      {((profile.goal_workout_days_week ?? 0) > 0 ||
        (profile.goal_workout_mins_week ?? 0) > 0 ||
        (profile.goal_sleep_hours ?? profile.goal_sleep_hours_min ?? 0) > 0 ||
        (profile.goal_water_liters ?? 0) > 0 ||
        (profile.goal_protein_g_day ?? 0) > 0 ||
        (profile.goal_calories_day ?? 0) > 0) && (
        <div className="space-y-1.5">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-text-muted">Your goals</p>
          <div className="flex flex-wrap gap-2">
            {(profile.goal_workout_days_week ?? 0) > 0 && (
              <span className="rounded-full bg-[#FF6B35]/15 text-[#FF6B35] px-2.5 py-1 text-xs font-semibold">
                🏋️ {profile.goal_workout_days_week} days/wk
              </span>
            )}
            {(profile.goal_workout_mins_week ?? 0) > 0 && !(profile.goal_workout_days_week ?? 0) && (
              <span className="rounded-full bg-[#FF6B35]/15 text-[#FF6B35] px-2.5 py-1 text-xs font-semibold">
                🏋️ {profile.goal_workout_mins_week}min/wk
              </span>
            )}
            {((profile.goal_sleep_hours ?? profile.goal_sleep_hours_min ?? 0) > 0) && (
              <span className="rounded-full bg-blue-500/15 text-blue-400 px-2.5 py-1 text-xs font-semibold">
                😴 {profile.goal_sleep_hours != null
                  ? `${profile.goal_sleep_hours}h`
                  : `${profile.goal_sleep_hours_min}–${profile.goal_sleep_hours_max}h`} sleep
              </span>
            )}
            {(profile.goal_water_liters ?? 0) > 0 && (
              <span className="rounded-full bg-amber-500/15 text-amber-400 px-2.5 py-1 text-xs font-semibold">
                💧 {profile.goal_water_liters}L water
              </span>
            )}
            {(profile.goal_protein_g_day ?? 0) > 0 && (
              <span className="rounded-full bg-indigo-500/15 text-indigo-400 px-2.5 py-1 text-xs font-semibold">
                🥩 {profile.goal_protein_g_day}g protein/day
              </span>
            )}
            {(profile.goal_calories_day ?? 0) > 0 && (
              <span className="rounded-full bg-rose-500/15 text-rose-400 px-2.5 py-1 text-xs font-semibold">
                🔥 {(profile.goal_calories_day ?? 0).toLocaleString()} kcal/day
              </span>
            )}
          </div>
        </div>
      )}

      <div className="glass-card p-5">
        <CalendarHistogram refreshTrigger={refreshTrigger} goals={profile} />
      </div>

      {/* Rank trajectory — desktop/tablet only; saves mobile scroll */}
      <div className="hidden md:block glass-card p-5">
        <h3 className="font-medium text-text-primary flex items-center gap-2 mb-4">
          <TrendingUp className="w-4 h-4 text-accent-blue" />
          Rank trajectory
        </h3>

        {(projection || rankInsights.myRank != null) ? (
          <div className="space-y-3 text-sm">
            {/* This month block */}
            <div className="rounded-lg bg-surface-2/50 md:bg-surface-2 p-3 space-y-2">
              <div className="text-[10px] font-semibold text-text-muted uppercase tracking-wide mb-1">This month</div>

              {/* Monthly rank */}
              {rankInsights.myRank != null && (
                <div className="flex items-center justify-between">
                  <span className="text-text-secondary">Your rank this month</span>
                  <span className="font-bold text-text-primary">
                    #{rankInsights.myRank}
                    {rankInsights.total > 1 && (
                      <span className="text-text-muted font-normal text-xs"> of {rankInsights.total} players</span>
                    )}
                  </span>
                </div>
              )}

              {/* Points to go up 1 rank */}
              {rankInsights.ptsNeeded != null && rankInsights.above && (
                <div className="flex items-start gap-2 text-xs text-text-secondary">
                  <Target className="w-3.5 h-3.5 text-text-muted shrink-0 mt-0.5" />
                  <span>
                    You need <span className="font-bold text-text-primary">{rankInsights.ptsNeeded} more points</span> to overtake{' '}
                    <span className="font-bold text-text-primary">{rankInsights.above.user.display_name}</span> and move up to{' '}
                    <span className="font-bold text-text-primary">rank #{rankInsights.myRank! - 1}</span>.
                  </span>
                </div>
              )}

              {rankInsights.myRank === 1 && (
                <div className="flex items-start gap-2 text-xs text-text-primary font-medium">
                  <Trophy className="w-3.5 h-3.5 text-accent-gold shrink-0 mt-0.5" />
                  <span>You&apos;re leading this month! Keep it up.</span>
                </div>
              )}

              {/* Projected rank at current pace */}
              {rankInsights.dailyPts > 0 && rankInsights.remainingMonthDays > 0 && rankInsights.projectedRank != null && (
                <div className="flex items-start gap-2 text-xs text-text-secondary">
                  <TrendingUp className="w-3.5 h-3.5 text-text-muted shrink-0 mt-0.5" />
                  <span>
                    If you keep scoring at your current pace (~<span className="font-bold text-text-primary">{rankInsights.dailyPts} pts/day</span> for the remaining{' '}
                    <span className="font-bold text-text-primary">{rankInsights.remainingMonthDays} day{rankInsights.remainingMonthDays !== 1 ? 's' : ''}</span> of the month), you&apos;ll finish the month at{' '}
                    <span className="font-bold text-text-primary">rank #{rankInsights.projectedRank}</span> with{' '}
                    <span className="font-bold text-text-primary">{rankInsights.projectedTotal} pts</span>.
                  </span>
                </div>
              )}

              {/* Projected rank if goals are met */}
              {rankInsights.remainingMonthDays > 0 && rankInsights.goalProjectedRank != null && (
                <div className="flex items-start gap-2 text-xs text-text-secondary">
                  <Trophy className="w-3.5 h-3.5 text-text-muted shrink-0 mt-0.5" />
                  <span>
                    If you hit your daily goals for every remaining day this month, you&apos;ll finish at{' '}
                    <span className="font-bold text-text-primary">rank #{rankInsights.goalProjectedRank}</span> with about{' '}
                    <span className="font-bold text-text-primary">{rankInsights.goalProjectedTotal} pts</span>.
                  </span>
                </div>
              )}
            </div>

          </div>
        ) : (
          <p className="text-sm text-text-muted">Log some entries to see your rank trajectory.</p>
        )}
      </div>

      {/* Full daily log (movement, nutrition, water, sleep) + weekly weight */}
      <div className="glass-card p-5">
        <h3 className="font-medium text-text-primary flex items-center gap-2 mb-4">
          <UtensilsCrossed className="w-4 h-4 text-primary-orange" />
          Full log
        </h3>

        {/* Filters */}
        <div className="flex flex-col gap-3 mb-4">
          <div className="flex flex-wrap items-center gap-3">
            {/* Range buttons */}
            <div className="inline-flex rounded-full border border-white/10 overflow-hidden text-xs">
              {(['all', 'week', 'month'] as HistoryRange[]).map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => setHistoryRange(r)}
                  className={`px-2.5 py-1 ${historyRange === r ? 'bg-primary-orange text-white' : 'bg-surface-0 text-text-muted'}`}
                >
                  {r === 'all' ? 'All' : r === 'week' ? 'Week' : 'Month'}
                </button>
              ))}
            </div>

            {/* Week navigation */}
            {historyRange === 'week' && (
              <div className="flex items-center gap-1 text-xs">
                <button
                  type="button"
                  onClick={() => setHistoryWeekOffset((o) => o - 1)}
                  className="p-1 rounded hover:bg-surface-2 text-text-muted"
                  aria-label="Previous week"
                >
                  ←
                </button>
                <span className="text-text-secondary font-medium whitespace-nowrap px-0.5">
                  {formatWeekNav(historyWeekOffset)}
                </span>
                {historyWeekOffset < 0 && (
                  <button
                    type="button"
                    onClick={() => setHistoryWeekOffset((o) => Math.min(0, o + 1))}
                    className="p-1 rounded hover:bg-surface-2 text-text-muted"
                    aria-label="Next week"
                  >
                    →
                  </button>
                )}
              </div>
            )}

            {/* Month navigation */}
            {historyRange === 'month' && (
              <div className="flex items-center gap-1 text-xs">
                <button
                  type="button"
                  onClick={() => setHistoryMonthOffset((o) => o - 1)}
                  className="p-1 rounded hover:bg-surface-2 text-text-muted"
                  aria-label="Previous month"
                >
                  ←
                </button>
                <span className="text-text-secondary font-medium whitespace-nowrap px-0.5">
                  {formatMonthNav(historyMonthOffset)}
                </span>
                {historyMonthOffset < 0 && (
                  <button
                    type="button"
                    onClick={() => setHistoryMonthOffset((o) => Math.min(0, o + 1))}
                    className="p-1 rounded hover:bg-surface-2 text-text-muted"
                    aria-label="Next month"
                  >
                    →
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Category filter */}
          <div className="flex flex-wrap gap-1.5">
            {LOG_FILTER_META.map(({ id, label }) => (
              <button
                key={id}
                type="button"
                onClick={() => setCategoryFilter(id)}
                className={`px-2.5 py-1 rounded-full text-xs font-medium border ${
                  categoryFilter === id
                    ? 'bg-surface-2 text-text-primary border-white/20'
                    : 'bg-surface-0 text-text-muted border-white/10 hover:bg-surface-2/80'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Week-grouped entries */}
        {loading ? (
          <LogHistorySkeleton />
        ) : weekGroups.length === 0 ? (
          <p className="text-sm text-text-muted">
            {categoryFilter === 'weight'
              ? 'No weigh-ins in this period.'
              : 'Nothing logged in this period for this filter.'}
          </p>
        ) : (
          <div className="space-y-6">
            {weekGroups.map(({ weekStart, entries: weekEntries, weightKg }) => {
              const wkEntry = weekGoalMap.get(weekStart);
              const meta = wkEntry ? weekStatusMeta[wkEntry.status] : null;
              const wkMetric = wkEntry?.metric ?? null;
              const showWeightRow =
                weightKg != null && (categoryFilter === 'all' || categoryFilter === 'weight');
              const showM = categoryFilter === 'all' || categoryFilter === 'movement';
              const showN = categoryFilter === 'all' || categoryFilter === 'nutrition';
              const showH = categoryFilter === 'all' || categoryFilter === 'hydration';
              const showSlp = categoryFilter === 'all' || categoryFilter === 'sleep';

              return (
                <div key={weekStart}>
                  {/* Week header */}
                  <div className="flex items-center justify-between mb-2 pb-2 border-b border-white/10">
                    <span className="text-xs font-semibold text-text-muted uppercase tracking-wide">
                      {formatWeekRange(weekStart)}
                    </span>
                    {hasWeeklyGoal && meta && categoryFilter !== 'weight' && (
                      <span
                        className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ${meta.cls}`}
                      >
                        {meta.icon}
                        <span>{meta.label}</span>
                        {wkMetric && (
                          <span className="opacity-70">· {wkMetric}</span>
                        )}
                      </span>
                    )}
                  </div>

                  <ul className="divide-y divide-white/10">
                    {showWeightRow && (
                      <li className="py-2 pl-3">
                        <div className="flex items-center justify-between gap-3 text-sm text-text-secondary">
                          <div className="flex items-center gap-2 min-w-0">
                            <Scale className="w-3.5 h-3.5 shrink-0" style={{ color: COLOR_WEIGHT }} />
                            <span className="font-medium text-text-primary">Weekly weigh-in</span>
                            <span className="text-text-secondary">{weightKg} kg</span>
                          </div>
                        </div>
                      </li>
                    )}

                    {weekEntries.map((e) => {
                      const hasStrength = e.workout_done === true && (e.workout_duration != null || (e.workout_types?.length ?? 0) > 0);
                      const hasCardio = e.cardio_done === true && (e.cardio_duration != null || !!e.cardio_type);
                      const hasSteps = !hasStrength && !hasCardio && e.steps != null && Number(e.steps) > 0;
                      const streakBonus = streakBonusByDate.get(e.date) ?? 0;
                      const isStreakDay = streakHighlightDates.has(e.date);
                      const goalHit = isGoalCrushEntry(e);

                      const showStrength = hasStrength && showM;
                      const showCardio = hasCardio && showM;
                      const showSteps = hasSteps && showM;
                      const showWater = hasHydration(e) && showH;
                      const showSleepRow = hasSleepLog(e) && showSlp;
                      const showProtein =
                        showN && ((e.protein_qty ?? 0) > 0 || e.protein_meal === true);
                      const showCals = showN && (e.calories_kcal ?? 0) > 0;
                      const showJunk = showN && e.junk_food != null;
                      const showAlc = showN && e.alcohol != null;
                      const showHome = showN && (e.home_cooked_meals ?? 0) > 0;
                      const showStreak = streakBonus > 0 && showM;

                      if (
                        !showStrength &&
                        !showCardio &&
                        !showSteps &&
                        !showWater &&
                        !showSleepRow &&
                        !showProtein &&
                        !showCals &&
                        !showJunk &&
                        !showAlc &&
                        !showHome &&
                        !showStreak
                      ) {
                        return null;
                      }

                      const strengthPts = showStrength ? getWorkoutPoints(e, profile.age_bracket) : 0;
                      const cardioPts = showCardio ? getCardioPoints(e, profile.age_bracket) : 0;
                      const stepsPts = showSteps ? getStepsPoints(e, profile.age_bracket) : 0;
                      const movementPts = strengthPts + cardioPts + stepsPts;
                      const totalDayPoints =
                        (e.daily_points ?? null) != null ? e.daily_points! : movementPts + streakBonus;

                      const clearBtn = (activity: ClearActivityKey) =>
                        isDateWithinAnchorRange(e.date, todayLocalForDelete, MAX_DELETE_DAYS_BACK) ? (
                          <button
                            type="button"
                            onPointerDown={(ev) => {
                              ev.stopPropagation();
                            }}
                            onClick={(ev) => {
                              ev.stopPropagation();
                              void clearActivityForDate(e.date, activity);
                            }}
                            disabled={busyClearKey === `${e.date}:${activity}`}
                            className="relative z-10 p-1 rounded-md text-text-muted hover:text-rose-400 hover:bg-rose-500/10 disabled:opacity-40 touch-manipulation"
                            aria-label={`Remove ${CLEAR_ACTIVITY_LABELS[activity]}`}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        ) : null;

                      return (
                        <li
                          key={e.date}
                          className={`relative py-2 pl-3 ${
                            isStreakDay && showM
                              ? 'before:absolute before:left-0 before:top-0 before:bottom-0 before:w-[3px] before:rounded-r before:bg-accent-gold/80'
                              : ''
                          }`}
                        >
                          <div className="flex items-center justify-between mb-1 gap-3">
                            <span className="text-text-primary font-medium flex items-center gap-1.5">
                              {isStreakDay && showM && (
                                <Flame className="w-3 h-3 text-accent-gold flex-shrink-0" />
                              )}
                              {new Date((normalizeYmd(e.date) ?? e.date) + 'T12:00:00').toLocaleDateString(undefined, {
                                weekday: 'short',
                                month: 'short',
                                day: 'numeric',
                              })}
                            </span>
                            <div className="flex items-center gap-2">
                              <span
                                className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                                  goalHit ? 'bg-emerald-500/10 text-emerald-500' : 'bg-rose-500/10 text-rose-500'
                                }`}
                              >
                                {goalHit ? (
                                  <Trophy className="w-3 h-3 text-accent-gold" />
                                ) : (
                                  <Frown className="w-3 h-3" />
                                )}
                                <span>{goalHit ? 'Goal hit' : 'Goal missed'}</span>
                              </span>
                              <span className="text-[11px] font-semibold text-text-primary whitespace-nowrap">
                                +{totalDayPoints} pts
                              </span>
                            </div>
                          </div>
                          <div className="space-y-1 pl-1">
                            {showStrength && (
                              <div className="flex items-center justify-between gap-2 text-sm text-text-secondary">
                                <div className="flex items-center gap-2 min-w-0">
                                  <Dumbbell className="w-3.5 h-3.5 shrink-0" style={{ color: COLOR_WORKOUT }} />
                                  <span className="font-medium text-text-primary">Strength</span>
                                  <span className="truncate">
                                    {e.workout_duration ? `${e.workout_duration} min` : ''}
                                    {e.workout_types?.length ? ` · ${e.workout_types.map(label).join(', ')}` : ''}
                                  </span>
                                </div>
                                <div className="flex items-center gap-1.5 shrink-0">
                                  {strengthPts > 0 && (
                                    <span className="text-xs font-semibold text-text-primary whitespace-nowrap">
                                      +{strengthPts} pts
                                    </span>
                                  )}
                                  {clearBtn('strength')}
                                </div>
                              </div>
                            )}
                            {showCardio && (
                              <div className="flex items-center justify-between gap-2 text-sm text-text-secondary">
                                <div className="flex items-center gap-2 min-w-0">
                                  <Activity className="w-3.5 h-3.5 shrink-0" style={{ color: COLOR_CARDIO }} />
                                  <span className="font-medium text-text-primary">Cardio</span>
                                  <span className="truncate">
                                    {e.cardio_duration ? `${e.cardio_duration} min` : ''}
                                    {e.cardio_type ? ` · ${label(e.cardio_type)}` : ''}
                                  </span>
                                </div>
                                <div className="flex items-center gap-1.5 shrink-0">
                                  {cardioPts > 0 && (
                                    <span className="text-xs font-semibold text-text-primary whitespace-nowrap">
                                      +{cardioPts} pts
                                    </span>
                                  )}
                                  {clearBtn('cardio')}
                                </div>
                              </div>
                            )}
                            {showSteps && (
                              <div className="flex items-center justify-between gap-2 text-sm text-text-secondary">
                                <div className="flex items-center gap-2 min-w-0">
                                  <Activity className="w-3.5 h-3.5 shrink-0" style={{ color: COLOR_STEPS }} />
                                  <span className="font-medium text-text-primary">Steps</span>
                                  <span>{e.steps?.toLocaleString()} steps</span>
                                </div>
                                <div className="flex items-center gap-1.5 shrink-0">
                                  {stepsPts > 0 && (
                                    <span className="text-xs font-semibold text-text-primary whitespace-nowrap">
                                      +{stepsPts} pts
                                    </span>
                                  )}
                                  {clearBtn('steps')}
                                </div>
                              </div>
                            )}
                            {showWater && (
                              <div className="flex items-center justify-between gap-2 text-sm text-text-secondary">
                                <div className="flex items-center gap-2 min-w-0">
                                  <Droplets className="w-3.5 h-3.5 shrink-0" style={{ color: COLOR_WATER }} />
                                  <span className="font-medium text-text-primary">Water</span>
                                  <span>{e.water_liters} L</span>
                                </div>
                                <div className="flex items-center gap-1.5 shrink-0">{clearBtn('water')}</div>
                              </div>
                            )}
                            {showSleepRow && (
                              <div className="flex items-center justify-between gap-2 text-sm text-text-secondary">
                                <div className="flex items-center gap-2 min-w-0">
                                  <Moon className="w-3.5 h-3.5 shrink-0" style={{ color: COLOR_SLEEP }} />
                                  <span className="font-medium text-text-primary">Sleep</span>
                                  <span>{e.sleep_hours} h</span>
                                </div>
                                <div className="flex items-center gap-1.5 shrink-0">{clearBtn('sleep')}</div>
                              </div>
                            )}
                            {showProtein && (
                              <div className="flex items-center justify-between gap-2 text-sm text-text-secondary">
                                <div className="flex items-center gap-2 min-w-0">
                                  <UtensilsCrossed className="w-3.5 h-3.5 shrink-0" style={{ color: COLOR_NUTRITION }} />
                                  <span className="font-medium text-text-primary">Protein</span>
                                  <span>
                                    {(e.protein_qty ?? 0) > 0 ? `${e.protein_qty} g` : 'Logged'}
                                    {e.protein_meal === true ? ' · meal' : ''}
                                  </span>
                                </div>
                                <div className="flex items-center gap-1.5 shrink-0">{clearBtn('protein')}</div>
                              </div>
                            )}
                            {showCals && (
                              <div className="flex items-center justify-between gap-2 text-sm text-text-secondary">
                                <div className="flex items-center gap-2 min-w-0">
                                  <Gauge className="w-3.5 h-3.5 shrink-0 text-rose-400" />
                                  <span className="font-medium text-text-primary">Calories</span>
                                  <span>{e.calories_kcal?.toLocaleString()} kcal</span>
                                </div>
                                <div className="flex items-center gap-1.5 shrink-0">{clearBtn('calories')}</div>
                              </div>
                            )}
                            {showJunk && (
                              <div className="flex items-center justify-between gap-2 text-sm text-text-secondary">
                                <div className="flex items-center gap-2 min-w-0">
                                  <span className="font-medium text-text-primary">Junk food</span>
                                  <span>{e.junk_food ? 'Yes' : 'No'}</span>
                                </div>
                                <div className="flex items-center gap-1.5 shrink-0">{clearBtn('junk')}</div>
                              </div>
                            )}
                            {showAlc && (
                              <div className="flex items-center justify-between gap-2 text-sm text-text-secondary">
                                <div className="flex items-center gap-2 min-w-0">
                                  <span className="font-medium text-text-primary">Alcohol</span>
                                  <span>{label(e.alcohol!)}</span>
                                </div>
                                <div className="flex items-center gap-1.5 shrink-0">{clearBtn('alcohol')}</div>
                              </div>
                            )}
                            {showHome && (
                              <div className="flex items-center justify-between gap-2 text-sm text-text-secondary">
                                <div className="flex items-center gap-2 min-w-0">
                                  <span className="font-medium text-text-primary">Home-cooked meals</span>
                                  <span>{e.home_cooked_meals}</span>
                                </div>
                                <div className="flex items-center gap-1.5 shrink-0">{clearBtn('home_cooked')}</div>
                              </div>
                            )}
                            {showStreak && (
                              <div className="flex items-center justify-between text-sm text-text-secondary">
                                <div className="flex items-center gap-2">
                                  <Flame className="w-3.5 h-3.5 text-accent-gold" />
                                  <span className="font-medium text-text-primary">
                                    Logging streak{' '}
                                    {streakLengthByDate.get(e.date)
                                      ? `(${streakLengthByDate.get(e.date)} days)`
                                      : ''}
                                  </span>
                                </div>
                                <span className="text-xs font-semibold text-text-primary whitespace-nowrap">
                                  +{streakBonus} pts
                                </span>
                              </div>
                            )}
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              );
            })}
          </div>
        )}

        {totalWeekCount > visibleWeeks && (
          <button
            type="button"
            onClick={() => setVisibleWeeks((w) => w + 4)}
            className="mt-4 text-xs text-primary-orange underline"
          >
            Load more weeks
          </button>
        )}
      </div>
    </div>
  );
}
