'use client';

import { useState, useEffect, useMemo } from 'react';
import { Activity, Target, Trophy, Dumbbell, Flame, Frown } from 'lucide-react';
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

type HistoryRange = 'day' | 'week' | 'month' | 'all';
type WorkoutFilter = 'all' | 'strength' | 'cardio' | 'steps';

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

function getThisWeekRange(): { from: string; to: string } {
  const to = new Date();
  const from = new Date();
  from.setDate(to.getDate() - 6);
  return { from: from.toISOString().slice(0, 10), to: to.toISOString().slice(0, 10) };
}

function getThisMonthRange(): { from: string; to: string } {
  const to = new Date();
  const from = new Date(to.getFullYear(), to.getMonth(), 1);
  return { from: from.toISOString().slice(0, 10), to: to.toISOString().slice(0, 10) };
}

function addDays(dateStr: string, delta: number): string {
  const d = new Date(dateStr + 'T12:00:00');
  d.setDate(d.getDate() + delta);
  return d.toISOString().slice(0, 10);
}

function getHistoryBounds(range: HistoryRange, anchor: string): { from: string; to: string } | null {
  if (range === 'all') return null;
  const base = anchor || new Date().toISOString().slice(0, 10);
  const d = new Date(base + 'T12:00:00');
  if (range === 'day') {
    const s = d.toISOString().slice(0, 10);
    return { from: s, to: s };
  }
  if (range === 'week') {
    const end = new Date(d);
    const start = new Date(d);
    start.setDate(end.getDate() - 6);
    return { from: start.toISOString().slice(0, 10), to: end.toISOString().slice(0, 10) };
  }
  // month
  const start = new Date(d.getFullYear(), d.getMonth(), 1);
  const end = new Date(d.getFullYear(), d.getMonth() + 1, 0);
  return { from: start.toISOString().slice(0, 10), to: end.toISOString().slice(0, 10) };
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
  const [historyRange, setHistoryRange] = useState<HistoryRange>('all');
  const [historyDate, setHistoryDate] = useState<string>(new Date().toISOString().slice(0, 10));
  const [typeFilter, setTypeFilter] = useState<WorkoutFilter>('all');
  const [visibleCount, setVisibleCount] = useState(30);

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

  const { week: weekRange, month: monthRange } = useMemo(() => ({
    week: getThisWeekRange(),
    month: getThisMonthRange(),
  }), []);
  const { streakBonusByDate, streakHighlightDates, streakLengthByDate } = useMemo(() => {
    // Compute streak highlights and incremental bonuses per date using workout days only.
    // Highlight any consecutive run of 7+ workout days as a continuous band; bonuses still land on milestone days.
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
        // New run starts; flush previous
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

  useEffect(() => {
    setVisibleCount(30);
  }, [historyRange, historyDate, typeFilter]);

  const filteredWorkoutEntries = useMemo(() => {
    const bounds = getHistoryBounds(historyRange, historyDate);
    return workoutEntries.filter((e) => {
      if (bounds && (e.date < bounds.from || e.date > bounds.to)) return false;
      const hasStrength = e.workout_done === true && (e.workout_duration != null || (e.workout_types?.length ?? 0) > 0);
      const hasCardio = e.cardio_done === true && (e.cardio_duration != null || !!e.cardio_type);
      const hasSteps = !hasStrength && !hasCardio && e.steps != null && Number(e.steps) > 0;
      if (typeFilter === 'all') return hasStrength || hasCardio || hasSteps;
      if (typeFilter === 'strength') return hasStrength;
      if (typeFilter === 'cardio') return hasCardio;
      return hasSteps;
    });
  }, [workoutEntries, historyRange, historyDate, typeFilter]);

  const goalProgress = useMemo(() => {
    const weekEntries = entries.filter((e) => e.date >= weekRange.from && e.date <= weekRange.to);
    const monthEntries = entries.filter((e) => e.date >= monthRange.from && e.date <= monthRange.to);
    const goalWkMins = profile.goal_workout_mins_week ?? 0;
    const goalWkDays = profile.goal_workout_days_week ?? 0;
    const dailyMinsTarget = goalWkMins > 0 ? goalWkMins / 7 : 0;
    const goalSteps = profile.goal_steps_day ?? 0;
    const goalSleep = profile.goal_sleep_hours ?? profile.goal_sleep_hours_min ?? null;

    const workoutMetWeek = goalWkDays > 0
      ? weekEntries.filter((e) => e.workout_done === true || e.cardio_done === true).length
      : goalWkMins > 0
        ? weekEntries.filter((e) => workoutMins(e) >= dailyMinsTarget).length
        : 0;
    const workoutMetMonth = goalWkDays > 0
      ? monthEntries.filter((e) => e.workout_done === true || e.cardio_done === true).length
      : goalWkMins > 0
        ? monthEntries.filter((e) => workoutMins(e) >= dailyMinsTarget).length
        : 0;
    const stepsMetWeek = goalSteps > 0 ? weekEntries.filter((e) => (e.steps ?? 0) >= goalSteps).length : 0;
    const stepsMetMonth = goalSteps > 0 ? monthEntries.filter((e) => (e.steps ?? 0) >= goalSteps).length : 0;
    const sleepMetWeek = goalSleep != null
      ? weekEntries.filter((e) => e.sleep_hours != null && Math.abs(e.sleep_hours - goalSleep) <= 0.5).length
      : 0;
    const sleepMetMonth = goalSleep != null
      ? monthEntries.filter((e) => e.sleep_hours != null && Math.abs(e.sleep_hours - goalSleep) <= 0.5).length
      : 0;

    const weekDays = 7;
    const monthDays = Math.ceil((new Date(monthRange.to).getTime() - new Date(monthRange.from).getTime()) / (24 * 60 * 60 * 1000)) + 1;

    return {
      workout: { week: { met: workoutMetWeek, total: weekDays }, month: { met: workoutMetMonth, total: monthDays }, hasGoal: goalWkMins > 0 || goalWkDays > 0 },
      steps: { week: { met: stepsMetWeek, total: weekDays }, month: { met: stepsMetMonth, total: monthDays }, hasGoal: goalSteps > 0 },
      sleep: { week: { met: sleepMetWeek, total: weekDays }, month: { met: sleepMetMonth, total: monthDays }, hasGoal: goalSleep != null },
    };
  }, [entries, profile, weekRange, monthRange]);

  return (
    <div className="space-y-8 animate-fade-up">
      <div>
        <h2 className="text-lg font-semibold text-text-primary mb-1">Workout history</h2>
        <p className="text-sm text-text-secondary">
          Calendar shows <strong>Workout</strong>, <strong>Food</strong>, and <strong>Sleep</strong> — the three pillars. Use <strong>New Entry</strong> in the header to log.
        </p>
      </div>

      <div className="glass-card p-5">
        <CalendarHistogram refreshTrigger={refreshTrigger} goals={profile} />
      </div>

      {(goalProgress.workout.hasGoal || goalProgress.steps.hasGoal || goalProgress.sleep.hasGoal) && (
        <div className="glass-card p-5">
          <h3 className="font-medium text-text-primary flex items-center gap-2 mb-4">
            <Target className="w-4 h-4 text-accent-blue" />
            Goal progress
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm">
            {goalProgress.workout.hasGoal && (
              <div>
                <div className="text-text-muted font-medium mb-1">Workout</div>
                <p
                  className={
                    goalProgress.workout.week.met >= goalProgress.workout.week.total / 2
                      ? 'text-emerald-500'
                      : 'text-rose-500'
                  }
                >
                  This week: goal met on <strong>{goalProgress.workout.week.met}</strong> of{' '}
                  {goalProgress.workout.week.total} days
                </p>
                <p className="text-text-secondary text-xs mt-0.5">
                  This month: goal met on <strong>{goalProgress.workout.month.met}</strong> of{' '}
                  {goalProgress.workout.month.total} days
                </p>
              </div>
            )}
            {goalProgress.steps.hasGoal && (
              <div>
                <div className="text-text-muted font-medium mb-1">Steps</div>
                <p
                  className={
                    goalProgress.steps.week.met >= goalProgress.steps.week.total / 2
                      ? 'text-emerald-500'
                      : 'text-rose-500'
                  }
                >
                  This week: goal met on <strong>{goalProgress.steps.week.met}</strong> of{' '}
                  {goalProgress.steps.week.total} days
                </p>
                <p className="text-text-secondary text-xs mt-0.5">
                  This month: goal met on <strong>{goalProgress.steps.month.met}</strong> of{' '}
                  {goalProgress.steps.month.total} days
                </p>
              </div>
            )}
            {goalProgress.sleep.hasGoal && (
              <div>
                <div className="text-text-muted font-medium mb-1">Sleep</div>
                <p
                  className={
                    goalProgress.sleep.week.met >= goalProgress.sleep.week.total / 2
                      ? 'text-emerald-500'
                      : 'text-rose-500'
                  }
                >
                  This week: goal met on <strong>{goalProgress.sleep.week.met}</strong> of{' '}
                  {goalProgress.sleep.week.total} days
                </p>
                <p className="text-text-secondary text-xs mt-0.5">
                  This month: goal met on <strong>{goalProgress.sleep.month.met}</strong> of{' '}
                  {goalProgress.sleep.month.total} days
                </p>
              </div>
            )}
          </div>
          {projection && (
            <div className="mt-4 pt-4 border-t border-white/10 flex items-center gap-2 text-sm">
              <Trophy className="w-4 h-4 text-accent-gold shrink-0" />
              {projection.is_first ? (
                <span className="text-text-primary">You&apos;re #1 on the all-time leaderboard. Keep it up!</span>
              ) : projection.days_to_first != null && projection.days_to_first > 0 ? (
                <span className="text-text-primary">
                  If you keep hitting your goal (~{projection.expected_daily_points} pts/day), about <strong>{projection.days_to_first}</strong> days to reach #1. You&apos;re currently #{projection.rank}.
                </span>
              ) : (
                <span className="text-text-primary">
                  Keep hitting your goals — you&apos;re gaining. Currently #{projection.rank} on the all-time leaderboard.
                </span>
              )}
            </div>
          )}
        </div>
      )}

      {projection && !(goalProgress.workout.hasGoal || goalProgress.steps.hasGoal || goalProgress.sleep.hasGoal) && (
        <div className="glass-card p-5">
          <h3 className="font-medium text-text-primary flex items-center gap-2 mb-2">
            <Trophy className="w-4 h-4 text-accent-gold" />
            Leaderboard
          </h3>
          <p className="text-sm text-text-secondary">
            {projection.is_first ? (
              <>You&apos;re #1 on the all-time leaderboard. Keep it up!</>
            ) : projection.days_to_first != null && projection.days_to_first > 0 ? (
              <>If you keep hitting your goal (~{projection.expected_daily_points} pts/day), about <strong>{projection.days_to_first}</strong> days to reach #1. You&apos;re currently #{projection.rank}.</>
            ) : (
              <>Keep hitting your goals — you&apos;re gaining. Currently #{projection.rank} on the all-time leaderboard.</>
            )}
          </p>
        </div>
      )}

      <div className="glass-card p-5">
        <h3 className="font-medium text-text-primary flex items-center gap-2 mb-4">
          <Activity className="w-4 h-4 text-[#FF6B35]" />
          Workout days
        </h3>
        <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
          <div className="inline-flex rounded-full border border-white/10 overflow-hidden text-xs">
            {(['all', 'day', 'week', 'month'] as HistoryRange[]).map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => setHistoryRange(r)}
                className={`px-2.5 py-1 ${historyRange === r ? 'bg-primary-orange text-white' : 'bg-surface-0 text-text-muted'}`}
              >
                {r === 'all' ? 'All' : r === 'day' ? 'Day' : r === 'week' ? 'Week' : 'Month'}
              </button>
            ))}
          </div>
          {historyRange !== 'all' && (
            <input
              type="date"
              value={historyDate}
              onChange={(e) => setHistoryDate(e.target.value)}
              className="input-field max-w-[150px] text-xs"
            />
          )}
          <div className="inline-flex rounded-full border border-white/10 overflow-hidden text-xs">
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
        {loading ? (
          <div className="animate-pulse text-text-muted text-sm">Loading…</div>
        ) : filteredWorkoutEntries.length === 0 ? (
          <p className="text-sm text-text-muted">No workout or cardio logged in the last 60 days.</p>
        ) : (
          <ul className="divide-y divide-white/10">
            {filteredWorkoutEntries.slice(0, visibleCount).map((e) => {
              const hasStrength = e.workout_done === true && (e.workout_duration != null || (e.workout_types?.length ?? 0) > 0);
              const hasCardio = e.cardio_done === true && (e.cardio_duration != null || !!e.cardio_type);
              const hasSteps = !hasStrength && !hasCardio && e.steps != null && Number(e.steps) > 0;
              const streakBonus = streakBonusByDate.get(e.date) ?? 0;
              const isStreakDay = streakHighlightDates.has(e.date);
              const goalHit = isGoalCrushEntry(e);
              const showStrength = hasStrength && (typeFilter === 'all' || typeFilter === 'strength');
              const showCardio = hasCardio && (typeFilter === 'all' || typeFilter === 'cardio');
              const showSteps = hasSteps && (typeFilter === 'all' || typeFilter === 'steps');
              if (!showStrength && !showCardio && !showSteps && streakBonus <= 0) {
                return null;
              }
              const strengthPts = showStrength ? getWorkoutPoints(e, profile.age_bracket) : 0;
              const cardioPts = showCardio ? getCardioPoints(e, profile.age_bracket) : 0;
              const stepsPts = showSteps ? getStepsPoints(e, profile.age_bracket) : 0;
              const movementPts = strengthPts + cardioPts + stepsPts;
              const totalDayPoints = (e.daily_points ?? null) != null ? e.daily_points! : movementPts + streakBonus;
              return (
                <li
                  key={e.date}
                  className={`relative py-2 pl-2 ${
                    isStreakDay
                      ? 'before:absolute before:left-0 before:top-0 before:bottom-0 before:w-0.5 before:bg-accent-gold/80'
                      : ''
                  }`}
                >
                  <div className="flex items-center justify-between mb-1 gap-3">
                    <span className="text-text-primary font-medium">
                      {new Date(e.date + 'Z').toLocaleDateString(undefined, {
                        weekday: 'short',
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
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
                          <span className="text-xs font-semibold text-text-primary whitespace-nowrap">+{strengthPts} pts</span>
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
                          <span className="text-xs font-semibold text-text-primary whitespace-nowrap">+{cardioPts} pts</span>
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
                          <span className="text-xs font-semibold text-text-primary whitespace-nowrap">+{stepsPts} pts</span>
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
        )}
        {filteredWorkoutEntries.length > visibleCount && (
          <button
            type="button"
            onClick={() => setVisibleCount((c) => c + 30)}
            className="mt-3 text-xs text-primary-orange underline"
          >
            Load more days
          </button>
        )}
      </div>
    </div>
  );
}
