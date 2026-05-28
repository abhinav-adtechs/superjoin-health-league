'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { apiUrl, getApiFetchOptions } from '@/lib/api';
import { parseGoalWorkoutTypes } from '@/lib/workout-goals';
import { CalendarHistogramSkeleton } from '@/components/LoadingScreen';
import { WeekGoalsGrid } from '@/components/WeekGoalsGrid';
import {
  buildWeekViewColumns,
  dayGoalStatus,
  entryWorkoutMins,
  fmtMins,
  weekColumnColor,
  weekColumnLabel,
  weekColumnStatus,
  weekColKey,
  COLOR_WORKOUT,
  COLOR_STEPS,
  COLOR_SLEEP,
  COLOR_PROTEIN,
  COLOR_CALORIES,
  type EntryRow,
  type ProfileGoals,
  type WeekViewColumn,
} from '@/lib/health-log-week-view';

export type { EntryRow, ProfileGoals, WeekViewColumn } from '@/lib/health-log-week-view';
export { buildWeekViewColumns, weekColumnStatus, weekColumnLabel } from '@/lib/health-log-week-view';

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
      return s + (e ? entryWorkoutMins(e) : 0);
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

type RangeId = 'W' | 'M' | '6M';

const RANGES: { id: RangeId; label: string }[] = [
  { id: 'W', label: 'W' },
  { id: 'M', label: 'M' },
  { id: '6M', label: '6M' },
];

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
      ? entries.reduce((s, e) => s + entryWorkoutMins(e), 0)
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

      {range === 'W' && <WeekGoalsGrid entries={entries} goals={goals} from={from} to={to} />}
      {range === 'M' && <MonthView entries={entries} goals={goals} monthOffset={monthOffset} />}
      {range === '6M' && <SixMonthView entries={entries} goals={goals} />}
    </div>
  );
}

type DayRingStatus = { col: WeekViewColumn; met: boolean | null; color: string };

function monthDayRingStatuses(
  e: EntryRow | undefined,
  goals: ProfileGoals | null,
  isPast: boolean,
  isFuture: boolean
): DayRingStatus[] {
  return buildWeekViewColumns(goals).map((col) => {
    const isPastNoEntry = !e && isPast && !isFuture;
    const { met } = weekColumnStatus(e, col, goals, isPastNoEntry, isPast && !isFuture);
    return { col, met, color: weekColumnColor(col) };
  });
}

/**
 * One donut per day: each slice = one tracked goal (color = metric).
 * Solid slice = met, faded = missed. Easier to read than multiple mini rings.
 */
function DayGoalDonut({
  rings,
  size = 30,
  metLabel,
}: {
  rings: DayRingStatus[];
  size?: number;
  /** e.g. "2/4" shown in the center */
  metLabel?: string;
}) {
  const scored = rings.filter((r) => r.met !== null);
  if (scored.length === 0) return null;

  const n = scored.length;
  const stroke = 3.25;
  const r = (size - stroke) / 2 - 0.5;
  const cx = size / 2;
  const cy = size / 2;
  const circumference = 2 * Math.PI * r;
  const segLen = circumference / n;
  const segGap = n > 1 ? 2.5 : 0;
  const track = 'rgba(15, 23, 42, 0.08)';

  return (
    <svg width={size} height={size} className="shrink-0" aria-hidden>
      <circle cx={cx} cy={cy} r={r} fill="none" stroke={track} strokeWidth={stroke} />
      {scored.map((ring, i) => {
        const dash = Math.max(1, segLen - segGap);
        const rotation = (360 / n) * i - 90;
        const isMet = ring.met === true;
        return (
          <circle
            key={weekColKey(ring.col)}
            cx={cx}
            cy={cy}
            r={r}
            fill="none"
            stroke={ring.color}
            strokeWidth={stroke}
            strokeOpacity={isMet ? 1 : 0.32}
            strokeLinecap="round"
            strokeDasharray={`${dash} ${circumference - dash}`}
            transform={`rotate(${rotation} ${cx} ${cy})`}
          />
        );
      })}
      {metLabel ? (
        <text
          x={cx}
          y={cy}
          textAnchor="middle"
          dominantBaseline="central"
          className="fill-text-muted"
          style={{ fontSize: metLabel.length > 3 ? 7 : 8, fontWeight: 600 }}
        >
          {metLabel}
        </text>
      ) : null}
    </svg>
  );
}

