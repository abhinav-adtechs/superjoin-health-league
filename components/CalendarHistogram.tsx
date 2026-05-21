'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { apiUrl, getApiFetchOptions } from '@/lib/api';
import type { WorkoutGoalType } from '@/lib/types';
import { parseGoalWorkoutTypes } from '@/lib/workout-goals';
import { CalendarHistogramSkeleton } from '@/components/LoadingScreen';

export type EntryRow = {
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
  sleep_hours?: number | null;
  sleep_quality?: number | null;
  protein_meal?: boolean | null;
  protein_qty?: number | null;
  calories_kcal?: number | null;
  daily_points?: number | null;
  is_goal_crush_day?: boolean | null;
};

export type ProfileGoals = {
  goal_workout_mins_week?: number | null;
  goal_workout_days_week?: number | null;
  goal_workout_types?: WorkoutGoalType[] | null;
  goal_steps_day?: number | null;
  goal_sleep_hours?: number | null;
  goal_sleep_hours_min?: number | null;
  goal_sleep_hours_max?: number | null;
  goal_water_liters?: number | null;
  goal_home_cooked_per_week?: number | null;
  goal_protein_g_day?: number | null;
  goal_calories_day?: number | null;
  fitness_goal?: string | null;
};

function workoutMins(e: EntryRow): number {
  const w = (e.workout_done && e.workout_duration) ? e.workout_duration : 0;
  const c = (e.cardio_done && e.cardio_duration) ? e.cardio_duration : 0;
  return w + c;
}

