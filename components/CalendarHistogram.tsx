'use client';

import { useState, useEffect, useMemo } from 'react';
import { apiUrl, getApiFetchOptions } from '@/lib/api';

export type EntryRow = {
  date: string;
  workout_done?: boolean | null;
  workout_duration?: number | null;
  cardio_done?: boolean | null;
  cardio_duration?: number | null;
  steps?: number | null;
  water_liters?: number | null;
  home_cooked_meals?: number | null;
  sleep_hours?: number | null;
  sleep_quality?: number | null;
};

export type ProfileGoals = {
  goal_workout_mins_week?: number | null;
  goal_workout_days_week?: number | null;
  goal_steps_day?: number | null;
  goal_sleep_hours_min?: number | null;
  goal_sleep_hours_max?: number | null;
  goal_water_liters?: number | null;
  goal_home_cooked_per_week?: number | null;
};

function hasWorkout(e: EntryRow): boolean {
  return e.workout_done === true || e.cardio_done === true || (e.steps != null && Number(e.steps) > 0);
}
function hasFood(e: EntryRow): boolean {
  return (
    (e.water_liters != null && Number(e.water_liters) > 0) ||
    (e.home_cooked_meals != null)
  );
}
function hasSleep(e: EntryRow): boolean {
  return e.sleep_hours != null || e.sleep_quality != null;
}

function workoutMins(e: EntryRow): number {
  const w = (e.workout_done && e.workout_duration) ? e.workout_duration : 0;
  const c = (e.cardio_done && e.cardio_duration) ? e.cardio_duration : 0;
  return w + c;
}

type RangeId = 'D' | 'W' | 'M' | '6M';

const RANGES: { id: RangeId; label: string }[] = [
  { id: 'D', label: 'D' },
  { id: 'W', label: 'W' },
  { id: 'M', label: 'M' },
  { id: '6M', label: '6M' },
];

const COLOR_WORKOUT = '#FF6B35';
const COLOR_FOOD = '#059669';
const COLOR_SLEEP = '#2563eb';

function getFromTo(range: RangeId, monthOffset: number): { from: string; to: string } {
  const today = new Date();
  const to = new Date(today);
  const from = new Date(today);
  if (range === 'D') {
    from.setDate(to.getDate());
    to.setDate(to.getDate());
  } else if (range === 'W') {
    from.setDate(to.getDate() - 6);
  } else if (range === 'M') {
    from.setFullYear(today.getFullYear(), today.getMonth() + monthOffset, 1);
    to.setFullYear(today.getFullYear(), today.getMonth() + monthOffset + 1, 0);
  } else {
    // 6M
    from.setMonth(from.getMonth() - 5);
    from.setDate(1);
  }
  return { from: from.toISOString().slice(0, 10), to: to.toISOString().slice(0, 10) };
}