function MonthDayCell({
  day,
  date,
  isCurrentMonth,
  isToday,
  entry,
  goals,
}: {
  day: number;
  date: string;
  isCurrentMonth: boolean;
  isToday: boolean;
  entry: EntryRow | undefined;
  goals: ProfileGoals | null;
}) {
  const todayStr = new Date().toISOString().slice(0, 10);
  const isPast = date < todayStr;
  const isFuture = date > todayStr;
  const columns = buildWeekViewColumns(goals);
  const rings = isCurrentMonth ? monthDayRingStatuses(entry, goals, isPast, isFuture) : [];
  const hasMetricGoals = columns.length > 0;

  const scored = rings.filter((r) => r.met !== null);
  const metCount = scored.filter((r) => r.met === true).length;
  const allMet = hasMetricGoals && scored.length > 0 && metCount === scored.length;
  const partial = hasMetricGoals && metCount > 0 && metCount < scored.length;

  const fallbackStatus =
    !hasMetricGoals && isCurrentMonth
      ? entry
        ? dayGoalStatus(entry, goals)
        : isPast
        ? false
        : null
      : null;

  const ariaParts = rings.map(
    (r) => `${weekColumnLabel(r.col)}: ${r.met === true ? 'met' : r.met === false ? 'missed' : 'pending'}`
  );
  const ariaLabel =
    isCurrentMonth && (rings.length > 0 || fallbackStatus !== null)
      ? `${date}: ${ariaParts.length ? ariaParts.join(', ') : fallbackStatus ? 'goals met' : 'goals missed'}`
      : undefined;

  if (!isCurrentMonth) {
    return (
      <div className="min-h-[48px] rounded-lg bg-surface-2/20 flex items-center justify-center p-0.5">
        <span className="text-[10px] text-text-muted/30 font-medium">{day}</span>
      </div>
    );
  }

  const metLabel =
    hasMetricGoals && scored.length > 0 && !allMet
      ? `${metCount}/${scored.length}`
      : allMet && scored.length > 0
        ? '✓'
        : undefined;

  return (
    <div
      className={`min-h-[52px] rounded-lg border flex flex-col items-center justify-center gap-0.5 p-0.5 ${
        allMet
          ? 'bg-emerald-500/10 border-emerald-500/30'
          : partial
          ? 'bg-amber-500/5 border-amber-500/20'
          : 'bg-surface-0 border-white/10'
      } ${isToday ? 'ring-2 ring-primary-orange ring-offset-1 ring-offset-surface-0' : ''}`}
      title={ariaLabel}
      aria-label={ariaLabel}
    >
      <span
        className={`text-[10px] font-semibold leading-none ${
          isToday ? 'text-primary-orange' : allMet ? 'text-emerald-500' : 'text-text-muted'
        }`}
      >
        {day}
      </span>
      {hasMetricGoals && scored.length > 0 ? (
        <DayGoalDonut rings={rings} metLabel={metLabel} />
      ) : fallbackStatus !== null ? (
        <span
          className={`text-[9px] font-bold leading-none ${
            fallbackStatus ? 'text-emerald-500' : 'text-text-muted/50'
          }`}
        >
          {fallbackStatus ? '✓' : '·'}
        </span>
      ) : null}
    </div>
  );
}