function fmtMins(mins: number): string {
  if (mins === 0) return '—';
  if (mins < 60) return `${mins}m`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

// Returns true = goal met (green), false = goal missed (red), null = no goals set
function dayGoalStatus(e: EntryRow, goals: ProfileGoals | null): boolean | null {
  if (e.is_goal_crush_day != null) return e.is_goal_crush_day;
  if (e.daily_points != null && e.daily_points >= 60) return true;
  if (e.daily_points != null && e.daily_points > 0) return false;

  const workoutGoal = (goals?.goal_workout_days_week ?? 0) > 0 || (goals?.goal_workout_mins_week ?? 0) > 0;
  const stepsGoal = (goals?.goal_steps_day ?? 0) > 0;
  const sleepGoal = (goals?.goal_sleep_hours ?? goals?.goal_sleep_hours_min ?? 0) > 0;
  const waterGoal = (goals?.goal_water_liters ?? 0) > 0;

  if (!workoutGoal && !stepsGoal && !sleepGoal && !waterGoal) return null;

  const workoutMet = !workoutGoal || (e.workout_done === true || e.cardio_done === true);
  const stepsMet = !stepsGoal || ((e.steps ?? 0) >= (goals?.goal_steps_day ?? 0));
  const sleepMet = !sleepGoal || (e.sleep_hours != null && (
    goals?.goal_sleep_hours != null
      ? e.sleep_hours >= goals.goal_sleep_hours
      : e.sleep_hours >= (goals?.goal_sleep_hours_min ?? 0) &&
        (goals?.goal_sleep_hours_max == null || e.sleep_hours <= goals.goal_sleep_hours_max)
  ));
  const waterMet = !waterGoal || ((e.water_liters ?? 0) >= (goals?.goal_water_liters ?? 0));

  return workoutMet && stepsMet && sleepMet && waterMet;
}

// 3-tier week status: green = fully met, yellow = partial, red = missed
type WeekStatus = 'green' | 'yellow' | 'red' | null;

function computeWeekStatus(
  weekDates: string[],
  entriesByDate: Map<string, EntryRow>,
  goals: ProfileGoals | null,
  todayStr: string
): WeekStatus {
  const pastDates = weekDates.filter((d) => d <= todayStr);
  if (pastDates.length === 0) return null;

  const goalDays = goals?.goal_workout_days_week ?? 0;
  const goalMins = goals?.goal_workout_mins_week ?? 0;

  const workoutCount = pastDates.filter((d) => {
    const e = entriesByDate.get(d);
    return e && (e.workout_done === true || e.cardio_done === true);
  }).length;

  if (goalDays > 0) {
    const scaledGoal = Math.max(1, Math.ceil((goalDays * pastDates.length) / 7));
    if (workoutCount >= scaledGoal) return 'green';
    if (workoutCount > 0) return 'yellow';
    return 'red';
  }

  if (goalMins > 0) {
    const totalMins = pastDates.reduce((s, d) => {
      const e = entriesByDate.get(d);
      return s + (e ? workoutMins(e) : 0);
    }, 0);
    const scaledGoal = Math.max(1, Math.ceil((goalMins * pastDates.length) / 7));
    if (totalMins >= scaledGoal) return 'green';
    if (totalMins > 0) return 'yellow';
    return 'red';
  }

  // No explicit goal — use workout presence + day-level status
  if (workoutCount === 0) return null; // nothing logged at all
  const greenCount = pastDates.filter((d) => {
    const e = entriesByDate.get(d);
    return e && dayGoalStatus(e, goals) === true;
  }).length;
  if (greenCount >= pastDates.length * 0.7) return 'green';
  if (greenCount > 0 || workoutCount > 0) return 'yellow';
  return 'red';
}

type CategoryKey = 'workout' | 'steps' | 'sleep' | 'water' | 'protein' | 'calories';

export type WeekViewColumn =
  | { kind: 'workout_agg' }
  | { kind: 'steps' }
  | { kind: 'sleep' }
  | { kind: 'water' }
  | { kind: 'protein' }
  | { kind: 'calories' };

/** One Workout column for any movement goal — goal_workout_types are focus tags, not separate daily columns. */
export function buildWeekViewColumns(goals: ProfileGoals | null): WeekViewColumn[] {
  const g = goals ?? {};
  const hasWorkoutGoal = (g.goal_workout_days_week ?? 0) > 0 || (g.goal_workout_mins_week ?? 0) > 0;
  const types = parseGoalWorkoutTypes(g.goal_workout_types);
  const cols: WeekViewColumn[] = [];
  if (hasWorkoutGoal || types.length > 0) {
    cols.push({ kind: 'workout_agg' });
  }
  if ((g.goal_steps_day ?? 0) > 0) cols.push({ kind: 'steps' });
  if ((g.goal_sleep_hours ?? g.goal_sleep_hours_min ?? 0) > 0) cols.push({ kind: 'sleep' });
  if ((g.goal_water_liters ?? 0) > 0) cols.push({ kind: 'water' });
  if ((g.goal_protein_g_day ?? 0) > 0) cols.push({ kind: 'protein' });
  if ((g.goal_calories_day ?? 0) > 0) cols.push({ kind: 'calories' });
  return cols;
}

export function weekColumnStatus(
  e: EntryRow | undefined,
  col: WeekViewColumn,
  goals: ProfileGoals | null,
  isPastNoEntry: boolean,
  isPast: boolean
): { met: boolean | null; value: string } {
  if (col.kind === 'workout_agg') return categoryStatus(e, 'workout', goals, isPastNoEntry, isPast);
  if (col.kind === 'steps') return categoryStatus(e, 'steps', goals, isPastNoEntry, isPast);
  if (col.kind === 'sleep') return categoryStatus(e, 'sleep', goals, isPastNoEntry, isPast);
  if (col.kind === 'protein') return categoryStatus(e, 'protein', goals, isPastNoEntry, isPast);
  if (col.kind === 'calories') return categoryStatus(e, 'calories', goals, isPastNoEntry, isPast);
  return categoryStatus(e, 'water', goals, isPastNoEntry, isPast);
}

function categoryStatus(
  e: EntryRow | undefined,
  category: CategoryKey,
  goals: ProfileGoals | null,
  isPastNoEntry = false,
  isPast = false
): { met: boolean | null; value: string } {
  if (!e) return { met: isPastNoEntry ? false : null, value: '—' };

  // Not logged = goal missed for past days
  const notLoggedAsMissed = isPastNoEntry || isPast;

  switch (category) {
    case 'workout': {
      const mins = workoutMins(e);
      const done = e.workout_done === true || e.cardio_done === true;
      if (!done) return { met: false, value: '—' };
      return { met: true, value: mins > 0 ? fmtMins(mins) : '✓' };
    }
    case 'steps': {
      const steps = e.steps ?? 0;
      if (steps === 0) return { met: notLoggedAsMissed ? false : null, value: '—' };
      const goal = goals?.goal_steps_day ?? 0;
      const met = goal > 0 ? steps >= goal : true;
      return { met, value: `${(steps / 1000).toFixed(1)}k` };
    }
    case 'sleep': {
      const sleep = e.sleep_hours ?? 0;
      if (sleep === 0) return { met: notLoggedAsMissed ? false : null, value: '—' };
      const single = goals?.goal_sleep_hours;
      const min = goals?.goal_sleep_hours_min;
      const max = goals?.goal_sleep_hours_max;
      let met: boolean | null = null;
      if (single != null) {
        met = sleep >= single;
      } else if (min != null && max != null) {
        met = sleep >= min && sleep <= max;
      } else if (min != null) {
        met = sleep >= min;
      } else {
        met = true;
      }
      return { met, value: `${sleep}h` };
    }
    case 'water': {
      const water = e.water_liters ?? 0;
      if (water === 0) return { met: notLoggedAsMissed ? false : null, value: '—' };
      const goal = goals?.goal_water_liters ?? 0;
      const met = goal > 0 ? water >= goal : true;
      return { met, value: `${water}L` };
    }
    case 'protein': {
      const qty = e.protein_qty ?? 0;
      const hasMeal = e.protein_meal === true;
      if (qty === 0 && !hasMeal) return { met: notLoggedAsMissed ? false : null, value: '—' };
      const goal = goals?.goal_protein_g_day ?? 0;
      const met = goal > 0 ? qty >= goal : true;
      return { met, value: qty > 0 ? `${qty}g` : '✓' };
    }
    case 'calories': {
      const cal = e.calories_kcal ?? 0;
      if (cal === 0) return { met: notLoggedAsMissed ? false : null, value: '—' };
      const goal = goals?.goal_calories_day ?? 0;
      let met: boolean | null = null;
      if (goal > 0) {
        const isLoseWeight = goals?.fitness_goal === 'lose_weight';
        met = isLoseWeight ? cal <= goal : cal >= goal;
      } else {
        met = true;
      }
      return { met, value: cal >= 1000 ? `${(cal / 1000).toFixed(1)}k` : `${cal}` };
    }
  }
}

type RangeId = 'W' | 'M' | '6M';

const RANGES: { id: RangeId; label: string }[] = [
  { id: 'W', label: 'W' },
  { id: 'M', label: 'M' },
  { id: '6M', label: '6M' },
];

const COLOR_WORKOUT = '#FF6B35';
const COLOR_STEPS = '#059669';
const COLOR_SLEEP = '#2563eb';

function getMondayOfWeek(date: Date): Date {
  const d = new Date(date);
  const dow = d.getDay();
  const diff = dow === 0 ? -6 : 1 - dow;
  d.setDate(d.getDate() + diff);
  return d;
}

function getFromTo(range: RangeId, weekOffset: number, monthOffset: number): { from: string; to: string } {
  const today = new Date();
  if (range === 'W') {
    const monday = getMondayOfWeek(today);
    monday.setDate(monday.getDate() + weekOffset * 7);
    const sunday = new Date(monday);
    sunday.setDate(sunday.getDate() + 6);
    return { from: monday.toISOString().slice(0, 10), to: sunday.toISOString().slice(0, 10) };
  }
  if (range === 'M') {
    const from = new Date(today.getFullYear(), today.getMonth() + monthOffset, 1);
    const to = new Date(today.getFullYear(), today.getMonth() + monthOffset + 1, 0);
    return { from: from.toISOString().slice(0, 10), to: to.toISOString().slice(0, 10) };
  }
  // 6M — start from Monday of the week containing 5 months ago's first day
  const sixAgo = new Date(today.getFullYear(), today.getMonth() - 5, 1);
  const alignedStart = getMondayOfWeek(sixAgo);
  return { from: alignedStart.toISOString().slice(0, 10), to: today.toISOString().slice(0, 10) };
}

function formatWeekLabel(from: string, to: string): string {
  const f = new Date(from + 'T12:00:00');
  const t = new Date(to + 'T12:00:00');
  const opts: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' };
  return `${f.toLocaleDateString(undefined, opts)} – ${t.toLocaleDateString(undefined, opts)}`;
}

export function CalendarHistogram({
  refreshTrigger = 0,
  goals = null,
}: {
  refreshTrigger?: number;
  goals?: ProfileGoals | null;
}) {
  const [range, setRange] = useState<RangeId>('M');
  const [weekOffset, setWeekOffset] = useState(0);
  const [monthOffset, setMonthOffset] = useState(0);
  const [entries, setEntries] = useState<EntryRow[]>([]);
  const [loading, setLoading] = useState(true);

  const { from, to } = useMemo(
    () => getFromTo(range, weekOffset, monthOffset),
    [range, weekOffset, monthOffset]
  );

  function handleRangeChange(r: RangeId) {
    setRange(r);
    setWeekOffset(0);
    setMonthOffset(0);
  }

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetch(apiUrl(`/api/entries/history?from=${from}&to=${to}`), getApiFetchOptions())
      .then((r) => r.json())
      .then((data) => { if (!cancelled) setEntries(Array.isArray(data) ? data : []); })
      .catch(() => { if (!cancelled) setEntries([]); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [from, to, refreshTrigger]);

  const summary = useMemo(() => {
    const g = goals ?? {};
    const hasWorkoutGoal = (g.goal_workout_days_week ?? 0) > 0 || (g.goal_workout_mins_week ?? 0) > 0;
    const workoutTypes = parseGoalWorkoutTypes(g.goal_workout_types);
    const showWorkout = hasWorkoutGoal || workoutTypes.length > 0;
    const showSteps = (g.goal_steps_day ?? 0) > 0;
    const showSleep = (g.goal_sleep_hours ?? g.goal_sleep_hours_min ?? 0) > 0;
    const showWater = (g.goal_water_liters ?? 0) > 0;
    const showProtein = (g.goal_protein_g_day ?? 0) > 0;
    const showCalories = (g.goal_calories_day ?? 0) > 0;

    const totalWorkoutMins = showWorkout
      ? entries.reduce((s, e) => s + workoutMins(e), 0)
      : 0;
    const stepsEntries = showSteps ? entries.filter((e) => e.steps != null && e.steps > 0) : [];
    const avgSteps = stepsEntries.length
      ? Math.round(stepsEntries.reduce((s, e) => s + (e.steps ?? 0), 0) / stepsEntries.length)
      : 0;
    const sleepEntries = showSleep ? entries.filter((e) => e.sleep_hours != null) : [];
    const avgSleep = sleepEntries.length
      ? sleepEntries.reduce((s, e) => s + (e.sleep_hours ?? 0), 0) / sleepEntries.length
      : 0;
    const waterEntries = showWater ? entries.filter((e) => e.water_liters != null && e.water_liters > 0) : [];
    const avgWater = waterEntries.length
      ? waterEntries.reduce((s, e) => s + (e.water_liters ?? 0), 0) / waterEntries.length
      : 0;
    const proteinEntries = showProtein ? entries.filter((e) => (e.protein_qty ?? 0) > 0) : [];
    const avgProtein = proteinEntries.length
      ? Math.round(proteinEntries.reduce((s, e) => s + (e.protein_qty ?? 0), 0) / proteinEntries.length)
      : 0;
    const caloriesEntries = showCalories ? entries.filter((e) => (e.calories_kcal ?? 0) > 0) : [];
    const avgCalories = caloriesEntries.length
      ? Math.round(caloriesEntries.reduce((s, e) => s + (e.calories_kcal ?? 0), 0) / caloriesEntries.length)
      : 0;
    return {
      totalWorkoutMins,
      avgSteps,
      avgSleep: Math.round(avgSleep * 10) / 10,
      avgWater: Math.round(avgWater * 10) / 10,
      avgProtein,
      avgCalories,
      showWorkout,
      showSteps,
      showSleep,
      showWater,
      showProtein,
      showCalories,
    };
  }, [entries, goals]);

  if (loading) return <CalendarHistogramSkeleton />;

  return (
    <div className="space-y-4 min-w-0 w-full">
      {/* W / M / 6M selector + navigation */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex rounded-lg border border-white/10 overflow-hidden">
          {RANGES.map((r) => (
            <button
              key={r.id}
              type="button"
              onClick={() => handleRangeChange(r.id)}
              className={`px-3 py-1.5 text-sm font-medium ${
                range === r.id ? 'bg-primary-orange text-white' : 'bg-surface-0 text-text-muted hover:bg-surface-2'
              }`}
            >
              {r.label}
            </button>
          ))}
        </div>

        {range === 'W' && (
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setWeekOffset((o) => o - 1)}
              className="p-1.5 rounded-lg hover:bg-surface-2 text-text-muted"
              aria-label="Previous week"
            >
              ←
            </button>
            <span className="text-xs text-text-muted font-medium px-1 whitespace-nowrap">
              {formatWeekLabel(from, to)}
            </span>
            {weekOffset < 0 && (
              <button
                type="button"
                onClick={() => setWeekOffset((o) => Math.min(0, o + 1))}
                className="p-1.5 rounded-lg hover:bg-surface-2 text-text-muted"
                aria-label="Next week"
              >
                →
              </button>
            )}
          </div>
        )}

        {range === 'M' && (
          <div className="flex gap-1">
            <button
              type="button"
              onClick={() => setMonthOffset((m) => m - 1)}
              className="p-1.5 rounded-lg hover:bg-surface-2 text-text-muted"
              aria-label="Previous month"
            >
              ←
            </button>
            {monthOffset < 0 && (
              <button
                type="button"
                onClick={() => setMonthOffset((m) => Math.min(0, m + 1))}
                className="p-1.5 rounded-lg hover:bg-surface-2 text-text-muted"
                aria-label="Next month"
              >
                →
              </button>
            )}
          </div>
        )}
      </div>

      {/* Period summary metrics — only categories the user has goals for */}
      {summary.showWorkout || summary.showSteps || summary.showSleep || summary.showWater || summary.showProtein || summary.showCalories ? (
        <div className="grid grid-cols-2 gap-2 text-xs">
          {summary.showWorkout && (
            <div className="flex items-center gap-1.5 rounded-lg bg-surface-2/40 px-3 py-2">
              <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: COLOR_WORKOUT }} />
              <span className="text-text-muted">Workout</span>
              <span className="font-semibold text-text-primary ml-auto">{fmtMins(summary.totalWorkoutMins)}</span>
            </div>
          )}
          {summary.showSteps && (
            <div className="flex items-center gap-1.5 rounded-lg bg-surface-2/40 px-3 py-2">
              <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: COLOR_STEPS }} />
              <span className="text-text-muted">Steps avg</span>
              <span className="font-semibold text-text-primary ml-auto">
                {summary.avgSteps > 0 ? `${(summary.avgSteps / 1000).toFixed(1)}k` : '—'}
              </span>
            </div>
          )}
          {summary.showSleep && (
            <div className="flex items-center gap-1.5 rounded-lg bg-surface-2/40 px-3 py-2">
              <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: COLOR_SLEEP }} />
              <span className="text-text-muted">Sleep avg</span>
              <span className="font-semibold text-text-primary ml-auto">
                {summary.avgSleep ? `${summary.avgSleep}h` : '—'}
              </span>
            </div>
          )}
          {summary.showWater && (
            <div className="flex items-center gap-1.5 rounded-lg bg-surface-2/40 px-3 py-2">
              <span className="w-2 h-2 rounded-full flex-shrink-0 bg-amber-500/80" />
              <span className="text-text-muted">Water avg</span>
              <span className="font-semibold text-text-primary ml-auto">
                {summary.avgWater ? `${summary.avgWater}L` : '—'}
              </span>
            </div>
          )}
          {summary.showProtein && (
            <div className="flex items-center gap-1.5 rounded-lg bg-surface-2/40 px-3 py-2">
              <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: COLOR_PROTEIN }} />
              <span className="text-text-muted">Protein avg</span>
              <span className="font-semibold text-text-primary ml-auto">
                {summary.avgProtein > 0 ? `${summary.avgProtein}g` : '—'}
              </span>
            </div>
          )}
          {summary.showCalories && (
            <div className="flex items-center gap-1.5 rounded-lg bg-surface-2/40 px-3 py-2">
              <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: COLOR_CALORIES }} />
              <span className="text-text-muted">Calories avg</span>
              <span className="font-semibold text-text-primary ml-auto">
                {summary.avgCalories > 0
                  ? summary.avgCalories >= 1000
                    ? `${(summary.avgCalories / 1000).toFixed(1)}k`
                    : `${summary.avgCalories}`
                  : '—'}
              </span>
            </div>
          )}
        </div>
      ) : (
        <p className="text-xs text-text-muted">
          Set goals in <strong className="text-text-secondary">My stats</strong> to see period totals here.
        </p>
      )}

      {range === 'W' && <WeekView entries={entries} goals={goals} from={from} to={to} />}
      {range === 'M' && <MonthView entries={entries} goals={goals} monthOffset={monthOffset} />}
      {range === '6M' && <SixMonthView entries={entries} goals={goals} />}
    </div>
  );
}