export function CalendarHistogram({
  refreshTrigger = 0,
  goals = null,
}: {
  refreshTrigger?: number;
  goals?: ProfileGoals | null;
}) {
  const [range, setRange] = useState<RangeId>('M');
  const [monthOffset, setMonthOffset] = useState(0);
  const [entries, setEntries] = useState<EntryRow[]>([]);
  const [loading, setLoading] = useState(true);

  const { from, to } = useMemo(() => getFromTo(range, monthOffset), [range, monthOffset]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetch(apiUrl(`/api/entries/history?from=${from}&to=${to}`), getApiFetchOptions())
      .then((r) => r.json())
      .then((data) => {
        if (!cancelled) setEntries(Array.isArray(data) ? data : []);
      })
      .catch(() => { if (!cancelled) setEntries([]); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [from, to, refreshTrigger]);

  const summary = useMemo(() => {
    const withWorkout = entries.filter((e) => e.workout_done || e.cardio_done);
    const totalWorkoutMins = entries.reduce((s, e) => s + workoutMins(e), 0);
    const stepsEntries = entries.filter((e) => e.steps != null && e.steps > 0);
    const totalSteps = stepsEntries.reduce((s, e) => s + (e.steps ?? 0), 0);
    const avgSteps = stepsEntries.length ? Math.round(totalSteps / stepsEntries.length) : 0;
    const sleepEntries = entries.filter((e) => e.sleep_hours != null);
    const avgSleep = sleepEntries.length
      ? sleepEntries.reduce((s, e) => s + (e.sleep_hours ?? 0), 0) / sleepEntries.length
      : 0;
    const waterEntries = entries.filter((e) => e.water_liters != null && e.water_liters > 0);
    const avgWater = waterEntries.length
      ? waterEntries.reduce((s, e) => s + (e.water_liters ?? 0), 0) / waterEntries.length
      : 0;
    const goalWorkoutMins = goals?.goal_workout_mins_week ?? null;
    const goalSteps = goals?.goal_steps_day ?? null;
    const goalSleepMin = goals?.goal_sleep_hours_min ?? null;
    const goalSleepMax = goals?.goal_sleep_hours_max ?? null;
    const goalWater = goals?.goal_water_liters ?? null;
    return {
      totalWorkoutMins,
      goalWorkoutMins,
      totalSteps,
      avgSteps,
      goalSteps,
      avgSleep: Math.round(avgSleep * 10) / 10,
      goalSleepMin,
      goalSleepMax,
      avgWater: Math.round(avgWater * 10) / 10,
      goalWater,
      daysWithEntries: entries.length,
    };
  }, [entries, goals]);

  if (loading) {
    return <div className="animate-pulse h-64 rounded-xl bg-surface-2/50" />;
  }

  return (
    <div className="space-y-4">
      {/* D / W / M / 6M selector */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex rounded-lg border border-white/10 overflow-hidden">
          {RANGES.map((r) => (
            <button
              key={r.id}
              type="button"
              onClick={() => setRange(r.id)}
              className={`px-3 py-1.5 text-sm font-medium ${
                range === r.id ? 'bg-primary-orange text-white' : 'bg-surface-0 text-text-muted hover:bg-surface-2'
              }`}
            >
              {r.label}
            </button>
          ))}
        </div>
        {range === 'M' && (
          <div className="flex gap-1">
            <button
              type="button"
              onClick={() => setMonthOffset((m) => m - 1)}
              className="p-1.5 rounded-lg hover:bg-black/5 text-text-muted"
              aria-label="Previous month"
            >
              ←
            </button>
            <button
              type="button"
              onClick={() => setMonthOffset((m) => m + 1)}
              className="p-1.5 rounded-lg hover:bg-black/5 text-text-muted"
              aria-label="Next month"
            >
              →
            </button>
          </div>
        )}
      </div>

      {/* Summary metrics */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: COLOR_WORKOUT }} />
          <span className="text-text-muted">Workout</span>
          <span className="font-medium text-text-primary ml-auto">
            {summary.totalWorkoutMins} min
            {summary.goalWorkoutMins != null && summary.goalWorkoutMins > 0 && (
              <span className="text-text-muted font-normal"> / {summary.goalWorkoutMins} goal</span>
            )}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: COLOR_FOOD }} />
          <span className="text-text-muted">Steps</span>
          <span className="font-medium text-text-primary ml-auto">
            {range === 'D' && entries.length ? (entries[0].steps ?? 0).toLocaleString() : summary.avgSteps > 0 ? `${(summary.avgSteps / 1000).toFixed(1)}k avg` : '—'}
            {summary.goalSteps != null && summary.goalSteps > 0 && (
              <span className="text-text-muted font-normal"> / {(summary.goalSteps / 1000).toFixed(0)}k</span>
            )}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: COLOR_SLEEP }} />
          <span className="text-text-muted">Sleep</span>
          <span className="font-medium text-text-primary ml-auto">
            {summary.avgSleep ? `${summary.avgSleep} hr` : '—'}
            {summary.goalSleepMin != null && summary.goalSleepMax != null && (
              <span className="text-text-muted font-normal"> / {summary.goalSleepMin}–{summary.goalSleepMax} hr</span>
            )}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full flex-shrink-0 bg-amber-500/80" />
          <span className="text-text-muted">Water</span>
          <span className="font-medium text-text-primary ml-auto">
            {summary.avgWater ? `${summary.avgWater} L` : '—'}
            {summary.goalWater != null && summary.goalWater > 0 && (
              <span className="text-text-muted font-normal"> / {summary.goalWater} L</span>
            )}
          </span>
        </div>
      </div>

      {/* View by range */}
      {range === 'D' && <DayView entries={entries} goals={goals} />}
      {range === 'W' && <WeekView entries={entries} goals={goals} from={from} to={to} />}
      {range === 'M' && <MonthView entries={entries} goals={goals} monthOffset={monthOffset} />}
      {range === '6M' && <SixMonthView entries={entries} goals={goals} />}
    </div>
  );
}

