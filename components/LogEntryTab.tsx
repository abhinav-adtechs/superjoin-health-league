'use client';

import { useState, useEffect } from 'react';
import { Activity } from 'lucide-react';
import { apiUrl, getApiFetchOptions } from '@/lib/api';
import { CalendarHistogram } from './CalendarHistogram';
import type { Profile } from '@/lib/types';

type EntryRow = {
  date: string;
  workout_done?: boolean | null;
  workout_duration?: number | null;
  workout_types?: string[] | null;
  cardio_done?: boolean | null;
  cardio_duration?: number | null;
  cardio_type?: string | null;
  steps?: number | null;
};

function hasWorkout(e: EntryRow): boolean {
  return e.workout_done === true || e.cardio_done === true || (e.steps != null && Number(e.steps) > 0);
}

function label(s: string): string {
  return s.replace(/_/g, ' ');
}

export function LogEntryTab({ profile, onSuccess, refreshTrigger = 0 }: { profile: Profile; onSuccess: () => void; refreshTrigger?: number }) {
  const [workoutEntries, setWorkoutEntries] = useState<EntryRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const end = new Date();
    const start = new Date();
    start.setDate(start.getDate() - 60);
    const from = start.toISOString().slice(0, 10);
    const to = end.toISOString().slice(0, 10);
    fetch(apiUrl(`/api/entries/history?from=${from}&to=${to}`), getApiFetchOptions())
      .then((r) => r.json())
      .then((data) => {
        const list = Array.isArray(data) ? data : [];
        const withWorkout = list.filter(hasWorkout).sort((a, b) => b.date.localeCompare(a.date));
        if (!cancelled) setWorkoutEntries(withWorkout);
      })
      .catch(() => { if (!cancelled) setWorkoutEntries([]); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [refreshTrigger]);

  return (
    <div className="space-y-8 animate-fade-up">
      <div>
        <h2 className="text-lg font-semibold text-text-primary mb-1">Workout history</h2>
        <p className="text-sm text-text-secondary">
          Calendar shows <strong>Workout</strong>, <strong>Food</strong>, and <strong>Sleep</strong> — the three pillars. Use <strong>New Entry</strong> in the header to log.
        </p>
      </div>

      <div className="glass-card p-5">
        <CalendarHistogram refreshTrigger={refreshTrigger} />
      </div>

      <div className="glass-card p-5">
        <h3 className="font-medium text-text-primary flex items-center gap-2 mb-4">
          <Activity className="w-4 h-4 text-[#FF6B35]" />
          Workout days
        </h3>
        {loading ? (
          <div className="animate-pulse text-text-muted text-sm">Loading…</div>
        ) : workoutEntries.length === 0 ? (
          <p className="text-sm text-text-muted">No workout or cardio logged in the last 60 days.</p>
        ) : (
          <ul className="space-y-2">
            {workoutEntries.slice(0, 30).map((e) => (
              <li key={e.date} className="flex items-center justify-between text-sm py-2 border-b border-white/10 last:border-0">
                <span className="text-text-primary font-medium">
                  {new Date(e.date + 'Z').toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}
                </span>
                <span className="text-text-secondary">
                  {e.workout_done === true && (
                    <>Workout {e.workout_duration ? `${e.workout_duration} min` : ''} {e.workout_types?.length ? `(${e.workout_types.map(label).join(', ')})` : ''}</>
                  )}
                  {e.cardio_done === true && (
                    <>Cardio {e.cardio_duration ? `${e.cardio_duration} min` : ''} {e.cardio_type ? label(e.cardio_type) : ''}</>
                  )}
                  {!e.workout_done && !e.cardio_done && e.steps != null && Number(e.steps) > 0 && (
                    <>{e.steps} steps</>
                  )}
                </span>
              </li>
            ))}
          </ul>
        )}
        {workoutEntries.length > 30 && (
          <p className="text-xs text-text-muted mt-2">Showing last 30 workout days.</p>
        )}
      </div>
    </div>
  );
}