const COLOR_PROTEIN = '#6366f1';
const COLOR_CALORIES = '#f43f5e';

function weekColumnColor(col: WeekViewColumn): string {
  if (col.kind === 'workout_agg') return COLOR_WORKOUT;
  if (col.kind === 'steps') return COLOR_STEPS;
  if (col.kind === 'sleep') return COLOR_SLEEP;
  if (col.kind === 'protein') return COLOR_PROTEIN;
  if (col.kind === 'calories') return COLOR_CALORIES;
  return '#f59e0b';
}

export function weekColumnLabel(col: WeekViewColumn): string {
  if (col.kind === 'workout_agg') return 'Workout';
  if (col.kind === 'steps') return 'Steps';
  if (col.kind === 'sleep') return 'Sleep';
  if (col.kind === 'protein') return 'Protein';
  if (col.kind === 'calories') return 'Calories';
  return 'Water';
}

function weekColKey(col: WeekViewColumn): string {
  return col.kind;
}

function WeekView({
  entries,
  goals,
  from,
  to,
}: {
  entries: EntryRow[];
  goals: ProfileGoals | null;
  from: string;
  to: string;
}) {
  const entriesByDate = new Map(entries.map((e) => [e.date, e]));
  const days: string[] = [];
  const d = new Date(from + 'T12:00:00');
  const end = new Date(to + 'T12:00:00');
  while (d <= end) {
    days.push(d.toISOString().slice(0, 10));
    d.setDate(d.getDate() + 1);
  }

  const columns = buildWeekViewColumns(goals);
  const todayStr = new Date().toISOString().slice(0, 10);

  const gridCols =
    columns.length === 0
      ? '4.5rem'
      : `4.5rem repeat(${columns.length}, minmax(0, 1fr))`;

  if (columns.length === 0) {
    return (
      <p className="text-sm text-text-muted py-2">
        Set weekly or daily goals in <strong className="text-text-secondary">My stats</strong> to see how each day lines up
        with your targets.
      </p>
    );
  }

  return (
    <div className="space-y-1">
      {/* Column headers */}
      <div
        className="grid text-[10px] font-medium text-text-muted pb-1.5 border-b border-white/10 gap-0.5"
        style={{ gridTemplateColumns: gridCols }}
      >
        <span />
        {columns.map((col) => (
          <span key={weekColKey(col)} className="text-center truncate px-0.5" style={{ color: weekColumnColor(col) }}>
            {weekColumnLabel(col)}
          </span>
        ))}
      </div>

      {/* Day rows */}
      {days.map((date) => {
        const e = entriesByDate.get(date);
        const isToday = date === todayStr;
        const isPast = date < todayStr;
        const dayLabel = new Date(date + 'T12:00:00').toLocaleDateString(undefined, {
          weekday: 'short',
          day: 'numeric',
        });

        return (
          <div
            key={date}
            className={`grid items-center py-1.5 px-1 rounded-lg gap-0.5 ${isToday ? 'bg-surface-2/50' : ''}`}
            style={{ gridTemplateColumns: gridCols }}
          >
            <span className={`text-xs font-medium ${isToday ? 'text-primary-orange' : 'text-text-muted'}`}>
              {dayLabel}
            </span>
            {columns.map((col) => {
              const { met, value } = weekColumnStatus(e, col, goals, !e && isPast, isPast);
              return (
                <div key={weekColKey(col)} className="flex flex-col items-center gap-0.5 min-w-0">
                  <div
                    className={`w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold ${
                      met === true
                        ? 'bg-emerald-500/20 text-emerald-500'
                        : met === false
                        ? 'bg-rose-500/20 text-rose-500'
                        : 'bg-surface-2 text-text-muted/40'
                    }`}
                  >
                    {met === true ? '✓' : met === false ? '✗' : '·'}
                  </div>
                  <span className="text-[10px] text-text-muted leading-none truncate max-w-full">{value}</span>
                </div>
              );
            })}
          </div>
        );
      })}
    </div>
  );
}

