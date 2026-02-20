'use client';

import { useState, useEffect } from 'react';
import { apiUrl, getApiFetchOptions } from '@/lib/api';

type EntryRow = {
  date: string;
  workout_done?: boolean | null;
  cardio_done?: boolean | null;
  steps?: number | null;
  water_liters?: number | null;
  home_cooked_meals?: number | null;
  protein_meal?: boolean | null;
  junk_food?: boolean | null;
  alcohol?: string | null;
  sleep_hours?: number | null;
  sleep_quality?: number | null;
};

function hasWorkout(e: EntryRow): boolean {
  return e.workout_done === true || e.cardio_done === true || (e.steps != null && Number(e.steps) > 0);
}
function hasFood(e: EntryRow): boolean {
  return (
    (e.water_liters != null && Number(e.water_liters) > 0) ||
    (e.home_cooked_meals != null) ||
    e.protein_meal != null ||
    e.junk_food != null ||
    e.alcohol != null
  );
}
function hasSleep(e: EntryRow): boolean {
  return e.sleep_hours != null || e.sleep_quality != null;
}

export function CalendarHistogram({ refreshTrigger = 0 }: { refreshTrigger?: number }) {
  const [entries, setEntries] = useState<EntryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [monthOffset, setMonthOffset] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    const today = new Date();
    const start = new Date(today.getFullYear(), today.getMonth() + monthOffset, 1);
    const end = new Date(today.getFullYear(), today.getMonth() + monthOffset + 1, 0);
    const from = start.toISOString().slice(0, 10);
    const to = end.toISOString().slice(0, 10);
    fetch(apiUrl(`/api/entries/history?from=${from}&to=${to}`), getApiFetchOptions())
      .then((r) => r.json())
      .then((data) => {
        if (!cancelled) setEntries(Array.isArray(data) ? data : []);
      })
      .catch(() => { if (!cancelled) setEntries([]); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [monthOffset, refreshTrigger]);

  const entriesByDate = new Map<string, EntryRow>();
  entries.forEach((e) => entriesByDate.set(e.date, e));

  const target = new Date();
  target.setMonth(target.getMonth() + monthOffset);
  const year = target.getFullYear();
  const month = target.getMonth();
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const startPad = firstDay.getDay();
  const daysInMonth = lastDay.getDate();
  const todayStr = new Date().toISOString().slice(0, 10);

  const weeks: { date: string; day: number; isCurrentMonth: boolean }[][] = [];
  let week: { date: string; day: number; isCurrentMonth: boolean }[] = [];
  for (let i = 0; i < startPad; i++) {
    const d = new Date(year, month, 1 - (startPad - i));
    week.push({
      date: d.toISOString().slice(0, 10),
      day: d.getDate(),
      isCurrentMonth: false,
    });
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
      week.push({
        date: d.toISOString().slice(0, 10),
        day: d.getDate(),
        isCurrentMonth: false,
      });
    }
    weeks.push(week);
  }

  if (loading) {
    return <div className="animate-pulse h-64 rounded-xl bg-surface-2/50" />;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-medium text-text-primary">
          {firstDay.toLocaleString('default', { month: 'long', year: 'numeric' })}
        </h3>
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
      </div>

      <div className="flex gap-4 items-center flex-wrap text-xs">
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-full bg-[#FF6B35]" />
          Workout
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-full bg-[#059669]" />
          Food
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-full bg-[#2563eb]" />
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
                  const isToday = date === todayStr;
                  return (
                    <td key={date} className="p-0.5 align-top">
                      <div
                        className={`min-h-[52px] rounded-lg border p-1 ${
                          !isCurrentMonth ? 'bg-surface-2/30 border-transparent' : 'bg-surface-0 border-white/10'
                        } ${isToday ? 'ring-2 ring-primary-orange ring-offset-1' : ''}`}
                      >
                        <div className="text-[10px] font-medium text-text-muted mb-1">{day}</div>
                        <div className="flex gap-0.5 flex-wrap">
                          {workout && (
                            <span
                              className="w-2 h-2 rounded-full flex-shrink-0 bg-[#FF6B35]"
                              title="Workout"
                            />
                          )}
                          {food && (
                            <span className="w-2 h-2 rounded-full flex-shrink-0 bg-[#059669]" title="Food" />
                          )}
                          {sleep && (
                            <span className="w-2 h-2 rounded-full flex-shrink-0 bg-[#2563eb]" title="Sleep" />
                          )}
                        </div>
                      </div>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