function hexToRgba(hex: string, alpha: number): string {
  const h = hex.replace('#', '');
  if (h.length !== 6) return `rgba(148, 163, 184, ${alpha})`;
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

/** Compact conic fill for 6M heatmap cells — same goal slices as month donuts. */
function ringsToConicGradient(rings: DayRingStatus[]): string {
  const scored = rings.filter((r) => r.met !== null);
  if (scored.length === 0) return 'rgba(248, 250, 252, 0.95)';
  const n = scored.length;
  const stops = scored.map((r, i) => {
    const pct0 = (i / n) * 100;
    const pct1 = ((i + 1) / n) * 100;
    const alpha = r.met === true ? 0.92 : 0.28;
    return `${hexToRgba(r.color, alpha)} ${pct0}% ${pct1}%`;
  });
  return `conic-gradient(from -90deg, ${stops.join(', ')})`;
}

function sixMonthCellPresentation(
  date: string,
  entry: EntryRow | undefined,
  goals: ProfileGoals | null,
  todayStr: string,
  metricColumns: WeekViewColumn[]
): { background: string; borderClass: string; title: string } {
  if (date > todayStr) {
    return { background: 'transparent', borderClass: 'border-transparent', title: date };
  }

  if (metricColumns.length === 0) {
    const e = entry;
    if (!e) {
      return {
        background: 'rgba(107, 114, 128, 0.15)',
        borderClass: 'border-transparent',
        title: `${date}: no entry`,
      };
    }
    const status = dayGoalStatus(e, goals);
    if (status === true) {
      return {
        background: 'rgba(34, 197, 94, 0.65)',
        borderClass: 'border-emerald-500/40',
        title: `${date}: goals met`,
      };
    }
    if (status === false) {
      return {
        background: 'rgba(239, 68, 68, 0.45)',
        borderClass: 'border-transparent',
        title: `${date}: goals missed`,
      };
    }
    return {
      background: 'rgba(107, 114, 128, 0.3)',
      borderClass: 'border-transparent',
      title: `${date}: logged`,
    };
  }

  const isPast = date < todayStr;
  const rings = monthDayRingStatuses(entry, goals, isPast, false);
  const scored = rings.filter((r) => r.met !== null);
  const metCount = scored.filter((r) => r.met === true).length;
  const allMet = scored.length > 0 && metCount === scored.length;
  const partial = metCount > 0 && metCount < scored.length;
  const ariaParts = rings.map(
    (r) => `${weekColumnLabel(r.col)}: ${r.met === true ? 'met' : r.met === false ? 'missed' : 'pending'}`
  );

  return {
    background: ringsToConicGradient(rings),
    borderClass: allMet
      ? 'border-emerald-500/45'
      : partial
      ? 'border-amber-500/35'
      : 'border-white/10',
    title: `${date}: ${ariaParts.join(', ')}`,
  };
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
  const metricColumns = buildWeekViewColumns(goals);

  return (
    <div className="w-full min-w-0 space-y-2">
      {/* Month + year heading */}
      <div className="flex items-baseline gap-2">
        <span className="text-base font-semibold text-text-primary">{MONTH_NAMES[month]}</span>
        <span className="text-xs text-text-muted">{year}</span>
      </div>

      {/* Legend */}
      <div className="flex gap-x-3 gap-y-1.5 flex-wrap text-xs text-text-muted">
        {metricColumns.length > 0 ? (
          <>
            <span className="flex items-center gap-1.5">
              <DayGoalDonut
                size={22}
                rings={metricColumns.slice(0, 4).map((col, i) => ({
                  col,
                  color: weekColumnColor(col),
                  met: i % 2 === 0,
                }))}
                metLabel="2/4"
              />
              <span>
                <span className="text-text-secondary font-medium">One ring per day</span>
                {' — '}
                each slice is a goal; bright = met, faded = missed. Center shows ✓ or count.
              </span>
            </span>
            <span className="flex items-center gap-1 w-full">
              <span className="w-3 h-3 shrink-0 rounded-sm bg-emerald-500/15 border border-emerald-500/30" />
              All goals met
              <span className="w-3 h-3 shrink-0 rounded-sm bg-amber-500/10 border border-amber-500/20 ml-2" />
              Some met
            </span>
            <span className="flex flex-wrap gap-x-2 gap-y-1 w-full">
              {metricColumns.map((col) => (
                <span key={weekColKey(col)} className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: weekColumnColor(col) }} />
                  {weekColumnLabel(col)}
                </span>
              ))}
            </span>
          </>
        ) : (
          <span className="text-text-muted/80">Set daily goals in My stats to see goal progress by day.</span>
        )}
        <span className="flex items-center gap-1 w-full sm:w-auto">
          <span className="w-3 h-3 shrink-0 rounded-sm" style={{ background: 'rgba(249,115,22,0.5)' }} />
          Wk column: partial
        </span>
        <span className="flex items-center gap-1">
          <span className="w-3 h-3 shrink-0 rounded-sm bg-emerald-600/60" />
          Wk column: on track
        </span>
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
                  {row.map(({ date, day, isCurrentMonth }) => (
                    <td key={date} className="p-0.5 align-top">
                      <MonthDayCell
                        day={day}
                        date={date}
                        isCurrentMonth={isCurrentMonth}
                        isToday={date === todayStr}
                        entry={entriesByDate.get(date)}
                        goals={goals}
                      />
                    </td>
                  ))}
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

  const metricColumns = buildWeekViewColumns(goals);

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
            gridTemplateColumns: `20px repeat(${numWeekCols}, minmax(8px, 1fr))`,
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
              {weeks.map((week, wi) => {
                const date = week[row];
                const cell = sixMonthCellPresentation(
                  date,
                  entriesByDate.get(date),
                  goals,
                  todayStr,
                  metricColumns
                );
                return (
                  <div
                    key={wi}
                    title={cell.title}
                    className={`rounded-[3px] w-full aspect-square border box-border ${cell.borderClass}`}
                    style={{
                      gridRow: row + 2,
                      gridColumn: wi + 2,
                      background: cell.background,
                    }}
                  />
                );
              })}
            </React.Fragment>
          ))}
        </div>
      </div>

      {/* Legend */}
      <div className="flex gap-x-3 gap-y-1.5 flex-wrap text-xs text-text-muted">
        {metricColumns.length > 0 ? (
          <>
            <span className="flex items-center gap-1.5 w-full sm:w-auto">
              <span
                className="w-4 h-4 rounded-sm border border-white/20 shrink-0"
                style={{
                  background: ringsToConicGradient(
                    metricColumns.slice(0, 4).map((col, i) => ({
                      col,
                      color: weekColumnColor(col),
                      met: i % 2 === 0,
                    }))
                  ),
                }}
              />
              <span>
                Each square = one day; colored slices are goals (bright = met, faded = missed).
              </span>
            </span>
            <span className="flex items-center gap-1">
              <span className="w-3 h-3 shrink-0 rounded-sm bg-emerald-500/15 border border-emerald-500/30" />
              All goals met
            </span>
            <span className="flex items-center gap-1">
              <span className="w-3 h-3 shrink-0 rounded-sm bg-amber-500/10 border border-amber-500/20" />
              Some met
            </span>
            <span className="flex flex-wrap gap-x-2 gap-y-1 w-full">
              {metricColumns.map((col) => (
                <span key={weekColKey(col)} className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: weekColumnColor(col) }} />
                  {weekColumnLabel(col)}
                </span>
              ))}
            </span>
          </>
        ) : (
          <>
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-sm bg-emerald-500/60" />
              Goals met
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-sm bg-slate-400/30" />
              Logged / no entry
            </span>
          </>
        )}
      </div>
    </div>
  );
}