function DayView({ entries, goals }: { entries: EntryRow[]; goals: ProfileGoals | null }) {
  const e = entries[0];
  if (!e) {
    return <p className="text-sm text-text-muted py-4">No entry for this day. Log workout, food, or sleep to see activity.</p>;
  }
  const wMins = workoutMins(e);
  const steps = e.steps ?? 0;
  const sleep = e.sleep_hours ?? 0;
  const water = e.water_liters ?? 0;
  const maxMins = Math.max(wMins, 1);
  const maxSteps = Math.max(steps, 1);
  const maxSleep = 12;
  return (
    <div className="space-y-3">
      <div className="text-xs font-medium text-text-muted">Activity breakdown</div>
      <div className="space-y-2">
        <div>
          <div className="flex justify-between text-xs mb-0.5">
            <span style={{ color: COLOR_WORKOUT }}>Workout + Cardio</span>
            <span>{wMins} min{goals?.goal_workout_mins_week != null && goals.goal_workout_mins_week > 0 ? ` / ${Math.round((goals.goal_workout_mins_week ?? 0) / 7)} daily` : ''}</span>
          </div>
          <div className="h-3 rounded-full bg-surface-2 overflow-hidden">
            <div className="h-full rounded-full bg-[#FF6B35]" style={{ width: `${Math.min(100, (wMins / 90) * 100)}%` }} />
          </div>
        </div>
        <div>
          <div className="flex justify-between text-xs mb-0.5">
            <span style={{ color: COLOR_FOOD }}>Steps</span>
            <span>{steps.toLocaleString()}{goals?.goal_steps_day ? ` / ${goals.goal_steps_day.toLocaleString()}` : ''}</span>
          </div>
          <div className="h-3 rounded-full bg-surface-2 overflow-hidden">
            <div className="h-full rounded-full bg-[#059669]" style={{ width: `${Math.min(100, (steps / (goals?.goal_steps_day ?? 10000)) * 100)}%` }} />
          </div>
        </div>
        <div>
          <div className="flex justify-between text-xs mb-0.5">
            <span style={{ color: COLOR_SLEEP }}>Sleep</span>
            <span>{sleep} hr{goals?.goal_sleep_hours_max ? ` / ${goals.goal_sleep_hours_min}–${goals.goal_sleep_hours_max} hr` : ''}</span>
          </div>
          <div className="h-3 rounded-full bg-surface-2 overflow-hidden">
            <div className="h-full rounded-full bg-[#2563eb]" style={{ width: `${Math.min(100, (sleep / maxSleep) * 100)}%` }} />
          </div>
        </div>
        <div>
          <div className="flex justify-between text-xs mb-0.5">
            <span className="text-amber-600">Water</span>
            <span>{water} L{goals?.goal_water_liters ? ` / ${goals.goal_water_liters} L` : ''}</span>
          </div>
          <div className="h-3 rounded-full bg-surface-2 overflow-hidden">
            <div className="h-full rounded-full bg-amber-500/80" style={{ width: `${Math.min(100, (water / (goals?.goal_water_liters ?? 3)) * 100)}%` }} />
          </div>
        </div>
      </div>
    </div>
  );
}

