'use client';

import { useState, useEffect, useMemo } from 'react';
import { Activity, Target, Trophy, Dumbbell, Flame, Frown, TrendingUp } from 'lucide-react';
import type { ReactNode } from 'react';
import { apiUrl, getApiFetchOptions } from '@/lib/api';
import { CalendarHistogram } from './CalendarHistogram';
import { getLoggingStreakBonus } from '@/lib/points';
import type { Profile } from '@/lib/types';

type ProjectionResponse = {
  rank: number;
  is_first: boolean;
  days_to_first: number | null;
  expected_daily_points: number;
  message?: string;
};

type WeeklyRankingEntry = {
  rank: number;
  user: { id: string; display_name: string };
  score: { total_points: number };
};

type WeeklyLeaderboard = {
  current_user_id: string | null;
  rankings: WeeklyRankingEntry[];
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
  sleep_hours?: number | null;
  daily_points?: number | null;
  is_goal_crush_day?: boolean | null;
};

type HistoryRange = 'week' | 'month' | 'all';
type WorkoutFilter = 'all' | 'strength' | 'cardio' | 'steps';
type WeekStatus = 'green' | 'yellow' | 'red';

function hasWorkout(e: EntryRow): boolean {
  return e.workout_done === true || e.cardio_done === true || (e.steps != null && Number(e.steps) > 0);
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
  const [loading, setLoading] = useState(true);
  const [projection, setProjection] = useState<ProjectionResponse | null>(null);
  const [weeklyBoard, setWeeklyBoard] = useState<WeeklyLeaderboard | null>(null);
  const [historyRange, setHistoryRange] = useState<HistoryRange>('all');
  const [historyWeekOffset, setHistoryWeekOffset] = useState(0);
  const [historyMonthOffset, setHistoryMonthOffset] = useState(0);
  const [typeFilter, setTypeFilter] = useState<WorkoutFilter>('all');
  const [visibleWeeks, setVisibleWeeks] = useState(8);

  const workoutEntries = useMemo(
    () => [...entries].filter(hasWorkout).sort((a, b) => b.date.localeCompare(a.date)),
    [entries]
  );

  useEffect(() => {
    let cancelled = false;
    const end = new Date();
    const start = new Date();
    start.setDate(start.getDate() - 365);
    const from = start.toISOString().slice(0, 10);
    const to = end.toISOString().slice(0, 10);
    fetch(apiUrl(`/api/entries/history?from=${from}&to=${to}`), getApiFetchOptions())
      .then((r) => r.json())
      .then((data) => {
        const list = Array.isArray(data) ? data : [];
        if (!cancelled) setEntries(list);
      })
      .catch(() => { if (!cancelled) setEntries([]); })
      .finally(() => { if (!cancelled) setLoading(false); });
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
    fetch(apiUrl('/api/leaderboard?view=weekly'), getApiFetchOptions())
      .then((r) => r.json())
      .then((data) => { if (!cancelled) setWeeklyBoard(data); })
      .catch(() => { if (!cancelled) setWeeklyBoard(null); });
    return () => { cancelled = true; };
  }, [refreshTrigger]);

  const { streakBonusByDate, streakHighlightDates, streakLengthByDate } = useMemo(() => {
    const bonuses = new Map<string, number>();
    const highlight = new Set<string>();
    const lengths = new Map<string, number>();
    if (!workoutEntries.length) return { streakBonusByDate: bonuses, streakHighlightDates: highlight, streakLengthByDate: lengths };

    const uniqueDates = Array.from(new Set(workoutEntries.map((e) => e.date))).sort();
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
  }, [entries]);

  // Reset pagination when filters change
  useEffect(() => {
    setVisibleWeeks(8);
    setHistoryWeekOffset(0);
    setHistoryMonthOffset(0);
  }, [historyRange]);

  useEffect(() => {
    setVisibleWeeks(8);
  }, [typeFilter]);

  // Compute filter bounds from offset-based navigation
  const filterBounds = useMemo(() => {
    if (historyRange === 'all') return null;
    if (historyRange === 'week') return getWeekBounds(historyWeekOffset);
    return getMonthBounds(historyMonthOffset);
  }, [historyRange, historyWeekOffset, historyMonthOffset]);

  const filteredWorkoutEntries = useMemo(() => {
    return workoutEntries.filter((e) => {
      if (filterBounds && (e.date < filterBounds.from || e.date > filterBounds.to)) return false;
      const hasStrength = e.workout_done === true && (e.workout_duration != null || (e.workout_types?.length ?? 0) > 0);
      const hasCardio = e.cardio_done === true && (e.cardio_duration != null || !!e.cardio_type);
      const hasSteps = !hasStrength && !hasCardio && e.steps != null && Number(e.steps) > 0;
      if (typeFilter === 'all') return hasStrength || hasCardio || hasSteps;
      if (typeFilter === 'strength') return hasStrength;
      if (typeFilter === 'cardio') return hasCardio;
      return hasSteps;
    });
  }, [workoutEntries, filterBounds, typeFilter]);

  // 3-tier week goal map (keyed by week-start date)
  const weekGoalMap = useMemo(() => {
    const map = new Map<string, { status: WeekStatus; metric: string | null }>();
    const goalDays = profile.goal_workout_days_week ?? 0;
    const goalMins = profile.goal_workout_mins_week ?? 0;

    const byWeek = new Map<string, EntryRow[]>();
    workoutEntries.forEach((e) => {
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
  }, [workoutEntries, profile]);

  // Group filtered entries by week, respecting visibleWeeks
  const { weekGroups, totalWeekCount } = useMemo(() => {
    const byWeek = new Map<string, EntryRow[]>();
    filteredWorkoutEntries.forEach((e) => {
      const ws = getWeekStart(e.date);
      if (!byWeek.has(ws)) byWeek.set(ws, []);
      byWeek.get(ws)!.push(e);
    });

    const sorted = Array.from(byWeek.entries()).sort((a, b) => b[0].localeCompare(a[0]));
    const totalWeekCount = sorted.length;
    const weekGroups = sorted.slice(0, visibleWeeks).map(([weekStart, entries]) => ({
      weekStart,
      entries,
    }));

    return { weekGroups, totalWeekCount };
  }, [filteredWorkoutEntries, visibleWeeks]);

  // Estimate daily points when hitting goals, based on past goal-crush day entries
  const goalDailyPts = useMemo(() => {
    const goalDays = workoutEntries.filter((e) => e.is_goal_crush_day === true && (e.daily_points ?? 0) > 0);
    if (goalDays.length === 0) {
      // Fall back: rough estimate based on which goals are set
      let est = 0;
      if ((profile.goal_workout_days_week ?? 0) > 0 || (profile.goal_workout_mins_week ?? 0) > 0) est += 20;
      if ((profile.goal_steps_day ?? 0) > 0) est += 15;
      if ((profile.goal_sleep_hours ?? profile.goal_sleep_hours_min ?? 0) > 0) est += 10;
      if ((profile.goal_water_liters ?? 0) > 0) est += 10;
      return est > 0 ? est : 55;
    }
    const avg = goalDays.reduce((s, e) => s + (e.daily_points ?? 0), 0) / goalDays.length;
    return Math.round(avg);
  }, [workoutEntries, profile]);

  // Weekly rank insights from live leaderboard
  const rankInsights = useMemo(() => {
    const dailyPts = projection?.expected_daily_points ?? 0;
    const today = new Date();
    const dow = today.getDay();
    const remainingWeekDays = dow === 0 ? 0 : 7 - dow; // days left after today (Sun=0)

    if (!weeklyBoard?.current_user_id || !weeklyBoard.rankings.length) {
      return { dailyPts, remainingWeekDays, myRank: null, myPts: null, total: 0, above: null, ptsNeeded: null, projectedRank: null, goalProjectedTotal: null, goalProjectedRank: null };
    }

    const userId = weeklyBoard.current_user_id;
    const myEntry = weeklyBoard.rankings.find((r) => r.user.id === userId);
    if (!myEntry) {
      return { dailyPts, remainingWeekDays, myRank: null, myPts: null, total: weeklyBoard.rankings.length, above: null, ptsNeeded: null, projectedRank: null, goalProjectedTotal: null, goalProjectedRank: null };
    }

    const myRank = myEntry.rank;
    const myPts = myEntry.score.total_points;
    const total = weeklyBoard.rankings.length;

    const above = myRank > 1 ? weeklyBoard.rankings.find((r) => r.rank === myRank - 1) : null;
    const ptsNeeded = above ? Math.max(1, above.score.total_points - myPts + 1) : null;

    const projectedTotal = myPts + Math.round(dailyPts * remainingWeekDays);
    const projectedRank =
      weeklyBoard.rankings.filter((r) => r.user.id !== userId && r.score.total_points > projectedTotal)
        .length + 1;

    const goalProjectedTotal = myPts + Math.round(goalDailyPts * remainingWeekDays);
    const goalProjectedRank =
      weeklyBoard.rankings.filter((r) => r.user.id !== userId && r.score.total_points > goalProjectedTotal)
        .length + 1;

    return { dailyPts, remainingWeekDays, myRank, myPts, total, above, ptsNeeded, projectedTotal, projectedRank, goalProjectedTotal, goalProjectedRank };
  }, [weeklyBoard, projection, goalDailyPts]);

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
        <h2 className="text-lg font-semibold text-text-primary mb-1">Workout history</h2>
        <p className="text-sm text-text-secondary">
          Calendar shows <strong>Workout</strong>, <strong>Food</strong>, and <strong>Sleep</strong> — the three pillars. Use <strong>New Entry</strong> in the header to log.
        </p>
      </div>

      {/* Goal pills — shown above the histogram card (matches DB: goal_sleep_hours or goal_sleep_hours_min/max) */}
      {((profile.goal_workout_days_week ?? 0) > 0 ||
        (profile.goal_workout_mins_week ?? 0) > 0 ||
        (profile.goal_steps_day ?? 0) > 0 ||
        (profile.goal_sleep_hours ?? profile.goal_sleep_hours_min ?? 0) > 0 ||
        (profile.goal_water_liters ?? 0) > 0) && (
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
          {(profile.goal_steps_day ?? 0) > 0 && (
            <span className="rounded-full bg-emerald-500/15 text-emerald-400 px-2.5 py-1 text-xs font-semibold">
              👟 {((profile.goal_steps_day ?? 0) / 1000).toFixed(0)}k steps/day
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
        </div>
        </div>
      )}

      <div className="glass-card p-5">
        <CalendarHistogram refreshTrigger={refreshTrigger} goals={profile} />
      </div>

      {/* Rank Trajectory */}
      <div className="glass-card p-5">
        <h3 className="font-medium text-text-primary flex items-center gap-2 mb-4">
          <TrendingUp className="w-4 h-4 text-accent-blue" />
          Rank trajectory
        </h3>

        {(projection || rankInsights.myRank != null) ? (
          <div className="space-y-3 text-sm">
            {/* This week block */}
            <div className="rounded-lg bg-surface-2/50 p-3 space-y-2">
              <div className="text-[10px] font-semibold text-text-muted uppercase tracking-wide mb-1">This week</div>

              {/* Weekly rank */}
              {rankInsights.myRank != null && (
                <div className="flex items-center justify-between">
                  <span className="text-text-secondary">Your rank this week</span>
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
                  <span>You&apos;re leading this week! Keep it up.</span>
                </div>
              )}

              {/* Projected rank at current pace */}
              {rankInsights.dailyPts > 0 && rankInsights.remainingWeekDays > 0 && rankInsights.projectedRank != null && (
                <div className="flex items-start gap-2 text-xs text-text-secondary">
                  <TrendingUp className="w-3.5 h-3.5 text-text-muted shrink-0 mt-0.5" />
                  <span>
                    If you keep scoring at your current pace (~<span className="font-bold text-text-primary">{rankInsights.dailyPts} pts/day</span> for the remaining{' '}
                    <span className="font-bold text-text-primary">{rankInsights.remainingWeekDays} day{rankInsights.remainingWeekDays !== 1 ? 's' : ''}</span>), you&apos;ll finish the week at{' '}
                    <span className="font-bold text-text-primary">rank #{rankInsights.projectedRank}</span> with{' '}
                    <span className="font-bold text-text-primary">{rankInsights.projectedTotal} pts</span>.
                  </span>
                </div>
              )}

              {/* Projected rank if goals are met */}
              {rankInsights.remainingWeekDays > 0 && rankInsights.goalProjectedRank != null && (
                <div className="flex items-start gap-2 text-xs text-text-secondary">
                  <Trophy className="w-3.5 h-3.5 text-text-muted shrink-0 mt-0.5" />
                  <span>
                    If you hit your daily goals for every remaining day this week, you&apos;ll finish at{' '}
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

      {/* Workout days */}
      <div className="glass-card p-5">
        <h3 className="font-medium text-text-primary flex items-center gap-2 mb-4">
          <Activity className="w-4 h-4 text-[#FF6B35]" />
          Workout days
        </h3>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-3 mb-4">
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

          {/* Type filter */}
          <div className="inline-flex rounded-full border border-white/10 overflow-hidden text-xs ml-auto">
            {(['all', 'strength', 'cardio', 'steps'] as WorkoutFilter[]).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setTypeFilter(t)}
                className={`px-2.5 py-1 ${
                  typeFilter === t ? 'bg-surface-2 text-text-primary' : 'bg-surface-0 text-text-muted'
                }`}
              >
                {t === 'all' ? 'All types' : t[0].toUpperCase() + t.slice(1)}
              </button>
            ))}
          </div>
        </div>

        {/* Week-grouped entries */}
        {loading ? (
          <div className="animate-pulse text-text-muted text-sm">Loading…</div>
        ) : filteredWorkoutEntries.length === 0 ? (
          <p className="text-sm text-text-muted">No workout or cardio logged in this period.</p>
        ) : (
          <div className="space-y-6">
            {weekGroups.map(({ weekStart, entries: weekEntries }) => {
              const wkEntry = weekGoalMap.get(weekStart);
              const meta = wkEntry ? weekStatusMeta[wkEntry.status] : null;
              const wkMetric = wkEntry?.metric ?? null;

              return (
                <div key={weekStart}>
                  {/* Week header */}
                  <div className="flex items-center justify-between mb-2 pb-2 border-b border-white/10">
                    <span className="text-xs font-semibold text-text-muted uppercase tracking-wide">
                      {formatWeekRange(weekStart)}
                    </span>
                    {hasWeeklyGoal && meta && (
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

                  {/* Daily entries */}
                  <ul className="divide-y divide-white/10">
                    {weekEntries.map((e) => {
                      const hasStrength = e.workout_done === true && (e.workout_duration != null || (e.workout_types?.length ?? 0) > 0);
                      const hasCardio = e.cardio_done === true && (e.cardio_duration != null || !!e.cardio_type);
                      const hasSteps = !hasStrength && !hasCardio && e.steps != null && Number(e.steps) > 0;
                      const streakBonus = streakBonusByDate.get(e.date) ?? 0;
                      const isStreakDay = streakHighlightDates.has(e.date);
                      const goalHit = isGoalCrushEntry(e);
                      const showStrength = hasStrength && (typeFilter === 'all' || typeFilter === 'strength');
                      const showCardio = hasCardio && (typeFilter === 'all' || typeFilter === 'cardio');
                      const showSteps = hasSteps && (typeFilter === 'all' || typeFilter === 'steps');
                      if (!showStrength && !showCardio && !showSteps && streakBonus <= 0) return null;

                      const strengthPts = showStrength ? getWorkoutPoints(e, profile.age_bracket) : 0;
                      const cardioPts = showCardio ? getCardioPoints(e, profile.age_bracket) : 0;
                      const stepsPts = showSteps ? getStepsPoints(e, profile.age_bracket) : 0;
                      const movementPts = strengthPts + cardioPts + stepsPts;
                      const totalDayPoints =
                        (e.daily_points ?? null) != null ? e.daily_points! : movementPts + streakBonus;

                      return (
                        <li
                          key={e.date}
                          className={`relative py-2 pl-3 ${
                            isStreakDay
                              ? 'before:absolute before:left-0 before:top-0 before:bottom-0 before:w-[3px] before:rounded-r before:bg-accent-gold/80'
                              : ''
                          }`}
                        >
                          <div className="flex items-center justify-between mb-1 gap-3">
                            <span className="text-text-primary font-medium flex items-center gap-1.5">
                              {isStreakDay && (
                                <Flame className="w-3 h-3 text-accent-gold flex-shrink-0" />
                              )}
                              {new Date(e.date + 'Z').toLocaleDateString(undefined, {
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
                              <div className="flex items-center justify-between text-sm text-text-secondary">
                                <div className="flex items-center gap-2">
                                  <Dumbbell className="w-3.5 h-3.5" style={{ color: COLOR_WORKOUT }} />
                                  <span className="font-medium text-text-primary">Strength</span>
                                  <span className="truncate">
                                    {e.workout_duration ? `${e.workout_duration} min` : ''}
                                    {e.workout_types?.length ? ` · ${e.workout_types.map(label).join(', ')}` : ''}
                                  </span>
                                </div>
                                {strengthPts > 0 && (
                                  <span className="text-xs font-semibold text-text-primary whitespace-nowrap">
                                    +{strengthPts} pts
                                  </span>
                                )}
                              </div>
                            )}
                            {showCardio && (
                              <div className="flex items-center justify-between text-sm text-text-secondary">
                                <div className="flex items-center gap-2">
                                  <Activity className="w-3.5 h-3.5" style={{ color: COLOR_CARDIO }} />
                                  <span className="font-medium text-text-primary">Cardio</span>
                                  <span className="truncate">
                                    {e.cardio_duration ? `${e.cardio_duration} min` : ''}
                                    {e.cardio_type ? ` · ${label(e.cardio_type)}` : ''}
                                  </span>
                                </div>
                                {cardioPts > 0 && (
                                  <span className="text-xs font-semibold text-text-primary whitespace-nowrap">
                                    +{cardioPts} pts
                                  </span>
                                )}
                              </div>
                            )}
                            {showSteps && (
                              <div className="flex items-center justify-between text-sm text-text-secondary">
                                <div className="flex items-center gap-2">
                                  <Activity className="w-3.5 h-3.5" style={{ color: COLOR_STEPS }} />
                                  <span className="font-medium text-text-primary">Steps</span>
                                  <span>{e.steps?.toLocaleString()} steps</span>
                                </div>
                                {stepsPts > 0 && (
                                  <span className="text-xs font-semibold text-text-primary whitespace-nowrap">
                                    +{stepsPts} pts
                                  </span>
                                )}
                              </div>
                            )}
                            {streakBonus > 0 && (
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