function MonthView({
  entries,
  goals,
  monthOffset,
}: {
  entries: EntryRow[];
  goals: ProfileGoals | null;
  monthOffset: number;
}) {
  const entriesByDate = new Map(entries.map((e) => [e.date, e]));
  const target = new Date();
  target.setMonth(target.getMonth() + monthOffset);
  const year = target.getFullYear();
  const month = target.getMonth();
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  // Monday-first: Mon=0, Tue=1, ..., Sun=6
  const startPad = (firstDay.getDay() + 6) % 7;
  const daysInMonth = lastDay.getDate();
  const todayStr = new Date().toISOString().slice(0, 10);

  // Build weeks (Mon–Sun order)
  const weeks: { date: string; day: number; isCurrentMonth: boolean }[][] = [];
  let week: { date: string; day: number; isCurrentMonth: boolean }[] = [];

  for (let i = 0; i < startPad; i++) {
    const d = new Date(year, month, 1 - startPad + i);
    week.push({ date: d.toISOString().slice(0, 10), day: d.getDate(), isCurrentMonth: false });
  }
  for (let day = 1; day <= daysInMonth; day++) {
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    week.push({ date: dateStr, day, isCurrentMonth: true });
    if (week.length === 7) {
      weeks.push(week);
      week = [];
    }
  }
  if (week.length) {
    let nextDay = lastDay.getDate() + 1;
    while (week.length < 7) {
      const d = new Date(year, month, nextDay++);
      week.push({ date: d.toISOString().slice(0, 10), day: d.getDate(), isCurrentMonth: false });
    }
    weeks.push(week);
  }

  const MONTH_NAMES = ['January','February','March','April','May','June','July','August','September','October','November','December'];

  return (
    <div className="w-full min-w-0 space-y-2">
      {/* Month + year heading */}
      <div className="flex items-baseline gap-2">
        <span className="text-base font-semibold text-text-primary">{MONTH_NAMES[month]}</span>
        <span className="text-xs text-text-muted">{year}</span>
      </div>

      {/* Legend */}
      <div className="flex gap-x-3 gap-y-1 flex-wrap text-xs text-text-muted">
        <span className="flex items-center gap-1"><span className="w-3 h-3 shrink-0 rounded-sm bg-emerald-500/50" />Day: goal met</span>
        <span className="flex items-center gap-1"><span className="w-3 h-3 shrink-0 rounded-sm bg-rose-500/50" />Day: missed</span>
        <span className="flex items-center gap-1"><span className="w-3 h-3 shrink-0 rounded-sm" style={{ background: 'rgba(249,115,22,0.5)' }} />Week: partial</span>
        <span className="flex items-center gap-1"><span className="w-3 h-3 shrink-0 rounded-sm bg-emerald-600/60" />Week: on track</span>
      </div>
      <div className="w-full overflow-x-auto overflow-y-visible overscroll-x-contain -mx-0.5 px-0.5 pb-1">
        <table className="w-full border-collapse table-fixed" style={{ minWidth: 280 }}>
          <thead>
            <tr>
              {/* Week indicator column on LEFT */}
              <th className="text-[10px] font-medium text-text-muted p-1 text-center w-8">Wk</th>
              {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((d) => (
                <th key={d} className="text-[10px] font-medium text-text-muted p-1 text-center">
                  {d}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {weeks.map((row, wi) => {
              const weekDates = row.map((c) => c.date);
              const wk = computeWeekStatus(weekDates, entriesByDate, goals, todayStr);
              return (
                <tr key={wi}>
                  {/* Week status cell on LEFT */}
                  <td className="p-0.5 align-middle">
                    <div
                      className="rounded-lg border min-h-[44px] flex items-center justify-center text-xs font-bold"
                      style={
                        wk === 'green'
                          ? { backgroundColor: 'rgba(34,197,94,0.15)', borderColor: 'rgba(34,197,94,0.35)', color: '#22c55e' }
                          : wk === 'yellow'
                          ? { backgroundColor: 'rgba(249,115,22,0.15)', borderColor: 'rgba(249,115,22,0.35)', color: '#fb923c' }
                          : wk === 'red'
                          ? { backgroundColor: 'rgba(239,68,68,0.1)', borderColor: 'rgba(239,68,68,0.25)', color: '#f87171' }
                          : { backgroundColor: 'transparent', borderColor: 'rgba(255,255,255,0.08)', color: 'rgba(156,163,175,0.4)' }
                      }
                    >
                      {wk === 'green' ? '✓' : wk === 'yellow' ? '~' : wk === 'red' ? '✗' : '·'}
                    </div>
                  </td>
                  {row.map(({ date, day, isCurrentMonth }) => {
                    const e = entriesByDate.get(date);
                    const isToday = date === todayStr;
                    const isPast = date < todayStr;
                    // Past day with no entry = red (goal missed)
                    const status =
                      !isCurrentMonth
                        ? null
                        : e
                        ? dayGoalStatus(e, goals)
                        : isPast
                        ? false
                        : null;
                    return (
                      <td key={date} className="p-0.5 align-top">
                        <div
                          className={`min-h-[44px] rounded-lg border flex flex-col items-center justify-center gap-0.5 p-1 ${
                            !isCurrentMonth
                              ? 'bg-surface-2/20 border-transparent'
                              : status === true
                              ? 'bg-emerald-500/20 border-emerald-500/30'
                              : status === false
                              ? 'bg-rose-500/15 border-rose-500/25'
                              : 'bg-surface-0 border-white/10'
                          } ${isToday ? 'ring-2 ring-primary-orange ring-offset-1' : ''}`}
                        >
                          <div
                            className={`text-[10px] font-semibold ${
                              !isCurrentMonth
                                ? 'text-text-muted/30'
                                : isToday
                                ? 'text-primary-orange'
                                : status === true
                                ? 'text-emerald-500'
                                : status === false
                                ? 'text-rose-400'
                                : 'text-text-muted'
                            }`}
                          >
                            {day}
                          </div>
                          {isCurrentMonth && status !== null && (
                            <div
                              className={`text-[9px] font-bold leading-none ${
                                status ? 'text-emerald-500' : 'text-rose-400'
                              }`}
                            >
                              {status ? '✓' : '✗'}
                            </div>
                          )}
                        </div>
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function SixMonthView({ entries, goals }: { entries: EntryRow[]; goals: ProfileGoals | null }) {
  const entriesByDate = new Map(entries.map((e) => [e.date, e]));
  const today = new Date();
  const todayStr = today.toISOString().slice(0, 10);

  // Build weeks starting from Monday of the week containing 5 months ago
  const rangeStart = getMondayOfWeek(new Date(today.getFullYear(), today.getMonth() - 5, 1));

  const weeks: string[][] = [];
  const cur = new Date(rangeStart);
  while (cur <= today) {
    const week: string[] = [];
    for (let i = 0; i < 7; i++) {
      week.push(new Date(cur).toISOString().slice(0, 10));
      cur.setDate(cur.getDate() + 1);
    }
    weeks.push(week);
  }

  // Month ranges: find first week that contains any day from each new month
  // This ensures "Jan" label aligns with where Jan 1 actually appears in the cells
  const monthFirstWeek = new Map<string, number>();
  weeks.forEach((week, wi) => {
    week.forEach((date) => {
      if (date > todayStr) return;
      const mk = date.slice(0, 7);
      if (!monthFirstWeek.has(mk)) monthFirstWeek.set(mk, wi);
    });
  });

  const sortedMonths = Array.from(monthFirstWeek.entries())
    .sort((a, b) => a[0].localeCompare(b[0]));

  // Deduplicate: if two months map to the same starting week (e.g. Sep + Oct both in week 0),
  // keep only the later month for that week position
  const deduped: typeof sortedMonths = [];
  for (const entry of sortedMonths) {
    if (deduped.length > 0 && deduped[deduped.length - 1][1] === entry[1]) {
      deduped[deduped.length - 1] = entry; // replace with the later month
    } else {
      deduped.push(entry);
    }
  }

  const monthRanges = deduped.map(([mk, startWi], i) => ({
    month: new Date(mk + '-15T12:00:00').toLocaleString('default', { month: 'short' }),
    start: startWi,
    end: i < deduped.length - 1 ? deduped[i + 1][1] - 1 : weeks.length - 1,
  }));

  const hasGoals =
    (goals?.goal_workout_days_week ?? 0) > 0 ||
    (goals?.goal_workout_mins_week ?? 0) > 0 ||
    (goals?.goal_steps_day ?? 0) > 0 ||
    (goals?.goal_sleep_hours ?? goals?.goal_sleep_hours_min ?? 0) > 0 ||
    (goals?.goal_water_liters ?? 0) > 0;

  const cellBg = (date: string): string => {
    if (date > todayStr) return 'transparent';
    const e = entriesByDate.get(date);
    if (!e) {
      // Past day with no entry
      return hasGoals ? 'rgba(239,68,68,0.4)' : 'rgba(107,114,128,0.15)';
    }
    const status = dayGoalStatus(e, goals);
    if (status === true) return 'rgba(34,197,94,0.65)';
    if (status === false) return 'rgba(239,68,68,0.5)';
    return 'rgba(107,114,128,0.3)'; // entry exists, no goals set
  };

  const GAP = 2; // px — gap between cells

  // Day-of-week labels (Mon–Sun)
  const DAY_LABELS = ['M', 'Tu', 'W', 'Th', 'F', 'Sa', 'Su'];

  // Single grid: col 1 = labels (20px), cols 2..N+1 = weeks
  // Row 1 = month header, rows 2..8 = Mon–Sun
  // Every element has explicit gridRow + gridColumn — zero auto-placement
  const numWeekCols = weeks.length;

  return (
    <div className="space-y-3 w-full">
      <div className="w-full overflow-x-auto pb-2">
        <div
          className="w-full min-w-0"
          style={{
            display: 'grid',
            gridTemplateColumns: `20px repeat(${numWeekCols}, minmax(6px, 1fr))`,
            gridTemplateRows: `14px repeat(7, auto)`,
            gap: `${GAP}px`,
          }}
        >
          {/* Row 1, col 1: empty corner */}
          <div style={{ gridRow: 1, gridColumn: 1 }} />

          {/* Row 1, cols 2+: month labels — left-aligned at first week of each month */}
          {monthRanges.map((range, ri) => (
            <div
              key={ri}
              className="text-[9px] text-text-muted/70 leading-none"
              style={{
                gridRow: 1,
                gridColumn: `${range.start + 2} / span ${range.end - range.start + 1}`,
                alignSelf: 'center',
                whiteSpace: 'nowrap',
                overflow: 'visible',
                paddingLeft: '1px',
              }}
            >
              {range.month}
            </div>
          ))}

          {/* Rows 2–8: day label + week cells, all explicitly placed */}
          {[0, 1, 2, 3, 4, 5, 6].map((row) => (
            <React.Fragment key={row}>
              {/* Col 1: day-of-week label */}
              <div
                className="text-[9px] text-text-muted/60 text-right leading-none flex items-center justify-end pr-1"
                style={{ gridRow: row + 2, gridColumn: 1 }}
              >
                {DAY_LABELS[row]}
              </div>
              {/* Cols 2..N+1: cells */}
              {weeks.map((week, wi) => (
                <div
                  key={wi}
                  title={week[row]}
                  className="rounded-[2px] w-full aspect-square"
                  style={{
                    gridRow: row + 2,
                    gridColumn: wi + 2,
                    backgroundColor: cellBg(week[row]),
                  }}
                />
              ))}
            </React.Fragment>
          ))}
        </div>
      </div>

      {/* Legend */}
      <div className="flex gap-4 flex-wrap text-xs text-text-muted">
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-sm" style={{ background: 'rgba(34,197,94,0.65)' }} />
          Goal met
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-sm" style={{ background: 'rgba(239,68,68,0.5)' }} />
          {hasGoals ? 'Missed / no entry' : 'No entry'}
        </span>
        {!hasGoals && (
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-sm" style={{ background: 'rgba(107,114,128,0.3)' }} />
            Logged
          </span>
        )}
      </div>
    </div>
  );
}