function WeekView({ entries, goals, from, to }: { entries: EntryRow[]; goals: ProfileGoals | null; from: string; to: string }) {
  const entriesByDate = new Map(entries.map((e) => [e.date, e]));
  const days: string[] = [];
  const d = new Date(from);
  const end = new Date(to);
  while (d <= end) {
    days.push(d.toISOString().slice(0, 10));
    d.setDate(d.getDate() + 1);
  }
  const goalMinsPerDay = (goals?.goal_workout_mins_week ?? 0) / 7;
  return (
    <div className="space-y-2">
      {days.map((date) => {
        const e = entriesByDate.get(date);
        const mins = e ? workoutMins(e) : 0;
        const steps = e?.steps ?? 0;
        const sleep = e?.sleep_hours ?? 0;
        const pctMins = goalMinsPerDay > 0 ? Math.min(100, (mins / goalMinsPerDay) * 100) : (mins > 0 ? 100 : 0);
        const pctSteps = (goals?.goal_steps_day ?? 10000) > 0 ? Math.min(100, (steps / (goals?.goal_steps_day ?? 10000)) * 100) : (steps > 0 ? 100 : 0);
        return (
          <div key={date} className="flex items-center gap-3 text-sm">
            <span className="text-text-muted w-20 shrink-0">
              {new Date(date + 'Z').toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' })}
            </span>
            <div className="flex-1 flex gap-1 items-center">
              <div className="flex-1 h-4 rounded bg-surface-2 overflow-hidden flex">
                <div className="h-full bg-[#FF6B35]" style={{ width: `${pctMins}%` }} title={`${mins} min`} />
                <div className="h-full bg-[#059669]" style={{ width: `${pctSteps}%` }} title={`${steps} steps`} />
                <div className="h-full bg-[#2563eb]" style={{ width: `${Math.min(100, (sleep / 10) * 100)}%` }} title={`${sleep} hr sleep`} />
              </div>
            </div>
            <span className="text-text-secondary text-xs w-16 text-right">{mins}m / {(steps / 1000).toFixed(1)}k / {sleep}h</span>
          </div>
        );
      })}
    </div>
  );
}

function MonthView({ entries, goals, monthOffset }: { entries: EntryRow[]; goals: ProfileGoals | null; monthOffset: number }) {
  const entriesByDate = new Map(entries.map((e) => [e.date, e]));
  const target = new Date();
  target.setMonth(target.getMonth() + monthOffset);
  const year = target.getFullYear();
  const month = target.getMonth();
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const startPad = firstDay.getDay();
  const daysInMonth = lastDay.getDate();
  const todayStr = new Date().toISOString().slice(0, 10);
  const goalMinsPerDay = (goals?.goal_workout_mins_week ?? 150) / 7;
  const goalSteps = goals?.goal_steps_day ?? 10000;
  const goalSleep = (Number(goals?.goal_sleep_hours_min ?? 7) + Number(goals?.goal_sleep_hours_max ?? 9)) / 2;

  const weeks: { date: string; day: number; isCurrentMonth: boolean }[][] = [];
  let week: { date: string; day: number; isCurrentMonth: boolean }[] = [];
  for (let i = 0; i < startPad; i++) {
    const d = new Date(year, month, 1 - (startPad - i));
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

  return (
    <>
      <div className="flex gap-4 items-center flex-wrap text-xs">
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-full" style={{ backgroundColor: COLOR_WORKOUT }} />
          Workout
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-full" style={{ backgroundColor: COLOR_FOOD }} />
          Food
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-full" style={{ backgroundColor: COLOR_SLEEP }} />
          Sleep
        </span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full border-collapse" style={{ tableLayout: 'fixed', minWidth: 280 }}>
          <thead>
            <tr>
              {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => (
                <th key={d} className="text-[10px] font-medium text-text-muted p-1 text-center">
                  {d}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {weeks.map((row, wi) => (
              <tr key={wi}>
                {row.map(({ date, day, isCurrentMonth }) => {
                  const e = entriesByDate.get(date);
                  const workout = e ? hasWorkout(e) : false;
                  const food = e ? hasFood(e) : false;
                  const sleep = e ? hasSleep(e) : false;
                  const mins = e ? workoutMins(e) : 0;
                  const steps = e?.steps ?? 0;
                  const sleepH = e?.sleep_hours ?? 0;
                  const pctMins = goalMinsPerDay > 0 ? Math.min(100, (mins / goalMinsPerDay) * 100) : (workout ? 100 : 0);
                  const pctSteps = goalSteps > 0 ? Math.min(100, (steps / goalSteps) * 100) : (steps > 0 ? 100 : 0);
                  const pctSleep = goalSleep > 0 ? Math.min(100, (sleepH / goalSleep) * 100) : (sleep ? 100 : 0);
                  const isToday = date === todayStr;
                  return (
                    <td key={date} className="p-0.5 align-top">
                      <div
                        className={`min-h-[52px] rounded-lg border p-1 ${
                          !isCurrentMonth ? 'bg-surface-2/30 border-transparent' : 'bg-surface-0 border-white/10'
                        } ${isToday ? 'ring-2 ring-primary-orange ring-offset-1' : ''}`}
                      >
                        <div className="text-[10px] font-medium text-text-muted mb-1">{day}</div>
                        <div className="flex gap-0.5 flex-wrap items-end">
                          {workout && (
                            <span
                              className="w-2 rounded-sm flex-shrink-0 bg-[#FF6B35]"
                              style={{ height: `${Math.max(4, pctMins * 0.2)}px` }}
                              title={`Workout ${mins} min`}
                            />
                          )}
                          {food && (
                            <span
                              className="w-2 rounded-sm flex-shrink-0 bg-[#059669]"
                              style={{ height: `${Math.max(4, (steps > 0 ? pctSteps : 50) * 0.2)}px` }}
                              title={steps > 0 ? `${steps} steps` : 'Food'}
                            />
                          )}
                          {sleep && (
                            <span
                              className="w-2 rounded-sm flex-shrink-0 bg-[#2563eb]"
                              style={{ height: `${Math.max(4, pctSleep * 0.2)}px` }}
                              title={`Sleep ${sleepH} hr`}
                            />
                          )}
                        </div>
                        {(workout || food || sleep) && (
                          <div className="text-[9px] text-text-muted mt-0.5 truncate">
                            {mins > 0 && `${mins}m `}
                            {steps > 0 && `${(steps / 1000).toFixed(0)}k `}
                            {sleepH > 0 && `${sleepH}h`}
                          </div>
                        )}
                      </div>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

function SixMonthView({ entries, goals }: { entries: EntryRow[]; goals: ProfileGoals | null }) {
  const byMonth = new Map<string, EntryRow[]>();
  entries.forEach((e) => {
    const month = e.date.slice(0, 7);
    if (!byMonth.has(month)) byMonth.set(month, []);
    byMonth.get(month)!.push(e);
  });
  const today = new Date();
  const months: { key: string; label: string }[] = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
    const key = d.toISOString().slice(0, 7);
    months.push({ key, label: d.toLocaleString('default', { month: 'short', year: '2-digit' }) });
  }
  const goalWorkoutMins = goals?.goal_workout_mins_week ?? 150;
  const goalSteps = goals?.goal_steps_day ?? 10000;

  return (
    <div className="space-y-3">
      {months.map(({ key, label: monthLabel }) => {
        const list = byMonth.get(key) ?? [];
        const totalMins = list.reduce((s, e) => s + workoutMins(e), 0);
        const stepEntries = list.filter((e) => (e.steps ?? 0) > 0);
        const stepCount = stepEntries.length;
        const avgStepsActual = stepCount ? stepEntries.reduce((s, e) => s + (e.steps ?? 0), 0) / stepCount : 0;
        const avgSleep = list.filter((e) => e.sleep_hours != null).length
          ? list.filter((e) => e.sleep_hours != null).reduce((s, e) => s + (e.sleep_hours ?? 0), 0) / list.filter((e) => e.sleep_hours != null).length
          : 0;
        const goalMinsMonth = goalWorkoutMins * 4;
        const pctMins = goalMinsMonth > 0 ? Math.min(100, (totalMins / goalMinsMonth) * 100) : 0;
        const pctSteps = goalSteps > 0 ? Math.min(100, (avgStepsActual / goalSteps) * 100) : 0;
        return (
          <div key={key} className="flex items-center gap-3 text-sm">
            <span className="text-text-muted w-14 shrink-0">{monthLabel}</span>
            <div className="flex-1 flex gap-1 h-6 rounded overflow-hidden bg-surface-2">
              <div className="h-full bg-[#FF6B35]" style={{ width: `${pctMins}%` }} title={`${totalMins} min workout`} />
              <div className="h-full bg-[#059669]" style={{ width: `${pctSteps}%` }} title={`${Math.round(avgStepsActual / 1000)}k avg steps`} />
              <div className="h-full bg-[#2563eb]" style={{ width: `${Math.min(100, (avgSleep / 10) * 100)}%` }} title={`${avgSleep.toFixed(1)} hr sleep`} />
            </div>
            <span className="text-text-secondary text-xs w-24 text-right shrink-0">
              {totalMins}m / {(avgStepsActual / 1000).toFixed(1)}k / {avgSleep.toFixed(1)}h
            </span>
          </div>
        );
      })}
    </div>
  );
}
